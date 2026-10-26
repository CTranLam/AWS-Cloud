# Application Summary

## Single Purpose: Image Upload to EBS

This application provides a simple interface to upload images to an EC2 EBS volume and displays AWS metadata.

## Features
1. **Image Upload** - Upload images to `/data/ebs` directory
2. **AWS Metadata Display** - Shows region name and instance ID
3. **Image Gallery** - Grid view of all uploaded images
4. **Delete Function** - Remove images from EBS storage

## Tech Stack
- **Backend**: Express.js with Multer for file uploads
- **Frontend**: Vanilla JavaScript with responsive design
- **Storage**: EBS volume mounted at `/data/ebs`
- **Metadata**: EC2 instance metadata service

## Quick Deploy

```bash
# As root
sudo -i
dnf update -y
dnf install -y nodejs22 git

# Create upload directory
mkdir -p /data/ebs
chown ec2-user:ec2-user /data/ebs

# Clone and setup
cd /home/ec2-user
git clone -b lab01-ec2-simple-website https://github.com/vietaws/architecting.git
cd architecting
npm install

# Create .env
cat > .env <<EOF
PORT=3001
UPLOAD_DIR=/data/ebs
EOF

# Setup systemd service (see README.md for full service file)
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
```

## Access
Open browser: `http://<instance-ip>:3001`

## File Structure
```
architecting/
├── server.js           # Express server with image API
├── public/
│   └── index.html      # Frontend UI
├── package.json        # Dependencies
├── .env.example        # Environment template
└── README.md           # Full documentation
```
