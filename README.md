# Serverless Todo App

## Architecture
- Frontend: Static files (S3 + CloudFront optional)
- Backend: 4 Lambda functions via API Gateway
- Database: DynamoDB

## DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name todos \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

## Lambda Functions

| Function | Handler file | Method | Path |
|---|---|---|---|
| getTodos | lambda/getTodos/index.js | GET | /todos |
| createTodo | lambda/createTodo/index.js | POST | /todos |
| updateTodo | lambda/updateTodo/index.js | PUT | /todos/{id} |
| deleteTodo | lambda/deleteTodo/index.js | DELETE | /todos/{id} |

Each function needs:
- Runtime: Node.js 20.x
- Environment variable: `TABLE_NAME=todos`
- IAM role with `AmazonDynamoDBFullAccess`

## API Gateway

1. Create REST API
2. Create resource `/todos` with methods GET, POST
3. Create resource `/todos/{id}` with methods PUT, DELETE
4. Enable CORS on all resources
5. Deploy to stage `prod`

## Frontend Deployment (S3)

```bash
aws s3 mb s3://your-todo-app-bucket
aws s3 website s3://your-todo-app-bucket --index-document index.html

# Update API URL in app.js first, then:
aws s3 sync frontend/ s3://your-todo-app-bucket --acl public-read
```

Update the `API` constant in `frontend/app.js` with your API Gateway URL:
```js
const API = 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod/todos';
```
