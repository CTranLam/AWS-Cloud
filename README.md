# Image Upload Application - EBS Storage

Simple image upload application that stores files on EC2 EBS volume and displays AWS metadata.

## Features
- Upload images to EBS volume (`/data/ebs`)
- Display AWS region and instance ID
- View uploaded images in grid layout
- Delete images

## Deployment Instructions

### 1. Update system and install Node.js

```bash
sudo -i
dnf update -y
dnf install -y nodejs22 git
```

### 2. Create EBS upload directory

```bash
mkdir -p /data/ebs
chown ec2-user:ec2-user /data/ebs
chmod 755 /data/ebs
```

### 3. Clone application

```bash
cd /home/ec2-user
git clone -b lab03-ebs-image-uploader https://github.com/vietaws/architecting.git
cd architecting
```

### 4. Create .env file

```bash
cat > .env <<EOF
PORT=3001
UPLOAD_DIR=/data/ebs
EOF
```

### 5. Install dependencies

```bash
npm install
chown -R ec2-user:ec2-user /home/ec2-user/architecting
```

### 6. Create systemd service

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

### 7. Enable and start service

```bash
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
systemctl status demo-app --no-pager
```

### 8. View logs

```bash
# Real-time logs
journalctl -u demo-app -f

# Recent logs
journalctl -u demo-app -n 50
```

## API Endpoints

- `GET /api/metadata` - Get AWS region and instance ID
- `GET /api/images` - List all uploaded images
- `POST /api/images` - Upload image (multipart/form-data, max 10MB)
- `DELETE /api/images/:name` - Delete image
- `GET /uploads/:filename` - Serve image file

## Environment Variables

- `PORT` - Server port (default: 3001)
- `UPLOAD_DIR` - Image storage directory (default: /data/ebs)

## Testing

1. Access application via browser: `http://<instance-ip>:3001`
2. Upload an image
3. Verify region and instance ID are displayed
4. Check images are stored in `/data/ebs`
5. Test delete functionality
