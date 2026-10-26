#!/bin/bash
set -e

# Update system
dnf update -y

# Install Node.js 22, and Git
dnf install -y nodejs22 git

# Clone application
cd /home/ec2-user
git clone -b lab14-cicd https://github.com/vietaws/architecting.git
cd architecting/app
# mv -f index-base.js index.js

# Create .env file (update DB_HOST with your database endpoint)
cat > .env <<EOF
PORT=3001
EOF

# Install dependencies
npm install

# Set permissions
chown -R ec2-user:ec2-user /home/ec2-user/architecting

# Create systemd service
cat > /etc/systemd/system/demo-app.service <<'EOFS'
[Unit]
Description=AWS Architecting Demo Application - Viet Tran
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

# Start service
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
systemctl status demo-app --no-pager