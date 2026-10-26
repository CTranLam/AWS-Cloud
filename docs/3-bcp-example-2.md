# Business Continuity Plan (BCP) Framework
**Version:** 3.0
**Date:** 2026-05-27

---

## Overview

A Business Continuity Plan (BCP) ensures an organization can continue critical operations during and after a disruption. The **Disaster Recovery (DR) Plan** is a focused subset of the BCP, specifically covering IT and technology recovery.

> **Key Relationship:** BCP covers the entire organization. DR Plan sits inside BCP and focuses specifically on IT/technology recovery.

---

## Priority Order

| Phase | Step | Component |
|---|---|---|
| 1 — Understand | 1 | Business Impact Analysis (BIA) |
| 1 — Understand | 2 | Risk Assessment |
| 2 — Prepare | 3 | Recovery Strategies |
| 2 — Prepare | 4 | DR Plan & Strategy |
| 2 — Prepare | 5 | Roles and Responsibilities |
| 2 — Prepare | 6 | Alternate Site / Work Arrangements |
| 2 — Prepare | 7 | Communication Plan |
| 3 — Respond | 8 | Incident Response Plan |
| 4 — Sustain | 9 | Testing and Exercises |
| 4 — Sustain | 10 | Plan Maintenance |

---

## End-to-End Example Set 2: AWS Cloud Scenarios

**Company profile:** SaaS platform "Miralce.IO", 200 employees, $20M ARR, fully AWS-native (multi-AZ, single region by default).

### Scenario Matrix

| Scenario | Description | AWS Services Involved | Critical Level |
|---|---|---|---|
| D | AWS Lambda function throttling | Lambda, CloudWatch | 🟢 Low |
| E | Single Availability Zone (AZ) outage | EC2, RDS Multi-AZ, ALB | 🟡 Medium |
| F | Full AWS Region outage | Route 53, RDS Global, S3 CRR, CloudFront | 🔴 High |

---

### Scenario D — AWS Lambda Throttling 🟢 Low

**1. BIA**
- Affected function: Background job processing (report generation, email notifications)
- RTO: 1 hour | RPO: N/A (jobs are queued, not lost)
- Financial impact: Delayed reports; no revenue loss

**2. Risk Assessment**
- Threat: Sudden traffic spike exceeds Lambda concurrency limit (default: 1,000)
- Likelihood: Medium | Severity: Low

**3. Recovery Strategy**
- SQS queue absorbs excess requests — no jobs lost
- Request AWS concurrency limit increase via Service Quotas

**4. DR Plan**
- AWS Services: Lambda + SQS (dead-letter queue configured)
- CloudWatch alarm triggers SNS notification to on-call engineer
- Reserved concurrency set for critical functions to prevent starvation

**5. Roles & Responsibilities**
- On-call Engineer: Acknowledge CloudWatch alarm, review throttle metrics
- Platform Lead: Submit Service Quotas increase request if recurring

**6. Alternate Site**
- N/A — SQS buffers all requests; jobs process once throttle clears

**7. Communication Plan**
- Internal: CloudWatch alarm → SNS → PagerDuty → on-call engineer
- No customer-facing communication needed unless delay exceeds SLA

**8. Incident Response**
1. CloudWatch detects throttling → SNS alert fires
2. Engineer reviews Lambda metrics in CloudWatch
3. Confirms SQS DLQ has no failed messages
4. Increases reserved concurrency or requests quota increase
5. Monitors until backlog clears
6. Documents in incident log

**9. Testing**
- Quarterly: Load test to simulate throttling; verify SQS buffering works
- Verify DLQ alerts fire correctly

**10. Maintenance**
- Review Lambda concurrency limits monthly
- Set proactive CloudWatch alarms at 80% concurrency threshold

---

### Scenario E — Single Availability Zone (AZ) Outage 🟡 Medium

**1. BIA**
- Affected function: Web application, API, database
- RTO: 15 minutes | RPO: Near-zero (Multi-AZ RDS automatic failover)
- Financial impact: ~$84K/hour if not recovered (based on $1,400/min Gartner estimate)

**2. Risk Assessment**
- Threat: AWS AZ-level hardware or power failure
- Likelihood: Low | Severity: Medium (AWS SLA covers this with Multi-AZ)

**3. Recovery Strategy**
- Multi-AZ architecture absorbs the failure automatically
- ALB routes traffic away from unhealthy AZ
- RDS Multi-AZ promotes standby replica automatically

**4. DR Plan**
- **Strategy:** Multi-AZ (Warm standby within same region)
- EC2 Auto Scaling Group spans 3 AZs — unhealthy AZ instances terminated, new ones launched in healthy AZs
- RDS Multi-AZ: automatic failover within 60–120 seconds
- ALB health checks: deregister unhealthy targets within 30 seconds
- EFS / S3 used for shared storage (AZ-resilient by default)

**5. Roles & Responsibilities**
- On-call Engineer: Monitor AWS Health Dashboard and CloudWatch
- Platform Lead: Confirm recovery and communicate status
- No manual failover needed if architecture is correctly configured

**6. Alternate Site**
- Remaining AZs in same region serve all traffic automatically

**7. Communication Plan**
- Internal: AWS Health Dashboard alert → SNS → PagerDuty
- External: Status page updated if customer impact detected (>5 min degradation)

**8. Incident Response**
1. AWS Health Dashboard reports AZ event
2. CloudWatch alarms fire on EC2/RDS health metrics
3. ALB automatically stops routing to affected AZ
4. RDS Multi-AZ promotes standby (60–120 sec)
5. Auto Scaling launches replacement instances in healthy AZs
6. Engineer confirms full recovery via CloudWatch dashboards
7. Post-incident review: verify no data loss, update runbook

