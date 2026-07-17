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
  internal_code VARCHAR(30),
  category VARCHAR(80),
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

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  document_type VARCHAR(30),
  document_number VARCHAR(60),
  phone VARCHAR(40) UNIQUE NOT NULL,
  email VARCHAR(150),
  address TEXT NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100),
  shipping_notes TEXT,
  billing_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
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
  commercial_classification VARCHAR(30),
  gross_weight_kg NUMERIC(12, 3) NOT NULL,
  packaging_type_id INTEGER REFERENCES packaging_types(id),
  packaging_quantity INTEGER NOT NULL DEFAULT 0,
  inner_bag_quantity INTEGER NOT NULL DEFAULT 0,
  tare_weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  net_weight_kg NUMERIC(12, 3) NOT NULL,
  available_weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  humidity_percent NUMERIC(5, 2),
  performance_factor NUMERIC(8, 2),
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  coffee_variety VARCHAR(120),
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
      'pendiente_revision_fisica',
      'pendiente_laboratorio',
      'rechazado',
      'retirado',
      'aprobado',
      'disponible',
      'en_proceso',
      'procesado',
      'vendido_parcial',
      'agotado',
      'danado'
    )
  ),
  CONSTRAINT coffee_lots_kind_check CHECK (lot_kind IN ('LOT', 'PROC', 'PASILLA', 'RECUPERACION')),
  CONSTRAINT coffee_lots_commercial_classification_check CHECK (
    commercial_classification IS NULL OR commercial_classification IN ('Base', 'Regional', 'Varietal', 'Exotico', 'Procesado', 'Pasilla', 'Recuperacion')
  ),
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
  CONSTRAINT coffee_lots_performance_factor_check CHECK (
    performance_factor IS NULL OR performance_factor >= 0
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
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS commercial_classification VARCHAR(30);
ALTER TABLE coffee_profiles ADD COLUMN IF NOT EXISTS internal_code VARCHAR(30);
ALTER TABLE coffee_profiles ADD COLUMN IF NOT EXISTS category VARCHAR(80);
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_payment_method_id INTEGER REFERENCES payment_methods(id);
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_payment_reference TEXT;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_paid_at TIMESTAMP;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS purchase_registered_by INTEGER REFERENCES users(id);
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS performance_factor NUMERIC(8, 2);
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS received_at DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE coffee_lots ADD COLUMN IF NOT EXISTS coffee_variety VARCHAR(120);

DO $$
BEGIN
  ALTER TABLE coffee_lots DROP CONSTRAINT IF EXISTS coffee_lots_status_check;
  ALTER TABLE coffee_lots
  ADD CONSTRAINT coffee_lots_status_check CHECK (
    status IN (
      'pendiente_revision_fisica',
      'pendiente_laboratorio',
      'rechazado',
      'retirado',
      'aprobado',
      'disponible',
      'en_proceso',
      'procesado',
      'vendido_parcial',
      'agotado',
      'danado'
    )
  );
END $$;

DO $$
BEGIN
  ALTER TABLE coffee_lots DROP CONSTRAINT IF EXISTS coffee_lots_kind_check;
  ALTER TABLE coffee_lots
  ADD CONSTRAINT coffee_lots_kind_check
  CHECK (lot_kind IN ('LOT', 'PROC', 'PASILLA', 'RECUPERACION'));

  ALTER TABLE coffee_lots DROP CONSTRAINT IF EXISTS coffee_lots_commercial_classification_check;
  ALTER TABLE coffee_lots
  ADD CONSTRAINT coffee_lots_commercial_classification_check
  CHECK (
    commercial_classification IS NULL OR commercial_classification IN ('Base', 'Regional', 'Varietal', 'Exotico', 'Procesado', 'Pasilla', 'Recuperacion')
  );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffee_lots_performance_factor_check'
  ) THEN
    ALTER TABLE coffee_lots
    ADD CONSTRAINT coffee_lots_performance_factor_check
    CHECK (performance_factor IS NULL OR performance_factor >= 0);
  END IF;

