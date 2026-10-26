import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'crypto';

const db = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME;

const handler = async (event) => {
    const { name, date, status = 'pending' } = JSON.parse(event.body);
    const item = { id: randomUUID(), name, date: date || null, status };

    await db.send(new PutItemCommand({ TableName: TABLE, Item: marshall(item) }));

    return {
        statusCode: 201,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(item)
    };
};

export {handler}