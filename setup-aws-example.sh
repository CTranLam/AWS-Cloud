#!/bin/bash
set -e

# Configuration
REGION=${AWS_REGION:-ap-southeast-1}
S3_BUCKET=${S3_BUCKET:-crm-demo-bucket-189999}
DYNAMODB_TABLE=${DYNAMODB_TABLE:-customers-18999}

VPC_ID=vpc-023bf7368fdb89582  # Required if creating EFS
EFS_SECURITY_GROUP=sg-0c421fd68c5dd5718  # Required if creating EFS
APP_SUBNET_IDS=sg-0180a712e5148e3fe  # Comma-separated subnet IDs for EFS mount targets

DB_SECRET_NAME=rds-cred
DB_TYPE=aurora # Options: rds or aurora
DB_INSTANCE_ID=demo-instance
DB_CLUSTER_ID=demo-cluster
DB_USERNAME=dbadmin
DB_PASSWORD=demoPassword
DB_SUBNET_GROUP=demo-db-subnet-group
DB_SUBNET_IDS=subnet-07ba938fe614f85ce,subnet-01e9e8eafdc68576e  # Comma-separated subnet IDs for DB subnet group
DB_SECURITY_GROUP=sg-0685c46fd1346dc35  # Must be provided

echo "Setting up AWS resources for CRM application..."
echo "Region: ${REGION}"
echo "Database Type: ${DB_TYPE}"

# 1. Create DB Subnet Group (if DB_SUBNET_IDS provided)
if [ ! -z "$DB_SUBNET_IDS" ]; then
  echo "Creating DB subnet group: ${DB_SUBNET_GROUP}"
  
  # Convert comma-separated string to space-separated for AWS CLI
  SUBNET_IDS_ARRAY=$(echo $DB_SUBNET_IDS | tr ',' ' ')
  
  aws rds create-db-subnet-group \
    --db-subnet-group-name ${DB_SUBNET_GROUP} \
    --db-subnet-group-description "DB subnet group for CRM application" \
    --subnet-ids ${SUBNET_IDS_ARRAY} \
    --region ${REGION} 2>/dev/null || echo "DB subnet group already exists"
fi

# 2. Create Database (RDS or Aurora)
if [ "$DB_TYPE" = "aurora" ]; then
  echo "Creating Aurora PostgreSQL cluster: ${DB_CLUSTER_ID}"
  
  # Create Aurora cluster
  aws rds create-db-cluster \
    --db-cluster-identifier ${DB_CLUSTER_ID}\
    --engine aurora-postgresql \
    --engine-version 16.4 \
    --master-username ${DB_USERNAME} \
    --master-user-password ${DB_PASSWORD} \
    --database-name demo \
    --db-subnet-group-name ${DB_SUBNET_GROUP} \
    --vpc-security-group-ids ${DB_SECURITY_GROUP} \
    --region ${REGION} 2>/dev/null || echo "Aurora cluster already exists"


  
  # Create Aurora instance
  aws rds create-db-instance \
    --db-instance-identifier ${DB_INSTANCE_ID} \
    --db-instance-class db.t4g.medium \
    --engine aurora-postgresql \
    --db-cluster-identifier ${DB_CLUSTER_ID} \
    --region ${REGION} 2>/dev/null || echo "Aurora instance already exists"
  
  # Wait for cluster to be available
  echo "Waiting for Aurora cluster to be available (this may take 5-10 minutes)..."
  aws rds wait db-cluster-available --db-cluster-identifier ${DB_CLUSTER_ID} --region ${REGION}
  
  # Get Aurora endpoint
  RDS_ENDPOINT=$(aws rds describe-db-clusters \
    --db-cluster-identifier ${DB_CLUSTER_ID} \
    --region ${REGION} \
    --query 'DBClusters[0].Endpoint' \
    --output text)
  
  echo "Aurora endpoint: ${RDS_ENDPOINT}"

else
  echo "Creating RDS PostgreSQL instance: ${DB_INSTANCE_ID}"
  
  # Create RDS instance
  aws rds create-db-instance \
    --db-instance-identifier ${DB_INSTANCE_ID} \
    --db-instance-class db.t4g.micro \
    --engine postgres \
    --engine-version 17.2 \
    --master-username ${DB_USERNAME} \
    --master-user-password ${DB_PASSWORD} \
    --database-name demo \
    --allocated-storage 20 \
    --db-subnet-group-name ${DB_SUBNET_GROUP} \
    --vpc-security-group-ids ${DB_SECURITY_GROUP} \
    --backup-retention-period 7 \
    --no-publicly-accessible \
    --region ${REGION} 2>/dev/null || echo "RDS instance already exists"
  
  # Wait for RDS to be available
  echo "Waiting for RDS instance to be available (this may take 5-10 minutes)..."
  aws rds wait db-instance-available --db-instance-identifier ${DB_INSTANCE_ID} --region ${REGION}
  
  # Get RDS endpoint
  RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier ${DB_INSTANCE_ID} \
    --region ${REGION} \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)
  
  echo "RDS endpoint: ${RDS_ENDPOINT}"
fi

# Create demo database and products table
echo "Creating demo database and products table..."
export PGPASSWORD=${DB_PASSWORD}


