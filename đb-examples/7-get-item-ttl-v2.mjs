// Author: VietAWS
// Youtube Channel: VietAWS

//src: https://github.com/aws/aws-sdk-js-v3/tree/main/lib/lib-dynamodb
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
// import { nanoid } from 'nanoid';

// Full DynamoDB Client
const client = new DynamoDB({});
const ddbDocClient = DynamoDBDocument.from(client); // client is DynamoDB client

/*
  =
  <
  >
  <=
  >=
  between
  begins_with
*/

const handler = async (event, context) => {
  // Call using full client.
  // 1. Get Current time in milliseconds
  const nowMs = Date.now();
  // 2. Convert Current time to epoch (seconds)
  const currentEpoch = Math.floor(nowMs / 1000);
  console.log("Current Epoch: ", currentEpoch)
  
  try {

    const res = await ddbDocClient.query({
      TableName: 'demo',
      KeyConditionExpression: '#hkey = :hvalue AND #rkey = :rvalue',
      FilterExpression: '#now > :ttl',
      ExpressionAttributeNames: {
        '#hkey': 'PK',
        '#rkey': 'SK',
        "#now": 'ttl'
      },
      ExpressionAttributeValues: {
        ':hvalue': 'Data',
        ':rvalue': 'david',
        ":ttl": currentEpoch
      },
      // ConsistentRead: true,
      ReturnConsumedCapacity: 'TOTAL',
    });
    console.log(`Items: ${JSON.stringify(res.Items)}`);
    console.log(
      // `Created item successfully!`
      `Get item successfully! RCU: ${res.ConsumedCapacity.CapacityUnits}`
    );
  } catch (error) {
    if (error instanceof Error) console.log(error.message);
  }
};

handler();

export { handler };