END $$;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER NOT NULL REFERENCES coffee_lots(id),
  movement_type VARCHAR(40) NOT NULL,
  quantity_kg NUMERIC(12, 3) NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coffee_processes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  quote_id INTEGER,
  sale_id INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  process_location TEXT,
  estimated_return_date DATE,
  notes TEXT,
  total_input_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  output_lot_id INTEGER REFERENCES coffee_lots(id),
  output_weight_kg NUMERIC(12, 3),
  physical_humidity_percent NUMERIC(5, 2),
  physical_performance_factor NUMERIC(8, 2),
  physical_reviewed_by INTEGER REFERENCES users(id),
  physical_reviewed_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  finalized_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  lab_pending_at TIMESTAMP,
  finalized_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT coffee_processes_status_check CHECK (
    status IN ('pendiente', 'en_proceso', 'pendiente_revision_fisica', 'pendiente_laboratorio', 'finalizado')
  ),
  CONSTRAINT coffee_processes_weight_check CHECK (
    total_input_kg >= 0 AND (output_weight_kg IS NULL OR output_weight_kg >= 0)
  )
);

ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS quote_id INTEGER;
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS sale_id INTEGER;
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS estimated_return_date DATE;
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS lab_pending_at TIMESTAMP;
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS physical_humidity_percent NUMERIC(5, 2);
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS physical_performance_factor NUMERIC(8, 2);
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS physical_reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE coffee_processes ADD COLUMN IF NOT EXISTS physical_reviewed_at TIMESTAMP;
ALTER TABLE coffee_processes ALTER COLUMN status SET DEFAULT 'pendiente';

DO $$
BEGIN
  ALTER TABLE coffee_processes DROP CONSTRAINT IF EXISTS coffee_processes_status_check;
  ALTER TABLE coffee_processes
  ADD CONSTRAINT coffee_processes_status_check CHECK (
    status IN ('pendiente', 'en_proceso', 'pendiente_revision_fisica', 'pendiente_laboratorio', 'finalizado')
  );
END $$;

CREATE TABLE IF NOT EXISTS coffee_process_inputs (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL REFERENCES coffee_processes(id),
  lot_id INTEGER NOT NULL REFERENCES coffee_lots(id),
  quantity_kg NUMERIC(12, 3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT coffee_process_inputs_quantity_check CHECK (quantity_kg > 0)
);

CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  quote_type VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'borrador',
  currency VARCHAR(3) NOT NULL,
  payment_terms TEXT,
  delivery_terms TEXT,
  shipping_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  estimated_delivery_date DATE,
  notes TEXT,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT quotes_type_check CHECK (quote_type IN ('inventario_disponible', 'preventa')),
  CONSTRAINT quotes_status_check CHECK (status IN ('borrador', 'enviada', 'aceptada', 'anulada')),
  CONSTRAINT quotes_currency_check CHECK (currency IN ('COP', 'USD')),
  CONSTRAINT quotes_amounts_check CHECK (shipping_cost >= 0 AND subtotal >= 0 AND total >= 0)
);

