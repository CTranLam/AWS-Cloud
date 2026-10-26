# Learn AWS CloudFormation — Key Concepts

A progressive series of standalone CloudFormation YAML templates, each focused on one concept. Ordered from foundational to advanced so each demo builds on the previous.

---

## Learning Path

```
Skeleton → Resources → AMI Parameter → SSM AMI → Ref → Pseudo → Outputs
→ Mappings → Intrinsic Functions → Conditions → cfn-init
→ Change Sets → Drift Detection → Stack Policies
→ Cross-Stack References → Nested Stacks
```

---

## Project Structure

```
cfn-learn/
├── demo-00-skeleton/
│   └── template.yaml           # Template anatomy — mandatory vs optional sections
├── demo-01-first-ec2/
│   └── template.yaml           # Hardcoded EC2, no parameters
├── demo-02-ami-parameter/
│   └── template.yaml           # Enter AMI ID manually — AWS::EC2::Image::Id validation
├── demo-03-ssm-ami/
│   └── template.yaml           # Resolve latest AL2023 ARM AMI via SSM Parameter Store
├── demo-04-ref/
│   └── template.yaml           # !Ref to link resources and parameters
├── demo-05-pseudo-parameters/
│   └── template.yaml           # AWS::Region, AWS::AccountId, AWS::StackName
├── demo-06-outputs/
│   └── template.yaml           # Outputs to expose resource values
├── demo-07-mappings/
│   └── template.yaml           # AMI lookup by region using Mappings
├── demo-08-intrinsic-functions/
│   └── template.yaml           # !Sub, !Join, !Select, !If, !FindInMap, !Base64
├── demo-09-conditions/
│   └── template.yaml           # Conditions to toggle resources by environment
├── demo-10-cfn-init/
│   ├── template.yaml           # AWS::CloudFormation::Init to bootstrap EC2
│   └── cfn-hup.yaml            # cfn-hup daemon to auto-apply Metadata changes on update
├── demo-11-change-sets/
│   └── template.yaml           # Preview changes before applying
├── demo-12-drift-detection/
│   └── template.yaml           # Detect out-of-band resource changes
├── demo-13-stack-policies/
│   ├── template.yaml           # Stack with protected resources
│   └── policy.json             # Stack policy to prevent resource replacement
├── demo-14-cross-stack-references/
│   ├── producer.yaml           # Stack that exports values
│   └── consumer.yaml           # Stack that imports via Fn::ImportValue
├── demo-15-nested-stacks/
│   ├── parent.yaml             # Root stack referencing child stacks
│   ├── network.yaml            # Child stack: VPC and subnet
│   └── ec2.yaml                # Child stack: EC2 using network outputs
└── README_IAC.md
```

---

## Demo Breakdown

### Demo 00 — CloudFormation Skeleton
**Concept:** Understand the full anatomy of a CloudFormation template before writing any resources.

| Section | Required | Purpose |
|---|---|---|
| `AWSTemplateFormatVersion` | No | Template version — always use `2010-09-09` |
| `Description` | No | Human-readable summary of the template |
| `Metadata` | No | Additional info for tools (e.g. Console UI hints) |
| `Parameters` | No | Runtime inputs to make templates reusable |
| `Mappings` | No | Static key-value lookup tables |
| `Conditions` | No | Boolean logic to conditionally create resources |
| `Transform` | No | Macros (e.g. `AWS::Serverless-2016-10-31` for SAM) |
| `Resources` | **Yes** | The only mandatory section — defines AWS resources |
| `Outputs` | No | Values to expose after stack creation |

**Key takeaway:** Only `Resources` is mandatory. Everything else is optional but powerful.

---

### Demo 01 — First EC2 (No Parameters)
**Concept:** Minimal working template using only the mandatory `Resources` section.  
**What you build:** A single EC2 instance with a hardcoded AMI ID and instance type.  
**Key takeaway:** Every resource needs a `Type` and `Properties`. Logical ID is your internal reference name.

