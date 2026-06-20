import { pool } from "../db.js";

export const listCatalog = async (tableName) => {
  const result = await pool.query(
    `
    SELECT *
    FROM ${tableName}
    WHERE is_active = TRUE
    ORDER BY name ASC
    `
  );

  return result.rows;
};

export const updateCoffeeProfile = async (id, { name, basePriceCop, basePriceUsd, isActive }) => {
  const result = await pool.query(
    `
    UPDATE coffee_profiles
    SET
      name = $1,
      base_price_cop = $2,
      base_price_usd = $3,
      is_active = $4,
      updated_at = NOW()
    WHERE id = $5
    RETURNING *
    `,
    [name, basePriceCop, basePriceUsd, isActive, id]
  );

  return result.rows[0];
};