**9. Testing**
- Semi-annual: Chaos engineering — terminate all EC2 instances in one AZ (using AWS Fault Injection Simulator)
- Verify RDS failover time meets RTO
- Verify ALB health check deregistration speed

**10. Maintenance**
- Ensure Auto Scaling Groups always span minimum 2 AZs
- Review RDS Multi-AZ configuration after any infrastructure change
- Monthly review of AWS Health Dashboard notification settings

---

### Scenario F — Full AWS Region Outage 🔴 High

**1. BIA**
- Affected function: Entire SaaS platform — all services unavailable
- RTO: 1 hour | RPO: 15 minutes
- Financial impact: $5,600/min downtime + SLA breach penalties + customer churn risk

**2. Risk Assessment**
- Threat: Large-scale AWS region failure (e.g., ap-southeast-1 power/network event)
- Likelihood: Very Low | Severity: Critical
- Historical reference: AWS us-east-1 outages (2021, 2023) impacted thousands of customers

**3. Recovery Strategy**
- Pre-provisioned warm standby in secondary region (ap-northeast-1)
- DNS failover via Route 53 health checks
- Data replicated continuously to DR region

**4. DR Plan**
- **Strategy:** Warm Standby (secondary region always running at reduced capacity, scales up on failover)
- **Data Replication:**
  - RDS: Aurora Global Database — replication lag < 1 second, RPO ~15 min
  - S3: Cross-Region Replication (CRR) enabled on all buckets
  - DynamoDB: Global Tables for session and config data
- **Compute:**
  - EC2 Auto Scaling Group in DR region pre-warmed at 20% capacity
  - Scales to 100% on failover trigger
- **DNS Failover:**
  - Route 53 health checks on primary region ALB
  - Automatic failover to DR region ALB within 60 seconds
- **CDN:**
  - CloudFront serves static assets from S3 CRR — unaffected by region outage
- **Failback:**
  - After primary region recovery, re-sync data from DR → primary
  - Gradual traffic shift via Route 53 weighted routing (10% → 50% → 100%)

**5. Roles & Responsibilities**
- CTO: Declare regional DR event, authorize failover
- DR Team Lead: Execute region failover runbook
- Database Lead: Promote Aurora Global secondary cluster
- DevOps Lead: Scale up DR region Auto Scaling Group
- Communications Lead: Manage customer and stakeholder updates

**6. Alternate Site**
- Warm standby in ap-northeast-1 (Tokyo) — scaled to full capacity within 30 minutes

**7. Communication Plan**
- Internal: AWS Health Dashboard + PagerDuty → war room within 10 minutes
- Customers: Status page updated within 15 minutes; email if outage exceeds 30 minutes
- Enterprise customers: Direct account manager calls within 30 minutes
- Regulators: Notification if data residency SLAs are affected

**8. Incident Response**
1. AWS Health Dashboard reports region-level event
2. Route 53 health checks fail → automatic DNS failover initiates (60 sec)
3. CTO declares regional DR event — war room activated
4. DR Team Lead executes failover runbook:
   a. Promote Aurora Global secondary in ap-northeast-1
   b. Scale Auto Scaling Group to 100% in DR region
   c. Verify all services healthy in DR region
5. Confirm DNS propagation complete — traffic flowing to DR region
6. Communications Lead updates status page and notifies customers
7. Monitor DR region stability for 30 minutes
8. Begin failback planning once primary region recovers
9. Gradual traffic shift back to primary via Route 53 weighted routing
10. Post-incident report within 5 business days; architecture review within 2 weeks

**9. Testing**
- Quarterly: Tabletop exercise — simulate region outage, walk through runbook
- Bi-annual: Full region failover drill using AWS Fault Injection Simulator
  - Measure actual RTO/RPO vs targets
  - Verify Aurora Global promotion time
  - Verify Route 53 failover speed
- Annual: Third-party DR audit

**10. Maintenance**
- Review Aurora Global replication lag weekly (target: <1 sec)
- Verify S3 CRR replication metrics monthly
- Update DR runbook after every infrastructure change
- Review Route 53 health check thresholds quarterly
- Cost review: Warm standby running cost ~30–40% of primary region cost

---

## AWS DR Strategy Summary

| Strategy | RTO | RPO | Cost | Best For |
|---|---|---|---|---|
| Backup & Restore | Hours | Hours | 💲 Lowest | Non-critical, cold data |
| Pilot Light | 30–60 min | Minutes | 💲💲 Low | Core services only |
| Warm Standby | 15–30 min | Seconds–Minutes | 💲💲💲 Medium | Business-critical SaaS |
| Multi-Site Active/Active | Near-zero | Near-zero | 💲💲💲💲 Highest | Mission-critical, financial |

> Scenario D maps to **Backup & Restore** (queue-based resilience).
> Scenario E maps to **Pilot Light / Warm Standby** (Multi-AZ within region).
> Scenario F maps to **Warm Standby** (cross-region).

---

## Authoritative Sources & Standards

| Source | Relevance |
|---|---|
| IBM Cost of a Data Breach Report (annual) | Breach costs, IR value |
| Gartner | Downtime costs, IT risk |
| FEMA | Disaster impact on SMBs |
| ISO 22301 | International BCP standard |
| NIST SP 800-34 | IT contingency/DR planning |
| Disaster Recovery Journal | Industry benchmarks |
| Swiss Re Institute | Natural disaster losses |
| Acronis Cyberthreats Report | DR and ransomware |
| AWS Well-Architected Framework (Reliability Pillar) | AWS DR strategies and patterns |

> **Recommended Frameworks:** ISO 22301, NIST SP 800-34, and AWS Well-Architected Reliability Pillar are the three most credible frameworks to anchor your BCP/DR strategy professionally.
