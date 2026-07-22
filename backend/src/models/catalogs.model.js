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
    SELECT
      coffee_profiles.*,
      process_purchase.name AS process_purchase_coffee_name,
      base_purchase.name AS base_purchase_coffee_name
    FROM coffee_profiles
    LEFT JOIN purchase_coffees process_purchase ON process_purchase.id = coffee_profiles.process_purchase_coffee_id
    LEFT JOIN purchase_coffees base_purchase ON base_purchase.id = coffee_profiles.base_purchase_coffee_id
    ORDER BY is_active DESC, name ASC
    `
  );

  return result.rows;
};

export const createCoffeeProfile = async ({
  name,
  code,
  category,
  processPurchaseCoffeeId,
  basePurchaseCoffeeId,
  processPercentage,
  basePercentage,
  basePriceCop,
  basePriceUsd,
}) => {
  const result = await pool.query(
    `
    INSERT INTO coffee_profiles (
      name,
      internal_code,
      category,
      process_purchase_coffee_id,
      base_purchase_coffee_id,
      process_percentage,
      base_percentage,
      base_price_cop,
      base_price_usd
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      name,
      code,
      category,
      processPurchaseCoffeeId,
      basePurchaseCoffeeId,
      processPercentage,
      basePercentage,
      basePriceCop,
      basePriceUsd,
    ]
  );

  return result.rows[0];
};

export const updateCoffeeProfile = async (
  id,
  {
    name,
    code,
    category,
    processPurchaseCoffeeId,
    basePurchaseCoffeeId,
    processPercentage,
    basePercentage,
    basePriceCop,
    basePriceUsd,
    isActive,
  }
) => {
  const result = await pool.query(
    `
    UPDATE coffee_profiles
    SET
      name = $1,
      internal_code = $2,
      category = $3,
      process_purchase_coffee_id = $4,
      base_purchase_coffee_id = $5,
      process_percentage = $6,
      base_percentage = $7,
      base_price_cop = $8,
      base_price_usd = $9,
      is_active = $10,
      updated_at = NOW()
    WHERE id = $11
    RETURNING *
    `,
    [
      name,
      code,
      category,
      processPurchaseCoffeeId,
      basePurchaseCoffeeId,
      processPercentage,
      basePercentage,
      basePriceCop,
      basePriceUsd,
      isActive,
      id,
    ]
  );

  return result.rows[0];
};
