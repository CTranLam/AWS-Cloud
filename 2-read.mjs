import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient();
const TABLE = process.env.TABLE_NAME;

export const handler = async (event) => {
  const { id } = event.pathParameters;

  const { Item } = await client.send(new GetItemCommand({
    TableName: TABLE,
    Key: { id: { S: id } },
  }));

  if (!Item) return { statusCode: 404, body: JSON.stringify({ message: "Not found" }) };

  return {
    statusCode: 200,
    body: JSON.stringify({ id: Item.id.S, name: Item.name.S, qty: Number(Item.qty.N) }),
  };
};