---

### Demo 02 — AMI Parameter (Manual Entry)
**Concept:** Use `AWS::EC2::Image::Id` parameter type — CloudFormation validates the AMI exists in the current region before deploying.  
**What you build:** EC2 instance where the user supplies an AMI ID at deploy time.  
**Key takeaway:** `AWS::EC2::Image::Id` is a special parameter type that auto-validates the value. If the AMI doesn't exist in the region, the stack fails before any resource is created.

---

### Demo 03 — Parameters
**Concept:** Make templates reusable with `Parameters`.  
**What you build:** EC2 instance where `InstanceType` and `AmiId` are supplied at deploy time.  
**Key takeaway:** `Type`, `Default`, `AllowedValues`, `Description` — parameters turn static templates into flexible ones.

---

### Demo 04 — SSM Parameter Store AMI
**Concept:** Use `AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>` to automatically resolve the latest Amazon Linux 2023 ARM AMI for the current region — no hardcoding, no manual lookup.  
**What you build:** EC2 instance where the AMI is resolved from the SSM public parameter path at deploy time.  
**Key takeaway:** The SSM path `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64` is maintained by AWS and always points to the latest AL2023 ARM AMI in the deployed region. All subsequent demos use this pattern.

---

### Demo 04 — !Ref
**Concept:** `!Ref` to reference parameters and other resources within the same template.  
**What you build:** EC2 inside a security group; SG ID wired to EC2 via `!Ref`.  
**Key takeaway:** `!Ref` on a parameter → its value. `!Ref` on a resource → its physical ID (e.g. SG ID, subnet ID). Use `!GetAtt` to access other attributes.

---

### Demo 05 — Pseudo Parameters
**Concept:** Built-in `AWS::` variables available in every template without declaration.  
**What you build:** S3 bucket with a globally unique name and EC2 tag built from pseudo parameters.  
**Key takeaway:** `AWS::Region`, `AWS::AccountId`, `AWS::StackName`, `AWS::StackId`, `AWS::NoValue` — no need to declare them in `Parameters`.

---

### Demo 06 — Outputs
**Concept:** `Outputs` to surface resource values after deployment.  
**What you build:** EC2 + security group; outputs expose instance ID, public IP, and SG ID.  
**Key takeaway:** Outputs appear in the console and CLI. They are the foundation for cross-stack references (Demo 14).

---

### Demo 07 — Mappings
**Concept:** `Mappings` for static lookup tables — no runtime input needed.  
**What you build:** EC2 that selects the correct AMI per region using `!FindInMap`.  
**Key takeaway:** Mappings are evaluated at deploy time. Ideal for region/environment-specific values that don't change often.

---

### Demo 08 — Intrinsic Functions
**Concept:** Master the core functions used in almost every real-world template.  
**What you build:** EC2 with a composed name tag and user data using multiple functions together.  
**Key takeaway:**

| Function | Use |
|---|---|
| `!Ref` | Reference parameter or resource |
| `!GetAtt` | Get a specific attribute of a resource |
| `!Sub` | String interpolation with `${Variable}` |
| `!Join` | Concatenate a list with a delimiter |
| `!Select` | Pick one item from a list |
| `!FindInMap` | Look up a value in Mappings |
| `!Base64` | Encode string (used for EC2 user data) |
| `!If` | Conditional value based on a Condition |
| `!ImportValue` | Import an exported Output from another stack |

---

### Demo 09 — Conditions
**Concept:** `Conditions` to conditionally create resources or set property values.  
**What you build:** Template with an `Environment` parameter (`dev`/`prod`); creates a NAT Gateway only in prod, sets instance type based on env.  
**Key takeaway:** `!If`, `!Equals`, `!And`, `!Or`, `!Not` — conditions are evaluated before resources are created.

---

