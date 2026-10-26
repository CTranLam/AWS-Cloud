import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const db = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME;

const handler = async (event) => {
    const { id } = event.pathParameters;

    await db.send(new DeleteItemCommand({
        TableName: TABLE,
        Key: marshall({ id })
    }));

    return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ deleted: id })
    };
};

export {handler}