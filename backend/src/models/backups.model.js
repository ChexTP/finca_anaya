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
};

export const listBackupModules = () => {
  return Object.keys(backupQueries);
};

export const exportBackupModule = async ({ moduleName, exportedBy }) => {
  const query = backupQueries[moduleName];

  if (!query) {
    return null;
  }

  const result = await pool.query(query);

  await pool.query(
    `
    INSERT INTO backup_exports (module_name, format, exported_by)
    VALUES ($1, 'csv', $2)
    `,
    [moduleName, exportedBy]
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
