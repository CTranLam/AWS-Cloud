# ref: https://docs.aws.amazon.com/AmazonS3/latest/userguide/mountpoint-installation.html

## Amazon Linux 2023

#!bin/bash
sudo dnf install -y  mount-s3

mount-s3 --version

mkdir -p /data

mount-s3 your-bucket /data

set noswapfile
set nobackup
set nowritebackup
set noundofile


