import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient();
const TABLE = process.env.TABLE_NAME;

export const handler = async (event) => {
  const { name, qty } = JSON.parse(event.body);
  const id = randomUUID();

  await client.send(new PutItemCommand({
    TableName: TABLE,
    Item: {
      id:   { S: id },
      name: { S: name },
      qty:  { N: String(qty) },
    },
    ConditionExpression: "attribute_not_exists(id)",
  }));

  return { statusCode: 201, body: JSON.stringify({ id, name, qty }) };
};
