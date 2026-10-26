CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0
);

INSERT INTO products (name, qty) VALUES
  ('Laptop', 15),
  ('Mouse', 50),
  ('Keyboard', 30);
