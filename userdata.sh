#!/bin/bash
set -e

# Configuration - Update these values
RDS_ENDPOINT=demo-cluster2.cluster-c6w5wziqkswf.ap-southeast-1.rds.amazonaws.com
S3_BUCKET=crm-demo-bucket-189999
DYNAMODB_TABLE=customers-18999
EFS_ID=fs-0f54729218001c067
AWS_REGION=ap-southeast-1
DB_SECRET_NAME=rds-cred

# Update system and install dependencies
dnf update -y
dnf install -y nodejs22 git postgresql17 amazon-efs-utils python3 python3-pip    
pip3 install botocore 

# Mount EFS
echo "Mounting EFS: ${EFS_ID}"
mkdir -p /mnt/efs
mount -t efs -o tls ${EFS_ID}:/ /mnt/efs
echo "${EFS_ID}:/ /mnt/efs efs _netdev,tls 0 0" >> /etc/fstab
chown -R ec2-user:ec2-user /mnt/efs
chmod 755 /mnt/efs

# Clone application
cd /home/ec2-user
git clone -b lab18-capstone https://github.com/vietaws/architecting.git
cd architecting

# Create .env file
cat > .env <<EOF
DB_SECRET_NAME=${DB_SECRET_NAME}
DB_HOST=${RDS_ENDPOINT}
DB_PORT=5432
DB_USER=dbadmin
S3_BUCKET=${S3_BUCKET}
DYNAMODB_TABLE=${DYNAMODB_TABLE}
EFS_PATH=/mnt/efs
AWS_REGION=${AWS_REGION}
PORT=3001
EOF

# Install dependencies
npm install
chown -R ec2-user:ec2-user /home/ec2-user/architecting

# Create systemd service
cat > /etc/systemd/system/crm-app.service <<'EOFS'
[Unit]
Description=CRM Application - AWS Architecting Capstone Project - Viet Tran
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

# Enable and start service
systemctl daemon-reload
systemctl enable crm-app
systemctl start crm-app