CREATE TABLE IF NOT EXISTS quote_items (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  lot_id INTEGER REFERENCES coffee_lots(id),
  coffee_type_id INTEGER REFERENCES coffee_types(id),
  coffee_profile_id INTEGER REFERENCES coffee_profiles(id),
  description TEXT,
  product_form VARCHAR(20),
  process_type VARCHAR(20),
  variety TEXT,
  quantity_kg NUMERIC(12, 3) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  line_total NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT quote_items_quantity_check CHECK (quantity_kg > 0),
  CONSTRAINT quote_items_price_check CHECK (unit_price >= 0 AND line_total >= 0)
);

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_form VARCHAR(20);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS process_type VARCHAR(20);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS variety TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffee_processes_quote_id_fkey'
  ) THEN
    ALTER TABLE coffee_processes
    ADD CONSTRAINT coffee_processes_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES quotes(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  quote_id INTEGER UNIQUE REFERENCES quotes(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(40) NOT NULL DEFAULT 'pendiente_bodega',
  warehouse_priority VARCHAR(20) NOT NULL DEFAULT 'media',
  order_assignee VARCHAR(120),
  payment_status VARCHAR(30) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  shipping_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL,
  amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
  estimated_delivery_date DATE,
  estimated_payment_date DATE,
  external_invoice_reference TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_status_check CHECK (
    status IN (
      'pendiente_alistamiento',
      'pendiente_bodega',
      'lote_asignado',
      'proceso_solicitado',
      'en_proceso',
      'listo_para_ensamble',
      'ensamble_definido',
      'alistada',
      'despachada',
      'anulada'
    )
  ),
  CONSTRAINT sales_warehouse_priority_check CHECK (
    warehouse_priority IN ('alta', 'media', 'baja')
  ),
  CONSTRAINT sales_payment_status_check CHECK (
    payment_status IN ('pagada', 'pago_parcial', 'pendiente_pago')
  ),
  CONSTRAINT sales_currency_check CHECK (currency IN ('COP', 'USD')),
  CONSTRAINT sales_amounts_check CHECK (
    subtotal >= 0 AND shipping_cost >= 0 AND total >= 0 AND amount_paid >= 0 AND balance_due >= 0
  )
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  quote_item_id INTEGER REFERENCES quote_items(id),
  lot_id INTEGER REFERENCES coffee_lots(id),
  coffee_type_id INTEGER REFERENCES coffee_types(id),
  coffee_profile_id INTEGER REFERENCES coffee_profiles(id),
  description TEXT,
  product_form VARCHAR(20),
  process_type VARCHAR(20),
  variety TEXT,
  quantity_kg NUMERIC(12, 3) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  line_total NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sale_items_quantity_check CHECK (quantity_kg > 0),
  CONSTRAINT sale_items_price_check CHECK (unit_price >= 0 AND line_total >= 0)
);

ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_form VARCHAR(20);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS process_type VARCHAR(20);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS variety TEXT;

CREATE TABLE IF NOT EXISTS sale_item_lots (
  id SERIAL PRIMARY KEY,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  lot_id INTEGER NOT NULL REFERENCES coffee_lots(id),
  quantity_kg NUMERIC(12, 3) NOT NULL,
  deducted_at TIMESTAMP,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sale_item_lots_quantity_check CHECK (quantity_kg > 0)
);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS warehouse_priority VARCHAR(20) NOT NULL DEFAULT 'media';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_assignee VARCHAR(120);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS blend_required BOOLEAN;
ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'pendiente_bodega';
ALTER TABLE sales ALTER COLUMN warehouse_priority SET DEFAULT 'media';
ALTER TABLE sale_item_lots ADD COLUMN IF NOT EXISTS deducted_at TIMESTAMP;
ALTER TABLE sale_item_lots ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sale_item_lots ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

DO $$
BEGIN
  ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
  ALTER TABLE sales
  ADD CONSTRAINT sales_status_check CHECK (
    status IN (
      'pendiente_alistamiento',
      'pendiente_bodega',
      'lote_asignado',
      'proceso_solicitado',
      'en_proceso',
      'listo_para_ensamble',
      'ensamble_definido',
      'alistada',
      'despachada',
      'anulada'
    )
  );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_warehouse_priority_check'
  ) THEN
    ALTER TABLE sales
    ADD CONSTRAINT sales_warehouse_priority_check CHECK (
      warehouse_priority IN ('alta', 'media', 'baja')
    );
  END IF;
END $$;

UPDATE sales
SET estimated_delivery_date = quotes.estimated_delivery_date
FROM quotes
WHERE sales.quote_id = quotes.id
  AND sales.estimated_delivery_date IS NULL;

UPDATE sale_item_lots
SET deducted_at = COALESCE(sale_item_lots.deducted_at, sale_item_lots.created_at)
FROM sale_items
INNER JOIN sales ON sales.id = sale_items.sale_id
WHERE sale_item_lots.sale_item_id = sale_items.id
  AND sale_item_lots.deducted_at IS NULL
  AND sales.status = 'pendiente_alistamiento';

