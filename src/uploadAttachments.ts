import { SendMailOptions } from 'nodemailer';
import { S3 } from 'aws-sdk';
import fs from 'fs';
import { S3Attachment, AttachmentSendgrid,NodemailerAttachment  } from '../types/index';
export const uploadAttachments = async (attachments: SendMailOptions["attachments"] | AttachmentSendgrid[] = [], s3: S3, bucketName: string, clientType:string = 'Nodemailer') => {
    const uploadedAttachmentsArray: S3Attachment[] = [];
    const regex = /^(http:\/\/)|^(https:\/\/)$/

    for (let i = 0; i < attachments?.length; i++) {
        let isSgEmail = false;
        let attachment = attachments[i] || {};
        const params: S3.Types.PutObjectRequest = { Bucket: bucketName, Key: `${Date.now()}` };
        if(clientType === 'Nodemailer'){
            attachment = attachment as NodemailerAttachment;
            if (typeof attachment.path === 'string') {
                const isUrl = attachment.path.match(regex);
                if(!attachment.path.includes("base64")){
                    if(attachment.filename){
                        params.Key = attachment.filename;
                    } else{
                        params.Key = attachment.path.split("/")[-1];
                    }
                }
                if (!isUrl) {
                    const path = attachment.path.split(/\ /).join('\ ');
                    const data = fs.readFileSync(path);
                    params.Body = data;
                }
            } else if (attachment.content) {
                params.Key = Date.now().toString() + attachment.filename as string;
                params.Body = attachment.content;
                if (attachment.contentType) {
                    params.ContentType = attachment.contentType;
                }
                if (attachment.encoding) {
                    params.ContentEncoding = attachment.encoding
                }
            } else if (attachment.raw) {
                params.Key = Date.now().toString();
                params.Body = attachment.raw;
            }
        } else {
            if(typeof attachment.content === "string" && "type" in attachment){
                isSgEmail = true;
                const content = attachment.content;
                // const file = `data:${attachment.type};base64,${content}`;
                params.Key = Date.now().toString();
                const data = Buffer.from(content, 'base64');
                params.Body = data;
            }
        }

        try{
            const data = await s3.putObject(params).promise();
            let storedAttachment: S3Attachment = { path: `https://${bucketName}.s3.amazonaws.com/${params.Key}`};
            if(isSgEmail){
                storedAttachment.filename = params.Key;
            }
            if("type" in attachment){
                storedAttachment.type = attachment.type;
            }
            uploadedAttachmentsArray.push(storedAttachment)
        }catch(err:any){
            if (err) {
                throw err;
            }
        }

    }
    return uploadedAttachmentsArray;
}