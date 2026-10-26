#!/bin/bash
set -e

# Configuration
BUCKET_NAME=architecting-demo-xxx
REGION=ap-southeast-1

echo "Deploying Image Upload Application to S3..."
echo "Bucket: ${BUCKET_NAME}"
echo "Region: ${REGION}"

# 1. Create S3 bucket
echo "Creating S3 bucket..."
aws s3 mb s3://${BUCKET_NAME} --region ${REGION} 2>/dev/null || echo "Bucket already exists"

# 2. Enable static website hosting
echo "Enabling static website hosting..."
aws s3 website s3://${BUCKET_NAME} \
  --index-document index.html \
  --error-document index.html

# 3. Set bucket policy
echo "Setting bucket policy..."
cat > /tmp/bucket-policy.json <<EOF
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

aws s3api put-bucket-policy --bucket ${BUCKET_NAME} --policy file:///tmp/bucket-policy.json

# 4. Configure CORS
echo "Configuring CORS..."
cat > /tmp/cors.json <<EOF
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

aws s3api put-bucket-cors --bucket ${BUCKET_NAME} --cors-configuration file:///tmp/cors.json

# 5. Create Cognito Identity Pool
echo "Creating Cognito Identity Pool..."
IDENTITY_POOL_ID=$(aws cognito-identity create-identity-pool \
  --identity-pool-name image-upload-pool \
  --allow-unauthenticated-identities \
  --region ${REGION} \
  --query 'IdentityPoolId' --output text 2>/dev/null || \
aws cognito-identity list-identity-pools --max-results 10 --region ${REGION} \
  --query "IdentityPools[?IdentityPoolName=='image-upload-pool'].IdentityPoolId" --output text)

echo "Identity Pool ID: ${IDENTITY_POOL_ID}"

# 6. Create IAM Role
echo "Creating IAM role..."
cat > /tmp/trust-policy.json <<EOF
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
  --assume-role-policy-document file:///tmp/trust-policy.json \
  --query 'Role.Arn' --output text 2>/dev/null || \
aws iam get-role --role-name CognitoS3UnauthRole --query 'Role.Arn' --output text)

cat > /tmp/role-policy.json <<EOF
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
  --policy-document file:///tmp/role-policy.json

# 7. Attach role to identity pool
echo "Attaching role to identity pool..."
aws cognito-identity set-identity-pool-roles \
  --identity-pool-id ${IDENTITY_POOL_ID} \
  --roles unauthenticated=${ROLE_ARN} \
  --region ${REGION}

# 8. Update frontend with configuration
echo "Updating frontend configuration..."
sed "s|REGION|${REGION}|g; s|BUCKET_NAME|${BUCKET_NAME}|g; s|IDENTITY_POOL_ID|${IDENTITY_POOL_ID}|g" \
  public/index.html > /tmp/index.html

# 9. Deploy frontend
echo "Deploying frontend to S3..."
aws s3 cp /tmp/index.html s3://${BUCKET_NAME}/index.html \
  --content-type "text/html" \
  --cache-control "max-age=300" \
  --region ${REGION}

# 10. Output website URL
WEBSITE_URL="http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"
echo ""
echo "Deployment complete!"
echo "Website URL: ${WEBSITE_URL}"
echo ""
