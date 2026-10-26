# Products Management Application

A simple web application for managing products inventory, built with Node.js, Express, and PostgreSQL. This application demonstrates basic CRUD operations with a PostgreSQL database on AWS EC2.

## 📋 Overview

- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Backend:** Node.js with Express
- **Database:** PostgreSQL (database: demo, table: products)
- **Deployment:** AWS EC2 (Amazon Linux 2023)

## 🏗️ Architecture

```
User Browser
     ↓
Express Server (Port 3001)
     ↓
PostgreSQL Database (demo)
     ↓
products table
```

## 📁 Project Structure

```
.
├── server.js           # Express server with API endpoints
├── package.json        # Node.js dependencies
├── init.sql            # Database initialization script
├── .env.example        # Environment variables template
├── public/
│   └── index.html      # Frontend application
└── README.md           # This file
```

## 🚀 Features

- **View Products** - List all products with price and quantity
- **Add Product** - Create new product records
- **Delete Product** - Remove product records
- **Real-time Updates** - Automatic UI refresh after operations

## 📊 Database Schema

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2),
  quantity INTEGER DEFAULT 0
);
```

## 🔧 Prerequisites

- AWS EC2 instance (Amazon Linux 2023)
- PostgreSQL 15+
- Node.js 22+
- Git

## 📦 PART 1 - Install and Configure psql

### 1. Launch psql on Amazon EC2

```bash
# Amazon EC2 parameters for psql

- Name: demo-db
- Type: t4g.small
- Subnet: db-subnet
- Security group: db-sg
- IAM Instance Profile: ec2-instance-role
```

### 2. Setup PostgreSQL

```bash
# Logging to Amazon EC2 by using Session Manager
sudo -i
sudo dnf update -y

# Initialize database
sudo dnf install postgresql17-server -y
sudo postgresql-setup --initdb

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify psql running
sudo systemctl status postgesql

# Create db and table
sudo -i -u postgres
createdb demo
exit

# Connect to create table
sudo -u postgres psql
\c demo

# Create table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2),
  quantity INTEGER DEFAULT 0
);

# Insert Test records
INSERT INTO products (name, price, quantity) VALUES
  ('Laptop', 999.99, 10),
  ('Mouse', 29.99, 50),
  ('Keyboard', 79.99, 30);

# Select all products
SELECT * FROM products;
```
### 3. Configure dbadmin
```bash
# Create database and user
sudo -u postgres psql
CREATE USER dbadmin WITH PASSWORD 'demoPassword';
GRANT ALL PRIVILEGES ON DATABASE demo TO dbadmin;
\c demo
GRANT ALL ON SCHEMA public TO dbadmin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbadmin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dbadmin;

# Verify
\l
exit

# Verify
psql -h localhost -U dbadmin -d demo
```
Optional - Configure remote access: If you need to access PostgreSQL remotely, edit:
- /var/lib/pgsql/data/postgresql.conf - set listen_addresses = '*'
- /var/lib/pgsql/data/pg_hba.conf - add client authentication rules
Then restart: sudo systemctl restart postgresql


### 4. Configure authentication for psql

```bash
# Edit the postgresql.conf and postgresql file:
sudo vi /var/lib/pgsql/data/postgresql.conf

Find and change: 

listen_addresses = 'localhost'

To:

listen_addresses = '*'

# Edit the pg_hba.conf and postgresql file:
sudo vi /var/lib/pgsql/data/pg_hba.conf

Add this line before other rules (for local connections):

host    demo    dbadmin    127.0.0.1/32    md5

For remote connections from specific IP:

host    demo    dbadmin    10.0.0.0/16    md5

Or for any IP (less secure):

host    demo    dbadmin    0.0.0.0/0    md5

# Restart psql
sudo systemctl restart postgresql

# Verify
sudo ss -tuln | grep 5432
You should see 0.0.0.0:5432 instead of 127.0.0.1:5432

# Test connection
psql -h localhost -U dbadmin -d demo
Enter password: demoPassword
```

## 📦 PART 2 - Install and Configure Application

### 1. Launch Amazon EC2 for application
```bash
# Amazon EC2 parameters for Application server

- Name: app-server
- Type: t4g.small
- Subnet: public-1
- Security group: public-sg
- IAM Instance Profile: ec2-instance-role

# Logging in via Session Manager
sudo -i
dnf update -y

# Install dependencies
dnf install -y nodejs22 git postgresql17

# Test db connection
psql -h 10.0.147.111 -U dbadmin -d demo

