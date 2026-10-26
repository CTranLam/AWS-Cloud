# Use Case 1: Single EC2 — In-Place Deployment

## Overview

| Item | Value |
|---|---|
| Target | Single EC2 (Amazon Linux 2023, Graviton / t4g.micro) |
| App | Node.js + Express on port 3001 |
| Strategy | CodeDeploy in-place |
| Pipeline | GitHub → CodeBuild → CodeDeploy |

**Flow:**
```
GitHub (push) → CodePipeline → CodeBuild (build & test) → CodeDeploy (in-place on EC2)
```

---

## Architecture

```
Internet
   │
   └── EC2 (app subnet, port 3001)
         └── Node.js Express app
         └── CodeDeploy Agent
```

---

## Step 1: Prepare the EC2 Instance

### 1.1 Install CodeDeploy Agent

SSH into the EC2 and run:

```bash
sudo -i
dnf install -y ruby wget
cd /home/ec2-user
wget https://aws-codedeploy-ap-southeast-1.s3.ap-southeast-1.amazonaws.com/latest/install
chmod +x ./install
./install auto
systemctl enable codedeploy-agent
systemctl start codedeploy-agent
systemctl status codedeploy-agent
```

> Replace `ap-southeast-1` with your actual AWS region.

### 1.2 Install Node.js

```bash
sudo dnf install -y nodejs npm
node -v
```

### 1.3 Tag the EC2

Add a tag so CodeDeploy can identify the target:

| Key | Value |
|---|---|
| `env` | `production` |
| `layer` | `webserver` |

---

## Step 2: Application Repository Structure

### `app/package.json`

```json
{
  "name": "demo-webserver",
  "version": "1.0.0",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "4.18.2"
  }
}
```

### `app/index.js`

```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Hello from EC2 - v1');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Step 3: CodeDeploy Lifecycle Scripts

### `scripts/stop_server.sh`

```bash
#!/bin/bash
# Stop the app if running
if pgrep -f "node index.js" > /dev/null; then
  pkill -f "node index.js"
  sleep 2
fi
exit 0
```

### `scripts/install_dependencies.sh`

```bash
#!/bin/bash
cd /home/ec2-user/app
npm install --production
exit 0
```

### `scripts/start_server.sh`

```bash
#!/bin/bash
cd /home/ec2-user/app
nohup node index.js > /var/log/app.log 2>&1 &
sleep 2
# Verify the process started
pgrep -f "node index.js" > /dev/null || exit 1
exit 0
```

---

## Step 4: `appspec.yml`

Place this at the **root** of the repo:

```yaml
version: 0.0
os: linux

files:
  - source: app/
    destination: /home/ec2-user/app

hooks:
  ApplicationStop:
    - location: scripts/stop_server.sh
      timeout: 30
      runas: root

  AfterInstall:
    - location: scripts/install_dependencies.sh
      timeout: 120
      runas: ec2-user

  ApplicationStart:
    - location: scripts/start_server.sh
      timeout: 30
      runas: ec2-user
```

> CodeDeploy Agent Comamnds:
- Check service running: systemctl status codedeploy-agent
- View logs: sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log
---

## Step 5: `buildspec.yml`

Place this at the **root** of the repo:

```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
  build:
    commands:
      - echo "Running tests..."
      - cd app && npm install && npm test --if-present
  post_build:
    commands:
      - echo "Build complete"

artifacts:
  files:
    - app/**/*
    - scripts/**/*
    - appspec.yml
  discard-paths: no
```

---

## Step 6: CodeDeploy Setup (Console)

### 6.1 Create Application

1. Go to **CodeDeploy → Applications → Create application**
2. Application name: `demo-webserver-uc1`
3. Compute platform: **EC2/On-premises**

### 6.2 Create Deployment Group

1. Deployment group name: `demo-uc1-inplace`
2. Service role: *(your CodeDeploy service role)*
3. Deployment type: **In-place**
4. Environment configuration: **Amazon EC2 instances**
   - Tag key: `app`, value: `webserver`
5. Deployment settings: `CodeDeployDefault.AllAtOnce` *(single instance)*
6. Load balancer: **Disable** *(no ALB in this use case)*

---

## Step 7: CodePipeline Setup (Console)

1. Go to **CodePipeline → Create pipeline**
2. Pipeline name: `demo-pipeline-uc1`
3. **Source stage**
   - Provider: **GitHub (Version 2)**
   - Connection: *(your existing CodeStar connection)*
   - Repository: `vietaws/architecting`
   - Branch: `lab14-cicd`
   - Output artifact format: `CodePipeline default`
4. **Build stage**
   - Provider: **AWS CodeBuild**
   - Create a new CodeBuild project:
     - Name: `demo-build-uc1`
     - Environment: Managed image, Amazon Linux, `aws/codebuild/amazonlinux2-aarch64-standard:3.0` *(ARM/Graviton)*
     - Buildspec: Use `buildspec.yml` from source
5. **Deploy stage**
   - Provider: **AWS CodeDeploy**
   - Application: `demo-webserver-uc1`
   - Deployment group: `demo-uc1-inplace`

---

## Step 8: Test the Pipeline

1. Push a change to branch `lab14-cicd`:
   ```bash
   git commit -am "test: trigger pipeline v1"
   git push origin lab14-cicd
   ```
2. Watch the pipeline in CodePipeline console.
3. After deploy succeeds, verify:
   ```bash
   curl http://<EC2-private-ip>:3001/
   curl http://<EC2-private-ip>:3001/health
   ```

---

## Deployment Lifecycle (In-Place)

```
ApplicationStop       → stop_server.sh       (kill existing process)
DownloadBundle        → CodeDeploy pulls artifact from S3
BeforeInstall         → (not used)
Install               → files copied to /home/ec2-user/app
AfterInstall          → install_dependencies.sh (npm install)
ApplicationStart      → start_server.sh       (start new version)
ValidateService       → (optional: add a curl health check script here)
```

---

## Rollback

In CodeDeploy console:
- Go to the deployment → **Stop and roll back deployment**
- CodeDeploy re-deploys the last successful revision automatically.

Or trigger via CLI:
```bash
aws deploy create-deployment \
  --application-name demo-webserver-uc1 \
  --deployment-group-name demo-uc1-inplace \
  --s3-location bucket=<artifact-bucket>,key=<previous-revision-key>,bundleType=zip
```

---

## Pros & Cons Summary

| | In-Place (Single EC2) |
|---|---|
| ✅ Simple setup | No extra infrastructure |
| ✅ Fast | No new instances to provision |
| ⚠️ Downtime | Brief downtime between stop and start |
| ⚠️ Rollback | Slow — requires re-deploy of old revision |
| ⚠️ Risk | If deploy fails mid-way, site is down |
