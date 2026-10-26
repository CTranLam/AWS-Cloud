import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient();
const TABLE = process.env.TABLE_NAME;

export const handler = async (event) => {
  const { id } = event.pathParameters;

  await client.send(new DeleteItemCommand({
    TableName: TABLE,
    Key: { id: { S: id } },
    ConditionExpression: "attribute_exists(id)",
  }));

  return { statusCode: 204, body: null };
};
