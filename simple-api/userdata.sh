#!/bin/bash
set -e

# Update system
dnf update -y

# Install Node.js 22, PostgreSQL client, and Git
dnf install -y nodejs24 git

# Clone application
cd /home/ec2-user
git clone -b extra https://github.com/vietaws/architecting.git
cd architecting/simple-api

# Create .env file (update DB_HOST with your database endpoint)
cat > .env <<EOF
PORT=3001
EOF

# Install dependencies
npm install

# Set permissions
chown -R ec2-user:ec2-user /home/ec2-user/architecting/simple-api

# Create systemd service
cat > /etc/systemd/system/demo-api.service <<'EOFS'
[Unit]
Description=AWS Architecting Demo API - Viet Tran
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/architecting/simple-api
EnvironmentFile=/home/ec2-user/architecting/simple-api/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=demo-api

[Install]
WantedBy=multi-user.target
EOFS

# Start service
systemctl daemon-reload
systemctl enable demo-api
systemctl start demo-api
systemctl status demo-api --no-pager