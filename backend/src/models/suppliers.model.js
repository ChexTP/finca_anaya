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

export const createSupplier = async (supplierData) => {
  const result = await pool.query(
    `
    INSERT INTO suppliers (
      name,
      document_type,
      document_number,
      phone,
      email,
      address,
      city,
      country,
      origin_zone,
      shipping_notes,
      billing_notes,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
    `,
    [
      supplierData.name,
      supplierData.documentType || null,
      supplierData.documentNumber || null,
      supplierData.phone,
      supplierData.email || null,
      supplierData.address,
      supplierData.city || null,
      supplierData.country || null,
      supplierData.originZone || null,
      supplierData.shippingNotes || null,
      supplierData.billingNotes || null,
      supplierData.notes || null,
    ]
  );

  return result.rows[0];
};

export const updateSupplier = async (id, supplierData) => {
  const result = await pool.query(
    `
    UPDATE suppliers
    SET
      name = $1,
      document_type = $2,
      document_number = $3,
      phone = $4,
      email = $5,
      address = $6,
      city = $7,
      country = $8,
      origin_zone = $9,
      shipping_notes = $10,
      billing_notes = $11,
      notes = $12,
      is_active = $13,
      updated_at = NOW()
    WHERE id = $14
    RETURNING *
    `,
    [
      supplierData.name,
      supplierData.documentType || null,
      supplierData.documentNumber || null,
      supplierData.phone,
      supplierData.email || null,
      supplierData.address,
      supplierData.city || null,
      supplierData.country || null,
      supplierData.originZone || null,
      supplierData.shippingNotes || null,
      supplierData.billingNotes || null,
      supplierData.notes || null,
      supplierData.isActive,
      id,
    ]
  );

  return result.rows[0];
};
