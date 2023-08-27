# queuemailjs
Its a Typescript based email client that has built integrated functionality to handle email queus, upload attachments and send emails to clients one by one. It also has fault tolerance capability. The user has to provide the configurations for sqs, s3, Nodemailer and sendgrid.

**NOTE: It is not ready to use at the moment as its in the stage of development. Once the v1.0 is ready, it will be available to use along with the detailed documentation. Please feel free to add suggestions.**

## Features

The **npm package** provides a hassle-free way to streamline the process of sending emails to users by offering the following features:

### 1. **Automated Email Sending**
Sending emails to users becomes a breeze with minimal setup. Our package takes care of the intricate details, enabling you to focus on your core tasks.

### 2. **Effortless Attachment Management**
Attachments are stored on Amazon S3, eliminating the need for manual handling. This ensures seamless delivery of files alongside your emails.

### 3. **Queue-based Messaging**
Messages are intelligently managed through an SQS (Simple Queue Service) queue. This guarantees reliable delivery and minimizes the chances of message loss.

### 4. **Flexible Email Providers**
Choose between two popular email service providers: Nodemailer and SendGrid. This flexibility empowers you to opt for the provider that best suits your needs.

### 5. **Consumer Control**
Our package grants you the power to start and stop the consumer at your convenience. This control ensures efficient resource utilization based on your email sending requirements.

### 6. **Automated Message Deletion**
Worried about message buildup? Fear not. Our package takes care of message deletion automatically, sparing you the hassle of manual intervention.

### 7. **Support for Multiple Attachments**
Easily attach multiple files to your emails, enhancing the richness of your communication with users.

### 8. **Detailed Documentation**
Our comprehensive documentation provides step-by-step instructions, examples, and use cases, ensuring a smooth onboarding experience.

### 9. **Active Maintenance and Updates**
Rest assured that we are committed to maintaining and improving this package to provide you with a dependable and up-to-date solution for your email needs.

With these features, our npm package simplifies the email sending process while offering you the flexibility and control necessary to meet your specific requirements. Say goodbye to email sending hassles and hello to efficient, automated communication with your users!

## Exports

The package provides the following exports:

| Export            | Description |
|-------------------|-------------|
| `JsClient`        | The main class that automates the process of sending emails to users with minimal setup. |
| `NodemailerOptions` | An interface that defines the options for using the Nodemailer email service provider. |
| `SendgridOptions`  | An interface that defines the options for using the SendGrid email service provider. |

## Configuration

The `JsClient` object can be configured using the following options:

| Option                | Type            | Description |
|-----------------------|-----------------|-------------|
| `clientType`          | `clientTypes` enum | Specifies the type of email client to use. Acceptable values are `'Nodemailer'` or `'Sendgrid'`. |
| `nodemailerConfig`    | Object          | (Optional) Configuration object for Nodemailer. |
| `awsConfig`           | Object          | Configuration object for AWS services. |
| `sgApiKey`            | String          | (Optional) SendGrid API key required if using SendGrid as the email service provider. |
| `repeatFrequency`     | Number          | (Optional) Frequency in milliseconds for checking the SQS queue for new messages. Defaults to 5 minutes. |

### Description:

- `clientType`: This option determines which email client will be used. It should be set to one of the acceptable enum values: `'Nodemailer'` or `'Sendgrid'`.

- `nodemailerConfig`: This object allows you to provide Nodemailer configuration options.

- `awsConfig`: This object should contain the necessary AWS configuration for accessing S3 and SQS. It includes the following keys:

  - `region`: Specifies the AWS region to be used for accessing services.

  - `sqsQueueUrl`: The URL of the SQS (Simple Queue Service) queue where email messages are pushed.

  - `bucketName` (optional): If you're using Amazon S3 for storing attachments, provide the name of the S3 bucket where attachments will be stored. This is an optional field and may be omitted if attachments are not used.

- `sgApiKey`: If you're using SendGrid, provide your SendGrid API key for authentication.

- `repeatFrequency`: This option specifies how often the package will check the SQS queue for new messages. It is optional and defaults to 5 minutes (300,000 milliseconds).

Please note that you need to provide the appropriate configuration depending on your chosen email client (Nodemailer or SendGrid).

## Methods

The `JsClient` object provides the following methods:

| Method               | Parameters                              | Description |
|----------------------|-----------------------------------------|-------------|
| `sendEmail`          | `options: NodemailerOptions \| SendgridOptions` | Sends an email using the configured email client (Nodemailer or SendGrid). The `options` parameter should be an object containing the necessary email details and content. |
| `startConsumer`      | None                                    | Starts the consumer, allowing the package to process and send email messages from the SQS queue. |
| `stopConsumer`       | None                                    | Stops the consumer, halting the processing of email messages from the SQS queue. |

### Method Descriptions:

- `sendEmail(options)`: This method allows you to send an email using the chosen email client (Nodemailer or SendGrid). The `options` parameter should be an object containing the email details and content. Depending on the chosen client, you need to provide either `NodemailerOptions` or `SendgridOptions`. Refer to the relevant email service provider's documentation for the required options.

- `startConsumer()`: This method starts the consumer, allowing the package to process and send email messages from the SQS queue.

- `stopConsumer()`: This method stops the consumer, halting the processing of email messages from the SQS queue.

Please refer to the individual method descriptions for more details on their usage and parameters.

## How to Use

### Using Nodemailer to Send an Email with Attachment

```typescript
import { JsClient, NodemailerOptions } from '';

// Configure the options for the JsClient
const jsClient = new JsClient({
  clientType: 'Nodemailer',
  nodemailerConfig: {
    // Nodemailer configuration options
    service: 'Gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-email-password',
    },
  },
  awsConfig: {
    // AWS configuration options for SQS and S3
    region: 'us-east-1',
    sqsQueueUrl: 'your-sqs-queue-url',
    bucketName: 'your-s3-bucket-name',
  },
});

// Construct email options with attachment
const emailOptions: NodemailerOptions = {
  from: 'your-email@gmail.com',
  to: 'recipient@example.com',
  subject: 'Email with Attachment from Nodemailer',
  text: 'This email contains an attachment.',
  attachments: [
    {
      filename: 'example.txt',
      content: 'Hello, this is the content of the attachment.',
    },
  ],
};

// Send the email
jsClient.sendEmail(emailOptions)
  .then(() => {
    console.log('Email with attachment sent successfully!');
  })
  .catch((error) => {
    console.error('Error sending email with attachment:', error);
  });
```

### Using Sendgrid to Send an Email with Attachment

```typescript
import { JsClient, SendgridOptions } from '';

// Configure the options for the JsClient
const jsClient = new JsClient({
  clientType: 'Sendgrid',
  sgApiKey: 'your-sendgrid-api-key',
  awsConfig: {
    // AWS configuration options for SQS and S3
    region: 'us-east-1',
    sqsQueueUrl: 'your-sqs-queue-url',
    bucketName: 'your-s3-bucket-name',
  },
});

// Construct email options with attachment
const emailOptions: SendgridOptions = {
  from: 'your-email@example.com',
  to: 'recipient@example.com',
  subject: 'Email with Attachment from SendGrid',
  text: 'This email contains an attachment.',
  attachments: [
    {
      filename: 'example.txt',
      content: 'Hello, this is the content of the attachment.',
    },
  ],
};

// Send the email
jsClient.sendEmail(emailOptions)
  .then(() => {
    console.log('Email with attachment sent successfully!');
  })
  .catch((error) => {
    console.error('Error sending email with attachment:', error);
  });

```


