# AWS CloudFormation Infrastructure Guide

Provisions a full VPC network, application tier (ALB + Auto Scaling Group), and Aurora database cluster using AWS CloudFormation templates, divided into three stacks: network, app, and database.

---

## Project Structure

```
cfn/
├── templates/
│   ├── network-stack.yaml      # VPC, subnets, IGW, NAT GW, route tables, security groups
│   ├── app-stack.yaml          # ALB, Auto Scaling Group
│   └── database-stack.yaml     # Aurora cluster, Secrets Manager
├── scripts/
│   └── user-data.sh            # EC2 user data script
└── deploy.sh                   # Helper script to deploy all stacks in order
```

---

## Prerequisites

- AWS CLI configured (`aws configure`)
- An S3 bucket to upload templates (if using `aws cloudformation package`)
- IAM permissions for EC2, RDS, ELB, Secrets Manager, and CloudFormation

---

## Stack Overview

### 1. network-stack.yaml

Provisions the foundational network layer. All outputs are exported for cross-stack references.

#### Resources

| Resource | Details |
|---|---|
| VPC | CIDR `10.0.0.0/16`, DNS enabled |
| Public Subnets | 2 subnets — `10.0.0.0/24` (AZ-a), `10.0.1.0/24` (AZ-b) |
| Private Subnets | 2 subnets — `10.0.2.0/24` (AZ-a), `10.0.3.0/24` (AZ-b) |
| Internet Gateway | Attached to VPC |
| NAT Gateway | 1 NAT GW with EIP in first public subnet |
| Public Route Table | `0.0.0.0/0` → IGW; associated with both public subnets |
| Private Route Table | `0.0.0.0/0` → NAT GW; associated with both private subnets |
| Public Security Group | Inbound TCP 80 and 443 from `0.0.0.0/0` |
| Private Security Group | Inbound all TCP from public security group only |

#### Outputs (exported for cross-stack use)

| Export Name | Value |
|---|---|
| `NetworkStack-VpcId` | VPC ID |
| `NetworkStack-PublicSubnet1` | Public Subnet 1 ID |
| `NetworkStack-PublicSubnet2` | Public Subnet 2 ID |
| `NetworkStack-PrivateSubnet1` | Private Subnet 1 ID |
| `NetworkStack-PrivateSubnet2` | Private Subnet 2 ID |
| `NetworkStack-PublicSG` | Public Security Group ID |
| `NetworkStack-PrivateSG` | Private Security Group ID |

---

### 2. app-stack.yaml

Depends on **network-stack**. Imports outputs via `Fn::ImportValue`.

#### Resources

| Resource | Details |
|---|---|
| Application Load Balancer | Internet-facing, public subnets, public security group |
| ALB Listener | HTTP port 80, forwards to target group |
| Target Group | HTTP port 80, health check on `/health` |
| Launch Template | `t3.micro`, Amazon Linux 2, user data from `scripts/user-data.sh` |
| Auto Scaling Group | Min 2 / Max 4, private subnets, attached to target group |

#### Parameters

| Parameter | Default | Description |
|---|---|---|
| `InstanceType` | `t3.micro` | EC2 instance type |
| `AmiId` | — | Amazon Linux 2 AMI ID for your region |

---

### 3. database-stack.yaml

Depends on **network-stack**. Imports outputs via `Fn::ImportValue`.

#### Resources

| Resource | Details |
|---|---|
| Secrets Manager Secret | Generates `admin` username + random password |
| DB Security Group | Inbound TCP 3306 and 5432 from private security group only |
| DB Subnet Group | Uses both private subnets |
| Aurora Cluster | `aurora-mysql` engine, Multi-AZ, storage encrypted, credentials from Secrets Manager |

---

## Deployment

### Step 1 — Deploy Network Stack

```bash
aws cloudformation deploy \
  --template-file templates/network-stack.yaml \
  --stack-name NetworkStack \
  --capabilities CAPABILITY_NAMED_IAM
```

### Step 2 — Deploy App Stack

```bash
aws cloudformation deploy \
  --template-file templates/app-stack.yaml \
  --stack-name AppStack \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides AmiId=<YOUR_AMI_ID>
```

### Step 3 — Deploy Database Stack

```bash
aws cloudformation deploy \
  --template-file templates/database-stack.yaml \
  --stack-name DatabaseStack \
  --capabilities CAPABILITY_NAMED_IAM
```

### Deploy All at Once (via helper script)

```bash
chmod +x deploy.sh
./deploy.sh <YOUR_AMI_ID>
```

---

## Cross-Stack References

CloudFormation stacks share values using `Outputs` + `Fn::ImportValue`:

```
NetworkStack  →  exports VpcId, SubnetIds, SecurityGroupIds
                    ↓                        ↓
               AppStack              DatabaseStack
          (imports via Fn::ImportValue)
```

> Stacks that import outputs from another stack cannot be deleted until the importing stack is deleted first.

---

## Teardown

Delete stacks in reverse dependency order:

```bash
aws cloudformation delete-stack --stack-name AppStack
aws cloudformation delete-stack --stack-name DatabaseStack

# Wait for both to finish, then:
aws cloudformation delete-stack --stack-name NetworkStack
```

> Aurora clusters have deletion protection enabled by default. Set `DeletionProtection: false` in `database-stack.yaml` before deleting, or update the stack first.

---

## Useful Commands

| Command | Description |
|---|---|
| `aws cloudformation deploy` | Create or update a stack |
| `aws cloudformation delete-stack` | Delete a stack |
| `aws cloudformation describe-stacks` | View stack status and outputs |
| `aws cloudformation validate-template` | Validate a template before deploying |
| `aws cloudformation list-stack-resources` | List all resources in a stack |
