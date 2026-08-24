import { pool } from "../db.js";

const backupQueries = {
  clients: `
    SELECT *
    FROM clients
    ORDER BY created_at DESC
  `,
  suppliers: `
    SELECT *
    FROM suppliers
    ORDER BY created_at DESC
  `,
  purchase_coffees: `
    SELECT
      id,
      name AS cafe_compra,
      family AS familia,
      process_type AS proceso,
      base_price_factor90_cop AS precio_base_carga_factor_90_cop,
      CASE WHEN is_active THEN 'activo' ELSE 'inactivo' END AS estado,
      created_at,
      updated_at
    FROM purchase_coffees
    ORDER BY created_at DESC, id DESC
  `,
  coffee_profiles: `
    SELECT
      coffee_profiles.id,
      coffee_profiles.name AS perfil_venta,
      coffee_profiles.internal_code AS codigo_interno,
      coffee_profiles.category AS categoria,
      coffee_profiles.process_type AS proceso,
      process_purchase.name AS componente_principal_anterior,
      coffee_profiles.process_percentage AS porcentaje_componente_anterior,
      base_purchase.name AS base_principal,
      coffee_profiles.base_percentage AS porcentaje_base,
      coffee_profiles.base_price_cop AS precio_carga_cop,
      coffee_profiles.base_price_usd AS precio_usd,
      CASE WHEN coffee_profiles.is_active THEN 'activo' ELSE 'inactivo' END AS estado,
      COALESCE(components.components_summary, '') AS componentes,
      COALESCE(components.components_codes, '') AS codigos_componentes,
      coffee_profiles.created_at,
      coffee_profiles.updated_at
    FROM coffee_profiles
    LEFT JOIN purchase_coffees process_purchase ON process_purchase.id = coffee_profiles.process_purchase_coffee_id
    LEFT JOIN purchase_coffees base_purchase ON base_purchase.id = coffee_profiles.base_purchase_coffee_id
    LEFT JOIN LATERAL (
      SELECT
        string_agg(
          CONCAT(
            CASE coffee_profile_components.component_type
              WHEN 'profile' THEN 'Proceso'
              ELSE 'Compra'
            END,
            ': ',
            COALESCE(purchase_coffees.name, component_profiles.name, 'Sin nombre'),
            CASE
              WHEN coffee_profile_components.percentage IS NULL THEN ''
              ELSE CONCAT(' ', coffee_profile_components.percentage, '%')
            END
          ),
          ' / '
          ORDER BY coffee_profile_components.sort_order ASC, coffee_profile_components.id ASC
        ) AS components_summary,
        string_agg(
          COALESCE(component_profiles.internal_code, ''),
          ' / '
          ORDER BY coffee_profile_components.sort_order ASC, coffee_profile_components.id ASC
        ) AS components_codes
      FROM coffee_profile_components
      LEFT JOIN purchase_coffees ON purchase_coffees.id = coffee_profile_components.purchase_coffee_id
      LEFT JOIN coffee_profiles component_profiles ON component_profiles.id = coffee_profile_components.component_profile_id
      WHERE coffee_profile_components.coffee_profile_id = coffee_profiles.id
    ) components ON TRUE
    ORDER BY coffee_profiles.created_at DESC, coffee_profiles.id DESC
  `,
  lots: `
    SELECT *
    FROM coffee_lots
    ORDER BY created_at DESC
  `,
  inventory_movements: `
    SELECT *
    FROM inventory_movements
    ORDER BY created_at DESC
  `,
  quotes: `
    SELECT *
    FROM quotes
    ORDER BY created_at DESC
  `,
  quote_items: `
    SELECT *
    FROM quote_items
    ORDER BY created_at DESC
  `,
  sales: `
    SELECT *
    FROM sales
    ORDER BY created_at DESC
  `,
  sale_items: `
    SELECT *
    FROM sale_items
    ORDER BY created_at DESC
  `,
  sale_payments: `
    SELECT *
    FROM sale_payments
    ORDER BY created_at DESC
  `,
  payables: `
    SELECT *
    FROM accounts_payable
    ORDER BY created_at DESC
  `,
  payable_payments: `
    SELECT *
    FROM accounts_payable_payments
    ORDER BY created_at DESC
  `,
  processes: `
    SELECT *
    FROM coffee_processes
    ORDER BY created_at DESC
  `,
  process_inputs: `
    SELECT *
    FROM coffee_process_inputs
    ORDER BY created_at DESC
  `,
  sample_requests: `
    SELECT *
    FROM sample_requests
    ORDER BY created_at DESC
  `,
};

export const listBackupModules = () => {
  return Object.keys(backupQueries);
};

export const exportBackupModule = async ({ moduleName, exportedBy, format = "csv" }) => {
  const query = backupQueries[moduleName];

  if (!query) {
    return null;
  }

  const result = await pool.query(query);

  await pool.query(
    `
    INSERT INTO backup_exports (module_name, format, exported_by)
    VALUES ($1, $2, $3)
    `,
    [moduleName, format, exportedBy]
  );

  return result.rows;
};

export const listBackupHistory = async () => {
  const result = await pool.query(
    `
    SELECT
      backup_exports.*,
      users.name AS exported_by_name
    FROM backup_exports
    LEFT JOIN users ON users.id = backup_exports.exported_by
    ORDER BY backup_exports.created_at DESC
    LIMIT 100
    `
  );

  return result.rows;
};
