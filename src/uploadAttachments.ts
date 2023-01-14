import { SendMailOptions } from 'nodemailer';
import { S3 } from 'aws-sdk';
import fs from 'fs';
import { Attachment, SendData, S3Attachment, AttachmentSendgrid,NodemailerAttachment  } from '../types/index';
export const uploadAttachments = async (attachments: SendMailOptions["attachments"] | AttachmentSendgrid[] = [], s3: S3, bucketName: string, clientType:string = 'Nodemailer') => {
    const uploadedAttachmentsArray: S3Attachment[] = [];
    const regex = /^(http:\/\/)|^(https:\/\/)$/

    for (let i = 0; i < attachments?.length; i++) {
        let attachment = attachments[i] || {};
        const params: Attachment = { Bucket: bucketName, Key: `${Date.now()}`, Body: null, };
        if(clientType === 'Nodemailer'){
            attachment = attachment as NodemailerAttachment;
            if (typeof attachment.path === 'string') {
                const isUrl = attachment.path.match(regex);
                if (!isUrl) {
                    const path = attachment.path.split(/\ /).join('\ ');
                    const data = fs.readFileSync(path);
                    params.Body = data;
    
                }
            } else if (attachment.content) {
                params.Body = attachment.content;
                if (attachment.contentType) {
                    params.ContentType = attachment.contentType;
                }
                if (attachment.encoding) {
                    params.ContentEncoding = attachment.encoding
                }
            } else if (attachment.raw) {
                params.Body = attachment.raw;
            }
        } else {
            console.log('in else sendgrid attachment....')
            const content = attachment.content as string;
            const data = Buffer.from(content, 'base64');
            params.Body = data;
        }

        try{
            console.log('in try....')
            const data: SendData = await s3.upload(params).promise();
            let storedAttachment: S3Attachment = { path: data.Location};
            if (attachment.filename) {
                storedAttachment.filename = attachment.filename
            }
            if("type" in attachment){
                storedAttachment.type = attachment.type;
            }
            if("disposition" in attachment){
                storedAttachment.disposition = attachment.disposition;
            }
            console.log('after try....')
            uploadedAttachmentsArray.push(storedAttachment)
        }catch(err:any){
            if (err) {
                console.log('error', err.message);
            }
        }

    }
    return uploadedAttachmentsArray;
}