CREATE TABLE IF NOT EXISTS sale_blend_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  lot_id INTEGER NOT NULL REFERENCES coffee_lots(id),
  percentage NUMERIC(5, 2) NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sale_blend_items_percentage_check CHECK (percentage > 0 AND percentage <= 100)
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  payment_reference TEXT,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  registered_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sale_payments_amount_check CHECK (amount > 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffee_processes_sale_id_fkey'
  ) THEN
    ALTER TABLE coffee_processes
    ADD CONSTRAINT coffee_processes_sale_id_fkey
    FOREIGN KEY (sale_id) REFERENCES sales(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounts_payable (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES payable_categories(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  lot_id INTEGER REFERENCES coffee_lots(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  third_party_name VARCHAR(150),
  description TEXT NOT NULL,
  total NUMERIC(14, 2) NOT NULL,
  amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
  due_date DATE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT accounts_payable_status_check CHECK (status IN ('pendiente', 'pago_parcial', 'pagada')),
  CONSTRAINT accounts_payable_amounts_check CHECK (total >= 0 AND amount_paid >= 0 AND balance_due >= 0)
);

CREATE TABLE IF NOT EXISTS accounts_payable_payments (
  id SERIAL PRIMARY KEY,
  payable_id INTEGER NOT NULL REFERENCES accounts_payable(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  payment_reference TEXT NOT NULL,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  registered_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT accounts_payable_payments_amount_check CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS sample_requests (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  requester_name VARCHAR(150) NOT NULL,
  requester_phone VARCHAR(40) NOT NULL,
  requester_email VARCHAR(150),
  requester_company VARCHAR(150),
  requester_address TEXT,
  requester_city VARCHAR(100),
  requester_country VARCHAR(100),
  coffee_type_id INTEGER REFERENCES coffee_types(id),
  coffee_profile_id INTEGER REFERENCES coffee_profiles(id),
  description TEXT,
  quantity_kg NUMERIC(12, 3) NOT NULL,
  quantity_grams NUMERIC(12, 2),
  is_charged BOOLEAN NOT NULL DEFAULT FALSE,
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  price NUMERIC(14, 2),
  requested_at DATE NOT NULL DEFAULT CURRENT_DATE,
  tentative_delivery_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'solicitada',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  handled_by INTEGER REFERENCES users(id),
  handled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sample_requests_status_check CHECK (
    status IN ('solicitada', 'en_preparacion', 'lista', 'entregada', 'cancelada')
  ),
  CONSTRAINT sample_requests_currency_check CHECK (currency IN ('COP', 'USD')),
  CONSTRAINT sample_requests_quantity_check CHECK (quantity_kg > 0),
  CONSTRAINT sample_requests_price_check CHECK (price IS NULL OR price >= 0),
  CONSTRAINT sample_requests_coffee_reference_check CHECK (
    coffee_type_id IS NOT NULL OR coffee_profile_id IS NOT NULL OR description IS NOT NULL
  )
);

ALTER TABLE sample_requests ADD COLUMN IF NOT EXISTS quantity_grams NUMERIC(12, 2);
ALTER TABLE sample_requests ALTER COLUMN requester_phone DROP NOT NULL;
UPDATE sample_requests
SET quantity_grams = quantity_kg * 1000
WHERE quantity_grams IS NULL;
ALTER TABLE sample_requests ALTER COLUMN quantity_grams SET NOT NULL;

CREATE TABLE IF NOT EXISTS sample_request_items (
  id SERIAL PRIMARY KEY,
  sample_request_id INTEGER NOT NULL REFERENCES sample_requests(id) ON DELETE CASCADE,
  coffee_type_id INTEGER REFERENCES coffee_types(id),
  coffee_profile_id INTEGER REFERENCES coffee_profiles(id),
  description TEXT,
  quantity_grams NUMERIC(12, 2) NOT NULL,
  price NUMERIC(14, 2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sample_request_items_quantity_check CHECK (quantity_grams > 0),
  CONSTRAINT sample_request_items_price_check CHECK (price IS NULL OR price >= 0),
  CONSTRAINT sample_request_items_reference_check CHECK (
    coffee_type_id IS NOT NULL OR coffee_profile_id IS NOT NULL OR description IS NOT NULL
  )
);

INSERT INTO sample_request_items (
  sample_request_id, coffee_type_id, coffee_profile_id, description, quantity_grams, price
)
SELECT id, coffee_type_id, coffee_profile_id, description, quantity_grams, price
FROM sample_requests
WHERE NOT EXISTS (
  SELECT 1 FROM sample_request_items WHERE sample_request_items.sample_request_id = sample_requests.id
);

CREATE TABLE IF NOT EXISTS sample_item_blends (
  id SERIAL PRIMARY KEY,
  sample_request_item_id INTEGER NOT NULL REFERENCES sample_request_items(id) ON DELETE CASCADE,
  lot_id INTEGER NOT NULL REFERENCES coffee_lots(id),
  percentage NUMERIC(5, 2) NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sample_item_blends_percentage_check CHECK (percentage > 0 AND percentage <= 100)
);

-- Los tipos activos corresponden al beneficio con el que llega el cafe a bodega.
INSERT INTO coffee_types (name) VALUES ('Lavado'), ('Natural'), ('Semilavado')
ON CONFLICT (name) DO UPDATE SET is_active = TRUE;
UPDATE coffee_types
SET is_active = FALSE
WHERE name IN ('Pergamino', 'Trillado', 'Procesado', 'Especial');

-- Rol gerencial para consultar informes de produccion y necesidades de cafe.
INSERT INTO roles (name, label)
VALUES ('management', 'Gerencia')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO users (name, username, password_hash, role_id)
SELECT
  'Gerencia',
  'gerencia',
  '$2a$10$ks0Z89gbyBCha0zY1ZIR1OY06dYnmnXrI/Zm1eKQNzqrRLQdddboC',
  roles.id
FROM roles
WHERE roles.name = 'management'
ON CONFLICT (username) DO NOTHING;

-- Catalogo comercial inicial. Los 17 perfiles actuales corresponden a cafes exoticos.
UPDATE coffee_profiles
SET category = 'Exotico'
WHERE category IS NULL AND name ~ '^Perfil ([1-9]|1[0-7])$';

INSERT INTO coffee_profiles (name, category)
VALUES
  ('Regional 1', 'Regional'),
  ('Regional 2', 'Regional'),
  ('Regional 3', 'Regional'),
  ('Regional 4', 'Regional'),
  ('Regional 5', 'Regional'),
  ('Varietal 1', 'Varietal'),
  ('Varietal 2', 'Varietal'),
  ('Varietal 3', 'Varietal'),
  ('Varietal 4', 'Varietal'),
  ('Varietal 5', 'Varietal')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS backup_exports (
  id SERIAL PRIMARY KEY,
  module_name VARCHAR(80) NOT NULL,
  format VARCHAR(20) NOT NULL DEFAULT 'csv',
  exported_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_document ON clients(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_coffee_lots_code ON coffee_lots(code);
CREATE INDEX IF NOT EXISTS idx_coffee_lots_status ON coffee_lots(status);
CREATE INDEX IF NOT EXISTS idx_coffee_lots_supplier_id ON coffee_lots(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_lot_id ON inventory_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_coffee_processes_status ON coffee_processes(status);
CREATE INDEX IF NOT EXISTS idx_coffee_processes_quote_id ON coffee_processes(quote_id);
CREATE INDEX IF NOT EXISTS idx_coffee_processes_sale_id ON coffee_processes(sale_id);
CREATE INDEX IF NOT EXISTS idx_coffee_process_inputs_process_id ON coffee_process_inputs(process_id);
CREATE INDEX IF NOT EXISTS idx_coffee_process_inputs_lot_id ON coffee_process_inputs(lot_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_seller_id ON quotes(seller_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_sales_quote_id ON sales(quote_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_estimated_delivery_date ON sales(estimated_delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_warehouse_priority ON sales(warehouse_priority);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_item_lots_sale_item_id ON sale_item_lots(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_item_lots_lot_id ON sale_item_lots(lot_id);
CREATE INDEX IF NOT EXISTS idx_sale_blend_items_sale_id ON sale_blend_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_blend_items_sale_item_id ON sale_blend_items(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_blend_items_lot_id ON sale_blend_items(lot_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_category_id ON accounts_payable(category_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_supplier_id ON accounts_payable(supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_lot_id ON accounts_payable(lot_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_payments_payable_id ON accounts_payable_payments(payable_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_status ON sample_requests(status);
CREATE INDEX IF NOT EXISTS idx_sample_requests_created_by ON sample_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_sample_requests_requested_at ON sample_requests(requested_at);
CREATE INDEX IF NOT EXISTS idx_backup_exports_module_name ON backup_exports(module_name);
CREATE INDEX IF NOT EXISTS idx_backup_exports_created_at ON backup_exports(created_at);
