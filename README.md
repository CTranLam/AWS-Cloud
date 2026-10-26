# CloudFront Distribution Configuration Guide

## Part 1: CloudFront + S3 (Private Bucket via OAC)

S3 bucket is **not** public and does **not** host a static website. CloudFront accesses it using **Origin Access Control (OAC)**.

### 1.1 Create S3 Bucket

- Block all public access (keep all checkboxes enabled)
- Do **not** enable static website hosting

### 1.2 Create CloudFront Distribution

1. Go to **CloudFront → Create distribution**
2. Choose "Pay as you go"
3. Distribution name: demo-cf / Click **Next**
4. Origin type: Amazon S3
5. **S3 Origin**: select your S3 bucket (`your-bucket.s3.amazonaws.com`)
6. **Cache policy**: `CachingOptimized`
7. Enable Security: `Do not enable security protection` / Click **Next**
8. Click **Create distribution**

> CloudFront will show a banner: **"Copy policy"** — do this before leaving.

### 1.3 Update S3 Bucket Policy

Paste the copied policy into your S3 bucket → **Permissions → Bucket policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
        }
      }
    }
  ]
}
```

Replace `your-bucket`, `<account-id>`, and `<distribution-id>` with your actual values.

---

## Part 2: Add EC2 as a Second Origin (Path: `/images`)

Serve `/images/*` from an EC2 instance while everything else is served from S3.

### 2.1 Add EC2 Origin

1. Go to your CloudFront distribution → **Origins → Create origin**
2. **Origin domain**: your EC2 public DNS or IP (e.g., `ec2-xx-xx-xx-xx.compute.amazonaws.com`)
3. **Protocol**: `HTTP only` (or HTTPS if EC2 has a cert)
4. **HTTP port**: `80` (or your app port)
5. Save

### 2.2 Add Cache Behavior for `/images`

1. Go to **Behaviors → Create behavior**
2. **Path pattern**: `/images/*`
3. **Origin**: select your EC2 origin
4. **Viewer protocol policy**: `Redirect HTTP to HTTPS`
5. **Cache policy**: `CachingDisabled` (or a custom policy if caching is needed)
6. **Precedence**: ensure this behavior has a **lower number** (higher priority) than the default (`*`) behavior

> The default `*` behavior continues to serve from S3.

### 2.3 EC2 Security Group

Allow inbound traffic **only from CloudFront** on port 80/443:

- **Source**: Use [CloudFront managed prefix list](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/LocationsOfEdgeServers.html) or restrict to `0.0.0.0/0` temporarily and tighten later.

Recommended: use the AWS-managed prefix list ID for CloudFront:

```
pl-3b927c52  # us-east-1 example — check your region
```

---

## Part 3: Origin Group (Active/Passive Failover)

Configure an **Origin Group** so that if EC2 (primary) fails, CloudFront falls back to an S3 error page (secondary).

### 3.1 Create the Origin Group

1. Go to **Origins → Create origin group**
2. **Name**: `images-origin-group`
3. **Primary origin**: EC2 origin
4. **Secondary origin**: S3 origin
5. **Failover criteria** — select HTTP status codes that trigger failover:
   - `500`, `502`, `503`, `504` (server errors)
   - Optionally add `403`, `404` if EC2 returns those on failure
6. Save

### 3.2 Update the `/images` Behavior

1. Go to **Behaviors** → edit the `/images/*` behavior
2. **Origin**: change from EC2 origin → **`images-origin-group`**
3. Save

### 3.3 S3 Fallback Error Page (Optional)

To serve a custom error page from S3 when EC2 fails:

1. Upload a fallback file to S3, e.g., `images/unavailable.html`
2. In CloudFront → **Error pages → Create custom error response**:
   - **HTTP error code**: `503`
   - **Response page path**: `/images/unavailable.html`
   - **HTTP response code**: `200`

---

## Summary

| Path | Origin | Failover |
|------|--------|----------|
| `/*` (default) | S3 (private via OAC) | — |
| `/images/*` | EC2 (primary) | S3 (passive fallback) |

> All origins are private. S3 is never directly accessible. EC2 should only accept traffic from CloudFront.
