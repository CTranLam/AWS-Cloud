import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const QUEUE_URL =
  process.env.QUEUE_URL ||
  'https://sqs.ap-southeast-1.amazonaws.com/274595021951/vietaws';

const sqsClient = new SQSClient({
  region: process.env.REGION || 'ap-southeast-1',
});

for (let i = 0; i < 1000; i++) {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: `Here is message #${i + 1}!`,
    })
  );

  console.log(`Sent message #${i + 1} successfully!`);
  await new Promise((resolver) => setTimeout(resolver, 500));
}
