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
    // 1. Get Current time in milliseconds
    const nowMs = Date.now();
    // 2. Convert Current time to epoch (seconds)
    const currentEpoch = Math.floor(nowMs / 1000);
    // 3. ttl = 15 minutes
    const ttl = 5
    const timeToBeDeleted = currentEpoch + (ttl * 60);

    console.log("Current epoch: ", currentEpoch);
    console.log("Time to Delete: ", timeToBeDeleted);

    const res = await ddbDocClient.put({
      //will not overwrite attributes that not included in Item object
      //only update/create new attributes, keep existing one
      TableName: "demo",
      Item: {
        PK: "Data",
        // SK: new Date().toISOString(),
        SK: "david",
        name: "David",
        ttl: timeToBeDeleted
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
