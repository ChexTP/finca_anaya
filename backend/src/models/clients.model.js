import { pool } from "../db.js";

export const listClients = async ({ search }) => {
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR document_number ILIKE $${params.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT *
    FROM clients
    ${where}
    ORDER BY created_at DESC
    `,
    params
  );

  return result.rows;
};

export const findClientById = async (id) => {
  const result = await pool.query("SELECT * FROM clients WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0];
};

export const createClient = async (clientData) => {
  const result = await pool.query(
    `
    INSERT INTO clients (
      name,
      document_type,
      document_number,
      phone,
      email,
      address,
      city,
      country,
      shipping_notes,
      billing_notes,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    [
      clientData.name,
      clientData.documentType || null,
      clientData.documentNumber || null,
      clientData.phone,
      clientData.email || null,
      clientData.address,
      clientData.city || null,
      clientData.country || null,
      clientData.shippingNotes || null,
      clientData.billingNotes || null,
      clientData.createdBy,
    ]
  );

  return result.rows[0];
};

export const updateClient = async (id, clientData) => {
  const result = await pool.query(
    `
    UPDATE clients
    SET
      name = $1,
      document_type = $2,
      document_number = $3,
      phone = $4,
      email = $5,
      address = $6,
      city = $7,
      country = $8,
      shipping_notes = $9,
      billing_notes = $10,
      is_active = $11,
      updated_at = NOW()
    WHERE id = $12
    RETURNING *
    `,
    [
      clientData.name,
      clientData.documentType || null,
      clientData.documentNumber || null,
      clientData.phone,
      clientData.email || null,
      clientData.address,
      clientData.city || null,
      clientData.country || null,
      clientData.shippingNotes || null,
      clientData.billingNotes || null,
      clientData.isActive,
      id,
    ]
  );

  return result.rows[0];
};
