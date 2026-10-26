import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/mnt/efs';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

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

app.get('/api/images', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(f => {
        const stats = fs.statSync(path.join(UPLOAD_DIR, f));
        return { name: f, size: stats.size, uploaded: stats.mtime, url: `/uploads/${f}` };
      })
      .sort((a, b) => b.uploaded - a.uploaded);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ name: req.file.filename, size: req.file.size, url: `/uploads/${req.file.filename}` });
});

app.delete('/api/images/:name', (req, res) => {
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, req.params.name));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload directory: ${UPLOAD_DIR}`);
});
