# Image Upload Application - EFS Storage

Simple image upload application that stores files on Amazon EFS and displays AWS metadata.

## Features
- Upload images to Amazon EFS (`/mnt/efs`)
- Display AWS region and instance ID
- View uploaded images in grid layout
- Delete images
- Shared storage across multiple EC2 instances

## Prerequisites
- Amazon EFS file system created in same VPC
- Security group allowing NFS traffic (port 2049) from EC2 to EFS
- EC2 instances in same subnets as EFS mount targets

## Deployment Instructions

### 1. Update system and install dependencies

```bash
sudo -i
dnf update -y
dnf install -y nodejs22 git amazon-efs-utils python3 python3-pip    
pip3 install botocore 
```

### 2. Mount EFS file system

Replace `fs-xxxxxxxxx` with your EFS ID:

```bash
EFS_ID=fs-xxxxxxxxx
mkdir -p /mnt/efs
mount -t efs -o tls ${EFS_ID}:/ /mnt/efs
```

### 3. Add to /etc/fstab for persistent mount

```bash
echo "${EFS_ID}:/ /mnt/efs efs _netdev,tls 0 0" >> /etc/fstab
```

### 4. Set permissions

```bash
chown ec2-user:ec2-user /mnt/efs
chmod 755 /mnt/efs
```

### 5. Clone application

```bash
cd /home/ec2-user
git clone -b lab05-efs-image-uploader https://github.com/vietaws/architecting.git
cd architecting
```

### 6. Create .env file

```bash
cat > .env <<EOF
PORT=3001
UPLOAD_DIR=/mnt/efs
EOF
```

### 7. Install dependencies

```bash
npm install
chown -R ec2-user:ec2-user /home/ec2-user/architecting
```

### 8. Create systemd service

```bash
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
```

### 9. Enable and start service

```bash
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
systemctl status demo-app --no-pager
```

### 10. View logs

```bash
# Real-time logs
journalctl -u demo-app -f

# Recent logs
journalctl -u demo-app -n 50
```

## Verify EFS Mount

```bash
df -h | grep efs
ls -la /mnt/efs
```

## API Endpoints

- `GET /api/metadata` - Get AWS region and instance ID
- `GET /api/images` - List all uploaded images
- `POST /api/images` - Upload image (multipart/form-data, max 10MB)
- `DELETE /api/images/:name` - Delete image
- `GET /uploads/:filename` - Serve image file

## Environment Variables

- `PORT` - Server port (default: 3000)
- `UPLOAD_DIR` - Image storage directory (default: /mnt/efs)

## Testing

1. Access application via browser: `http://<instance-ip>:3001`
2. Upload an image
3. Verify region and instance ID are displayed
4. Check images are stored in `/mnt/efs`
5. Test delete functionality
6. Upload from one EC2 instance and verify visibility from another instance

## EFS Benefits
- Shared storage across multiple EC2 instances
- Automatic scaling
- High availability and durability
- No capacity planning required
