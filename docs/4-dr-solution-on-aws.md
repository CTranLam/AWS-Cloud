# Disaster Recovery (DR) Solution on AWS
**Version:** 1.0
**Date:** 2026-05-27

---

## Overview

AWS provides a layered set of services to implement DR solutions across four strategies, ordered by increasing complexity, cost, and recovery speed.

```
Complexity & Cost
     ▲
     │  ④ Multi-Site Active/Active   ← Near-zero RTO/RPO
     │  ③ Warm Standby               ← Minutes RTO
     │  ② Pilot Light                ← 30–60 min RTO
     │  ① Backup & Restore           ← Hours RTO
     └──────────────────────────────► Recovery Speed
```

---

## Level 1 — Backup & Restore (Basic)

**RTO:** Hours | **RPO:** Hours | **Cost:** $

The simplest DR strategy. Back up data and configurations; restore from scratch when needed.

### Core AWS Services

| Service | Role |
|---|---|
| **Amazon S3** | Store backups, AMIs, config files; 11 nines durability |
| **AWS Backup** | Centralized backup across EC2, RDS, EFS, DynamoDB, FSx |
| **Amazon S3 Glacier** | Low-cost long-term archival (retrieval: minutes to hours) |
| **Amazon EC2 AMI** | Snapshot entire EC2 instances for rapid re-launch |
| **AWS Elastic Disaster Recovery (DRS)** | Continuous block-level replication; launch recovery instances on demand |

### Architecture Pattern

```
Primary Region
  EC2 / RDS / EFS
       │
       ▼ (scheduled snapshots)
  AWS Backup ──► S3 / Glacier
                      │
                      ▼ (on disaster)
              DR Region: restore EC2 from AMI,
              restore RDS from snapshot
```

### Key Configurations
- Enable **S3 Versioning** and **MFA Delete** on backup buckets
- Set **AWS Backup** plans: daily snapshots, 30-day retention
- Store AMIs in DR region via **AMI Copy**
- Use **AWS Backup Vault Lock** for immutable backups (ransomware protection)

---

## Level 2 — Pilot Light (Intermediate)

**RTO:** 30–60 min | **RPO:** Minutes | **Cost:** $$

Keep a minimal "pilot light" always running in DR region — just the core data layer. Scale up compute on failover.

### Core AWS Services

| Service | Role |
|---|---|
| **Amazon RDS (cross-region read replica)** | Replicate database to DR region; promote on failover |
| **Amazon Route 53** | DNS failover routing; health checks trigger cutover |
| **AWS CloudFormation / CDK** | Pre-built IaC templates to spin up compute quickly |
| **Amazon EC2 Auto Scaling** | Scale from 0 to full capacity on failover trigger |
| **AWS Systems Manager (SSM)** | Run failover runbooks automatically via Automation documents |
| **Amazon ECR** | Store container images in DR region for fast ECS/EKS re-launch |

### Architecture Pattern

```
Primary Region                    DR Region (Pilot Light)
  EC2 (full) + RDS (primary)          RDS read replica (always on)
       │                                    │
       │ continuous replication             │ promote to primary on failover
       ▼                                    ▼
  Route 53 health check ──────► DNS failover → scale up EC2 ASG
```

### Key Configurations
- **RDS Read Replica** in DR region with automated promotion runbook in SSM
- **Route 53 health checks** on primary ALB endpoint (threshold: 3 failures)
- **CloudFormation StackSets** pre-deployed in DR region (compute in STOPPED state)
- **AMIs** copied to DR region and kept current via EventBridge + Lambda automation

---

## Level 3 — Warm Standby (Advanced)

**RTO:** 15–30 min | **RPO:** Seconds–Minutes | **Cost:** $$$

A scaled-down but fully functional copy of production runs in DR region at all times. Scale to 100% on failover.

### Core AWS Services

| Service | Role |
|---|---|
| **Aurora Global Database** | Cross-region replication with <1 second lag; promote secondary in <1 min |
| **Amazon S3 Cross-Region Replication (CRR)** | Automatic object replication to DR region bucket |
| **Amazon DynamoDB Global Tables** | Multi-region active-active replication for session/config data |
| **AWS Global Accelerator** | Anycast routing; instant traffic shift between regions |
| **Amazon CloudFront** | Serve static assets globally; unaffected by region outage |
| **EC2 Auto Scaling (pre-warmed)** | DR region ASG running at 20–30% capacity; scales to 100% on event |
| **AWS Lambda** | Stateless functions replicated to DR region; no warm-up needed |
| **Amazon ElastiCache (Global Datastore)** | Redis cross-region replication for session cache |
| **AWS Systems Manager Automation** | One-click failover runbook execution |
| **Amazon EventBridge** | Trigger failover automation on health check failure |

### Architecture Pattern

```
Primary Region (100% traffic)        DR Region (20–30% capacity, warm)
  ALB → EC2 ASG (full)                  ALB → EC2 ASG (scaled down)
  Aurora Primary ──────────────────────► Aurora Secondary (lag <1s)
  S3 Bucket ───── CRR ────────────────► S3 Bucket (replica)
  DynamoDB ────── Global Tables ───────► DynamoDB (replica)
  ElastiCache ─── Global Datastore ───► ElastiCache (replica)
       │                                      │
       └──── Route 53 / Global Accelerator ───┘
                  (health-check based failover)
```

