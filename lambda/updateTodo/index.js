import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb' ;
import { marshall } from '@aws-sdk/util-dynamodb';

const db = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME;

const handler = async (event) => {
    const { id } = event.pathParameters;
    const fields = JSON.parse(event.body);

    const expParts = [], names = {}, values = {};
    for (const [k, v] of Object.entries(fields)) {
        expParts.push(`#${k} = :${k}`);
        names[`#${k}`] = k;
        values[`:${k}`] = marshall({ v }).v;
    }

    await db.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ id }),
        UpdateExpression: `SET ${expParts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
    }));

    return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ id, ...fields })
    };
};

export {handler}
