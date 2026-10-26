# AWS CDK Infrastructure — TypeScript

A multi-stack CDK project provisioning a full VPC network, application tier (ALB + Auto Scaling Group), and Aurora database cluster.

---

## Project Structure

```
iac/
├── bin/
│   └── app.ts                  # CDK app entry point
├── lib/
│   ├── network-stack.ts        # VPC, subnets, IGW, NAT GW, route tables, security groups
│   ├── app-stack.ts            # ALB, Auto Scaling Group
│   └── database-stack.ts       # Aurora cluster
├── scripts/
│   └── user-data.sh            # EC2 user data script
├── cdk.json
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- Node.js >= 18
- AWS CLI configured (`aws configure`)
- CDK CLI: `npm install -g aws-cdk`
- Bootstrap your AWS account/region (first time only):

```bash
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

---

## Setup

```bash
npm install
```

---

## Stack Overview

### 1. NetworkStack (`lib/network-stack.ts`)

Provisions the foundational network layer:

| Resource | Details |
|---|---|
| VPC | CIDR `10.0.0.0/16`, 2 AZs |
| Public Subnets | 2 subnets (one per AZ), `10.0.0.0/24`, `10.0.1.0/24` |
| Private Subnets | 2 subnets (one per AZ), `10.0.2.0/24`, `10.0.3.0/24` |
| Internet Gateway | Attached to VPC, associated with public route table |
| NAT Gateway | 1 NAT GW in a public subnet; private subnets route `0.0.0.0/0` through it |
| Public Route Table | Routes `0.0.0.0/0` → Internet Gateway; associated with both public subnets |
| Private Route Table | Routes `0.0.0.0/0` → NAT Gateway; associated with both private subnets |
| Public Security Group | Allows inbound HTTP (80) and HTTPS (443) from `0.0.0.0/0` |
| Private Security Group | Allows inbound traffic only from the public security group |

**Exports:** VPC, subnets, and security groups are passed as props to downstream stacks.

---

### 2. AppStack (`lib/app-stack.ts`)

Depends on **NetworkStack**. Provisions the application tier:

| Resource | Details |
|---|---|
| Application Load Balancer | Internet-facing, placed in public subnets, uses public security group |
| ALB Listener | HTTP on port 80, forwards to target group |
| Target Group | HTTP port 80, health check on `/health` |
| Launch Template | EC2 instance type (e.g. `t3.micro`), AMI, user data script |
| Auto Scaling Group | Min 2 / Max 4 instances, placed in private subnets, attached to ALB target group |

---

### 3. DatabaseStack (`lib/database-stack.ts`)

Depends on **NetworkStack**. Provisions the Aurora cluster:

| Resource | Details |
|---|---|
| DB Subnet Group | Uses private subnets |
| Aurora Cluster | MySQL or PostgreSQL compatible, Multi-AZ, placed in private subnets |
| DB Security Group | Allows inbound on port `3306` / `5432` only from the private security group |
| Secret | Database credentials stored in AWS Secrets Manager |

---

## Deployment

Deploy all stacks in dependency order:

```bash
# Synthesize CloudFormation templates
cdk synth

# Deploy network first
cdk deploy NetworkStack

# Deploy app and database (can be done together after network is up)
cdk deploy AppStack DatabaseStack
```

Or deploy everything at once:

```bash
cdk deploy --all
```

---

## Stack Dependencies in `bin/app.ts`

```
NetworkStack
    ├── AppStack      (receives vpc, subnets, securityGroups from NetworkStack)
    └── DatabaseStack (receives vpc, subnets, securityGroups from NetworkStack)
```

Wire the stacks by passing `NetworkStack` outputs as constructor props into `AppStack` and `DatabaseStack`.

---

## Teardown

```bash
cdk destroy --all
```

> Note: Aurora clusters have deletion protection enabled by default. Disable it before destroying, or set `removalPolicy: RemovalPolicy.DESTROY` during development.

---

## Useful Commands

| Command | Description |
|---|---|
| `cdk synth` | Emit CloudFormation templates |
| `cdk diff` | Compare deployed stack with current state |
| `cdk deploy <StackName>` | Deploy a specific stack |
| `cdk destroy --all` | Tear down all stacks |
| `npm run build` | Compile TypeScript |
| `npm run watch` | Watch mode for TypeScript |
