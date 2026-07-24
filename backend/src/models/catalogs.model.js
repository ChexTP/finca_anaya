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
      base_purchase.name AS base_purchase_coffee_name,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', coffee_profile_components.id,
              'purchase_coffee_id', coffee_profile_components.purchase_coffee_id,
              'purchase_coffee_name', purchase_coffees.name,
              'purchase_coffee_family', purchase_coffees.family,
              'purchase_coffee_process_type', purchase_coffees.process_type,
              'percentage', coffee_profile_components.percentage,
              'sort_order', coffee_profile_components.sort_order
            )
            ORDER BY coffee_profile_components.sort_order ASC, coffee_profile_components.id ASC
          )
          FROM coffee_profile_components
          INNER JOIN purchase_coffees ON purchase_coffees.id = coffee_profile_components.purchase_coffee_id
          WHERE coffee_profile_components.coffee_profile_id = coffee_profiles.id
        ),
        '[]'::json
      ) AS components
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
  components = [],
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
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

    const profile = result.rows[0];
    await replaceCoffeeProfileComponents(client, profile.id, components);

    await client.query("COMMIT");
    return profile;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
    components = [],
    isActive,
  }
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
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

    const profile = result.rows[0];

    if (profile) {
      await replaceCoffeeProfileComponents(client, id, components);
    }

    await client.query("COMMIT");
    return profile;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const replaceCoffeeProfileComponents = async (client, profileId, components) => {
  await client.query("DELETE FROM coffee_profile_components WHERE coffee_profile_id = $1", [profileId]);

  for (const [index, component] of components.entries()) {
    await client.query(
      `
      INSERT INTO coffee_profile_components (
        coffee_profile_id,
        purchase_coffee_id,
        percentage,
        sort_order
      )
      VALUES ($1, $2, $3, $4)
      `,
      [profileId, component.purchaseCoffeeId, component.percentage ?? null, index + 1]
    );
  }
};
