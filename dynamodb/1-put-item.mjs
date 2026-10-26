//src: https://github.com/aws/aws-sdk-js-v3/tree/main/lib/lib-dynamodb
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
// import { nanoid } from 'nanoid';
const t1 = new Date();
// Full DynamoDB Client
const client = new DynamoDB({});
const ddbDocClient = DynamoDBDocument.from(client); // client is DynamoDB client

// Call using full client.
const handler = async (event, context) => {
  try {
    const res = await ddbDocClient.put({
      //will not overwrite attributes that not included in Item object
      //only update/create new attributes, keep existing one
      TableName: "demo",
      Item: {
        PK: "ARC",
        // SK: new Date().toISOString(),
        SK: "viet",
        name: "Viet Tran2",
        age: 18,
        loc: 'saigon'
        // isFavourite: "NO",
      },
    //   ConditionExpression: `attribute_not_exists(PK) AND attribute_not_exists(SK)`,
      ReturnConsumedCapacity: "TOTAL",
    });
    console.log(
      // `Created item successfully!`
      `Created item successfully! WCU: ${res.ConsumedCapacity.CapacityUnits}`
    );
  } catch (error) {
    if (error instanceof Error) console.log(error.message);
  }
};

handler();
