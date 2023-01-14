import {
    Config
} from './types/index';
import nodemailer,{Transporter, SendMailOptions} from 'nodemailer';
import AWS, {SQS, S3} from 'aws-sdk';
import sgMail, { MailService, MailDataRequired } from '@sendgrid/mail';
import axios from 'axios';
import fs from 'fs';

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

const SENDGRID_API_KEY = "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";
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
                console.log('in else')
                if(sendMailOptions.attachments){
                    const uploadedAttachment =await uploadAttachments(sendMailOptions.attachments, this.s3, this.bucketName, 'Sendgrid');
                    console.log('after attach',uploadedAttachment)
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
        console.log('in recive....')
        this.sqs.receiveMessage({...params, QueueUrl: this.queueUrl}, async (err:any, result:SQS.ReceiveMessageResult) => {
            const messages = result.Messages;
            if(messages?.length){
                for(let i = 0; i< messages.length; i++){
                    const message = messages[i];
                    let deleteHandle = message.ReceiptHandle;
                    let body = null;
                    if(message.Body){
                        body = JSON.parse(message.Body);
                        console.log('disposition', body);
                        if(body.disposition){
                            console.log('in axios...')
                            const response = await axios.get(body.path,  { responseType: 'arraybuffer' })
                            const buffer = Buffer.from(response.data, "utf-8");
                            body.content = buffer.toString('base64');
                            delete body.path;
                            console.log('done axios....')
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
                        console.log('in sgMail....')
                        const result = await sgMail.send(body);
                        console.log('result', result)
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


const client =  new JsClient({
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
    awsConfig:{
        region: 'ap-northeast-1',
        sqsQueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/269446268656/myEmailQueue.fifo',
        bucketName: 'attachments-store'
    }
});
let path = '../abc.jpg'
path = path.split(/\ /).join('\ ');
const attachment = fs.readFileSync(path).toString("base64");
// for(let i = 10; i <15;i++){
    client.sendEmail({
        from:'abubakar.waris@techverx.com',
        to: 'abubakarwaris@gmail.com',
        subject:'test email',
        html: `<b>Hello World</b>`,
        attachments: [{
            content:attachment,
            filename: 'abc.jpg',
            type:'image/jpg',
            disposition: 'attachment',
            // content_id: 'my_text'
            // path: 'C:/Users/Abu Bakar/Documents/Work/js-email-client/abc.jpg',
        }]
    });
// }

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
