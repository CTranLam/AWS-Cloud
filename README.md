# AWS Simple Data Lake — Demo Guide

## Scenario

A company ingests employee records (id, name, email, salary, date of birth) into a data lake. The pipeline cleans invalid records, converts to a queryable format, and enforces fine-grained access control per analyst — all on AWS with S3 as the backbone.

```
[Data Sources]
  Employee Records (JSON)
        │
        ▼
[S3 — Raw Zone]          (s3://datalake/raw/)
        │
        ▼
[AWS Glue — Job 1]       (remove dob < 1900-01-01)
        │
        ▼
[S3 — Cleaned Zone]      (s3://datalake/cleaned/)
        │
        ▼
[AWS Glue — Job 2]       (convert to Parquet)
        │
        ▼
[S3 — Processed Zone]    (s3://datalake/processed/)
        │
        ▼
[AWS Glue Crawler]       (auto-discover schema → Data Catalog)
        │
        ▼
[Amazon Athena]          (SQL queries on S3)
```

---

## AWS Services Used

| Service | Role |
|---|---|
| S3 | Storage backbone — raw, cleaned, processed, failed zones |
| AWS Glue (ETL + Crawler) | Job 1: clean data; Job 2: convert to Parquet + auto-catalog schema |
| Glue Data Catalog | Central metadata store |
| Amazon Athena | Serverless SQL queries on S3 |
| IAM | Least-privilege roles per service |
| S3 Lifecycle Policies | Auto-archive old raw data to Glacier |
| CloudWatch | Monitor Glue job metrics |
| AWS Lake Formation | Fine-grained table/column/row-level access control |

---

## Step-by-Step Demo

### Step 1 — Create S3 Bucket with Zone Prefixes

```bash
aws s3api create-bucket \
  --bucket lab06-data-lake \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1

# Create logical zones as prefixes
aws s3api put-object --bucket lab06-data-lake --key raw/
aws s3api put-object --bucket lab06-data-lake --key cleaned/
aws s3api put-object --bucket lab06-data-lake --key processed/
aws s3api put-object --bucket lab06-data-lake --key failed/
aws s3api put-object --bucket lab06-data-lake --key athena-results/
```

Block all public access:

```bash
aws s3api put-public-access-block \
  --bucket lab06-data-lake \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

### Step 2 — Set S3 Lifecycle Policy (Raw Zone → Glacier after 90 days)

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket lab06-data-lake \
  --lifecycle-configuration file://lifecycle.json
```

`lifecycle.json`:

```json
{
  "Rules": [{
    "ID": "archive-raw",
    "Filter": { "Prefix": "raw/" },
    "Status": "Enabled",
    "Transitions": [{
      "Days": 90,
      "StorageClass": "GLACIER"
    }]
  }]
}
```

---

### Step 3 — Create IAM Role

**Glue role** — can read `raw/`, write `cleaned/` and `processed/`, and update Glue Data Catalog

```bash
aws iam attach-role-policy \
  --role-name GlueDatalakeRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole
```

---

### Step 4 — Upload Sample Data to Raw Zone

```bash
cat > employees.json <<'EOF'
{"id":"1","name":"Alice","email":"alice@example.com","salary":80000,"dob":"1985-03-12"}
{"id":"2","name":"Bob","email":"bob@example.com","salary":45000,"dob":"1990-07-22"}
{"id":"3","name":"Charlie","email":"charlie@example.com","salary":120000,"dob":"1875-01-01"}
{"id":"4","name":"Diana","email":"diana@example.com","salary":30000,"dob":"1978-11-05"}
EOF

aws s3 cp employees.json s3://lab06-data-lake/raw/year=2026/month=05/day=05/employees.json
```

> Record 3 (Charlie, dob 1875) will be filtered out in the cleaning step.

```bash

cat > employees1.json <<'EOF'
{"id":"5","name":"Marry","email":"marry@example.com","salary":12000,"dob":"2002-03-15","gender":"female"}
EOF

cat > employees2.json <<'EOF'
{"id":"6","name":"Peter","email":"peter@example.com","salary":12000,"dob":"1995-03-15","gender":"male"}
EOF

aws s3 cp employees1.json s3://lab06-data-lake/raw/year=2026/month=05/day=05/employees1.json

aws s3 cp employees2.json s3://lab06-data-lake/raw/year=2026/month=05/day=06/employees2.json
```

```bash
cat > employees.json <<'EOF'
{"id":"7","name":"Viet","email":"hello@viet.vn","salary":30800,"dob":"2000-03-12","gender":"male"}
{"id":"8","name":"Thu","email":"thu@example.com","salary":229000,"dob":"1995-09-22","gender":"female"}
EOF

aws s3 cp employees.json s3://lab06-data-lake/raw/year=2025/month=09/day=18/employees.json

```

---

### Step 5 — Create Glue ETL Jobs

