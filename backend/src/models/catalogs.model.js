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

export const listCoffeeProfilesForAdmin = async () => {
  const result = await pool.query(
    `
    SELECT *
    FROM coffee_profiles
    ORDER BY is_active DESC, name ASC
    `
  );

  return result.rows;
};

export const createCoffeeProfile = async ({ name, code, category, basePriceCop, basePriceUsd }) => {
  const result = await pool.query(
    `
    INSERT INTO coffee_profiles (name, internal_code, category, base_price_cop, base_price_usd)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [name, code, category, basePriceCop, basePriceUsd]
  );

  return result.rows[0];
};

export const updateCoffeeProfile = async (id, { name, code, category, basePriceCop, basePriceUsd, isActive }) => {
  const result = await pool.query(
    `
    UPDATE coffee_profiles
    SET
      name = $1,
      internal_code = $2,
      category = $3,
      base_price_cop = $4,
      base_price_usd = $5,
      is_active = $6,
      updated_at = NOW()
    WHERE id = $7
    RETURNING *
    `,
    [name, code, category, basePriceCop, basePriceUsd, isActive, id]
  );

  return result.rows[0];
};
