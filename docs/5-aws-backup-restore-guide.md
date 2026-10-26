# AWS Backup & Restore — Detailed Guide
**DR Strategy:** Backup & Restore
**Architecture:** EC2 + Aurora + S3
**Version:** 1.0
**Date:** 2026-05-27

---

## Architecture Overview

```
Primary Region (ap-southeast-1)
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ALB                                               │
│    │                                                │
│   EC2 (Auto Scaling Group)                          │
│    │                                                │
│   Aurora MySQL/PostgreSQL Cluster                   │
│    │  (Primary + Reader instances)                  │
│                                                     │
│   S3 Buckets (app assets, user uploads, configs)    │
│                                                     │
└─────────────────────────────────────────────────────┘
         │ AWS Backup (scheduled)
         ▼
┌─────────────────────────────────────────────────────┐
│  AWS Backup Vault (primary region)                  │
│  ├── EC2 AMI snapshots                              │
│  ├── Aurora cluster snapshots                       │
│  └── S3 backup (via Backup or S3 native)            │
└─────────────────────────────────────────────────────┘
         │ Cross-region copy (automated)
         ▼
┌─────────────────────────────────────────────────────┐
│  AWS Backup Vault (DR region: ap-northeast-1)       │
│  ├── EC2 AMI copies                                 │
│  ├── Aurora snapshot copies                         │
│  └── S3 replicated buckets (via CRR)                │
└─────────────────────────────────────────────────────┘
         │ On disaster: manual or automated restore
         ▼
┌─────────────────────────────────────────────────────┐
│  DR Region — Restored Environment                   │
│  ├── EC2 launched from AMI                          │
│  ├── Aurora restored from snapshot                  │
│  └── S3 buckets available (CRR already synced)      │
└─────────────────────────────────────────────────────┘
```

**RTO:** 2–4 hours | **RPO:** 1–24 hours (depends on backup frequency)

---

## Step 1 — Prerequisites

### 1.1 IAM Roles

Create the AWS Backup service role:

```json
{
  "Role": "AWSBackupDefaultServiceRole",
  "ManagedPolicies": [
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup",
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
  ]
}
```

> AWS creates this role automatically when you first open AWS Backup console. Verify it exists in IAM before proceeding.

### 1.2 Enable AWS Backup in Both Regions

```bash
# Verify AWS Backup is available
aws backup list-backup-vaults --region ap-southeast-1
aws backup list-backup-vaults --region ap-northeast-1
```

### 1.3 Tag All Resources

AWS Backup uses tags to select resources. Apply consistent tags:

```bash
# Tag EC2 instances
aws ec2 create-tags --resources i-xxxxxxxxxx \
  --tags Key=backup,Value=true Key=env,Value=prod

# Tag Aurora cluster
aws rds add-tags-to-resource \
  --resource-name arn:aws:rds:ap-southeast-1:123456789:cluster:my-aurora-cluster \
  --tags Key=backup,Value=true Key=env,Value=prod

# Tag S3 buckets (via bucket tagging)
aws s3api put-bucket-tagging --bucket my-app-bucket \
  --tagging 'TagSet=[{Key=backup,Value=true},{Key=env,Value=prod}]'
```

---

## Step 2 — Create Backup Vaults

Vaults store and protect your backups. Create one per region.

### 2.1 Primary Region Vault

```bash
# Create KMS key for vault encryption
aws kms create-key \
  --description "AWS Backup vault key - primary" \
  --region ap-southeast-1

# Create vault
aws backup create-backup-vault \
  --backup-vault-name prod-backup-vault \
  --encryption-key-arn arn:aws:kms:ap-southeast-1:123456789:key/YOUR-KEY-ID \
  --region ap-southeast-1
```

### 2.2 DR Region Vault

```bash
aws kms create-key \
  --description "AWS Backup vault key - DR" \
  --region ap-northeast-1

aws backup create-backup-vault \
  --backup-vault-name prod-backup-vault-dr \
  --encryption-key-arn arn:aws:kms:ap-northeast-1:123456789:key/YOUR-DR-KEY-ID \
  --region ap-northeast-1
```

### 2.3 Enable Vault Lock (Ransomware Protection)

```bash
aws backup put-backup-vault-lock-configuration \
  --backup-vault-name prod-backup-vault \
  --min-retention-days 7 \
  --max-retention-days 365 \
  --region ap-southeast-1
```

> ⚠️ Vault Lock is **irreversible** after the cooling-off period (72 hours). Test before applying to production.

---

## Step 3 — Create Backup Plan

A backup plan defines **when** to back up and **how long** to retain.

### 3.1 Backup Plan JSON

