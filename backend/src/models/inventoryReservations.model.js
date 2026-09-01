import { pool } from "../db.js";

const inventoryReservationsTableSql = `
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER NOT NULL REFERENCES coffee_lots(id),
  quantity_kg NUMERIC(12, 3) NOT NULL,
  reserved_for TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'activa',
  created_by INTEGER REFERENCES users(id),
  released_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP,
  CONSTRAINT inventory_reservations_quantity_check CHECK (quantity_kg > 0),
  CONSTRAINT inventory_reservations_status_check CHECK (status IN ('activa', 'liberada'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_lot_id ON inventory_reservations(lot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status ON inventory_reservations(status);
`;

let ensurePromise = null;

export const ensureInventoryReservationsTable = async (client = pool) => {
  if (client !== pool) {
    await client.query(inventoryReservationsTableSql);
    return;
  }

  if (!ensurePromise) {
    ensurePromise = pool.query(inventoryReservationsTableSql);
  }

  await ensurePromise;
};
