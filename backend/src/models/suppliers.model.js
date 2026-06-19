import { pool } from "../db.js";

export const listSuppliers = async () => {
  const result = await pool.query(
    `
    SELECT *
    FROM suppliers
    ORDER BY created_at DESC
    `
  );

  return result.rows;
};

export const findSupplierById = async (id) => {
  const result = await pool.query("SELECT * FROM suppliers WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0];
};

export const createSupplier = async ({ name, phone, address, originZone, notes }) => {
  const result = await pool.query(
    `
    INSERT INTO suppliers (name, phone, address, origin_zone, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [name, phone, address, originZone || null, notes || null]
  );

  return result.rows[0];
};

export const updateSupplier = async (id, { name, phone, address, originZone, notes, isActive }) => {
  const result = await pool.query(
    `
    UPDATE suppliers
    SET
      name = $1,
      phone = $2,
      address = $3,
      origin_zone = $4,
      notes = $5,
      is_active = $6,
      updated_at = NOW()
    WHERE id = $7
    RETURNING *
    `,
    [name, phone, address, originZone || null, notes || null, isActive, id]
  );

  return result.rows[0];
};

