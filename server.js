import express from 'express';
import pg from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const app = express();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'demo',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: { rejectUnauthorized: false }
});

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const BUCKET = process.env.S3_BUCKET;

app.use(express.json());
app.use(express.static('public'));

// Get presigned URL for upload
app.get('/api/upload-url', async (req, res) => {
  const { filename, contentType } = req.query;
  const key = `products/${randomUUID()}-${filename}`;
  try {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 3600 }
    );
    res.json({ url, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get presigned URL for viewing an image
app.get('/api/image-url', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 3600 }
    );
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, qty, image_url } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, qty, image_url) VALUES ($1, $2, $3) RETURNING *',
      [name, qty, image_url || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { name, qty, image_url } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET name = $1, qty = $2, image_url = $3 WHERE id = $4 RETURNING *',
      [name, qty, image_url || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
