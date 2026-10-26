# Business Continuity Plan (BCP) Framework
**Version:** 2.0
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

## End-to-End Example: E-Commerce Company "ShopNow"

**Company profile:** Online retail platform, 500 employees, $50M annual revenue, AWS-hosted infrastructure.

---

### Scenario Matrix

| Scenario | Description | Critical Level |
|---|---|---|
| A | Office Wi-Fi outage | 🟢 Low |
| B | Key supplier delays shipment | 🟡 Medium |
| C | Ransomware attack on production database | 🔴 High |

---

### Scenario A — Office Wi-Fi Outage 🟢 Low

**1. BIA**
- Affected function: Internal staff communication
- RTO: 4 hours | RPO: N/A (no data loss risk)
- Financial impact: Minimal — staff can use mobile hotspots

**2. Risk Assessment**
- Threat: ISP failure or router hardware fault
- Likelihood: High | Severity: Low

**3. Recovery Strategy**
- Staff switch to mobile hotspots or work from home
- IT contacts ISP for SLA-based resolution

**4. DR Plan**
- No IT failover needed
- Backup 4G routers pre-configured and stored on-site

**5. Roles & Responsibilities**
- IT Helpdesk: diagnose and escalate to ISP
- Team leads: notify staff of work-from-home option

**6. Alternate Site**
- Staff work remotely via VPN

**7. Communication Plan**
- IT sends Slack/email notification to all staff within 15 minutes

**8. Incident Response**
- IT detects outage → checks router → contacts ISP → activates backup router
- Resolved within 2 hours

**9. Testing**
- Annual drill: simulate ISP outage, verify backup router activation

**10. Maintenance**
- Review ISP SLA annually; update backup router firmware quarterly

---

### Scenario B — Key Supplier Delays Shipment 🟡 Medium

**1. BIA**
- Affected function: Order fulfillment, customer delivery
- RTO: 48 hours | RPO: N/A
- Financial impact: ~$200K revenue at risk per day of delay

**2. Risk Assessment**
- Threat: Supplier bankruptcy, port strike, natural disaster at supplier location
- Likelihood: Medium | Severity: Medium

**3. Recovery Strategy**
- Activate secondary pre-approved supplier
- Prioritize high-value orders from existing inventory
- Offer customers estimated delay notification + discount voucher

**4. DR Plan**
- No IT failover needed
- Update inventory and order management system to reflect new supplier lead times

**5. Roles & Responsibilities**
- Procurement Manager: contact secondary supplier within 4 hours
- Customer Service Lead: prepare customer communication templates
- Operations Manager: re-prioritize fulfillment queue

**6. Alternate Site**
- Secondary warehouse activated if primary fulfillment center is also affected

**7. Communication Plan**
- Internal: Operations team briefed within 2 hours
- External: Affected customers notified via email within 24 hours; public statement if delay exceeds 72 hours

**8. Incident Response**
- Procurement detects delay → escalates to Operations Manager → activates secondary supplier → updates ETA in system
- Customer service sends proactive notifications

**9. Testing**
- Semi-annual tabletop exercise: simulate supplier failure, test secondary supplier activation time

**10. Maintenance**
- Review supplier contracts and secondary supplier list every 6 months

---

### Scenario C — Ransomware Attack on Production Database 🔴 High

**1. BIA**
- Affected function: Entire platform (orders, payments, customer data)
- RTO: 4 hours | RPO: 1 hour (max 1 hour of data loss acceptable)
- Financial impact: $5,600/min downtime + regulatory fines + reputational damage

**2. Risk Assessment**
- Threat: Ransomware via phishing email or unpatched vulnerability
- Likelihood: Medium | Severity: Critical

**3. Recovery Strategy**
- Isolate infected systems immediately
- Restore from last clean backup (RPO: 1 hour)
- Failover to DR environment (Hot standby on AWS)
- Engage cybersecurity incident response firm

**4. DR Plan**
- **DR Strategy:** Hot standby on AWS (multi-region: ap-southeast-1 primary, ap-east-1 DR)
- Automated hourly snapshots via AWS RDS and S3
- Failover: Route 53 health checks trigger automatic DNS failover within 5 minutes
- Failback: After forensic cleanup, restore primary region and sync data
- Backup retention: 30 days

**5. Roles & Responsibilities**
- CISO: Declare incident, lead response
- DR Team Lead: Execute failover runbook
- Legal/Compliance: Assess data breach notification obligations (GDPR/local law)
- CEO: Approve external communications and ransom decision policy (policy: do not pay)

**6. Alternate Site**
- Hot standby AWS region activated — full platform operational within RTO of 4 hours

**7. Communication Plan**
- Internal: All staff notified within 30 minutes; infected systems isolated
- Customers: Status page updated within 1 hour; email if data is compromised
- Regulators: Breach notification within 72 hours (per GDPR)
- Media: Prepared statement released only after legal review

**8. Incident Response**
1. Alert triggered (AWS GuardDuty / SIEM)
2. CISO declares incident — war room activated
3. Infected systems isolated from network
4. DR Team executes AWS failover runbook
5. Platform restored on DR region within 4 hours
6. Forensic investigation begins on isolated systems
7. Root cause identified → patch applied
8. Failback to primary region after clean bill of health
9. Post-incident report within 5 business days

**9. Testing**
- Quarterly: Tabletop ransomware simulation
- Bi-annual: Full DR failover drill (test RTO/RPO targets)
- Annual: Third-party penetration test

**10. Maintenance**
- Patch management: Critical patches within 24 hours
- Backup integrity checks: Weekly automated restore test
- BCP review: After every incident and annually

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

> **Recommended Frameworks:** ISO 22301 and NIST SP 800-34 are the two most credible frameworks to anchor your BCP/DR strategy professionally.
