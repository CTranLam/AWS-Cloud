import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

const QUEUE_URL =
  process.env.QUEUE_URL ||
  'https://sqs.ap-southeast-1.amazonaws.com/274595021951/vietaws';

const sqsClient = new SQSClient({
  region: process.env.REGION || 'ap-southeast-1',
});
while (true) {
  const response = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      // AttributeNames: ['All'],
      // MessageAttributeNames: ['project', 'user'],
      // WaitTimeSeconds: 5, //long polling 5 seconds
      // VisibilityTimeout: 5, //will get this message in 10 seconds
      // MaxNumberOfMessages: 1,
    })
  );

  const message = response.Messages[0].Body;
  const receiptHandleId = response.Messages[0].ReceiptHandle;

  await new Promise((resolver) => setTimeout(resolver, 1000));

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandleId,
    })
  );

  console.log('Proceeded & Deleted: ', message);
}
