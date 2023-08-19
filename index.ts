import { Config } from "./types/index";
import nodemailer, { Transporter } from "nodemailer";
import AWS, { SQS, S3 } from "aws-sdk";
import sgMail from "@sendgrid/mail";
import axios from "axios";
import { promisify } from "util";
import {
  AttachmentSendgrid,
  NodemailerOptions,
  SendgridOptions,
} from "./types/index";
import { uploadAttachments } from "./src/uploadAttachments";

const params = {
  AttributeNames: ["SentTimestamp"],
  MaxNumberOfMessages: 10,
  MessageAttributeNames: ["All"],
  QueueUrl: "",
  VisibilityTimeout: 20,
  WaitTimeSeconds: 0,
};

let isConsumerRunning = false;
let isIntervalSet = false;

class JsClient {
  private transporter?: Transporter;
  private sqs: SQS;
  private queueUrl: string;
  private s3: S3;
  private bucketName: string = "";
  private repeatFrequency: number = 5 * 60 * 1000;
  private interval: NodeJS.Timer | null = null;
  /**
   * Creates a new instance of the JsClient class.
   * @param {Config} config - The configuration object to initialize assets..
   */
  constructor(config: Config) {
    AWS.config.update({ region: config.awsConfig.region });
    this.queueUrl = config.awsConfig.sqsQueueUrl;
    this.sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
    this.s3 = new AWS.S3();
    if (config.awsConfig.bucketName) {
      this.bucketName = config.awsConfig.bucketName;
    }
    if (config.repeatFrequency) {
      this.repeatFrequency = config.repeatFrequency;
    }
    if (config.clientType === "Nodemailer") {
      if (config.nodemailerConfig) {
        this.transporter = nodemailer.createTransport(config.nodemailerConfig);
      } else {
        throw "nodemailer config is not provided";
      }
    } else if (config.clientType === "Sendgrid") {
      if (config.sgApiKey) {
        sgMail.setApiKey(config.sgApiKey);
      } else {
        throw "Please provide Sendgrid api key.";
      }
    } else {
      throw "clientType is not provided";
    }
  }
  /**
   * Sends an email using the configured email transporter and message options.
   * @param {NodemailerOptions | SendgridOptions} sendMailOptions - The options for sending the email, including attachments.
   * @returns {Promise<SQS.Types.SendMessageResult>} A promise that resolves with the SQS message sending result.
   * @throws {string | Error} Throws an error if required parameters are missing or if there's an issue sending the email.
   */
  public async sendEmail(
    sendMailOptions: NodemailerOptions | SendgridOptions
  ): Promise<SQS.Types.SendMessageResult> {
    // Check if the transporter is available
    if (this.transporter) {
      // Handle attachments if provided
      if (sendMailOptions.attachments) {
        // Check if the bucket name is required to store attachments
        if (!this.bucketName) {
          throw "bucketname is required to store attachments.";
        }
        // Upload attachments and update sendMailOptions
        const uploadedAttachment = await uploadAttachments(
          sendMailOptions.attachments,
          this.s3,
          this.bucketName
        );
        sendMailOptions.attachments = uploadedAttachment;
      }
    } else {
      // Handle attachments if provided
      if (sendMailOptions.attachments) {
        const uploadedAttachment = await uploadAttachments(
          sendMailOptions.attachments,
          this.s3,
          this.bucketName,
          "Sendgrid"
        );
        sendMailOptions.attachments = uploadedAttachment;
      }
    }

    return new Promise((resolve, reject) => {
      this.sqs.sendMessage(
        {
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(sendMailOptions),
        },
        (err: any, data: SQS.Types.SendMessageResult) => {
          if (err) {
            reject(err); // Reject the promise with the error
          } else {
            resolve(data); // Resolve the promise with the result
          }
        }
      );
    });
  }

