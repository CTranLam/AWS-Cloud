#!/bin/bash

# delete old node modules to ensure we have a clean slate for the new deployment
rm -rf /home/ec2-user/architecting/app/node_modules
# install new dependencies
cd /home/ec2-user/architecting/app
npm install --production
exit 0