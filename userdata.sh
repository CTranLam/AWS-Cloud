#!/bin/bash
set -e

# Update system
dnf update -y

# Install Node.js 22, PostgreSQL client, and Git
dnf install -y nodejs22 postgresql17 git

# Clone application
cd /home/ec2-user
git clone -b lab01-ec2-simple-website https://github.com/vietaws/architecting.git
cd architecting

# Create .env file (update DB_HOST with your database endpoint)
cat > .env <<EOF
DB_HOST=10.0.x.x
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=demoPassword
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