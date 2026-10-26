# Inventory Management Application

Simple inventory management system built with Node.js, Express, and Amazon RDS PostgreSQL.

## Features
- Add new products with name and quantity
- Edit existing products
- Delete products
- View all products in inventory
- Responsive design

## Prerequisites
- Amazon RDS PostgreSQL instance (pre-created)
- Amazon EC2 instance (application server)
- Node.js 22
- RDS connection details

## RDS Database Setup

### 1. Create RDS PostgreSQL Instance

- Engine: PostgreSQL 17
- Instance class: `db.t4g.micro` or `db.t4g.small`
- Database name: `demo`
- Master username: `dbadmin`
- Master password: `demoPassword`
- VPC: Same as application EC2
- Subnet group: Private subnets
- Security group: Allow port 5432 from application security group
- Public access: No

### 2. Create Products Table

Connect to RDS using psql or any PostgreSQL client:

```bash
psql -h <rds-endpoint> -U dbadmin -d demo
```

Run the following SQL:

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0
);

INSERT INTO products (name, qty) VALUES
  ('Laptop', 15),
  ('Mouse', 50),
  ('Keyboard', 30);
```

Or use the provided `init.sql` file:

```bash
psql -h <rds-endpoint> -U dbadmin -d demo -f init.sql
```

## Application Deployment

### 1. Launch Application EC2 Instance

- Name: `demo-app`
- Type: `t4g.small`
- Subnet: Public or private subnet
- Security group: Allow port 3001 and outbound to RDS port 5432
- IAM Instance Profile: `ec2-instance-role`

### 2. Install Dependencies

```bash
sudo dnf update -y
sudo dnf install -y nodejs22 git postgresql17
```

### 3. Clone Application

```bash
cd /home/ec2-user
git clone -b lab08-rds-inventory https://github.com/vietaws/architecting.git
cd architecting
```

### 4. Create Environment File

```bash
cat > .env <<EOF
DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=<your-password>
PORT=3001
EOF
```

Replace:
- `<rds-endpoint>` with your RDS endpoint (e.g., `demo-db.xxxxx.ap-southeast-1.rds.amazonaws.com`)
- `<your-password>` with your RDS master password

### 5. Install Node Modules

```bash
npm install
sudo chown -R ec2-user:ec2-user /home/ec2-user/architecting
```

### 6. Test Database Connection

```bash
psql -h <rds-endpoint> -U dbadmin -d demo
```

### 7. Create Systemd Service

```bash
sudo cat > /etc/systemd/system/demo-app.service <<'EOF'
[Unit]
Description=Inventory Management Application
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
EOF
```

### 8. Start Application

```bash
sudo systemctl daemon-reload
sudo systemctl enable demo-app
sudo systemctl start demo-app
sudo systemctl status demo-app
```

### 9. View Logs

```bash
# Real-time logs
sudo journalctl -u demo-app -f

# Recent logs
sudo journalctl -u demo-app -n 50
```

## Automated Deployment with User Data

Use the provided `userdata.sh` script when launching EC2 instances. Make sure to update the RDS endpoint in the script before use.

## API Endpoints

- `GET /api/products` - List all products
- `POST /api/products` - Create product
  - Body: `{ "name": "Product Name", "qty": 10 }`
- `PUT /api/products/:id` - Update product
  - Body: `{ "name": "Updated Name", "qty": 20 }`
- `DELETE /api/products/:id` - Delete product

## Environment Variables

- `DB_HOST` - RDS endpoint (e.g., `demo-db.xxxxx.ap-southeast-1.rds.amazonaws.com`)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database username (default: dbadmin)
- `DB_PASSWORD` - Database password
- `PORT` - Application port (default: 3000)

## Database Schema

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0
);
```

## Testing

1. Access application: `http://<ec2-public-ip>:3001`
2. Add a new product
3. Edit product quantity
4. Delete a product
5. Verify changes persist in RDS database

## Troubleshooting

### Cannot connect to RDS
- Check RDS security group allows port 5432 from EC2 security group
- Verify RDS endpoint in .env file
- Ensure EC2 and RDS are in the same VPC
- Test connection: `psql -h <rds-endpoint> -U dbadmin -d demo`

### Application not starting
- Check logs: `sudo journalctl -u demo-app -n 50`
- Verify .env file exists with correct RDS endpoint
- Check Node.js is installed: `node --version`

### Port already in use
- Change PORT in .env file
- Update security group rules

## RDS Benefits
- Automated backups
- Multi-AZ deployment for high availability
- Automatic software patching
- Scalable storage
- Read replicas for read-heavy workloads
