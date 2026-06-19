-- Esquema base del backend de Finca Anaya.
-- La fase inicial deja listas las tablas de usuarios, roles y catalogos simples.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coffee_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coffee_profiles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  base_price_cop NUMERIC(14, 2) NOT NULL DEFAULT 0,
  base_price_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packaging_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  tare_kg NUMERIC(10, 3) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payable_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(40) UNIQUE NOT NULL,
  address TEXT NOT NULL,
  origin_zone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coffee_lots (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE,
  supplier_id INTEGER REFERENCES suppliers(id),
  coffee_type_id INTEGER REFERENCES coffee_types(id),
  coffee_profile_id INTEGER REFERENCES coffee_profiles(id),
  status VARCHAR(40) NOT NULL DEFAULT 'pendiente_laboratorio',
  lot_kind VARCHAR(20) NOT NULL DEFAULT 'LOT',
  gross_weight_kg NUMERIC(12, 3) NOT NULL,
  packaging_type_id INTEGER REFERENCES packaging_types(id),
  packaging_quantity INTEGER NOT NULL DEFAULT 0,
  inner_bag_quantity INTEGER NOT NULL DEFAULT 0,
  tare_weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  net_weight_kg NUMERIC(12, 3) NOT NULL,
  available_weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  humidity_percent NUMERIC(5, 2),
  visual_status VARCHAR(20),
  visual_defect_percent NUMERIC(5, 2),
  visual_notes TEXT,
  lab_aroma TEXT,
  lab_fragrance TEXT,
  lab_flavor TEXT,
  lab_acidity TEXT,
  lab_sweetness TEXT,
  lab_body TEXT,
  lab_balance TEXT,
  lab_uniformity TEXT,
  lab_residual TEXT,
  lab_clean_cup TEXT,
  lab_score NUMERIC(8, 2),
  lab_notes TEXT,
  lab_reviewed_by INTEGER REFERENCES users(id),
  lab_reviewed_at TIMESTAMP,
  origin_zone TEXT,
  initial_comment TEXT,
  purchase_price_per_kg NUMERIC(14, 2),
  purchase_total NUMERIC(14, 2),
  purchase_paid BOOLEAN NOT NULL DEFAULT FALSE,
  purchase_payment_method_id INTEGER REFERENCES payment_methods(id),
  purchase_payment_reference TEXT,
  purchase_paid_at TIMESTAMP,
  purchase_registered_by INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT coffee_lots_status_check CHECK (
    status IN (
      'pendiente_laboratorio',
      'rechazado',
      'aprobado',
      'disponible',
      'en_proceso',
      'procesado',
      'vendido_parcial',
      'agotado'
    )
  ),
  CONSTRAINT coffee_lots_kind_check CHECK (lot_kind IN ('LOT', 'PROC')),
  CONSTRAINT coffee_lots_visual_status_check CHECK (
    visual_status IS NULL OR visual_status IN ('aprobado', 'rechazado')
  ),
  CONSTRAINT coffee_lots_weights_check CHECK (
    gross_weight_kg >= 0
    AND tare_weight_kg >= 0
    AND net_weight_kg >= 0
    AND available_weight_kg >= 0
  ),
  CONSTRAINT coffee_lots_humidity_check CHECK (
    humidity_percent IS NULL OR (humidity_percent >= 0 AND humidity_percent <= 100)
  ),
  CONSTRAINT coffee_lots_visual_defect_check CHECK (
    visual_defect_percent IS NULL OR (visual_defect_percent >= 0 AND visual_defect_percent <= 100)
  ),
  CONSTRAINT coffee_lots_lab_score_check CHECK (
    lab_score IS NULL OR lab_score >= 0
  )
);

ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_aroma TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_fragrance TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_flavor TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_acidity TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_sweetness TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_body TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_balance TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_uniformity TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_residual TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_clean_cup TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_score NUMERIC(8, 2);
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_notes TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS lab_reviewed_at TIMESTAMP;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_payment_method_id INTEGER REFERENCES payment_methods(id);
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_payment_reference TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_paid_at TIMESTAMP;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_registered_by INTEGER REFERENCES users(id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER NOT NULL REFERENCES coffee_lots(id),
  movement_type VARCHAR(40) NOT NULL,
  quantity_kg NUMERIC(12, 3) NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_coffee_lots_code ON coffee_lots(code);
CREATE INDEX IF NOT EXISTS idx_coffee_lots_status ON coffee_lots(status);
CREATE INDEX IF NOT EXISTS idx_coffee_lots_supplier_id ON coffee_lots(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_lot_id ON inventory_movements(lot_id);
