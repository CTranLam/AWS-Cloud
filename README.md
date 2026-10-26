# Infrastructure as Code — Overview

This repository covers three approaches to provisioning AWS infrastructure, from learning fundamentals to production-ready tooling.

---

## Guides in This Repo

| File | Tool | Purpose |
|---|---|---|
| [README_IAC.md](./README_IAC.md) | AWS CloudFormation (learning) | 16 progressive demos covering CFN concepts from skeleton to nested stacks |
| [README_CFN.md](./README_CFN.md) | AWS CloudFormation (production) | Full VPC + ALB + ASG + Aurora infra split into 3 deployable stacks |
| [README_CDK.md](./README_CDK.md) | AWS CDK (TypeScript) | Same full infra as CFN but written as CDK TypeScript stacks |

---

## Infrastructure Covered (CFN & CDK)

Both `README_CFN.md` and `README_CDK.md` provision the same architecture:

```
Internet
   │
   ▼
ALB (public subnets, AZ-a + AZ-b)
   │
   ▼
Auto Scaling Group (private subnets, min 2 / max 4 × t4g.micro)
   │
   ▼
Aurora PostgreSQL 16.2 (private subnets, db.t4g.medium)
```

Networking: VPC `10.0.0.0/16`, 2 public + 2 private subnets, IGW, NAT Gateway, public and private route tables, public SG (80/443), private SG (internal only).

---

## Which Should I Use?

| | CloudFormation (CFN) | CDK (TypeScript) |
|---|---|---|
| Language | YAML | TypeScript |
| Abstraction | Low — explicit every resource | High — constructs generate resources |
| Learning curve | Lower to start | Higher (requires Node.js/TS knowledge) |
| Reusability | Limited (nested stacks, macros) | High (classes, loops, conditionals) |
| Best for | Simple infra, learning, no code dependency | Complex infra, teams comfortable with code |

---

## Learning Path

If you're new to IaC on AWS, follow this order:

1. **README_IAC.md** — work through demos 00–15 to understand CFN concepts
2. **README_CFN.md** — apply those concepts to deploy a real multi-stack architecture
3. **README_CDK.md** — learn how CDK abstracts the same architecture into TypeScript

---

## Quick Start

```bash
# CloudFormation
aws cloudformation deploy --template-file cfn/templates/network-stack.yaml --stack-name NetworkStack
aws cloudformation deploy --template-file cfn/templates/app-stack.yaml --stack-name AppStack --parameter-overrides AmiId=<ami-id>
aws cloudformation deploy --template-file cfn/templates/database-stack.yaml --stack-name DatabaseStack

# CDK
npm install
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
cdk deploy --all
```