#### Job 1 — Clean (raw → cleaned)

1. Go to **AWS Glue → ETL Jobs → Create job**
2. Choose **Spark script editor**
3. Use the script at `glue/clean.py` (see below)
4. IAM role: `GlueDatalakeRole`
5. Job parameters:
   - `--SOURCE_PATH` = `s3://lab06-data-lake/raw/`
   - `--DEST_PATH` = `s3://lab06-data-lake/cleaned/`

`glue/clean.py`:

```python
import sys
from awsglue.context import GlueContext
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql.functions import col, to_date

args = getResolvedOptions(sys.argv, ['SOURCE_PATH', 'DEST_PATH'])
sc = SparkContext()
gc = GlueContext(sc)

df = gc.spark_session.read.json(args['SOURCE_PATH'])

# Remove employees with dob before 1900-01-01
df = df.filter(to_date(col('dob'), 'yyyy-MM-dd') >= '1900-01-01')

df.write.mode("overwrite").json(args['DEST_PATH'])
```

#### Job 2 — Transform (cleaned → processed)

1. Go to **AWS Glue → ETL Jobs → Create job**
2. Choose **Spark script editor**
3. Use the script at `glue/transform.py` (see below)
4. IAM role: `GlueDatalakeRole`
5. Job parameters:
   - `--SOURCE_PATH` = `s3://lab06-data-lake/cleaned/`
   - `--DEST_PATH` = `s3://lab06-data-lake/processed/`

`glue/transform.py`:

```python
import sys
from awsglue.context import GlueContext
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext

args = getResolvedOptions(sys.argv, ['SOURCE_PATH', 'DEST_PATH'])
sc = SparkContext()
gc = GlueContext(sc)

df = gc.spark_session.read.json(args['SOURCE_PATH'])
df.write.mode("overwrite").parquet(args['DEST_PATH'])
```

---

### Step 6 — Create Glue Crawler (Auto-catalog Processed Zone)

```bash
aws glue create-crawler \
  --name datalake-processed-crawler \
  --role arn:aws:iam::<account-id>:role/GlueDatalakeRole \
  --database-name lab06 \
  --targets '{"S3Targets": [{"Path": "s3://lab06-data-lake/processed/"}]}'

aws glue start-crawler --name datalake-processed-crawler
```

After the crawler runs, a table appears in **Glue Data Catalog → lab06**.

---

### Step 7 — Query with Athena

1. Go to **Athena → Query editor**
2. Set workgroup output to `s3://lab06-data-lake/athena-results/`
3. Run:

```sql
SELECT id, name, email, salary, dob
FROM lab06.processed
LIMIT 10;
```

---

## Part 2: Fine-Grained Access Control with AWS Lake Formation

Build on top of the existing setup to enforce **table-level**, **column-level**, and **row-level** access control using Lake Formation — replacing broad IAM/S3 bucket policies with granular data permissions.

### Access Matrix

| Analyst | Columns visible | Row filter |
|---|---|---|
| analyst-a | id, name, email, salary, dob | all rows |
| analyst-b | id, name, email, dob | all rows (salary hidden) |
| analyst-c | id, name, email, salary, dob | only rows where salary < 50000 |

### Architecture Addition

```
[Glue Data Catalog]
        │
        ▼
[AWS Lake Formation]   ← central permission layer
        │
   ┌────┼────┐
   ▼    ▼    ▼
[A]   [B]   [C]
full  no    salary
      salary < 50k
```

---

### Step 8 — Bootstrap Lake Formation

#### 8.1 Set Lake Formation as the Permission Model

```bash
aws lakeformation put-data-lake-settings \
  --data-lake-settings '{
    "DataLakeAdmins": [
      {"DataLakePrincipalIdentifier": "arn:aws:iam::<account-id>:role/LakeAdminRole"}
    ],
    "CreateDatabaseDefaultPermissions": [],
    "CreateTableDefaultPermissions": []
  }'
```

> Setting `CreateDatabaseDefaultPermissions` and `CreateTableDefaultPermissions` to empty arrays **disables** the default IAM-only fallback, forcing all access through Lake Formation.

#### 8.2 Register the S3 Data Lake Location

```bash
aws lakeformation register-resource \
  --resource-arn arn:aws:s3:::lab06-data-lake \
  --use-service-linked-role
```

This hands S3 location control to Lake Formation. The service-linked role (`AWSServiceRoleForLakeFormationDataAccess`) will be created automatically.

---

### Step 9 — Grant Database & Table Permissions

#### 9.1 Grant Glue Crawler Permission to Create Tables

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:role/GlueDatalakeRole \
  --resource '{"Database": {"Name": "lab06"}}' \
  --permissions CREATE_TABLE ALTER DROP
```

#### 9.2 Grant Analyst A — Full Table Access

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:user/analyst-a \
  --resource '{"Table": {"DatabaseName": "lab06", "Name": "processed"}}' \
  --permissions SELECT DESCRIBE
```

