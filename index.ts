import {
    Config
} from './types/index';
import nodemailer,{Transporter, SendMailOptions} from 'nodemailer';
import AWS, {SQS, S3} from 'aws-sdk';
import sgMail, { MailDataRequired } from '@sendgrid/mail';
import axios from 'axios';
import 'dotenv/config'

import { uploadAttachments } from './src/uploadAttachments';

const params = {
    AttributeNames: [
       "SentTimestamp"
    ],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: [
       "All"
    ],
    QueueUrl: '',
    VisibilityTimeout: 20,
    WaitTimeSeconds: 0
};

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
sgMail.setApiKey(SENDGRID_API_KEY);
var credentials = new AWS.SharedIniFileCredentials({profile: 'mohsin'});
AWS.config.credentials = credentials;
let isConsumerRunning = false;

export class JsClient {
   private transporter?: Transporter;
   private sqs: SQS;
   private queueUrl: string;
   private s3: S3;
   private bucketName: string = '';
    constructor (config:Config){
        AWS.config.update({region: config.awsConfig.region});
        this.queueUrl = config.awsConfig.sqsQueueUrl;
        this.sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        this.s3 = new AWS.S3();
        if(config.awsConfig.bucketName) {
            this.bucketName = config.awsConfig.bucketName;
        }
        if(config.clientType === 'Nodemailer'){
            if(config.nodemailerConfig){
                this.transporter = nodemailer.createTransport(config.nodemailerConfig);
            } else {
                throw 'nodemailer config is not provided';
            }
        } else if(config.clientType === 'Sendgrid') {
            // do sendgrid config
        } else {
            throw "clientType is not provided";
        }
    }

    public async sendEmail(sendMailOptions:SendMailOptions | MailDataRequired) {
            if(this.transporter){
                if(sendMailOptions.attachments){
                    if(!this.bucketName){
                        throw 'bucketname is required to store attachments.'
                    }
                   const uploadedAttachment =await uploadAttachments(sendMailOptions.attachments, this.s3, this.bucketName);
                   sendMailOptions.attachments = uploadedAttachment;
                }
            } else {
                if(sendMailOptions.attachments){
                    const uploadedAttachment =await uploadAttachments(sendMailOptions.attachments, this.s3, this.bucketName, 'Sendgrid');
                    sendMailOptions.attachments = uploadedAttachment;
                }
            }
            

            this.sqs.sendMessage({
                QueueUrl: this.queueUrl,
                MessageBody: JSON.stringify(sendMailOptions),
                MessageGroupId: "1"
            },(err:any, data:any) => {
                if(err){
                    console.log('Error', err);
                    throw err;
                } else {
                    if(!isConsumerRunning){
                        isConsumerRunning = true;
                        this.receiveMessage();
                    }
                    return data;
                }
            })
            
    }

    private receiveMessage() {
        this.sqs.receiveMessage({...params, QueueUrl: this.queueUrl}, async (err:any, result:SQS.ReceiveMessageResult) => {
            const messages = result.Messages;
            if(messages?.length){
                for(let i = 0; i< messages.length; i++){
                    const message = messages[i];
                    let deleteHandle = message.ReceiptHandle;
                    let body = null;
                    if(message.Body){
                        body = JSON.parse(message.Body);
                        if(body.disposition){
                            const response = await axios.get(body.path,  { responseType: 'arraybuffer' })
                            const buffer = Buffer.from(response.data, "utf-8");
                            body.content = buffer.toString('base64');
                            delete body.path;
                        }
                    }
                    if(this.transporter){
                        this.transporter?.sendMail(body, (err,info) =>{
                            if(err){
                                console.log('err', err);
                            } else{
                                if(deleteHandle){
                                    this.sqs.deleteMessage({QueueUrl: this.queueUrl, ReceiptHandle: deleteHandle}, (err, data) =>{
                                        console.log('message deleted successfully');
                                    })
                                }
                                
                            }
                        });
                    } else {
                        const result = await sgMail.send(body);
                    }
                    

                }
                this.receiveMessage()
            } else {
                isConsumerRunning = false;
            }
        })
    }

    public async send(sendMailOptions:SendMailOptions){
        this.transporter?.sendMail(sendMailOptions, (err,info) =>{
            if(err){
                console.log('err', err);
            } else{
                console.log('some')
                
            }
        });
    }

}
