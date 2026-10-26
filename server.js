import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const app = express();

const BUCKET_NAME = process.env.S3_BUCKET || 'architecting-demo-xxx';
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.static('public'));

app.get('/api/metadata', async (req, res) => {
  try {
    const token = await fetch('http://169.254.169.254/latest/api/token', {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
      signal: AbortSignal.timeout(2000)
    }).then(r => r.text());

    const [region, instanceId] = await Promise.all([
      fetch('http://169.254.169.254/latest/meta-data/placement/region', {
        headers: { 'X-aws-ec2-metadata-token': token },
        signal: AbortSignal.timeout(2000)
      }).then(r => r.text()),
      fetch('http://169.254.169.254/latest/meta-data/instance-id', {
        headers: { 'X-aws-ec2-metadata-token': token },
        signal: AbortSignal.timeout(2000)
      }).then(r => r.text())
    ]);
    res.json({ region, instanceId });
  } catch (err) {
    res.json({ region: 'N/A', instanceId: 'N/A' });
  }
});

app.get('/api/images', async (req, res) => {
  try {
    console.log(`Listing S3 bucket: ${BUCKET_NAME}`);
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const data = await s3Client.send(command);
    
    const images = await Promise.all(
      (data.Contents || [])
        .filter(obj => /\.(jpg|jpeg|png|gif|webp)$/i.test(obj.Key))
        .map(async obj => {
          const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }), { expiresIn: 3600 });
          return {
            name: obj.Key,
            size: obj.Size,
            uploaded: obj.LastModified,
            url
          };
        })
    );
    
    res.json(images.sort((a, b) => b.uploaded - a.uploaded));
  } catch (err) {
    console.error('S3 List Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const key = `${Date.now()}-${req.file.originalname}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    });
    
    console.log(`Uploading to S3: ${BUCKET_NAME}/${key}`);
    await s3Client.send(command);
    console.log('Upload successful');
    
    const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }), { expiresIn: 3600 });
    
    res.json({ name: key, size: req.file.size, url });
  } catch (err) {
    console.error('S3 Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/images/:name', async (req, res) => {
  try {
    const command = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: req.params.name });
    await s3Client.send(command);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`S3 Bucket: ${BUCKET_NAME}`);
  console.log(`AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);
});
