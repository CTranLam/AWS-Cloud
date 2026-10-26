import express from 'express';
import pg from 'pg';

const app = express();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'demo',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());
app.use(express.static('public'));

// Get AWS metadata
app.get('/api/metadata', async (req, res) => {
  try {
    // Get IMDSv2 token
    const tokenResponse = await fetch('http://169.254.169.254/latest/api/token', {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to get token');
    }
    
    const token = await tokenResponse.text();
    console.log('IMDSv2 token obtained');

    // Get region and instance ID
    const [regionResponse, instanceIdResponse] = await Promise.all([
      fetch('http://169.254.169.254/latest/meta-data/placement/region', {
        headers: { 'X-aws-ec2-metadata-token': token }
      }),
      fetch('http://169.254.169.254/latest/meta-data/instance-id', {
        headers: { 'X-aws-ec2-metadata-token': token }
      })
    ]);

    const region = await regionResponse.text();
    const instanceId = await instanceIdResponse.text();
    
    console.log('Metadata:', { region, instanceId });
    res.json({ region, instanceId });
  } catch (err) {
    console.error('Metadata error:', err.message);
    res.json({ region: 'N/A', instanceId: 'N/A' });
  }
});

// CPU stress endpoint
let stressInterval = null;
app.post('/api/stress', (req, res) => {
  const { duration = 600 } = req.body;
  
  if (stressInterval) {
    return res.json({ status: 'already running' });
  }

  const endTime = Date.now() + (duration * 1000);
  stressInterval = setInterval(() => {
    if (Date.now() >= endTime) {
      clearInterval(stressInterval);
      stressInterval = null;
      return;
    }
    // CPU intensive operation
    for (let i = 0; i < 1000000; i++) {
      Math.sqrt(Math.random());
    }
  }, 0);

  res.json({ status: 'started', duration });
});

app.delete('/api/stress', (req, res) => {
  if (stressInterval) {
    clearInterval(stressInterval);
    stressInterval = null;
    res.json({ status: 'stopped' });
  } else {
    res.json({ status: 'not running' });
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
  const { name, qty } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, qty) VALUES ($1, $2) RETURNING *',
      [name, qty]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { name, qty } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET name = $1, qty = $2 WHERE id = $3 RETURNING *',
      [name, qty, req.params.id]
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
