# CRM Application - AWS Integration Guide

Complete CRM system with Products (RDS + S3) and Customers (DynamoDB + EFS).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        EC2 Instance                          │
│                     (Node.js Application)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Products   │  │  Customers   │  │  Metadata    │     │
│  │   Module     │  │   Module     │  │   & Stress   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘     │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          ▼                  ▼
    ┌─────────┐        ┌──────────┐
    │   RDS   │        │ DynamoDB │
    │  (SQL)  │        │  (NoSQL) │
    └─────────┘        └──────────┘
          │                  │
          ▼                  ▼
    ┌─────────┐        ┌──────────┐
    │   S3    │        │   EFS    │
    │ (Images)│        │(Avatars) │
    └─────────┘        └──────────┘
```

## Prerequisites

### 1. RDS PostgreSQL Instance
- Engine: PostgreSQL 17
- Instance: db.t4g.micro or db.t4g.small
- Database: `demo`
- Security Group: Allow port 5432 from EC2

### 2. S3 Bucket
- Name: `crm-demo-bucket` (or your choice)
- Region: Same as EC2
- CORS enabled for image uploads

### 3. DynamoDB Table
- Name: `customers`
- Partition Key: `id` (String)
- Billing: On-demand

### 4. EFS File System
- Performance mode: General Purpose
- Throughput mode: Bursting
- Mount targets in same subnets as EC2

### 5. Secrets Manager
- Secret name: `rds-credentials`
- Format: `{"host":"...","username":"...","password":"..."}`

## Quick Setup

### Step 1: Create AWS Resources

```bash
# Set environment variables
export AWS_REGION=us-east-1
export S3_BUCKET=crm-demo-bucket
export DYNAMODB_TABLE=customers
export EFS_ID=fs-xxxxxxxxx
export DB_SECRET_NAME=rds-credentials

# Run setup script
sudo ./setup-aws.sh
```

### Step 2: Create RDS Secret

```bash
aws secretsmanager create-secret \
  --name rds-credentials \
  --secret-string '{"host":"demo-db.xxxxx.rds.amazonaws.com","username":"dbadmin","password":"YourPassword"}' \
  --region us-east-1
```

### Step 3: Deploy Application

```bash
# Install dependencies
sudo dnf update -y
sudo dnf install -y nodejs22 git postgresql17 amazon-efs-utils

# Clone application
cd /home/ec2-user
git clone -b main https://github.com/vietaws/architecting.git
cd architecting

# Create .env file
cat > .env <<EOF
DB_SECRET_NAME=rds-credentials
DB_HOST=demo-db.xxxxx.rds.amazonaws.com
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=fallback-password
S3_BUCKET=crm-demo-bucket
DYNAMODB_TABLE=customers
EFS_PATH=/mnt/efs
AWS_REGION=us-east-1
PORT=3001
EOF

# Initialize RDS database
export PGPASSWORD=YourPassword
psql "host=demo-db.xxxxx.rds.amazonaws.com port=5432 dbname=demo user=dbadmin sslmode=require" -f init.sql
unset PGPASSWORD

# Install Node modules
npm install
sudo chown -R ec2-user:ec2-user /home/ec2-user/architecting

# Create systemd service
sudo cat > /etc/systemd/system/crm-app.service <<'EOFS'
[Unit]
Description=CRM Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/architecting
EnvironmentFile=/home/ec2-user/architecting/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=crm-app

[Install]
WantedBy=multi-user.target
EOFS

# Start application
sudo systemctl daemon-reload
sudo systemctl enable crm-app
sudo systemctl start crm-app
sudo systemctl status crm-app
```

## IAM Permissions Required

EC2 instance role needs these permissions:

```json
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
      "Resource": "arn:aws:s3:::crm-demo-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/customers"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:rds-credentials-*"
    }
  ]
}
```

## API Endpoints

### Products (RDS + S3)
- `GET /api/products` - List all products
- `POST /api/products` - Create product with image
  - Form data: `name`, `qty`, `image` (file)
- `PUT /api/products/:id` - Update product
  - Form data: `name`, `qty`, `image` (file, optional)
- `DELETE /api/products/:id` - Delete product and image

### Customers (DynamoDB + EFS)
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer with avatar
  - Form data: `name`, `location`, `dob`, `description`, `avatar` (file)
- `PUT /api/customers/:id` - Update customer
  - Form data: `name`, `location`, `dob`, `description`, `avatar` (file, optional)
- `DELETE /api/customers/:id` - Delete customer

### System
- `GET /api/metadata` - Get EC2 region and instance ID
- `POST /api/stress` - Start CPU stress test
  - Body: `{ "duration": 60 }`
- `DELETE /api/stress` - Stop CPU stress test

## Database Schemas

### Products (PostgreSQL)
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image_url VARCHAR(500),
  qty INTEGER NOT NULL DEFAULT 0
);
```

### Customers (DynamoDB)
```json
{
  "id": "string (timestamp)",
  "name": "string",
  "avatar": "string (path)",
  "location": "string",
  "dob": "string (date)",
  "description": "string"
}
```

## Storage Structure

### S3 Bucket
```
s3://crm-demo-bucket/
└── products/
    ├── 1234567890-laptop.jpg
    └── 1234567891-mouse.png
```

### EFS Mount
```
/mnt/efs/
├── 1234567890-avatar1.jpg
└── 1234567891-avatar2.png
```

## Testing

1. Access application: `http://<ec2-ip>:3001`
2. **Products Tab**:
   - Add product with image → Stored in S3
   - Edit product → Update RDS + S3
   - Delete product → Remove from RDS + S3
3. **Customers Tab**:
   - Add customer with avatar → Stored in EFS
   - Edit customer → Update DynamoDB + EFS
   - Delete customer → Remove from DynamoDB
4. **Metadata**: Verify region and instance ID display
5. **Stress Test**: Click "Start CPU Stress" and monitor CloudWatch

## Troubleshooting

### Cannot connect to RDS
```bash
# Test connection
psql "host=your-rds-endpoint port=5432 dbname=demo user=dbadmin sslmode=require"

# Check security group allows port 5432
# Verify Secrets Manager secret exists
aws secretsmanager get-secret-value --secret-id rds-credentials
```

### S3 upload fails
```bash
# Check IAM permissions
# Verify bucket exists
aws s3 ls s3://crm-demo-bucket

# Check CORS configuration
aws s3api get-bucket-cors --bucket crm-demo-bucket
```

### DynamoDB errors
```bash
# Verify table exists
aws dynamodb describe-table --table-name customers

# Check IAM permissions
```

### EFS mount issues
```bash
# Check mount
df -h | grep efs

# Remount if needed
sudo mount -t efs -o tls fs-xxxxxxxxx:/ /mnt/efs

# Check permissions
ls -la /mnt/efs
```

### Application logs
```bash
sudo journalctl -u crm-app -f
sudo journalctl -u crm-app -n 100
```

## Security Best Practices

1. ✅ RDS credentials in Secrets Manager
2. ✅ SSL/TLS for RDS connections
3. ✅ S3 presigned URLs for secure image access
4. ✅ EFS encryption in transit
5. ✅ IAM roles instead of access keys
6. ✅ Security groups restrict access
7. ✅ File upload size limits (10MB)

## Cost Optimization

- Use RDS db.t4g.micro for development
- Enable S3 lifecycle policies for old images
- Use DynamoDB on-demand billing
- EFS Infrequent Access for old avatars
- Stop EC2 instances when not in use
