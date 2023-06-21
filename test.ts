import { JsClient } from "./index";

const client =  new JsClient({
    clientType: 'Nodemailer',
    nodemailerConfig: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth:{
            user: 'abubakarwaris@gmail.com',
            pass: 'M1k2b3t4p5d6h7@'
        }
    },
    awsConfig:{
        region: 'ap-northeast-1',
        sqsQueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/269446268656/myEmailQueue.fifo'
    }
});

client.sendEmail({
    from:'abubakarwaris@gmail.com',
    to: 'abubakar.waris@techverx.com',
    subject:'test email',
    text:' somtehdfsdkasdfsd',
    html: "<b>Hello World</b>"
})

// const client =  new JsClient({
//     clientType: 'Sendgrid',
//     nodemailerConfig: {
//         host: "smtp.gmail.com",
//         port: 587,
//         secure: false,
//         auth:{
//             user: 'abubakar.waris@techverx.com',
//             pass: 'M1k2b3t4p5d6@'
//         }
//     },
//     awsConfig:{
//         region: 'ap-northeast-1',
//         sqsQueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/269446268656/myEmailQueue.fifo',
//         bucketName: 'attachments-store'
//     }
// });
// let path = '../abc.jpg'
// path = path.split(/\ /).join('\ ');
// const attachment = fs.readFileSync(path).toString("base64");
// for(let i = 10; i <15;i++){
//     client.sendEmail({
//         from:'abubakar.waris@techverx.com',
//         to: 'abubakarwaris@gmail.com',
//         subject:'test email',
//         html: `<b>Hello World</b>`,
//         attachments: [{
//             content:attachment,
//             filename: 'abc.jpg',
//             type:'image/jpg',
//             disposition: 'attachment',
//             content_id: 'my_text'
//             path: 'C:/Users/Abu Bakar/Documents/Work/js-email-client/abc.jpg',
//         }]
//     });
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

