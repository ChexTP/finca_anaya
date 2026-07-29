import { pool } from "../db.js";

const mode = process.argv.includes("--execute") ? "execute" : "dry-run";
const fullReset = process.argv.includes("--full-reset");

const partialCountQueries = [
  ["sample_item_blends", "SELECT COUNT(*)::int AS count FROM sample_item_blends"],
  ["sample_request_items_no_historicos", "SELECT COUNT(*)::int AS count FROM sample_request_items WHERE sample_request_id NOT IN (SELECT id FROM cleanup_keep_samples)"],
  ["sample_requests_no_historicas", "SELECT COUNT(*)::int AS count FROM sample_requests WHERE id NOT IN (SELECT id FROM cleanup_keep_samples)"],
  ["sale_item_lots", "SELECT COUNT(*)::int AS count FROM sale_item_lots"],
  ["sale_blend_items", "SELECT COUNT(*)::int AS count FROM sale_blend_items"],
  ["sale_order_assignee_history_no_historica", "SELECT COUNT(*)::int AS count FROM sale_order_assignee_history WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sale_payments_no_historicos", "SELECT COUNT(*)::int AS count FROM sale_payments WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sale_items_no_historicos", "SELECT COUNT(*)::int AS count FROM sale_items WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sales_no_historicas", "SELECT COUNT(*)::int AS count FROM sales WHERE id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["coffee_process_inputs", "SELECT COUNT(*)::int AS count FROM coffee_process_inputs"],
  ["coffee_process_outputs", "SELECT COUNT(*)::int AS count FROM coffee_process_outputs"],
  ["coffee_processes", "SELECT COUNT(*)::int AS count FROM coffee_processes"],
  ["quote_items_no_historicos", "SELECT COUNT(*)::int AS count FROM quote_items WHERE quote_id NOT IN (SELECT id FROM cleanup_keep_quotes)"],
  ["quotes_no_historicas", "SELECT COUNT(*)::int AS count FROM quotes WHERE id NOT IN (SELECT id FROM cleanup_keep_quotes)"],
  ["inventory_movements", "SELECT COUNT(*)::int AS count FROM inventory_movements"],
  ["coffee_lots", "SELECT COUNT(*)::int AS count FROM coffee_lots"],
];

const partialDeleteQueries = [
  // Las mezclas amarradas a lotes dejan de servir al borrar todos los lotes.
  ["sample_item_blends", "DELETE FROM sample_item_blends"],
  ["sale_item_lots", "DELETE FROM sale_item_lots"],
  ["sale_blend_items", "DELETE FROM sale_blend_items"],

  // Se conservan solo muestras entregadas.
  ["sample_request_items_no_historicos", "DELETE FROM sample_request_items WHERE sample_request_id NOT IN (SELECT id FROM cleanup_keep_samples)"],
  ["sample_requests_no_historicas", "DELETE FROM sample_requests WHERE id NOT IN (SELECT id FROM cleanup_keep_samples)"],

  // Se borran todos los procesos.
  ["coffee_process_inputs", "DELETE FROM coffee_process_inputs"],
  ["coffee_process_outputs", "DELETE FROM coffee_process_outputs"],
  ["coffee_processes", "DELETE FROM coffee_processes"],

  // Se conservan solo ventas despachadas y sus pagos.
  ["sale_order_assignee_history_no_historica", "DELETE FROM sale_order_assignee_history WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sale_payments_no_historicos", "DELETE FROM sale_payments WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sale_items_no_historicos", "DELETE FROM sale_items WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sales_no_historicas", "DELETE FROM sales WHERE id NOT IN (SELECT id FROM cleanup_keep_sales)"],

  // Se conservan solo cotizaciones aceptadas.
  ["quote_items_no_historicos", "DELETE FROM quote_items WHERE quote_id NOT IN (SELECT id FROM cleanup_keep_quotes)"],
  ["quotes_no_historicas", "DELETE FROM quotes WHERE id NOT IN (SELECT id FROM cleanup_keep_quotes)"],

  // Se limpian referencias a lotes para permitir borrar todos los lotes.
  ["quote_items_lot_id", "UPDATE quote_items SET lot_id = NULL WHERE lot_id IS NOT NULL"],
  ["sale_items_lot_id", "UPDATE sale_items SET lot_id = NULL WHERE lot_id IS NOT NULL"],
  ["accounts_payable_lot_id", "UPDATE accounts_payable SET lot_id = NULL WHERE lot_id IS NOT NULL"],

  // Se borra todo el movimiento operativo de inventario y todos los lotes.
  ["inventory_movements", "DELETE FROM inventory_movements"],
  ["coffee_lots", "DELETE FROM coffee_lots"],
];

const fullCountQueries = [
  ["sample_item_blends", "SELECT COUNT(*)::int AS count FROM sample_item_blends"],
  ["sample_request_items", "SELECT COUNT(*)::int AS count FROM sample_request_items"],
  ["sample_requests", "SELECT COUNT(*)::int AS count FROM sample_requests"],
  ["sale_item_lots", "SELECT COUNT(*)::int AS count FROM sale_item_lots"],
  ["sale_blend_items", "SELECT COUNT(*)::int AS count FROM sale_blend_items"],
  ["sale_order_assignee_history", "SELECT COUNT(*)::int AS count FROM sale_order_assignee_history"],
  ["sale_payments", "SELECT COUNT(*)::int AS count FROM sale_payments"],
  ["sale_items", "SELECT COUNT(*)::int AS count FROM sale_items"],
  ["sales", "SELECT COUNT(*)::int AS count FROM sales"],
  ["coffee_process_inputs", "SELECT COUNT(*)::int AS count FROM coffee_process_inputs"],
  ["coffee_process_outputs", "SELECT COUNT(*)::int AS count FROM coffee_process_outputs"],
  ["coffee_processes", "SELECT COUNT(*)::int AS count FROM coffee_processes"],
  ["quote_items", "SELECT COUNT(*)::int AS count FROM quote_items"],
  ["quotes", "SELECT COUNT(*)::int AS count FROM quotes"],
  ["accounts_payable_payments", "SELECT COUNT(*)::int AS count FROM accounts_payable_payments"],
  ["accounts_payable", "SELECT COUNT(*)::int AS count FROM accounts_payable"],
  ["inventory_movements", "SELECT COUNT(*)::int AS count FROM inventory_movements"],
  ["coffee_lots", "SELECT COUNT(*)::int AS count FROM coffee_lots"],
  ["suppliers", "SELECT COUNT(*)::int AS count FROM suppliers"],
  ["clients", "SELECT COUNT(*)::int AS count FROM clients"],
  ["backup_exports", "SELECT COUNT(*)::int AS count FROM backup_exports"],
  ["coffee_profile_components", "SELECT COUNT(*)::int AS count FROM coffee_profile_components"],
  ["coffee_profiles", "SELECT COUNT(*)::int AS count FROM coffee_profiles"],
  ["purchase_coffees", "SELECT COUNT(*)::int AS count FROM purchase_coffees"],
  ["coffee_types", "SELECT COUNT(*)::int AS count FROM coffee_types"],
  ["payment_methods", "SELECT COUNT(*)::int AS count FROM payment_methods"],
  ["payable_categories", "SELECT COUNT(*)::int AS count FROM payable_categories"],
  ["code_counters", "SELECT COUNT(*)::int AS count FROM code_counters"],
];

const fullDeleteQueries = [
  // Limpieza total de datos de prueba: conserva usuarios, roles y catalogos base.
  ["sample_item_blends", "DELETE FROM sample_item_blends"],
  ["sample_request_items", "DELETE FROM sample_request_items"],
  ["sample_requests", "DELETE FROM sample_requests"],
  ["sale_item_lots", "DELETE FROM sale_item_lots"],
  ["sale_blend_items", "DELETE FROM sale_blend_items"],
  ["coffee_process_inputs", "DELETE FROM coffee_process_inputs"],
  ["coffee_process_outputs", "DELETE FROM coffee_process_outputs"],
  ["coffee_processes", "DELETE FROM coffee_processes"],
  ["sale_order_assignee_history", "DELETE FROM sale_order_assignee_history"],
  ["sale_payments", "DELETE FROM sale_payments"],
  ["sale_items", "DELETE FROM sale_items"],
  ["sales", "DELETE FROM sales"],
  ["quote_items", "DELETE FROM quote_items"],
  ["quotes", "DELETE FROM quotes"],
  ["accounts_payable_payments", "DELETE FROM accounts_payable_payments"],
  ["accounts_payable", "DELETE FROM accounts_payable"],
  ["inventory_movements", "DELETE FROM inventory_movements"],
  ["coffee_lots", "DELETE FROM coffee_lots"],
  ["suppliers", "DELETE FROM suppliers"],
  ["clients", "DELETE FROM clients"],
  ["backup_exports", "DELETE FROM backup_exports"],
  ["coffee_profile_components", "DELETE FROM coffee_profile_components"],
  ["coffee_profiles", "DELETE FROM coffee_profiles"],
  ["purchase_coffees", "DELETE FROM purchase_coffees"],
  ["coffee_types", "DELETE FROM coffee_types"],
  ["payment_methods", "DELETE FROM payment_methods"],
  ["payable_categories", "DELETE FROM payable_categories"],
  ["code_counters", "DELETE FROM code_counters"],
];

const sequenceNames = [
  "sample_item_blends_id_seq",
  "sample_request_items_id_seq",
  "sample_requests_id_seq",
  "sale_item_lots_id_seq",
  "sale_blend_items_id_seq",
  "sale_order_assignee_history_id_seq",
  "sale_payments_id_seq",
  "sale_items_id_seq",
  "sales_id_seq",
  "coffee_process_inputs_id_seq",
  "coffee_process_outputs_id_seq",
  "coffee_processes_id_seq",
  "quote_items_id_seq",
  "quotes_id_seq",
  "accounts_payable_payments_id_seq",
  "accounts_payable_id_seq",
  "inventory_movements_id_seq",
  "coffee_lots_id_seq",
  "suppliers_id_seq",
  "clients_id_seq",
  "backup_exports_id_seq",
  "coffee_profile_components_id_seq",
  "coffee_profiles_id_seq",
  "purchase_coffees_id_seq",
  "coffee_types_id_seq",
  "payment_methods_id_seq",
  "payable_categories_id_seq",
  "code_counters_id_seq",
];

const createKeepTables = async (client) => {
  if (fullReset) {
    return;
  }

  await client.query(`
    CREATE TEMP TABLE cleanup_keep_sales ON COMMIT DROP AS
    SELECT id
    FROM sales
    WHERE status = 'despachada';
  `);

  await client.query(`
    CREATE TEMP TABLE cleanup_keep_quotes ON COMMIT DROP AS
    SELECT id
    FROM quotes
    WHERE status = 'aceptada'
    UNION
    SELECT quote_id
    FROM sales
    WHERE quote_id IS NOT NULL
      AND id IN (SELECT id FROM cleanup_keep_sales);
  `);

  await client.query(`
    CREATE TEMP TABLE cleanup_keep_samples ON COMMIT DROP AS
    SELECT id
    FROM sample_requests
    WHERE status = 'entregada';
  `);
};

const getCounts = async (client, countQueries) => {
  const counts = {};

  for (const [name, query] of countQueries) {
    const result = await client.query(query);
    counts[name] = result.rows[0].count;
  }

  return counts;
};

const resetSequences = async (client) => {
  for (const sequenceName of sequenceNames) {
    await client.query("SELECT setval($1::regclass, 1, false)", [sequenceName]);
  }
};

const run = async () => {
  const client = await pool.connect();
  const countQueries = fullReset ? fullCountQueries : partialCountQueries;
  const deleteQueries = fullReset ? fullDeleteQueries : partialDeleteQueries;

  try {
    await client.query("BEGIN");
    await createKeepTables(client);

    const counts = await getCounts(client, countQueries);
    console.table(counts);

    if (mode !== "execute") {
      await client.query("ROLLBACK");
      console.log("Dry-run completado. No se elimino ningun dato. Use --execute para aplicar.");
      if (fullReset) {
        console.log("Modo total activado: se conservaran solo usuarios y roles.");
      }
      return;
    }

    for (const [name, query] of deleteQueries) {
      const result = await client.query(query);
      console.log(`${name}: ${result.rowCount} registros afectados`);
    }

    if (fullReset) {
      await resetSequences(client);
      console.log("Secuencias operativas reiniciadas.");
    }

    await client.query("COMMIT");
    console.log(fullReset ? "Limpieza total aplicada correctamente." : "Limpieza operativa aplicada correctamente.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error durante la limpieza:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
