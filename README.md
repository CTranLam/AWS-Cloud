# Image Upload Application - S3 Direct Upload

Static website hosted on S3 that uses AWS SDK in the browser to upload images directly to S3 using Cognito Identity Pool for authentication.

## Architecture
- **Frontend**: Static HTML/CSS/JS hosted on S3 (root of bucket)
- **Authentication**: Cognito Identity Pool (unauthenticated access)
- **Storage**: S3 bucket with `data/` prefix for uploaded images
- **SDK**: AWS SDK v3 loaded from CDN

## Prerequisites
- S3 bucket (e.g., `architecting-demo-xxx`)
- Cognito Identity Pool with unauthenticated access enabled
- S3 bucket configured for static website hosting
- CORS configuration on S3 bucket

## Deployment Instructions

### 1. Create S3 Bucket

```bash
BUCKET_NAME=architecting-demo-xxx
REGION=ap-southeast-1

aws s3 mb s3://${BUCKET_NAME} --region ${REGION}
```

### 2. Enable Static Website Hosting

```bash
aws s3 website s3://${BUCKET_NAME} \
  --index-document index.html \
  --error-document index.html
```

### 3. Set Bucket Policy for Public Read

```bash
cat > bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket ${BUCKET_NAME} --policy file://bucket-policy.json
```

### 4. Configure CORS

```bash
cat > cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket ${BUCKET_NAME} --cors-configuration file://cors.json
```

### 5. Create Cognito Identity Pool

```bash
IDENTITY_POOL_ID=$(aws cognito-identity create-identity-pool \
  --identity-pool-name image-upload-pool \
  --allow-unauthenticated-identities \
  --region ${REGION} \
  --query 'IdentityPoolId' --output text)

echo "Identity Pool ID: ${IDENTITY_POOL_ID}"
```

### 6. Create IAM Role for Unauthenticated Users

```bash
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "${IDENTITY_POOL_ID}"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "unauthenticated"
        }
      }
    }
  ]
}
EOF

ROLE_ARN=$(aws iam create-role \
  --role-name CognitoS3UnauthRole \
  --assume-role-policy-document file://trust-policy.json \
  --query 'Role.Arn' --output text)

cat > role-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/data/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}",
      "Condition": {
        "StringLike": {
          "s3:prefix": "data/*"
        }
      }
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name CognitoS3UnauthRole \
  --policy-name S3Access \
  --policy-document file://role-policy.json
```

### 7. Attach Role to Identity Pool

```bash
aws cognito-identity set-identity-pool-roles \
  --identity-pool-id ${IDENTITY_POOL_ID} \
  --roles unauthenticated=${ROLE_ARN} \
  --region ${REGION}
```

### 8. Update Frontend Configuration

Edit `public/index.html` and replace:
- `REGION` with your AWS region
- `BUCKET_NAME` with your bucket name
- `IDENTITY_POOL_ID` with your Cognito Identity Pool ID

```bash
sed -i "s|REGION|${REGION}|g" public/index.html
sed -i "s|BUCKET_NAME|${BUCKET_NAME}|g" public/index.html
sed -i "s|IDENTITY_POOL_ID|${IDENTITY_POOL_ID}|g" public/index.html
```

### 9. Deploy Frontend to S3

```bash
aws s3 cp public/index.html s3://${BUCKET_NAME}/index.html \
  --content-type "text/html" \
  --cache-control "max-age=300"
```

### 10. Access Website

```bash
echo "Website URL: http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"
```

## S3 Bucket Structure

```
s3://architecting-demo-xxx/
├── index.html              # Frontend
└── data/                   # Uploaded images
    ├── 1234567890-image1.jpg
    └── 1234567891-image2.png
```

## How It Works

1. Frontend loads AWS SDK v3 from CDN (jsDelivr)
2. Uses Cognito Identity Pool for temporary credentials
3. Browser directly uploads to S3 using `PutObjectCommand`
4. Lists images using `ListObjectsV2Command`
5. Deletes images using `DeleteObjectCommand`
6. No backend servers required

## Testing

1. Access website: `http://bucket-name.s3-website-region.amazonaws.com`
2. Upload an image (goes directly to S3)
3. Verify image appears in gallery
4. Check S3 bucket for `data/` prefix
5. Test delete functionality

## Benefits
- Fully serverless (no Lambda or API Gateway)
- Direct browser-to-S3 upload
- No backend infrastructure
- Pay only for S3 storage and requests
- Cognito handles authentication
- AWS SDK handles all S3 operations
