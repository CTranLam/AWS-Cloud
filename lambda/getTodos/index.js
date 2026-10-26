import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const db = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME;

const handler = async () => {
    const { Items } = await db.send(new ScanCommand({ TableName: TABLE }));
    return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(Items.map(unmarshall))
    };
};

export {handler}