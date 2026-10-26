# Products CRUD — Lambda + DynamoDB

Four Lambda functions (ES module, Node.js 22.x) managing a `products` DynamoDB table.

---

## 1. DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name products \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

| Attribute | Type   | Role |
|-----------|--------|------|
| `id`      | String | PK   |
| `name`    | String | —    |
| `qty`     | Number | —    |

---

## 2. Lambda Functions

Each function requires the env var `TABLE_NAME=products`.  
Runtime: **Node.js 22.x**, Handler suffix: `.handler`.

| Function          | File         | Handler          |
|-------------------|--------------|------------------|
| `products-create` | `index.mjs` | `create.handler` |
| `products-read`   | `index.mjs` | `read.handler`   |
| `products-update` | `index.mjs` | `update.handler` |
| `products-delete` | `index.mjs` | `delete.handler` |

### Create a function (repeat for each)

```bash
# Package
zip create.zip create.mjs

# Deploy
aws lambda create-function \
  --function-name products-create \
  --runtime nodejs22.x \
  --handler create.handler \
  --zip-file fileb://create.zip \
  --role arn:aws:iam::<ACCOUNT_ID>:role/products-create-role \
  --environment Variables={TABLE_NAME=products}
```

> Replace `products-create` / `create.mjs` / `create.handler` / `products-create-role` for each function.

---

## 3. IAM Roles & Policies

Each function gets its own role with least-privilege DynamoDB permissions.

### Trust policy (same for all roles) — `trust-policy.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

---

### products-create-role — `PutItem` only

```bash
aws iam create-role \
  --role-name products-create-role \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name products-create-role \
  --policy-name products-create-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "dynamodb:PutItem",
      "Resource": "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/products"
    }]
  }'
```

---

### products-read-role — `GetItem` only

```bash
aws iam create-role \
  --role-name products-read-role \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name products-read-role \
  --policy-name products-read-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "dynamodb:GetItem",
      "Resource": "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/products"
    }]
  }'
```

---

### products-update-role — `UpdateItem` only

```bash
aws iam create-role \
  --role-name products-update-role \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name products-update-role \
  --policy-name products-update-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "dynamodb:UpdateItem",
      "Resource": "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/products"
    }]
  }'
```

---

### products-delete-role — `DeleteItem` only

```bash
aws iam create-role \
  --role-name products-delete-role \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name products-delete-role \
  --policy-name products-delete-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "dynamodb:DeleteItem",
      "Resource": "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/products"
    }]
  }'
```

> Attach `AWSLambdaBasicExecutionRole` to each role for CloudWatch Logs:
> ```bash
> aws iam attach-role-policy \
>   --role-name products-create-role \
>   --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
> ```

---

## 4. API Contract

| Operation | Method | Path              | Body                        |
|-----------|--------|-------------------|-----------------------------|
| Create    | POST   | `/products`       | `{ "name": "...", "qty": 0 }` |
| Read      | GET    | `/products/{id}`  | —                           |
| Update    | PUT    | `/products/{id}`  | `{ "name": "...", "qty": 0 }` |
| Delete    | DELETE | `/products/{id}`  | —                           |
