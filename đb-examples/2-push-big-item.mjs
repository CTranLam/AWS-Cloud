//src: https://github.com/aws/aws-sdk-js-v3/tree/main/lib/lib-dynamodb
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, PutCommand } from '@aws-sdk/lib-dynamodb';
import bigItem from './big-item.json' with { type: 'json' };

// Full DynamoDB Client
const client = new DynamoDB({});
const ddbDocClient = DynamoDBDocument.from(client); // client is DynamoDB client

// Call using full client.
const handler = async (event, context) => {
  try {
    // const bigItem = await fetch('./big-item.json');
    const res = await ddbDocClient.put({
      //will not overwrite attributes that not included in Item object
      TableName: 'demo',
      Item: {
        PK: 'Test',
        SK: 'Test',
        item: JSON.stringify(bigItem.item), //409,582
      },
      //400KB: Test, Test, item + values (PK, SK, items)
      //400KB: PK, SK + item values
      ReturnConsumedCapacity: 'TOTAL',
    });
    console.log(
      // `Created item successfully!`
      `Created BIG item successfully! WCU: ${res.ConsumedCapacity.CapacityUnits}`
    );
  } catch (error) {
    if (error instanceof Error) console.log(error.message);
  }
};

handler();
