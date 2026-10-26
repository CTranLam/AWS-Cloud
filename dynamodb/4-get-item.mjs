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
  const now = new Date().toUTCString()
  try {

    const res = await ddbDocClient.query({
      TableName: 'demo',
      KeyConditionExpression: '#hkey = :hvalue AND #rkey = :rvalue',
      ExpressionAttributeNames: {
        '#hkey': 'PK',
        '#rkey': 'SK'
      },
      ExpressionAttributeValues: {
        ':hvalue': 'ARC',
        ':rvalue': 'viet'
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