# Create dbadmin user and grant permissions
psql "host=${RDS_ENDPOINT} port=5432 dbname=demo user=${DB_USERNAME} sslmode=require" <<EOF

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE demo TO dbadmin;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO dbadmin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbadmin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dbadmin;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dbadmin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dbadmin;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image_url VARCHAR(500),
  qty INTEGER NOT NULL DEFAULT 0
);

-- Grant permissions on products table
GRANT ALL PRIVILEGES ON TABLE products TO dbadmin;
GRANT ALL PRIVILEGES ON SEQUENCE products_id_seq TO dbadmin;

-- Insert sample data
INSERT INTO products (name, qty) VALUES
  ('Laptop', 15),
  ('Mouse', 50),
  ('Keyboard', 30);
EOF

unset PGPASSWORD

echo "Database, dbadmin user, and table created successfully!"

# Store credentials in Secrets Manager
echo "Storing database credentials in Secrets Manager..."
aws secretsmanager create-secret \
  --name ${DB_SECRET_NAME} \
  --secret-string "{\"host\":\"${RDS_ENDPOINT}\",\"username\":\"${DB_USERNAME}\",\"password\":\"${DB_PASSWORD}\"}" \
  --region ${REGION} 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id ${DB_SECRET_NAME} \
  --secret-string "{\"host\":\"${RDS_ENDPOINT}\",\"username\":\"${DB_USERNAME}\",\"password\":\"${DB_PASSWORD}\"}" \
  --region ${REGION}

# 3. Create S3 bucket for product images
echo "Creating S3 bucket: ${S3_BUCKET}"
aws s3 mb s3://${S3_BUCKET} --region ${REGION} 2>/dev/null || echo "Bucket already exists"

# Configure S3 bucket CORS
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

aws s3api put-bucket-cors --bucket ${S3_BUCKET} --cors-configuration file:///tmp/cors.json

# 4. Create DynamoDB table for customers
echo "Creating DynamoDB table: ${DYNAMODB_TABLE}"
aws dynamodb create-table \
  --table-name ${DYNAMODB_TABLE} \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ${REGION} 2>/dev/null || echo "Table already exists"

# Wait for table to be active
echo "Waiting for DynamoDB table to be active..."
aws dynamodb wait table-exists --table-name ${DYNAMODB_TABLE} --region ${REGION}

# 5. Create EFS (if not provided)
if [ -z "$EFS_ID" ]; then
  # Create new EFS file system
  if [ -z "$VPC_ID" ] || [ -z "$APP_SUBNET_IDS" ] || [ -z "$EFS_SECURITY_GROUP" ]; then
    echo "ERROR: VPC_ID, APP_SUBNET_IDS, and EFS_SECURITY_GROUP are required to create EFS"
    exit 1
  fi
  
  echo "Creating EFS file system..."
  EFS_ID=$(aws efs create-file-system \
    --performance-mode generalPurpose \
    --throughput-mode bursting \
    --encrypted \
    --region ${REGION} \
    --tags Key=Name,Value=crm-efs \
    --query 'FileSystemId' \
    --output text)
  
  echo "EFS created: ${EFS_ID}"
  
  # Wait for EFS to be available
  echo "Waiting for EFS to be available..."
  aws efs describe-file-systems --file-system-id ${EFS_ID} --region ${REGION} > /dev/null
  sleep 10
  
  # Create mount targets in each subnet
  IFS=',' read -ra SUBNETS <<< "$APP_SUBNET_IDS"
  for subnet in "${SUBNETS[@]}"; do
    echo "Creating mount target in subnet: ${subnet}"
    aws efs create-mount-target \
      --file-system-id ${EFS_ID} \
      --subnet-id ${subnet} \
      --security-groups ${EFS_SECURITY_GROUP} \
      --region ${REGION} 2>/dev/null || echo "Mount target already exists in ${subnet}"
  done
  
  # Wait for mount targets to be available
  echo "Waiting for mount targets to be available..."
  sleep 30
else
  echo "Using existing EFS: ${EFS_ID}"
fi

echo ""
echo "AWS resources setup complete!"
echo ""
echo "Configuration summary:"
if [ "$DB_TYPE" = "aurora" ]; then
  echo "  Aurora Cluster: ${DB_CLUSTER_ID}"
  echo "  Aurora Instance: ${DB_INSTANCE_ID}"
else
  echo "  RDS Instance: ${DB_INSTANCE_ID}"
fi
echo "  Database Endpoint: ${RDS_ENDPOINT}"
echo "  Database: demo"
echo "  S3 Bucket: ${S3_BUCKET}"
echo "  DynamoDB Table: ${DYNAMODB_TABLE}"
echo "  EFS ID: ${EFS_ID}"
echo "  Secrets Manager: ${DB_SECRET_NAME}"
echo "  Region: ${REGION}"
echo ""
echo "Use these values in your EC2 userdata or .env file:"
echo "  DB_HOST=${RDS_ENDPOINT}"
echo "  S3_BUCKET=${S3_BUCKET}"
echo "  DYNAMODB_TABLE=${DYNAMODB_TABLE}"
echo "  EFS_ID=${EFS_ID}"
echo "  AWS_REGION=${REGION}"
echo ""
