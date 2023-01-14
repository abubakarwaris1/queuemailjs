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

