import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient();
const TABLE = process.env.TABLE_NAME;

export const handler = async (event) => {
  const { id } = event.pathParameters;
  const { name, qty } = JSON.parse(event.body);

  await client.send(new UpdateItemCommand({
    TableName: TABLE,
    Key: { id: { S: id } },
    ConditionExpression: "attribute_exists(id)",
    UpdateExpression: "SET #n = :name, qty = :qty",
    ExpressionAttributeNames: { "#n": "name" },
    ExpressionAttributeValues: { ":name": { S: name }, ":qty": { N: String(qty) } },
  }));

  return { statusCode: 200, body: JSON.stringify({ id, name, qty }) };
};