### Key Configurations
- **Aurora Global Database**: promote secondary cluster via `FailoverGlobalCluster` API
- **S3 CRR**: enable on all buckets; set replication time control (RTC) for 99.99% objects replicated in 15 min
- **Route 53**: set failover routing policy; health check interval = 10 seconds
- **Global Accelerator**: endpoint groups in both regions; traffic dial = 100/0 normally, flip to 0/100 on failover
- **ASG scaling policy**: EventBridge rule triggers `SetDesiredCapacity` to 100% on failover event

---

## Level 4 — Multi-Site Active/Active (Expert)

**RTO:** Near-zero | **RPO:** Near-zero | **Cost:** $$$$

Both regions serve live traffic simultaneously. No failover needed — traffic is redistributed automatically.

### Core AWS Services

| Service | Role |
|---|---|
| **AWS Global Accelerator** | Distributes traffic across regions; instant re-routing on failure |
| **Amazon Aurora Global Database (active/active)** | Write forwarding from secondary to primary; read locally |
| **Amazon DynamoDB Global Tables** | True multi-region active-active writes with conflict resolution |
| **Amazon API Gateway (multi-region)** | Deploy APIs in both regions behind Global Accelerator |
| **AWS WAF + Shield Advanced** | DDoS protection at global edge; consistent policy across regions |
| **Amazon CloudFront** | Global CDN; origin failover between regions automatically |
| **AWS Transit Gateway (inter-region peering)** | Private network connectivity between regions |
| **Amazon Route 53 (latency-based routing)** | Route users to nearest healthy region |
| **AWS Control Tower / Organizations** | Governance and guardrails across multi-region accounts |
| **Amazon CloudWatch (cross-region dashboards)** | Unified observability across both regions |

### Architecture Pattern

```
Users (Global)
     │
     ▼
AWS Global Accelerator / Route 53 (latency-based)
     │                    │
     ▼                    ▼
Region A (50%)        Region B (50%)
  ALB → ECS/EKS          ALB → ECS/EKS
  Aurora (primary) ◄────► Aurora (write forwarding)
  DynamoDB Global ◄──────► DynamoDB Global
  S3 (CRR bidirectional)   S3 (CRR bidirectional)
```

### Key Configurations
- **DynamoDB Global Tables**: enable in both regions; use version-based conflict resolution
- **Aurora write forwarding**: secondary region writes forwarded to primary automatically
- **Global Accelerator**: set endpoint weights 50/50; health checks auto-remove unhealthy endpoints
- **CloudFront origin groups**: primary + failover origin; automatic origin failover on 5xx errors
- **Chaos engineering**: run AWS Fault Injection Simulator (FIS) experiments continuously in staging

---

## Supporting Services (All Levels)

| Service | Purpose |
|---|---|
| **AWS CloudTrail** | Audit all API calls; essential for post-incident forensics |
| **AWS Config** | Track configuration changes; detect drift from DR baseline |
| **Amazon GuardDuty** | Threat detection; trigger IR on suspicious activity |
| **AWS Security Hub** | Centralized security findings across regions |
| **AWS Resilience Hub** | Assess application resiliency; validate RTO/RPO targets |
| **AWS Fault Injection Simulator (FIS)** | Chaos engineering; test DR plans under real failure conditions |
| **Amazon CloudWatch** | Metrics, alarms, dashboards; trigger failover automation |
| **AWS Systems Manager (OpsCenter)** | Centralized incident management and runbook execution |
| **AWS Health Dashboard** | Real-time AWS service health; trigger automated responses |
| **AWS Organizations + SCPs** | Enforce DR policies (e.g., backup required, multi-AZ mandatory) |

---

## DR Strategy Selection Guide

| If you need... | Use this strategy | Key services |
|---|---|---|
| Simple backup, budget-constrained | Backup & Restore | S3, AWS Backup, DRS |
| Core data always replicated, fast compute spin-up | Pilot Light | RDS Read Replica, Route 53, CloudFormation |
| Fast failover, moderate cost | Warm Standby | Aurora Global, S3 CRR, Global Accelerator, ASG |
| Zero downtime, mission-critical | Multi-Site Active/Active | Global Accelerator, DynamoDB Global Tables, Aurora Global |

---

## RTO / RPO Quick Reference

| Strategy | RTO | RPO | Approx. Extra Cost vs Single Region |
|---|---|---|---|
| Backup & Restore | Hours | Hours | +5–10% |
| Pilot Light | 30–60 min | Minutes | +10–20% |
| Warm Standby | 15–30 min | Seconds–Minutes | +30–50% |
| Multi-Site Active/Active | Near-zero | Near-zero | +80–100% |

---

## References

| Resource | Link |
|---|---|
| AWS Well-Architected — Reliability Pillar | https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar |
| AWS Disaster Recovery of Workloads on AWS (whitepaper) | https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws |
| AWS Resilience Hub | https://aws.amazon.com/resilience-hub |
| AWS Elastic Disaster Recovery | https://aws.amazon.com/disaster-recovery |
| AWS Fault Injection Simulator | https://aws.amazon.com/fis |
