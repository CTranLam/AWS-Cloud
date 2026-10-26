# Image Upload Application - S3 Storage

Simple image upload application that stores files on Amazon S3 and displays AWS metadata.

## Features
- Upload images to Amazon S3 bucket
- Display AWS region and instance ID
- View uploaded images in grid layout
- Delete images from S3
- Presigned URLs for secure image access

## Prerequisites
- Amazon S3 bucket created (e.g., `architecting-demo-xxx`)
- EC2 instance with IAM role that has S3 permissions:
  - `s3:PutObject`
  - `s3:GetObject`
  - `s3:ListBucket`
  - `s3:DeleteObject`

## Deployment Instructions

### 1. Update system and install Node.js

```bash
sudo -i
dnf update -y
dnf install -y nodejs22 git
```

### 2. Clone application

```bash
cd /home/ec2-user
git clone -b lab05-s3-image-uploader https://github.com/vietaws/architecting.git
cd architecting
```

### 3. Create .env file

Replace `architecting-demo-xxx` with your S3 bucket name and set your AWS region:

```bash
cat > .env <<EOF
PORT=3001
S3_BUCKET=lab05-xxx
AWS_REGION=ap-southeast-1
EOF
```

### 4. Install dependencies

```bash
npm install
chown -R ec2-user:ec2-user /home/ec2-user/architecting
```

### 5. Create systemd service

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

### 6. Enable and start service

```bash
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
systemctl status demo-app --no-pager
```

### 7. View logs

```bash
# Real-time logs
journalctl -u demo-app -f

# Recent logs
journalctl -u demo-app -n 50
```

## IAM Role Policy

Attach this policy to your EC2 instance role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::architecting-demo-xxx/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::architecting-demo-xxx"
    }
  ]
}
```

## API Endpoints

- `GET /api/metadata` - Get AWS region and instance ID
- `GET /api/images` - List all uploaded images with presigned URLs
- `POST /api/images` - Upload image (multipart/form-data, max 10MB)
- `DELETE /api/images/:name` - Delete image from S3

## Environment Variables

- `PORT` - Server port (default: 3000)
- `S3_BUCKET` - S3 bucket name (required)
- `AWS_REGION` - AWS region (default: us-east-1)

## Testing

1. Access application via browser: `http://<instance-ip>:3001`
2. Upload an image
3. Verify region and instance ID are displayed
4. Check images are stored in S3 bucket
5. Test delete functionality
6. Verify presigned URLs expire after 1 hour

## S3 Benefits
- Scalable object storage
- High durability (99.999999999%)
- No capacity planning required
- Presigned URLs for secure access
- Can be accessed from multiple EC2 instances
