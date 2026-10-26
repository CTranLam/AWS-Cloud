# Use Case 2: ASG + ALB — In-Place Rolling & Blue/Green Deployment

## Overview

| Item | Value |
|---|---|
| Target | 4 EC2s in Auto Scaling Group (Amazon Linux 2023, Graviton / t4g.micro) |
| App | Node.js + Express on port 3001 |
| Load Balancer | Application Load Balancer (ALB) in public subnet |
| Strategies | **Option A**: In-place rolling (batch size 1) · **Option B**: Blue/Green (new ASG) |
| Pipeline | GitHub → CodeBuild → CodeDeploy |
| Repo | `vietaws/architecting` branch `lab14-cicd` |

**Flow:**
```
GitHub (push) → CodePipeline → CodeBuild → CodeDeploy → ASG (rolling or blue/green)
```

---

## Architecture

```
Internet
   │
  ALB (public subnet)
   │
  Target Group (port 3001)
   │
  ┌──────────────────────────────────┐
  │  Auto Scaling Group (app subnet) │
  │  EC2-1  EC2-2  EC2-3  EC2-4     │
  │  (Node.js Express, port 3001)    │
  └──────────────────────────────────┘
```

For Blue/Green, CodeDeploy creates a second ASG (green) and shifts ALB traffic:

```
ALB
 ├── Target Group BLUE  → ASG Blue  (old version)
 └── Target Group GREEN → ASG Green (new version)  ← traffic shifted here after deploy
```

---

## Prerequisites

### ALB & Target Group

Ensure you have:
- An ALB with a listener on port 80 (or 443)
- A target group (`demo-uc2-tg-blue`) pointing to port 3001 on EC2 instances
- The ASG attached to this target group

### EC2 Launch Template

The ASG must use a Launch Template that:
- Uses AMI: Amazon Linux 2023 (ARM64)
- Instance type: `t4g.micro`
- Has the CodeDeploy agent and Node.js installed via user data (see below)

**User Data for Launch Template:**

```bash
#!/bin/bash
dnf install -y ruby wget nodejs22 npm git
cd /tmp
wget https://aws-codedeploy-ap-southeast-1.s3.ap-southeast-1.amazonaws.com/latest/install
chmod +x ./install
./install auto
systemctl enable codedeploy-agent
systemctl start codedeploy-agent
```

> Replace `ap-southeast-1` with your region.

---

## Step 1: Application Repository Structure

Same repo as Use Case 1 (`vietaws/architecting`, branch `lab14-cicd`). The files below are identical to Use Case 1 — if you are running both use cases from the same repo, you can reuse them.

```
├── app/
│   ├── index.js
│   └── package.json
├── scripts/
│   ├── install_dependencies.sh
│   ├── start_server.sh
│   └── stop_server.sh
└── specs/
    ├── appspec.yaml
    └── buildspec.yaml
```

### `app/index.js`

```javascript
import express from 'express';
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Hello from ASG EC2 - v1');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Step 2: CodeDeploy Lifecycle Scripts

### `scripts/stop_server.sh`

```bash
#!/bin/bash
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
pgrep -f "node index.js" > /dev/null || exit 1
exit 0
```

---

## Step 3: `specs/appspec.yaml`

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

---

## Step 4: `specs/buildspec.yaml`

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
    - specs/appspec.yml
  discard-paths: no
```

---

## Step 5: CodeDeploy Setup

### 5.1 Create Application

1. Go to **CodeDeploy → Applications → Create application**
2. Application name: `demo-webserver-uc2`
3. Compute platform: **EC2/On-premises**

---

### Option A: In-Place Rolling Deployment

#### 5.2A Create Deployment Group (In-Place)

1. Deployment group name: `demo-uc2-inplace`
2. Service role: *(your CodeDeploy service role)*
3. Deployment type: **In-place**
4. Environment configuration: **Amazon EC2 Auto Scaling groups**
   - Select your ASG: `demo-uc2-asg`
5. Deployment settings: **Create a custom deployment configuration**
   - Name: `demo-uc2-one-at-a-time`
   - Deployment config type: **By number**
   - Value: `1` *(deploy to 1 instance at a time)*
6. Load balancer:
   - Enable load balancing: ✅
   - Load balancer: select your ALB
   - Target group: `demo-uc2-tg-blue`
   - *(CodeDeploy will deregister each instance from the target group before deploying, then re-register after)*

**What happens during rolling deploy:**
```
Batch 1: Deregister EC2-1 from ALB → deploy → health check → re-register
Batch 2: Deregister EC2-2 from ALB → deploy → health check → re-register
Batch 3: Deregister EC2-3 from ALB → deploy → health check → re-register
Batch 4: Deregister EC2-4 from ALB → deploy → health check → re-register
```

---

### Option B: Blue/Green Deployment

#### 5.2B Create Deployment Group (Blue/Green)

