import { pool } from "../db.js";

const requiredPaymentMethods = ["Efectivo", "Transferencia", "Cheque", "Otro"];
const requiredPayableCategories = ["Lote de cafe"];
const requiredCoffeeTypes = ["Lavado", "Natural", "Semilavado"];
const requiredCoffeePresentations = ["Pergamino", "Excelso"];
const requiredPackagingTypes = [
  ["Costal o saco de fique", 0.7],
  ["Tula o estopa", 0.2],
  ["Bolsa interna", 0.05],
];
const requiredPurchaseCoffees = [
  ["Regional Lavado", "Regional", "Lavado"],
  ["Regional Natural", "Regional", "Natural"],
  ["Rosado Lavado", "Varietal", "Lavado"],
  ["Rosado Natural", "Varietal", "Natural"],
  ["Desco Lavado", "Varietal", "Lavado"],
  ["Geisha Lavado", "Varietal", "Lavado"],
  ["Geisha Natural", "Varietal", "Natural"],
];

const ensureNamedCatalogRows = async (tableName, names) => {
  for (const name of names) {
    await pool.query(
      `
      INSERT INTO ${tableName} (name, is_active)
      VALUES ($1, TRUE)
      ON CONFLICT (name) DO UPDATE
      SET is_active = TRUE
      `,
      [name]
    );
  }
};

export const ensureRequiredCatalogs = async () => {
  await ensureNamedCatalogRows("coffee_types", requiredCoffeeTypes);
  await ensureNamedCatalogRows("coffee_presentations", requiredCoffeePresentations);
  await ensureNamedCatalogRows("payment_methods", requiredPaymentMethods);
  await ensureNamedCatalogRows("payable_categories", requiredPayableCategories);

  for (const [name, tareKg] of requiredPackagingTypes) {
    await pool.query(
      `
      INSERT INTO packaging_types (name, tare_kg, is_active)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (name) DO UPDATE
      SET tare_kg = EXCLUDED.tare_kg,
          is_active = TRUE
      `,
      [name, tareKg]
    );
  }

  for (const [name, family, processType] of requiredPurchaseCoffees) {
    await pool.query(
      `
      INSERT INTO purchase_coffees (name, family, process_type, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (name) DO UPDATE
      SET family = EXCLUDED.family,
          process_type = EXCLUDED.process_type,
          is_active = TRUE,
          updated_at = NOW()
      `,
      [name, family, processType]
    );
  }
};

export const listSimpleCatalogForAdmin = async (tableName) => {
  const result = await pool.query(
    `
    SELECT *
    FROM ${tableName}
    ORDER BY is_active DESC, name ASC
    `
  );

  return result.rows;
};

export const createSimpleCatalogItem = async (tableName, { name, isActive = true }) => {
  const result = await pool.query(
    `
    INSERT INTO ${tableName} (name, is_active)
    VALUES ($1, $2)
    RETURNING *
    `,
    [name, isActive]
  );

  return result.rows[0];
};

export const updateSimpleCatalogItem = async (tableName, id, { name, isActive = true }) => {
  const result = await pool.query(
    `
    UPDATE ${tableName}
    SET name = $1,
        is_active = $2
    WHERE id = $3
    RETURNING *
    `,
    [name, isActive, id]
  );

  return result.rows[0];
};

export const listCatalog = async (tableName) => {
  const orderBy = ["purchase_coffees", "coffee_profiles"].includes(tableName)
    ? "created_at DESC, id DESC"
    : "name ASC";

  const result = await pool.query(
    `
    SELECT *
    FROM ${tableName}
    WHERE is_active = TRUE
    ORDER BY ${orderBy}
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
    ORDER BY created_at DESC, id DESC
    `
  );

  return result.rows;
};

export const listPurchaseCoffeesForAdmin = async () => {
  const result = await pool.query(
    `
    SELECT *
    FROM purchase_coffees
    ORDER BY created_at DESC, id DESC
    `
  );

  return result.rows;
};

export const createPurchaseCoffee = async ({
  name,
  family,
  processType,
  isActive = true,
}) => {
  const result = await pool.query(
    `
    INSERT INTO purchase_coffees (name, family, process_type, is_active)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [name, family, processType, isActive]
  );

  return result.rows[0];
};

export const updatePurchaseCoffee = async (
  id,
  {
    name,
    family,
    processType,
    isActive = true,
  }
) => {
  const result = await pool.query(
    `
    UPDATE purchase_coffees
    SET
      name = $1,
      family = $2,
      process_type = $3,
      is_active = $4,
      updated_at = NOW()
    WHERE id = $5
    RETURNING *
    `,
    [name, family, processType, isActive, id]
  );

  return result.rows[0];
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
