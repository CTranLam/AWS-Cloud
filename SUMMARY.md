# Application Summary

## Single Purpose: Image Upload to S3

This application provides a simple interface to upload images to Amazon S3 and displays AWS metadata.

## Features
1. **Image Upload** - Upload images to S3 bucket
2. **AWS Metadata Display** - Shows region name and instance ID
3. **Image Gallery** - Grid view with presigned URLs
4. **Delete Function** - Remove images from S3
5. **Secure Access** - Presigned URLs (1 hour expiry)

## Tech Stack
- **Backend**: Express.js with Multer (memory storage)
- **Frontend**: Vanilla JavaScript with responsive design
- **Storage**: Amazon S3
- **AWS SDK**: @aws-sdk/client-s3 v3
- **Metadata**: EC2 instance metadata service (IMDSv2)

## Quick Deploy

```bash
# As root
sudo -i
dnf update -y
dnf install -y nodejs22 git

# Clone and setup
cd /home/ec2-user
git clone -b lab04-ec2-s3 https://github.com/vietaws/architecting.git
cd architecting
npm install

# Create .env (replace with your bucket name)
cat > .env <<EOF
PORT=3001
S3_BUCKET=architecting-demo-xxx
EOF

# Setup systemd service (see README.md for full service file)
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
```

## IAM Role Required

Attach policy to EC2 instance role:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
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

## Access
Open browser: `http://<instance-ip>:3001`

## File Structure
```
architecting/
├── server.js           # Express server with S3 integration
├── public/
│   └── index.html      # Frontend UI
├── package.json        # Dependencies (includes AWS SDK)
├── .env.example        # Environment template
├── userdata.sh         # EC2 user data script
└── README.md           # Full documentation
```

## S3 Benefits
- Scalable object storage (no capacity planning)
- High durability (99.999999999%)
- Presigned URLs for secure access
- Accessible from multiple EC2 instances
- No local storage required