```json
{
  "BackupPlanName": "prod-backup-plan",
  "Rules": [
    {
      "RuleName": "daily-backup",
      "TargetBackupVaultName": "prod-backup-vault",
      "ScheduleExpression": "cron(0 2 * * ? *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 180,
      "Lifecycle": {
        "DeleteAfterDays": 35
      },
      "CopyActions": [
        {
          "DestinationBackupVaultArn": "arn:aws:backup:ap-northeast-1:123456789:backup-vault:prod-backup-vault-dr",
          "Lifecycle": {
            "DeleteAfterDays": 35
          }
        }
      ]
    },
    {
      "RuleName": "weekly-backup",
      "TargetBackupVaultName": "prod-backup-vault",
      "ScheduleExpression": "cron(0 3 ? * SUN *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 360,
      "Lifecycle": {
        "DeleteAfterDays": 90
      },
      "CopyActions": [
        {
          "DestinationBackupVaultArn": "arn:aws:backup:ap-northeast-1:123456789:backup-vault:prod-backup-vault-dr",
          "Lifecycle": {
            "DeleteAfterDays": 90
          }
        }
      ]
    },
    {
      "RuleName": "monthly-backup",
      "TargetBackupVaultName": "prod-backup-vault",
      "ScheduleExpression": "cron(0 4 1 * ? *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 480,
      "Lifecycle": {
        "DeleteAfterDays": 365
      },
      "CopyActions": [
        {
          "DestinationBackupVaultArn": "arn:aws:backup:ap-northeast-1:123456789:backup-vault:prod-backup-vault-dr",
          "Lifecycle": {
            "DeleteAfterDays": 365
          }
        }
      ]
    }
  ]
}
```

```bash
aws backup create-backup-plan \
  --backup-plan file://backup-plan.json \
  --region ap-southeast-1
```

### 3.2 Backup Retention Summary

| Rule | Schedule | Retention (Primary) | Retention (DR) |
|---|---|---|---|
| Daily | 02:00 UTC | 35 days | 35 days |
| Weekly | Sunday 03:00 UTC | 90 days | 90 days |
| Monthly | 1st of month 04:00 UTC | 365 days | 365 days |

---

## Step 4 — Assign Resources to Backup Plan

### 4.1 Tag-based Selection (Recommended)

```bash
aws backup create-backup-selection \
  --backup-plan-id YOUR-PLAN-ID \
  --backup-selection '{
    "SelectionName": "prod-resources",
    "IamRoleArn": "arn:aws:iam::123456789:role/AWSBackupDefaultServiceRole",
    "ListOfTags": [
      {
        "ConditionType": "STRINGEQUALS",
        "ConditionKey": "backup",
        "ConditionValue": "true"
      }
    ]
  }' \
  --region ap-southeast-1
```

This automatically includes all EC2 instances and Aurora clusters tagged `backup=true`.

### 4.2 What Gets Backed Up Per Resource

| Resource | Backup Type | Notes |
|---|---|---|
| **EC2** | EBS snapshots + AMI | Full AMI includes OS, app code, config |
| **Aurora** | Cluster snapshot | Backs up entire cluster (primary + readers) |
| **S3** | S3 Backup job | Backs up object versions; use CRR for continuous sync |

---

## Step 5 — S3 Backup Configuration

AWS Backup supports S3, but for continuous replication, combine both approaches:

### 5.1 AWS Backup for S3 (Point-in-time)

```bash
# Enable S3 Backup (requires S3 Versioning to be ON)
aws s3api put-bucket-versioning \
  --bucket my-app-bucket \
  --versioning-configuration Status=Enabled

# S3 is automatically included in backup plan via tag selection
# Ensure bucket has tag: backup=true
```

### 5.2 S3 Cross-Region Replication (Continuous)

For near-real-time replication to DR region (complements AWS Backup):

```json
{
  "Role": "arn:aws:iam::123456789:role/S3ReplicationRole",
  "Rules": [
    {
      "ID": "replicate-all-to-dr",
      "Status": "Enabled",
      "Filter": {},
      "Destination": {
        "Bucket": "arn:aws:s3:::my-app-bucket-dr",
        "StorageClass": "STANDARD_IA"
      },
      "DeleteMarkerReplication": {
        "Status": "Enabled"
      }
    }
  ]
}
```

```bash
aws s3api put-bucket-replication \
  --bucket my-app-bucket \
  --replication-configuration file://replication.json
```

> **Best practice:** Use CRR for continuous sync + AWS Backup for point-in-time restore capability.

---

## Step 6 — Monitor Backups

### 6.1 CloudWatch Alarms for Backup Failures

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "BackupJobFailed" \
  --metric-name "NumberOfBackupJobsFailed" \
  --namespace "AWS/Backup" \
  --statistic Sum \
  --period 86400 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-southeast-1:123456789:ops-alerts \
  --region ap-southeast-1
