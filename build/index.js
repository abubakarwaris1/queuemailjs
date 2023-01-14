"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsClient = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const uploadAttachments_1 = require("./src/uploadAttachments");
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
const SENDGRID_API_KEY = "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";
mail_1.default.setApiKey(SENDGRID_API_KEY);
var credentials = new aws_sdk_1.default.SharedIniFileCredentials({ profile: 'mohsin' });
aws_sdk_1.default.config.credentials = credentials;
let isConsumerRunning = false;
class JsClient {
    transporter;
    sqs;
    queueUrl;
    s3;
    bucketName = '';
    constructor(config) {
        aws_sdk_1.default.config.update({ region: config.awsConfig.region });
        this.queueUrl = config.awsConfig.sqsQueueUrl;
        this.sqs = new aws_sdk_1.default.SQS({ apiVersion: '2012-11-05' });
        this.s3 = new aws_sdk_1.default.S3();
        if (config.awsConfig.bucketName) {
            this.bucketName = config.awsConfig.bucketName;
        }
        if (config.clientType === 'Nodemailer') {
            if (config.nodemailerConfig) {
                this.transporter = nodemailer_1.default.createTransport(config.nodemailerConfig);
            }
            else {
                throw 'nodemailer config is not provided';
            }
        }
        else if (config.clientType === 'Sendgrid') {
            // do sendgrid config
        }
        else {
            throw "clientType is not provided";
        }
    }
    async sendEmail(sendMailOptions) {
        if (this.transporter) {
            if (sendMailOptions.attachments) {
                if (!this.bucketName) {
                    throw 'bucketname is required to store attachments.';
                }
                const uploadedAttachment = await (0, uploadAttachments_1.uploadAttachments)(sendMailOptions.attachments, this.s3, this.bucketName);
                sendMailOptions.attachments = uploadedAttachment;
            }
        }
        else {
            console.log('in else');
            if (sendMailOptions.attachments) {
                const uploadedAttachment = await (0, uploadAttachments_1.uploadAttachments)(sendMailOptions.attachments, this.s3, this.bucketName, 'Sendgrid');
                console.log('after attach', uploadedAttachment);
                sendMailOptions.attachments = uploadedAttachment;
            }
        }
        this.sqs.sendMessage({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify(sendMailOptions),
            MessageGroupId: "1"
        }, (err, data) => {
            if (err) {
                console.log('Error', err);
                throw err;
            }
            else {
                if (!isConsumerRunning) {
                    isConsumerRunning = true;
                    this.receiveMessage();
                }
                return data;
            }
        });
    }
    receiveMessage() {
        console.log('in recive....');
        this.sqs.receiveMessage({ ...params, QueueUrl: this.queueUrl }, async (err, result) => {
            const messages = result.Messages;
            if (messages?.length) {
                for (let i = 0; i < messages.length; i++) {
                    const message = messages[i];
                    let deleteHandle = message.ReceiptHandle;
                    let body = null;
                    if (message.Body) {
                        body = JSON.parse(message.Body);
                        console.log('disposition', body);
                        if (body.disposition) {
                            console.log('in axios...');
                            const response = await axios_1.default.get(body.path, { responseType: 'arraybuffer' });
                            const buffer = Buffer.from(response.data, "utf-8");
                            body.content = buffer.toString('base64');
                            delete body.path;
                            console.log('done axios....');
                        }
                    }
                    if (this.transporter) {
                        this.transporter?.sendMail(body, (err, info) => {
                            if (err) {
                                console.log('err', err);
                            }
                            else {
                                if (deleteHandle) {
                                    this.sqs.deleteMessage({ QueueUrl: this.queueUrl, ReceiptHandle: deleteHandle }, (err, data) => {
                                        console.log('message deleted successfully');
                                    });
                                }
                            }
                        });
                    }
                    else {
                        console.log('in sgMail....');
                        const result = await mail_1.default.send(body);
                        console.log('result', result);
                    }
                }
                this.receiveMessage();
            }
            else {
                isConsumerRunning = false;
            }
        });
    }
    async send(sendMailOptions) {
        this.transporter?.sendMail(sendMailOptions, (err, info) => {
            if (err) {
                console.log('err', err);
            }
            else {
                console.log('some');
            }
        });
    }
}
exports.JsClient = JsClient;
const client = new JsClient({
    clientType: 'Sendgrid',
    // nodemailerConfig: {
    //     host: "smtp.gmail.com",
    //     port: 587,
    //     secure: false,
    //     auth:{
    //         user: 'abubakar.waris@techverx.com',
    //         pass: 'M1k2b3t4p5d6@'
    //     }
    // },
    awsConfig: {
        region: 'ap-northeast-1',
        sqsQueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/269446268656/myEmailQueue.fifo',
        bucketName: 'attachments-store'
    }
});
let path = 'C:/Users/Abu Bakar/Documents/Work/js-email-client/abc.jpg';
path = path.split(/\ /).join('\ ');
const attachment = fs_1.default.readFileSync(path).toString("base64");
for (let i = 10; i < 15; i++) {
    client.sendEmail({
        from: 'abubakar.waris@techverx.com',
        to: 'abubakarwaris@gmail.com',
        subject: 'test email',
        html: `<b>Hello World ${i}</b>`,
        attachments: [{
                content: attachment,
                path: 'C:/Users/Abu Bakar/Documents/Work/js-email-client/abc.jpg',
            }]
    });
}
// client.send({
//     from:'abubakar.waris@techverx.com',
//     to: 'abubakarwaris@gmail.com',
//     subject:'test email',
//     text:' somtehdfsdkasdfsd',
//     html: `<b>Hello World</b>`,
//     attachments: [{
//         filename:'abc.jpg',
//         path: 'https://attachments-store.s3.ap-northeast-1.amazonaws.com/1672746343467.jpg',
//         contentType: 'image/jpg'
//     }]
// })
