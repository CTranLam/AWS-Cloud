# AWS CI/CD Demo Guide

A hands-on guide for implementing CI/CD pipelines using **AWS CodePipeline**, **CodeBuild**, and **CodeDeploy** across three common deployment scenarios.

- **Repo:** `vietaws/architecting` · **Branch:** `lab14-cicd`
- **App:** Node.js + Express on port 3001
- **OS:** Amazon Linux 2023 (Graviton / t4g.micro) for EC2 use cases

---

## Use Cases

### Use Case 1 — Single EC2 (In-Place)

> One EC2 instance running a Node.js web server. No load balancer.

**Strategy:** CodeDeploy in-place deployment. The CodeDeploy agent on the EC2 stops the running app, installs the new revision, and restarts it.

| | |
|---|---|
| Deployment type | In-place |
| Downtime | Brief (stop → start) |
| Rollback | Re-deploy previous revision |
| Best for | Dev/test environments, simple demos |

📄 [Full Guide](./use-case-1-single-ec2-inplace.md)

---

### Use Case 2 — ASG + ALB (Rolling & Blue/Green)

> 4 EC2 instances in an Auto Scaling Group behind an Application Load Balancer.

Two strategies are covered side by side:

| | In-Place Rolling | Blue/Green |
|---|---|---|
| Deployment type | In-place, 1 instance at a time | New ASG (green fleet) |
| Downtime | None (ALB drains each instance) | None (ALB cutover) |
| Rollback | Re-deploy old revision | Instant — shift ALB back to blue |
| Extra cost | None | Doubles EC2 count during deploy |
| Best for | Cost-sensitive, simple rollout | Production, safe cutover |

📄 [Full Guide](./use-case-2-asg-alb-rolling-bluegreen.md)

---

### Use Case 3 — ECS Fargate + ALB (Full Cutover & Canary)

> Existing ECS Fargate service behind an ALB. CodeBuild builds and pushes a Docker image to ECR; CodeDeploy handles the blue/green task set swap.

Two strategies are covered side by side:

| | Full Cutover | Canary 10% / 5 min |
|---|---|---|
| Deployment config | `ECSAllAtOnce` | `ECSCanary10Percent5Minutes` |
| Traffic shift | 100% immediately | 10% for 5 min → 100% |
| Rollback | Instant (within termination window) | Instant — only 10% of users affected |
| Blast radius | All users | 10% of users |
| Best for | Fast releases, low-risk changes | High-risk changes, gradual validation |

📄 [Full Guide](./use-case-3-ecs-fargate-cutover-canary.md)

---

## Pipeline Architecture

All three use cases share the same pipeline structure:

```
GitHub (push to lab14-cicd)
        │
        ▼
  CodePipeline
        │
        ├── Source Stage   — pulls code from GitHub via CodeStar Connection
        │
        ├── Build Stage    — CodeBuild: runs tests, builds artifact or Docker image
        │
        └── Deploy Stage   — CodeDeploy: deploys to EC2 / ASG / ECS
```

---

## File Structure (Repo)

```
vietaws/architecting (branch: lab14-cicd)
├── app/
│   ├── index.js          # Express app
│   └── package.json
├── scripts/              # EC2 lifecycle hooks (Use Cases 1 & 2)
│   ├── stop_server.sh
│   ├── install_dependencies.sh
│   └── start_server.sh
├── specs/                # Build & deploy specs (Use Cases 2 & 3)
│   ├── appspec.yml       # CodeDeploy deployment spec
│   ├── buildspec.yml     # CodeBuild build spec
│   └── taskdef.json      # ECS task definition template (Use Case 3 only)
├── Dockerfile            # Use Case 3 only
├── appspec.yml           # CodeDeploy spec (Use Case 1 only)
└── buildspec.yml         # CodeBuild spec (Use Case 1 only)
```

---

## Quick Comparison

| | UC1: Single EC2 | UC2: ASG + ALB | UC3: ECS Fargate |
|---|---|---|---|
| Infrastructure | 1 EC2 | 4 EC2 + ASG + ALB | Fargate + ALB |
| Deployment | In-place | Rolling or Blue/Green | Full cutover or Canary |
| Zero downtime | ❌ | ✅ | ✅ |
| Instant rollback | ❌ | ✅ (B/G only) | ✅ |
| Container-based | ❌ | ❌ | ✅ |
| Complexity | Low | Medium | Medium–High |