```

### 6.2 AWS Backup Audit Manager

Enable compliance reports to verify all resources are backed up per policy:

```bash
aws backup create-framework \
  --framework-name "prod-backup-compliance" \
  --framework-controls '[
    {"ControlName": "BACKUP_RESOURCES_PROTECTED_BY_BACKUP_PLAN"},
    {"ControlName": "BACKUP_RECOVERY_POINT_MINIMUM_RETENTION_CHECK",
     "ControlInputParameters": [{"ParameterName": "requiredRetentionDays", "ParameterValue": "35"}]},
    {"ControlName": "BACKUP_RECOVERY_POINT_ENCRYPTED"}
  ]' \
  --region ap-southeast-1
```

### 6.3 EventBridge Rule for Backup Notifications

```bash
aws events put-rule \
  --name "BackupJobStateChange" \
  --event-pattern '{
    "source": ["aws.backup"],
    "detail-type": ["Backup Job State Change"],
    "detail": {"state": ["FAILED", "ABORTED"]}
  }' \
  --region ap-southeast-1

aws events put-targets \
  --rule "BackupJobStateChange" \
  --targets '[{"Id": "1", "Arn": "arn:aws:sns:ap-southeast-1:123456789:ops-alerts"}]' \
  --region ap-southeast-1
```

---

## Step 7 — Restore Procedure (Disaster Recovery)

### 7.1 Declare DR Event

**Checklist before restore:**
- [ ] Confirm primary region is unrecoverable (not a transient issue)
- [ ] Identify latest clean recovery point (before the incident)
- [ ] Notify stakeholders — DR event declared
- [ ] Assign restore team roles (DB Lead, Infra Lead, App Lead)

### 7.2 Restore Aurora from Snapshot

```bash
# List available recovery points in DR vault
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name prod-backup-vault-dr \
  --by-resource-type Aurora \
  --region ap-northeast-1

# Restore Aurora cluster from snapshot
aws backup start-restore-job \
  --recovery-point-arn arn:aws:rds:ap-northeast-1:123456789:cluster-snapshot:awsbackup-SNAPSHOT-ID \
  --metadata '{
    "Engine": "aurora-postgresql",
    "DBClusterIdentifier": "restored-aurora-cluster",
    "VpcId": "vpc-DR-ID",
    "DBSubnetGroupName": "dr-subnet-group",
    "AvailabilityZones": "[\"ap-northeast-1a\",\"ap-northeast-1c\"]"
  }' \
  --iam-role-arn arn:aws:iam::123456789:role/AWSBackupDefaultServiceRole \
  --resource-type Aurora \
  --region ap-northeast-1
```

**Expected restore time:** 15–45 minutes depending on database size.

### 7.3 Restore EC2 from AMI

```bash
# List EC2 recovery points
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name prod-backup-vault-dr \
  --by-resource-type EC2 \
  --region ap-northeast-1

# Restore EC2 instance
aws backup start-restore-job \
  --recovery-point-arn arn:aws:ec2:ap-northeast-1::image/ami-XXXXXXXX \
  --metadata '{
    "InstanceType": "t3.large",
    "SubnetId": "subnet-DR-ID",
    "SecurityGroupIds": "[\"sg-DR-ID\"]",
    "IamInstanceProfileArn": "arn:aws:iam::123456789:instance-profile/app-profile"
  }' \
  --iam-role-arn arn:aws:iam::123456789:role/AWSBackupDefaultServiceRole \
  --resource-type EC2 \
  --region ap-northeast-1
```

**Expected restore time:** 5–15 minutes per instance.

### 7.4 Verify S3 Data in DR Region

```bash
# S3 CRR should already have data — verify
aws s3 ls s3://my-app-bucket-dr --recursive --human-readable --summarize

# If CRR was not set up, restore from AWS Backup S3 job
aws backup start-restore-job \
  --recovery-point-arn arn:aws:backup:ap-northeast-1:123456789:recovery-point:S3-RECOVERY-POINT-ID \
  --metadata '{
    "DestinationBucketName": "my-app-bucket-dr",
    "NewBucket": "false"
  }' \
  --iam-role-arn arn:aws:iam::123456789:role/AWSBackupDefaultServiceRole \
  --resource-type S3 \
  --region ap-northeast-1
```

### 7.5 Update Application Configuration

After restore, update connection strings and endpoints:

```bash
# Update Aurora endpoint in Parameter Store (DR region)
aws ssm put-parameter \
  --name "/prod/db/endpoint" \
  --value "restored-aurora-cluster.cluster-XXXX.ap-northeast-1.rds.amazonaws.com" \
  --type SecureString \
  --overwrite \
  --region ap-northeast-1

