#!/bin/bash
echo "==> [ApplicationStart] Starting New Application Server..."
cd /home/ec2-user/app
# nohup node index.js > /var/log/app.log 2>&1 &
# sleep 2
# # Verify the process started
# pgrep -f "node index.js" > /dev/null || exit 1
systemctl restart demo-app
echo "New Application Server Started successfully."
exit 0