1. Deployment group name: `demo-uc2-bluegreen`
2. Service role: *(your CodeDeploy service role)*
3. Deployment type: **Blue/green**
4. Environment configuration:
   - **Automatically copy Amazon EC2 Auto Scaling group**
   - Select your existing ASG: `demo-uc2-asg` *(this becomes the blue fleet)*
   - CodeDeploy will create a new ASG (green fleet) using the same launch template
5. Deployment settings:
   - Deployment config: `CodeDeployDefault.AllAtOnce`
   - Traffic rerouting: **Reroute traffic immediately** after green fleet is healthy
   - Original instances (blue fleet): **Terminate after** `10` minutes *(adjust for demo)*
6. Load balancer:
   - Enable load balancing: ✅
   - Load balancer: select your ALB
   - Target group 1 (blue): `demo-uc2-tg-blue`
   - Target group 2 (green): `demo-uc2-tg-green` *(create this target group in advance)*


JSON Policy for Blue/Green Deployment - CodeDeploy IAM Role:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "ec2:CreateTags",
                "ec2:RunInstances"
            ],
            "Resource": "*"
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "iam:PassRole"
            ],
            "Resource": "arn:aws:iam::123456789012:role/ec2-instance-role"
        }
    ]
}
```

**What happens during blue/green deploy:**
```
1. CodeDeploy creates new ASG (green) by copying launch template from blue ASG
2. New EC2 instances launch in green ASG (4 instances)
3. App is deployed to all green instances
4. ALB listener switches from blue target group → green target group
5. Blue instances remain running for 15 min (rollback window)
6. Blue instances terminated after 15 min
```

#### Pre-requisite: Create the Green Target Group

Before running a blue/green deployment, create a second target group:

1. Go to **EC2 → Target Groups → Create target group**
2. Name: `demo-uc2-tg-green`
3. Protocol: HTTP, Port: `3001`
4. VPC: same as your ALB
5. Health check path: `/health`
6. Do **not** register any instances — CodeDeploy manages this

---

## Step 6: CodePipeline Setup

### Option A Pipeline: `demo-pipeline-uc2-inplace`

1. Go to **CodePipeline → Create pipeline**
2. Pipeline name: `demo-pipeline-uc2-inplace`
3. **Source stage**
   - Provider: **GitHub (Version 2)**
   - Connection: *(your existing CodeStar connection)*
   - Repository: `vietaws/architecting`
   - Branch: `lab14-cicd`
4. **Build stage**
   - Provider: **AWS CodeBuild**
   - Project name: `demo-build-uc2` *(create once, reuse for both pipelines)*
     - Environment: Managed image, Amazon Linux, `aws/codebuild/amazonlinux2-aarch64-standard:3.0`
     - Buildspec: `specs/buildspec.yaml`
5. **Deploy stage**
   - Provider: **AWS CodeDeploy**
   - Application: `demo-webserver-uc2`
   - Deployment group: `demo-uc2-inplace`

### Option B Pipeline: `demo-pipeline-uc2-bluegreen`

Same as above, except in the Deploy stage:
- Deployment group: `demo-uc2-bluegreen`

> You can run both pipelines independently to demo each strategy.

---

## Step 7: Test the Pipelines

### Trigger a deployment

```bash
git commit -am "test: trigger uc2 pipeline"
git push origin lab14-cicd
```

### Verify rolling deploy (Option A)

Watch the CodeDeploy deployment — you should see instances being deregistered and re-registered one at a time. The ALB continues serving traffic from the remaining 3 instances during each batch.

```bash
# Hit the ALB DNS repeatedly to confirm no downtime
while true; do curl -s http://<ALB-DNS>/; sleep 1; done
```

### Verify blue/green deploy (Option B)

1. In CodeDeploy console, watch the green ASG being created
2. After traffic shifts, confirm the ALB target group shows green instances as healthy
3. Check the blue instances are still running (within the 15-min termination window)
4. To test rollback: in CodeDeploy → deployment → **Stop and roll back**

---

## Rollback

**In-Place (Option A):**
- CodeDeploy re-deploys the last successful revision to all instances
- Brief per-instance downtime during rollback (same as forward deploy)

**Blue/Green (Option B):**
- Within the termination window: CodeDeploy shifts ALB traffic back to the blue target group instantly
- After blue instances are terminated: a new deployment of the old revision is required

---

## Pros & Cons Summary

| | In-Place Rolling | Blue/Green |
|---|---|---|
| ✅ Cost | No extra instances | Doubles EC2 count during deploy |
| ✅ Rollback | Re-deploy old revision | Instant traffic shift back to blue |
| ✅ Risk | Low — 1 instance at a time | Very low — full green fleet tested before cutover |
| ⚠️ Speed | Slower (4 batches × deploy time) | Faster cutover (all green at once) |
| ⚠️ Version mix | Brief mixed versions during rolling | No mixed versions — clean cutover |
| ⚠️ Complexity | Simple | Requires 2 target groups, launch template |