### Demo 10 — Metadata & cfn-init
**Concept:** `AWS::CloudFormation::Init` to configure EC2 after launch, with stack-level wait signal.  
**What you build:** EC2 that installs Apache and writes an HTML file; stack waits for `cfn-signal` before marking CREATE_COMPLETE.  
**Key takeaway:** `CreationPolicy` + `cfn-signal` ensures the stack only succeeds when the instance is fully ready, not just launched.

**Bonus — cfn-hup (`cfn-hup.yaml`):**  
**Concept:** `cfn-hup` is a daemon that polls for stack Metadata changes and automatically re-runs `cfn-init` — no instance replacement needed.  
**What you build:** Same EC2 setup, but with `cfn-hup.conf` and a hook that watches `Resources.WebServer.Metadata.AWS::CloudFormation::Init`. After deploy, update the `index.html` content in Metadata and run `aws cloudformation update-stack` — the page updates to `Hello from AWS CloudFormation` within 1 minute without touching the instance.  
**Key takeaway:** `cfn-hup` = live config updates on running instances. The hook `path` targets the exact Metadata path to watch; `triggers=post.update` fires after a stack update is detected.

---

### Demo 11 — Change Sets
**Concept:** Preview the impact of a stack update before executing it.  
**What you build:** Deploy `template.yaml`, modify it (e.g. change instance type or add a tag), create a change set, review, then execute.  
**Key takeaway:** Change sets show `Add`, `Modify`, `Remove` actions and flag `Replacement: true` — critical for avoiding accidental data loss.

```bash
# Create change set
aws cloudformation create-change-set \
  --stack-name demo-11 \
  --change-set-name my-change \
  --template-body file://template.yaml

# Review
aws cloudformation describe-change-set \
  --stack-name demo-11 \
  --change-set-name my-change

# Execute
aws cloudformation execute-change-set \
  --stack-name demo-11 \
  --change-set-name my-change
```

---

### Demo 12 — Drift Detection
**Concept:** Detect when actual resource configuration diverges from the deployed template.  
**What you build:** Deploy a stack, manually change a resource in the console (e.g. add a tag or change SG rule), then run drift detection.  
**Key takeaway:** Drift detection identifies out-of-band changes. It does not auto-remediate — you must redeploy to fix drift.

```bash
aws cloudformation detect-stack-drift --stack-name demo-12
aws cloudformation describe-stack-resource-drifts --stack-name demo-12
```

---

### Demo 13 — Stack Policies
**Concept:** Protect critical resources from accidental updates or replacement during stack updates.  
**What you build:** Stack with an EC2 instance; `policy.json` denies all updates to it.  
**Key takeaway:** Stack policies are separate from IAM — they control what CloudFormation itself is allowed to modify, not what users can do.

```bash
# Apply policy at create time
aws cloudformation create-stack \
  --stack-name demo-13 \
  --template-body file://template.yaml \
  --stack-policy-body file://policy.json
```

---

### Demo 14 — Cross-Stack References
**Concept:** Share values between independently deployed stacks using `Outputs` exports and `Fn::ImportValue`.  
**What you build:** `producer.yaml` creates a VPC and exports its ID; `consumer.yaml` imports it to create a subnet.  
**Key takeaway:** Cross-stack references decouple stacks. The producer stack cannot be deleted while any consumer stack imports its exports.

---

### Demo 15 — Nested Stacks
**Concept:** `AWS::CloudFormation::Stack` to compose a parent stack from reusable child templates.  
**What you build:** Parent stack deploys a network child (VPC/subnet) and an EC2 child that receives network outputs as parameters via `!GetAtt`.  
**Key takeaway:** Nested stacks are managed as one unit — deleting the parent deletes all children. Use for tightly coupled, co-deployed resources. Use cross-stack references (Demo 14) for loosely coupled, independently managed stacks.

---

## How to Deploy Each Demo

```bash
aws cloudformation deploy \
  --template-file demo-XX-<name>/template.yaml \
  --stack-name demo-XX \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides Key=Value
```

## How to Tear Down

```bash
aws cloudformation delete-stack --stack-name demo-XX
```
