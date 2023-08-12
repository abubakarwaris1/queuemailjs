import { SendMailOptions } from 'nodemailer';
import { S3 } from 'aws-sdk';
import fs from 'fs';
import { S3Attachment, AttachmentSendgrid,NodemailerAttachment  } from '../types/index';
/**
 * Uploads email attachments to an S3 bucket.
 * @param {SendMailOptions["attachments"] | AttachmentSendgrid[]} attachments - An array of email attachments.
 * @param {S3} s3 - An instance of the AWS S3 service.
 * @param {string} bucketName - The name of the S3 bucket where attachments will be stored.
 * @param {string} clientType - The type of email client ('Nodemailer' or 'Sendgrid') for which the attachments are being uploaded.
 * @returns {Promise<S3Attachment[]>} A promise that resolves with an array of uploaded attachment information.
 * @throws {Error} Throws an error if there's an issue with S3 upload.
 */
export const uploadAttachments = async (
    attachments: SendMailOptions["attachments"] | AttachmentSendgrid[] = [],
    s3: S3,
    bucketName: string,
    clientType: string = 'Nodemailer'
): Promise<S3Attachment[]> => {
    // Initialize an array to hold uploaded attachment information
    const uploadedAttachmentsArray: S3Attachment[] = [];

    // Regular expression to check if the attachment path is an HTTP(s) URL
    const regex = /^(http:\/\/)|^(https:\/\/)$/;

    // Loop through each attachment in the provided array
    for (let i = 0; i < attachments?.length; i++) {
        let isSgEmail = false;
        let attachment = attachments[i] || {};
        
        // Initialize parameters for S3 upload
        const params: S3.Types.PutObjectRequest = { Bucket: bucketName, Key: `${Date.now()}` };
        
        // Handle attachments for Nodemailer client
        if (clientType === 'Nodemailer') {
            attachment = attachment as NodemailerAttachment;

            // Check if the attachment path is a string (file path or URL)
            if (typeof attachment.path === 'string') {
                const isUrl = attachment.path.match(regex);

                // Check if the attachment path contains "base64"
                if (!attachment.path.includes("base64")) {
                    // If attachment has a filename, use it as the key; otherwise, use the last part of the path
                    if (attachment.filename) {
                        params.Key = attachment.filename;
                    } else {
                        params.Key = attachment.path.split("/").pop() || params.Key;
                    }
                }

                // If the attachment path is not a URL, read the file and set it as the Body for S3
                if (!isUrl) {
                    const path = attachment.path.split(/\ /).join('\ ');
                    const data = fs.readFileSync(path);
                    params.Body = data;
                }
            } else if (attachment.content) {
                // Handle attachments with content (base64)
                params.Key = Date.now().toString() + (attachment.filename || "");
                params.Body = attachment.content;
                if (attachment.contentType) {
                    params.ContentType = attachment.contentType;
                }
                if (attachment.encoding) {
                    params.ContentEncoding = attachment.encoding;
                }
            } else if (attachment.raw) {
                // Handle raw attachments
                params.Key = Date.now().toString();
                params.Body = attachment.raw;
            }
        } else {
            // Handle attachments for Sendgrid client
            if (typeof attachment.content === "string" && "type" in attachment) {
                isSgEmail = true;
                const content = attachment.content;
                params.Key = Date.now().toString();
                const data = Buffer.from(content, 'base64');
                params.Body = data;
            }
        }

        try {
            // Upload the attachment to the S3 bucket
            const data = await s3.putObject(params).promise();
            // Construct stored attachment information
            let storedAttachment: S3Attachment = { path: `https://${bucketName}.s3.amazonaws.com/${params.Key}`};
            if (isSgEmail) {
                storedAttachment.filename = params.Key;
            }
            if ("type" in attachment) {
                storedAttachment.type = attachment.type;
            }
            // Add the stored attachment information to the array
            uploadedAttachmentsArray.push(storedAttachment);
        } catch (err: any) {
            // Handle S3 upload error
            if (err) {
                throw err;
            }
        }
    }

    // Return the array of uploaded attachment information
    return uploadedAttachmentsArray;
}
