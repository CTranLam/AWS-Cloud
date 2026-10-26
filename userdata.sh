#!/bin/bash
set -e

# Update system and install Node.js
dnf update -y
dnf install -y nodejs22 git

# Clone application
cd /home/ec2-user
git clone -b lab06-s3-image-uploader https://github.com/vietaws/architecting.git
cd architecting

# Create .env file (replace with your S3 bucket name)
cat > .env <<EOF
PORT=3001
S3_BUCKET=architecting-demo-xxx
AWS_REGION=ap-southeast-1
EOF

# Install dependencies
npm install
chown -R ec2-user:ec2-user /home/ec2-user/architecting

# Create systemd service
cat > /etc/systemd/system/demo-app.service <<'EOFS'
[Unit]
Description=Image Upload Application
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
SyslogIdentifier=demo-app

[Install]
WantedBy=multi-user.target
EOFS

# Enable and start service
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
