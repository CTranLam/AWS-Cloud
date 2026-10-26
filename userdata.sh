#!/bin/bash
set -e

# Update system and install dependencies
dnf update -y
dnf install -y nodejs22 git amazon-efs-utils python3 python3-pip    
pip3 install botocore 

# Mount EFS file system (replace with your EFS ID)
EFS_ID=fs-04ffb1e04ec0b8138
mkdir -p /mnt/efs
mount -t efs -o tls ${EFS_ID}:/ /mnt/efs

# Add to fstab for persistent mount
echo "${EFS_ID}:/ /mnt/efs efs _netdev,tls 0 0" >> /etc/fstab

# Set permissions
chown ec2-user:ec2-user /mnt/efs
chmod 755 /mnt/efs

# Clone application
cd /home/ec2-user
git clone -b lab05-efs-image-uploader https://github.com/vietaws/architecting.git
cd architecting

# Create .env file
cat > .env <<EOF
PORT=3001
UPLOAD_DIR=/mnt/efs
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
