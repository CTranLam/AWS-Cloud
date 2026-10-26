# Use Case 3: ECS Fargate — Full Cutover & Canary Deployment

## Overview

| Item | Value |
|---|---|
| Target | Existing ECS Fargate service behind ALB |
| App | Node.js + Express container on port 3001 |
| Load Balancer | ALB with two target groups (blue/green) |
| Strategies | **Option A**: Full cutover (all-at-once) · **Option B**: Canary 10% for 5 min |
| Pipeline | GitHub → CodeBuild (build & push image) → CodeDeploy (ECS blue/green) |
| Repo | `vietaws/architecting` branch `lab14-cicd` |

**Flow:**
```
GitHub (push) → CodePipeline → CodeBuild (build image, push to ECR) → CodeDeploy (ECS blue/green)
```

---

## Architecture

```
Internet
   │
  ALB (public subnet)
   │  Listener port 80
   │
   ├── Listener Rule → Target Group BLUE  (port 3001) → Fargate tasks (current)
   └── Test Listener  → Target Group GREEN (port 3001) → Fargate tasks (new)
                                                          ↑
                                              CodeDeploy shifts traffic here
```

During canary: ALB sends 10% of production traffic to green, 90% stays on blue for 5 minutes, then 100% shifts to green.

---

## Prerequisites

Before running the pipeline, ensure the following exist:

1. **ECR repository** — to store Docker images (e.g., `demo-webserver`)
2. **ECS cluster** — Fargate cluster (e.g., `demo-cluster`)
3. **ECS service** — already created, using a task definition with container port 3001
4. **Two ALB target groups**:
   - `demo-uc3-tg-blue` — currently attached to the ECS service
   - `demo-uc3-tg-green` — empty, managed by CodeDeploy
5. **ALB listener** on port 80 forwarding to `demo-uc3-tg-blue`
6. **ALB test listener** on port 8080 forwarding to `demo-uc3-tg-green` *(used during canary to test green before full shift)*

Command to create ECS Service (Blue/Green with CODE_DEPLOY deployment controller)

```sh
aws ecs create-service \
    --cluster mycluster \
    --service-name my-svc \
    --task-definition my-td:1 \
    --deployment-controller type=CODE_DEPLOY \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-0aff4ca2a21fb79b0,subnet-0faac0a4333c18e6f],securityGroups=[sg-01c828e9581d09303],assignPublicIp=ENABLED}" \
    --load-balancers "[{\"targetGroupArn\": \"arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/tg-blue/912c3062848e55ff\", \"containerName\": \"example\", \"containerPort\": 3001}]"
```
---

## Step 1: Application & Docker Setup

### Repository Structure

```
├── app/
│   ├── index.js
│   └── package.json
├── specs/
│   ├── appspec.yml
│   ├── buildspec.yml
│   └── taskdef.json
└── Dockerfile
```

### `app/index.js`

```javascript
const express = require('express');
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send('Hello from ECS - v1');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

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

### `Dockerfile`

```dockerfile
FROM node:24-alpine3.22
WORKDIR /app
COPY app/package.json .
RUN npm install --production
COPY app/ .
EXPOSE 3001
CMD ["node", "index.js"]
```

---

## Step 2: `specs/buildspec.yml`

CodeBuild builds the Docker image, pushes it to ECR, and produces two output artifacts that CodeDeploy needs: `appspec.yml` and `taskdef.json`.

```yaml
version: 0.2

env:
  variables:
    AWS_ACCOUNT_ID: "123456789012"       # replace with your account ID
    AWS_REGION: "ap-southeast-1"         # replace with your region
    ECR_REPO: "demo-webserver"
    ECS_CONTAINER_NAME: "demo-webserver" # must match container name in task definition