#### 9.3 Grant Analyst B — Column-Level Access (hide `salary`)

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:user/analyst-b \
  --resource '{
    "TableWithColumns": {
      "DatabaseName": "lab06",
      "Name": "processed",
      "ColumnNames": ["id", "name", "email", "dob"]
    }
  }' \
  --permissions SELECT
```

> Analyst B can only see `id`, `name`, `email`, `dob` — `salary` is invisible in Athena queries.

#### 9.4 Grant Analyst C — Full Columns, Row-Filtered Access

```bash
aws lakeformation create-data-cells-filter \
    --table-data '{
      "DatabaseName": "lab06",
      "TableName": "processed",
      "Name": "low-salary-filter",
      "RowFilter": {"FilterExpression": "salary < 50000"},
      "ColumnWildcard": {}
    }'
```

#### 9.5 Permissions for Analysts

With Lake Formation handling data permissions, the analysts only need IAM permissions to call Athena and read the catalog — Lake Formation enforces what data they actually see. Here are the minimal policies:
  
Shared base for all three analysts (Athena + Glue Catalog read):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:StopQueryExecution",
        "athena:GetWorkGroup"
      ],
      "Resource": "arn:aws:athena:ap-southeast-1:<account-id>:workgroup/primary"
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase",
        "glue:GetTable",
        "glue:GetPartitions"
      ],
      "Resource": [
        "arn:aws:glue:ap-southeast-1:<account-id>:catalog",
        "arn:aws:glue:ap-southeast-1:<account-id>:database/lab06",
        "arn:aws:glue:ap-southeast-1:<account-id>:table/lab06/processed"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::lab06-data-lake/results/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:GetBucketLocation",
      "Resource": "arn:aws:s3:::lab06-data-lake"
    },
    {
      "Effect": "Allow",
      "Action": "lakeformation:GetDataAccess",
      "Resource": "*"
    }
  ]
}
```
  
This same policy applies to analyst-a, analyst-b, and analyst-c. No S3 GetObject on **processed/** is needed — Lake Formation's service-linked role vends temporary credentials to Athena directly, so analysts never touch the raw S3 data.
  
The difference between analysts is not in IAM — it's entirely in Lake Formation grants (Steps 9–10 in the guide):
  
  - analyst-a → full table SELECT via grant-permissions
  - analyst-b → column-restricted SELECT (no salary, gender) via **TableWithColumns**
  - analyst-c → row-filtered SELECT via **DataCellsFilter**

---


### Step 10 — Verify Permissions in Athena

**As Analyst A** — sees all rows and all columns:

```sql
SELECT * FROM lab06.processed LIMIT 10;
-- Returns: id, name, email, salary, dob  (all rows)
```

**As Analyst B** — salary column hidden:

```sql
SELECT * FROM lab06.processed LIMIT 10;
-- Returns: id, name, email, dob  (salary invisible)
```

**As Analyst C** — all columns, only low-salary rows:

```sql
SELECT * FROM lab06.processed LIMIT 10;
-- Returns: id, name, email, salary, dob
-- Only rows where salary < 50000
```

---

### Step 11 — Audit Access with CloudTrail + Lake Formation Logs

Lake Formation automatically logs all data access decisions to CloudTrail.

```bash
# Find recent Lake Formation access events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventSource,AttributeValue=lakeformation.amazonaws.com \
  --max-results 10
```

Key events to monitor:
- `GetDataAccess` — triggered every time Athena requests temporary S3 credentials
- `GrantPermissions` / `RevokePermissions` — permission changes

---

### Step 12 — Revoke Access

```bash
# Revoke Analyst C's table access
aws lakeformation revoke-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:user/analyst-c \
  --resource '{"Table": {"DatabaseName": "lab06", "Name": "processed"}}' \
  --permissions SELECT
```

---

## Project Structure

```
data-lake/
├── README.md
├── lifecycle.json
└── glue/
    ├── clean.py
    └── transform.py
```

---

## Key Concepts Demonstrated

**Part 1 — Core Data Lake**
- S3 as a multi-zone data lake (raw → cleaned → processed)
- Job 1 cleans raw JSON: removes employees with dob before 1900
- Job 2 converts cleaned JSON to Parquet
- Manual upload with date-based partitioning
- Schema-on-read with Glue Crawler + Data Catalog
- Serverless SQL with Athena (no database servers)
- Columnar format (Parquet) for cost-efficient queries
- Lifecycle policies for storage cost management

**Part 2 — Lake Formation Governance**
- Centralized permission model replacing IAM/S3 bucket policies
- Table-level access per IAM user/role
- Column-level masking (analyst-b cannot see salary)
- Row-level filtering via Data Cells Filters (analyst-c sees only salary < 50000)
- Full audit trail via CloudTrail integration
`