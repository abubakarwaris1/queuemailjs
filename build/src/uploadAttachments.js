"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAttachments = void 0;
const fs_1 = __importDefault(require("fs"));
const uploadAttachments = async (attachments = [], s3, bucketName, clientType = 'Nodemailer') => {
    const uploadedAttachmentsArray = [];
    const regex = /^(http:\/\/)|^(https:\/\/)$/;
    for (let i = 0; i < attachments?.length; i++) {
        let attachment = attachments[i] || {};
        const params = { Bucket: bucketName, Key: `${Date.now()}`, Body: null, };
        if (clientType === 'Nodemailer') {
            attachment = attachment;
            if (typeof attachment.path === 'string') {
                const isUrl = attachment.path.match(regex);
                if (!isUrl) {
                    const path = attachment.path.split(/\ /).join('\ ');
                    const data = fs_1.default.readFileSync(path);
                    params.Body = data;
                }
            }
            else if (attachment.content) {
                params.Body = attachment.content;
                if (attachment.contentType) {
                    params.ContentType = attachment.contentType;
                }
                if (attachment.encoding) {
                    params.ContentEncoding = attachment.encoding;
                }
            }
            else if (attachment.raw) {
                params.Body = attachment.raw;
            }
        }
        else {
            console.log('in else sendgrid attachment....');
            const content = attachment.content;
            const data = Buffer.from(content, 'base64');
            params.Body = data;
        }
        try {
            console.log('in try....');
            const data = await s3.upload(params).promise();
            let storedAttachment = { path: data.Location };
            if (attachment.filename) {
                storedAttachment.filename = attachment.filename;
            }
            if ("type" in attachment) {
                storedAttachment.type = attachment.type;
            }
            if ("disposition" in attachment) {
                storedAttachment.disposition = attachment.disposition;
            }
            console.log('after try....');
            uploadedAttachmentsArray.push(storedAttachment);
        }
        catch (err) {
            if (err) {
                console.log('error', err.message);
            }
        }
    }
    return uploadedAttachmentsArray;
};
exports.uploadAttachments = uploadAttachments;
