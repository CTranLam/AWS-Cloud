# Application Summary

## Single Purpose: Image Upload to EFS

This application provides a simple interface to upload images to Amazon EFS and displays AWS metadata.

## Features
1. **Image Upload** - Upload images to `/mnt/efs` directory (EFS mount point)
2. **AWS Metadata Display** - Shows region name and instance ID
3. **Image Gallery** - Grid view of all uploaded images
4. **Delete Function** - Remove images from EFS storage
5. **Shared Storage** - Images accessible across multiple EC2 instances

## Tech Stack
- **Backend**: Express.js with Multer for file uploads
- **Frontend**: Vanilla JavaScript with responsive design
- **Storage**: Amazon EFS (Elastic File System)
- **Metadata**: EC2 instance metadata service (IMDSv2)

## Quick Deploy

```bash
# As root
sudo -i
dnf update -y
dnf install -y nodejs22 git amazon-efs-utils

# Mount EFS (replace with your EFS ID)
EFS_ID=fs-xxxxxxxxx
mkdir -p /mnt/efs
mount -t efs -o tls ${EFS_ID}:/ /mnt/efs
echo "${EFS_ID}:/ /mnt/efs efs _netdev,tls 0 0" >> /etc/fstab
chown ec2-user:ec2-user /mnt/efs

# Clone and setup
cd /home/ec2-user
git clone -b lab03-ec2-efs https://github.com/vietaws/architecting.git
cd architecting
npm install

# Create .env
cat > .env <<EOF
PORT=3001
UPLOAD_DIR=/mnt/efs
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
├── userdata.sh         # EC2 user data script
└── README.md           # Full documentation
```

## EFS Benefits
- Shared storage across multiple EC2 instances
- Automatic scaling
- High availability and durability
- No capacity planning required

