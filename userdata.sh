#!/bin/bash
set -e

# Update system and install Node.js
dnf update -y
dnf install -y nodejs22 git postgresql17

# Clone application
cd /home/ec2-user
git clone -b lab10-auto-scaling https://github.com/vietaws/architecting.git
cd architecting

# Create .env file (update RDS_ENDPOINT with your actual RDS endpoint)
RDS_ENDPOINT=demo-db.xxxxx.ap-southesat-1.rds.amazonaws.com
RDS_PASSWORD=demoPassword

cat > .env <<EOF
DB_HOST=${RDS_ENDPOINT}
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=${RDS_PASSWORD}
PORT=3001
EOF

# Initialize database with init.sql
export PGPASSWORD=${RDS_PASSWORD}
psql "host=${RDS_ENDPOINT} port=5432 dbname=demo user=dbadmin sslmode=require" -f init.sql
unset PGPASSWORD

# Install dependencies
npm install
chown -R ec2-user:ec2-user /home/ec2-user/architecting

# Create systemd service
cat > /etc/systemd/system/demo-app.service <<'EOFS'
[Unit]
Description=Inventory Management Application
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

