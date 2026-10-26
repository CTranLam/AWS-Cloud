# Image Converter with AWS Lambda and Amazon S3

Automatically resize, watermark, and convert images to WebP using AWS Lambda triggered by S3 uploads.

## Architecture

```
S3 (input/) → Lambda (image-converter) → S3 (output/)
```

## Prerequisites

- AWS account with permissions to manage Lambda, S3, and IAM
- S3 bucket with `input/` and `output/` prefixes
- IAM role attached to the Lambda function with `s3:GetObject` and `s3:PutObject` permissions
- *(Optional)* EC2 instance running Amazon Linux 2023 to build the Pillow Lambda layer

---

## Step 1 — Build the Pillow Lambda Layer *(Optional)*

Run the following on an EC2 instance with Amazon Linux 2023 to build a compatible Pillow layer.

> Check Python version compatibility: https://pillow.readthedocs.io/en/stable/installation/python-support.html

```sh
# Install build dependencies
sudo dnf install -y gcc openssl-devel bzip2-devel libffi-devel make zlib-devel

# Download and extract Python 3.14
wget https://www.python.org/ftp/python/3.14.4/Python-3.14.4.tgz
tar xzf Python-3.14.4.tgz
cd Python-3.14.4

# Compile and install Python
./configure --enable-optimizations --with-zlib
make
sudo make altinstall

# Install pip for Python 3.14
cd ~
curl -O https://bootstrap.pypa.io/get-pip.py
sudo /usr/local/bin/python3.14 get-pip.py

# Create and activate a virtual environment
/usr/local/bin/python3.14 -m venv pillow-layer-env
source pillow-layer-env/bin/activate

# Install Pillow
pip install Pillow

# Package into Lambda layer structure
mkdir -p python/lib/python3.14/site-packages
cp -r pillow-layer-env/lib/python3.14/site-packages/* python/lib/python3.14/site-packages/
zip -r pillow-layer.zip python
```

---

## Step 2 — Upload the Layer to AWS Lambda

1. Open the [AWS Lambda console](https://console.aws.amazon.com/lambda).
2. Navigate to **Layers** → **Create Layer**.
3. Upload `pillow-layer.zip`.
4. Set the compatible runtime to **Python 3.14**.

---

## Step 3 — Create the Lambda Function

| Setting | Value |
|---|---|
| Function name | `image-converter` |
| Runtime | Python 3.14 |
| Architecture | x86_64 |

Attach the Pillow layer created in Step 2, then deploy the following source code:

```python
import boto3
import botocore
from PIL import Image
from io import BytesIO
import time
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.resource('s3')


def resize_image(bucket_name, key):
    suffix = str(int(time.time()))
    base_key = key.removeprefix('input/')
    new_object_key = f"output/{base_key}_{suffix}.jpg"

    # Fetch source image
    obj = s3.Object(bucket_name=bucket_name, key=key)
    img = Image.open(BytesIO(obj.get()['Body'].read()))
    logger.info(f"Image loaded: size={img.size}, mode={img.mode}")

    # Resize to mobile resolution
    img = img.resize((360, 640))

    # Save as JPEG
    buffer = BytesIO()
    img.convert('RGB').save(buffer, 'JPEG')
    buffer.seek(0)

    s3.Object(bucket_name=bucket_name, key=new_object_key).put(Body=buffer, ContentType='image/jpeg')
    logger.info(f"Output uploaded: s3://{bucket_name}/{new_object_key}")

    return f"https://{bucket_name}.s3.amazonaws.com/{new_object_key}"


def lambda_handler(event, context):
    try:
        record = event['Records'][0]
        bucket_name = record['s3']['bucket']['name']
        obj_key = record['s3']['object']['key']
        obj_size = record['s3']['object']['size']
    except (KeyError, IndexError) as e:
        logger.error(f"Invalid event structure: {e}")
        return {'statusCode': 400, 'body': 'Invalid S3 event.'}

    logger.info(f"Received: bucket={bucket_name}, key={obj_key}, size={obj_size}")

    if not obj_key.startswith('input/'):
        logger.warning(f"Skipping {obj_key}: not in input/ folder.")
        return {'statusCode': 400, 'body': 'File not in the input/ folder.'}

    try:
        url = resize_image(bucket_name, obj_key)
        return {'statusCode': 200, 'body': url}
    except botocore.exceptions.ClientError as e:
        logger.error(f"S3 error: {e}")
        return {'statusCode': 500, 'body': 'Failed to read/write S3 object.'}
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {'statusCode': 500, 'body': 'Internal error during image processing.'}
```

---

## Step 4 — Configure the S3 Event Trigger

1. In the Lambda function, go to **Configuration** → **Triggers** → **Add Trigger**.
2. Select **S3** as the source.
3. Choose your S3 bucket.
4. Set **Event type** to `PUT`.
5. Set **Prefix** to `input/` to scope the trigger to uploaded source images only.

---

## Step 5 — Test

1. Upload an image to the `input/` prefix in your S3 bucket.
2. Check the `output/` prefix for the processed `.webp` result.