# Update S3 bucket name if different
aws ssm put-parameter \
  --name "/prod/s3/bucket" \
  --value "my-app-bucket-dr" \
  --type String \
  --overwrite \
  --region ap-northeast-1
```

### 7.6 Update DNS (Route 53)

```bash
# Point domain to DR region ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR-ZONE-ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "app.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "DR-ALB-HOSTED-ZONE-ID",
          "DNSName": "dr-alb-XXXX.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

**DNS propagation:** 60 seconds (if TTL was pre-set to 60s) — set low TTL in advance.

---

## Step 8 — Restore Sequence & Timeline

```
T+0 min   Disaster declared
T+5 min   DR team assembled; restore plan confirmed
T+10 min  Aurora restore job started (from DR vault snapshot)
T+15 min  EC2 AMI restore jobs started (all instances in parallel)
T+20 min  S3 verified (CRR already synced) or S3 restore started
T+40 min  Aurora restore complete; connection string updated in SSM
T+45 min  EC2 instances running; app health checks passing
T+50 min  Route 53 DNS updated to DR region ALB
T+60 min  Full smoke test: login, read data, write data, file upload
T+70 min  DR environment declared operational; stakeholders notified
```

**Target RTO: 60–90 minutes**

---

## Step 9 — Failback to Primary Region

Once primary region is recovered:

1. **Sync data back** — export Aurora snapshot from DR → restore in primary; sync S3 with `aws s3 sync`
2. **Verify data integrity** — compare row counts, checksums
3. **Gradual traffic shift** — use Route 53 weighted routing (10% → 50% → 100% to primary)
4. **Decommission DR restore** — terminate restored EC2s, delete temporary Aurora cluster
5. **Resume normal backup schedule** — verify AWS Backup jobs running in primary region

---

## Step 10 — Testing Schedule

| Test Type | Frequency | What to Test |
|---|---|---|
| Backup job verification | Weekly | Confirm all jobs completed successfully in CloudWatch |
| Single resource restore | Monthly | Restore one EC2 AMI and one Aurora snapshot to isolated VPC; verify data |
| Full DR drill | Bi-annual | Execute full restore procedure in DR region; measure actual RTO/RPO |
| Backup integrity check | Monthly | Automated Lambda: restore Aurora snapshot → run row count query → delete |

### Automated Backup Integrity Check (Lambda)

```python
import boto3

def lambda_handler(event, context):
    rds = boto3.client('rds', region_name='ap-northeast-1')
    backup = boto3.client('backup', region_name='ap-northeast-1')

    # Get latest Aurora recovery point
    points = backup.list_recovery_points_by_backup_vault(
        BackupVaultName='prod-backup-vault-dr',
        ByResourceType='Aurora'
    )['RecoveryPoints']

    latest = sorted(points, key=lambda x: x['CreationDate'], reverse=True)[0]

    # Start restore to temp cluster
    restore = backup.start_restore_job(
        RecoveryPointArn=latest['RecoveryPointArn'],
        Metadata={
            'Engine': 'aurora-postgresql',
            'DBClusterIdentifier': 'integrity-check-temp',
            'VpcId': 'vpc-DR-ID',
            'DBSubnetGroupName': 'dr-subnet-group'
        },
        IamRoleArn='arn:aws:iam::123456789:role/AWSBackupDefaultServiceRole',
        ResourceType='Aurora'
    )

    # Note: actual query validation runs in a follow-up Lambda
    # triggered by EventBridge when restore job completes
    return {'RestoreJobId': restore['RestoreJobId'], 'Status': 'started'}
```

---

## Summary Checklist

### Setup (One-time)
- [ ] IAM role `AWSBackupDefaultServiceRole` exists
- [ ] KMS keys created in both regions
- [ ] Backup vaults created in primary and DR regions
- [ ] Vault Lock enabled (after testing)
- [ ] Backup plan created with daily/weekly/monthly rules + cross-region copy
- [ ] All EC2, Aurora, S3 resources tagged `backup=true`
- [ ] Backup selection assigned to plan
- [ ] S3 Versioning enabled on all buckets
- [ ] S3 CRR configured to DR region bucket
- [ ] CloudWatch alarm for backup failures
- [ ] EventBridge rule for backup job notifications
- [ ] Route 53 TTL set to 60 seconds
- [ ] DR region VPC, subnets, security groups pre-created
- [ ] SSM Parameter Store parameters pre-created in DR region

### Ongoing
- [ ] Weekly: verify backup job success in CloudWatch
- [ ] Monthly: restore single resource test
- [ ] Bi-annual: full DR drill with RTO measurement
- [ ] After every infra change: verify tags still applied to new resources