Enter password: demoPassword
Output: Cannot connect due to connection and security group did not open port 5432. Fix it.
```

### 2. Clone application from github
```bash
# Clone repository
cd /home/ec2-user
git clone -b lab01-ec2-simple-website https://github.com/vietaws/architecting.git
cd architecting

# Create environment file
cat > .env <<EOF
DB_HOST=10.0.147.111
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=demoPassword
PORT=3001
EOF

# Install dependencies
npm install

# Test database connection
psql -h 10.0.147.111 -U dbadmin -d demo

Enter password: demoPassword

# sql commands
- SELECT * FROM products;
- DELETE FROM products;
```

### 4. Create Systemd Service

```bash
# Set permissions
sudo chown -R ec2-user:ec2-user /home/ec2-user/architecting

# Create demo-app service
cat > /etc/systemd/system/demo-app.service <<'EOFS'
[Unit]
Description=AWS Architecting Demo Application - Viet Tran
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/architecting
EnvironmentFile=/home/ec2-user/architecting/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=demo-app

[Install]
WantedBy=multi-user.target
EOFS

# Start service
sudo systemctl daemon-reload
sudo systemctl enable demo-app
sudo systemctl start demo-app
```

### 5. Verify Installation

```bash
# Check service status
sudo systemctl status demo-app

# View logs
sudo journalctl -u demo-app -f

# Test application
curl http://localhost:3001/api/products
```

## 🌐 API Endpoints

### Get All Products
```http
GET /api/products
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Laptop",
    "price": "999.99",
    "quantity": 10
  }
]
```

### Create Product
```http
POST /api/products
Content-Type: application/json

{
  "name": "Monitor",
  "price": 299.99,
  "quantity": 15
}
```

**Response:**
```json
{
  "id": 4,
  "name": "Monitor",
  "price": "299.99",
  "quantity": 15
}
```

### Delete Product
```http
DELETE /api/products/:id
```

**Response:**
```json
{
  "success": true
}
```

## 🔐 Environment Variables

Create a `.env` file in the project root:

```bash
DB_HOST=localhost          # PostgreSQL host
DB_PORT=5432              # PostgreSQL port
DB_USER=dbadmin           # Database user
DB_PASSWORD=demoPassword # Database password
PORT=3001                # Application port
```

## 🖥️ Usage

### Access the Application

1. **Local Development:**
   ```
   http://localhost:3001
   ```

2. **EC2 Instance:**
   ```
   http://<ec2-public-ip>:3001
   ```

### Using the Interface

1. **View Products:** Automatically loads on page load
2. **Add Product:** Fill in Name, Price, and Quantity, then click "Add Product"
3. **Delete Product:** Click the "Delete" button next to any product

## 🐛 Troubleshooting

### Application Won't Start

```bash
# Check service status
sudo systemctl status demo-app

# View detailed logs
sudo journalctl -u demo-app -n 100

# Check if port is in use
sudo ss -tulpn | grep 3000
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
psql -h localhost -U dbadmin -d demo

# Check PostgreSQL logs
sudo tail -f /var/lib/pgsql/data/log/postgresql-*.log
```

## 📝 Development

### Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm start

# Server runs on http://localhost:3001
```

### Database Operations

```bash
# Connect to database
psql -h localhost -U dbadmin -d demo

# View all products
SELECT * FROM products;

# Add product manually
INSERT INTO products (name, price, quantity) 
VALUES ('Tablet', 499.99, 20);

# Delete product
DELETE FROM products WHERE id = 1;
```

## 🔒 Security Considerations

1. **Change default passwords** - Never use default credentials in production
2. **Use environment variables** - Don't commit `.env` file to Git
3. **Configure PostgreSQL authentication** - Restrict access in `pg_hba.conf`
4. **Use security groups** - Limit EC2 access to required ports only
5. **Enable SSL/TLS** - Use HTTPS in production
6. **Regular updates** - Keep dependencies and system packages updated

## 📊 Monitoring

### View Application Logs

```bash
# Real-time logs
sudo journalctl -u demo-app -f

# Last 50 lines
sudo journalctl -u demo-app -n 50

# Errors only
sudo journalctl -u demo-app -p err
```

## 🚀 Deployment

### AWS EC2 Deployment

1. **Launch EC2 Instance**
   - AMI: Amazon Linux 2023
   - Instance Type: t4.small or larger
   - Security Group: Allow ports 3001 (HTTP)

2. **Access Application**
   - Wait 2-3 minutes for setup to complete
   - Access via `http://<ec2-public-ip>:3001`

## 📄 License

This project is for educational purposes.

## 👤 Author

Viet Tran - hello@viet.vn

---

**Note:** This is a demonstration application. For production use, implement proper security measures, error handling, input validation, and monitoring.