phases:
  pre_build:
    commands:
      - echo Logging in to ECR...
      - aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
      - IMAGE_TAG=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c1-8)
      - IMAGE_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG
  build:
    commands:
      - echo Building Docker image...
      - docker build -t $IMAGE_URI .
  post_build:
    commands:
      - echo Pushing image to ECR...
      - docker push $IMAGE_URI
      - echo Writing imageDetail.json...
      - printf '{"ImageURI":"%s"}' $IMAGE_URI > imageDetail.json
      - echo Writing appspec.yml...
      - |
        cat > specs/appspec.yml << EOF
        version: 0.0
        Resources:
          - TargetService:
              Type: AWS::ECS::Service
              Properties:
                TaskDefinition: <TASK_DEFINITION>
                LoadBalancerInfo:
                  ContainerName: "$ECS_CONTAINER_NAME"
                  ContainerPort: 3001
        EOF

artifacts:
  files:
    - specs/appspec.yml
    - specs/taskdef.json
    - imageDetail.json
  discard-paths: yes
```

---

## Step 3: `specs/taskdef.json`

This is the ECS task definition template. CodeDeploy uses `imageDetail.json` to replace `<IMAGE1_NAME>` with the newly built image URI.

```json
{
  "family": "lab14-td",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::274595021951:role/ecs-task-execution-role",
  "runtimePlatform": {
    "cpuArchitecture": "ARM64",
    "operatingSystemFamily": "LINUX"
  },
  "containerDefinitions": [
    {
      "name": "example",
      "image": "<IMAGE1_NAME>",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/lab14-td",
          "awslogs-region": "ap-southeast-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

> Replace `123456789012` with your AWS account ID and `ap-southeast-1` with your region.
> The `<IMAGE_NAME>` placeholder is replaced automatically by CodePipeline using `imageDetail.json`.

---

## Step 4: `specs/appspec.yml`

This file is generated dynamically in `buildspec.yml` (see Step 2). It tells CodeDeploy which ECS service and container to update.

If you prefer a static file in the repo, use this:

```yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: <TASK_DEFINITION>
        LoadBalancerInfo:
          ContainerName: "example"
          ContainerPort: 3001
```

> `<TASK_DEFINITION>` is replaced automatically by CodeDeploy with the newly registered task definition ARN.

---

## Step 5: CodeDeploy Setup

### 5.1 Create Application

1. Go to **CodeDeploy → Applications → Create application**
2. Application name: `demo-webserver-uc3`
3. Compute platform: **Amazon ECS**

---

### Option A: Full Cutover (All-at-Once)

#### 5.2A Create Deployment Group

1. Deployment group name: `demo-uc3-fullcutover`
2. Service role: *(your CodeDeploy service role with ECS permissions)*
3. ECS cluster name: `demo-cluster`
4. ECS service name: `demo-webserver-service`
5. Load balancers:
   - Load balancer: select your ALB
   - Production listener: port `80`
   - Test listener: port `8080` *(optional for full cutover, but good practice)*
   - Target group 1 (blue): `demo-uc3-tg-blue`
   - Target group 2 (green): `demo-uc3-tg-green`
6. Deployment settings:
   - Deployment configuration: **`CodeDeployDefault.ECSAllAtOnce`**
7. Original task set termination:
   - Terminate after: `15` minutes *(blue tasks stay running for rollback window)*

**What happens during full cutover:**
```
1. CodeDeploy registers new task definition (with new image)
2. Creates green task set — Fargate launches new tasks
3. Green tasks pass ALB health checks on port 8080 (test listener)
4. ALB listener (port 80) switches 100% traffic to green immediately
5. Blue task set remains for 15 min (rollback window)
6. Blue tasks terminated after 15 min
```

---

### Option B: Canary 10% for 5 Minutes

#### 5.2B Create Deployment Group

1. Deployment group name: `demo-uc3-canary`
2. Service role: *(same as above)*
3. ECS cluster name: `demo-cluster`
4. ECS service name: `demo-webserver-service`
5. Load balancers: same as Option A
6. Deployment settings:
   - Deployment configuration: **`CodeDeployDefault.ECSCanary10Percent5Minutes`**
7. Original task set termination:
   - Terminate after: `15` minutes

**What happens during canary deploy:**
```
1. CodeDeploy registers new task definition
2. Creates green task set — Fargate launches new tasks
3. Green tasks pass health checks on test listener (port 8080)
4. ALB shifts 10% of production traffic (port 80) to green
5. Wait 5 minutes — monitor CloudWatch alarms (optional)
6. If healthy: ALB shifts remaining 90% → 100% on green
7. Blue task set terminated after 15 min
8. If unhealthy: automatic rollback to 100% blue
```

---

## Step 6: CodePipeline Setup

### Option A Pipeline: `demo-pipeline-uc3-fullcutover`

1. Go to **CodePipeline → Create pipeline**
2. Pipeline name: `demo-pipeline-uc3-fullcutover`
3. **Source stage**
   - Provider: **GitHub (Version 2)**
   - Connection: *(your existing CodeStar connection)*
   - Repository: `vietaws/architecting`
   - Branch: `lab14-cicd`
4. **Build stage**
   - Provider: **AWS CodeBuild**
   - Create project `demo-build-uc3`:
     - Environment: Managed image, Amazon Linux, Standard runtime
     - Privileged mode: ✅ *(required for Docker builds)*
     - Buildspec: `specs/buildspec.yml`
   - Output artifacts: `BuildArtifact`
5. **Deploy stage**
   - Provider: **Amazon ECS (Blue/Green)**
   - Application name: `demo-webserver-uc3`
   - Deployment group: `demo-uc3-fullcutover`
   - Amazon ECS task definition: `BuildArtifact` → `specs/taskdef.json`
   - AWS CodeDeploy AppSpec file: `BuildArtifact` → `specs/appspec.yml`
   - Dynamically update task definition image: `BuildArtifact` → `imageDetail.json`

### Option B Pipeline: `demo-pipeline-uc3-canary`

Same as above, except in the Deploy stage:
- Deployment group: `demo-uc3-canary`

---

## Step 7: Test the Pipelines

### Trigger a deployment

```bash
git commit -am "test: trigger uc3 pipeline"
git push origin lab14-cicd
```

### Verify full cutover (Option A)

```bash
# Watch traffic — should switch 100% immediately after green is healthy
while true; do curl -s http://<ALB-DNS>/; sleep 1; done
```

In CodeDeploy console: watch the deployment go from `Pending` → `InProgress` → `Succeeded`.

### Verify canary (Option B)

```bash
# During the 5-minute canary window, ~10% of responses should be from the new version
while true; do curl -s http://<ALB-DNS>/; sleep 0.5; done
```

In CodeDeploy console: you will see the deployment pause at the canary step showing `10% traffic shifted`. After 5 minutes it automatically completes.

### Test the green task set directly (before traffic shift)

During any blue/green deployment, you can hit the test listener directly:

```bash
curl http://<ALB-DNS>:8080/
```

This hits the green task set before production traffic is shifted — useful for smoke testing.

---

## Rollback

**Automatic rollback** (canary only): Configure a CloudWatch alarm on the deployment group. If the alarm fires during the canary window, CodeDeploy automatically shifts traffic back to 100% blue.

**Manual rollback** (both options): In CodeDeploy console → deployment → **Stop and roll back deployment**. Traffic shifts back to blue instantly (within the termination window).

After the blue task set is terminated (after 15 min), rollback requires a new deployment of the previous image tag.

---

## Pros & Cons Summary

| | Full Cutover (All-at-Once) | Canary 10% / 5 min |
|---|---|---|
| ✅ Speed | Fastest — immediate 100% shift | Slower — 5 min canary window |
| ✅ Simplicity | Simple — no traffic split logic | Slightly more complex |
| ✅ Rollback | Instant (within termination window) | Instant — only 10% of users affected |
| ⚠️ Risk | All users hit new version at once | Only 10% of users exposed to new version |
| ⚠️ Blast radius | 100% if new version has a bug | 10% if new version has a bug |
| ⚠️ Observability | Need to monitor after full shift | Can monitor during canary window before full shift |