  /**
   * Private function for receiving and processing messages from an SQS queue.
   * This function continuously polls the queue for messages, processes each message,
   * and deletes the processed messages from the queue.
   * @private
   */
  private receiveMessage() {
    console.log("****CONSUMER STARTED****");
    if (isConsumerRunning) {
      console.log("****SHUTTING DOWN. CONSUMER ALREADY RUNNING****");
      return;
    }

    isConsumerRunning = true;
    // Poll the SQS queue for messages
    this.sqs.receiveMessage(
      { ...params, QueueUrl: this.queueUrl },
      async (err: any, result: SQS.ReceiveMessageResult) => {
        // Check if there are any messages to process
        const messages = result.Messages;
        console.log("**** total messages ****", messages?.length);
        if (messages?.length) {
          // Process each received message
          for (let i = 0; i < messages.length; i++) {
            console.log("*** processing task at index ***", i);
            const message = messages[i];
            let deleteHandle = message.ReceiptHandle;
            let body = null;

            // Parse the message body (if available)
            if (message.Body) {
              body = JSON.parse(message.Body);

              // Handle special disposition (content download) case
              if (body.disposition) {
                // Download content from the specified path and convert to base64
                const response = await axios.get(body.path, {
                  responseType: "arraybuffer",
                });
                const buffer = Buffer.from(response.data, "utf-8");
                body.content = buffer.toString("base64");
                delete body.path;
              }
            }

            // Handle message attachments
            if (body?.attachments.length > 0 && body?.attachments[0].filename) {
              const attachments: AttachmentSendgrid[] = [];
              for (const attachment of body.attachments) {
                // Download attachment content and convert to base64
                const response = await axios(attachment.path, {
                  responseType: "arraybuffer",
                });
                const base64String = Buffer.from(response.data).toString(
                  "base64"
                );
                attachments.push({
                  content: base64String,
                  filename: attachment.filename,
                  type: attachment.type,
                });
              }
              body.attachments = attachments;
            }
            try {
              if (this.transporter) {
                // Send the email using the specified transporter (if available)
                const sendMailAsync = promisify(this.transporter.sendMail).bind(
                  this.transporter
                );
                await sendMailAsync(body);
              } else {
                // Send the email using the SendGrid API (if transporter is not available)
                await sgMail.send(body);
              }
              const result = await new Promise((resolve, reject) => {
                if (deleteHandle) {
                  this.sqs.deleteMessage(
                    { QueueUrl: this.queueUrl, ReceiptHandle: deleteHandle },
                    (err, data) => {
                      if (err) {
                        reject(err);
                      }
                      // console.log("Task processed and deleted successfully");
                      resolve("Task processed and deleted successfully");
                    }
                  );
                }
              });
              console.log(result);
            } catch (error) {
              throw error;
              continue;
            }
          }
        }
        isConsumerRunning = false;
        console.log("****CONSUMER COMPLETED****");
      }
    );
  }

  /**
   * Start the message consumer to periodically receive messages.
   */
  public startConsumer(): void {
    // Check if the consumer has already been initiated
    if (!isIntervalSet) {
      // Mark the consumer as initiated
      isIntervalSet = true;

      // Set up an interval to call the 'receiveMessage' method at the specified repeat frequency
      this.interval = setInterval(
        this.receiveMessage.bind(this),
        this.repeatFrequency
      );

      // Log a message indicating successful initiation
      console.log("****CONSUMER INITIATED****");
    } else {
      // Log a message indicating that the consumer is already initiated
      console.log("****CONSUMER IS ALREADY INITIATED****");
    }
  }
  /**
   * Stop the message consumer from receiving messages.
   */
  public stopConsumer(): void {
    // Check if the interval is set (i.e., if the consumer is running)
    if (this.interval) {
      // Clear the interval to stop the consumer
      clearInterval(this.interval);

      // Set the interval reference to null, indicating the consumer is stopped
      this.interval = null;
      isIntervalSet = false;
      console.log("****CONSUMER TERMINATED****");
    } else {
      // Log a message indicating that there is no consumer running to stop
      console.log("***NO CONSUMER RUNNING***");
    }
  }
}

export { JsClient, NodemailerOptions, SendgridOptions };
