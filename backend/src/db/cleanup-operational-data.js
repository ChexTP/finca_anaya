import { pool } from "../db.js";

const mode = process.argv.includes("--execute") ? "execute" : "dry-run";

const countQueries = [
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
  ["coffee_processes", "SELECT COUNT(*)::int AS count FROM coffee_processes"],
  ["quote_items_no_historicos", "SELECT COUNT(*)::int AS count FROM quote_items WHERE quote_id NOT IN (SELECT id FROM cleanup_keep_quotes)"],
  ["quotes_no_historicas", "SELECT COUNT(*)::int AS count FROM quotes WHERE id NOT IN (SELECT id FROM cleanup_keep_quotes)"],
  ["inventory_movements", "SELECT COUNT(*)::int AS count FROM inventory_movements"],
  ["coffee_lots", "SELECT COUNT(*)::int AS count FROM coffee_lots"],
];

const deleteQueries = [
  // Las mezclas amarradas a lotes dejan de servir al borrar todos los lotes.
  ["sample_item_blends", "DELETE FROM sample_item_blends"],
  ["sale_item_lots", "DELETE FROM sale_item_lots"],
  ["sale_blend_items", "DELETE FROM sale_blend_items"],

  // Se conservan solo muestras entregadas.
  ["sample_request_items_no_historicos", "DELETE FROM sample_request_items WHERE sample_request_id NOT IN (SELECT id FROM cleanup_keep_samples)"],
  ["sample_requests_no_historicas", "DELETE FROM sample_requests WHERE id NOT IN (SELECT id FROM cleanup_keep_samples)"],

  // Se conservan solo ventas despachadas y sus pagos.
  ["sale_order_assignee_history_no_historica", "DELETE FROM sale_order_assignee_history WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sale_payments_no_historicos", "DELETE FROM sale_payments WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sale_items_no_historicos", "DELETE FROM sale_items WHERE sale_id NOT IN (SELECT id FROM cleanup_keep_sales)"],
  ["sales_no_historicas", "DELETE FROM sales WHERE id NOT IN (SELECT id FROM cleanup_keep_sales)"],

  // Se borran todos los procesos.
  ["coffee_process_inputs", "DELETE FROM coffee_process_inputs"],
  ["coffee_processes", "DELETE FROM coffee_processes"],

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

const createKeepTables = async (client) => {
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

const getCounts = async (client) => {
  const counts = {};

  for (const [name, query] of countQueries) {
    const result = await client.query(query);
    counts[name] = result.rows[0].count;
  }

  return counts;
};

const run = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createKeepTables(client);

    const counts = await getCounts(client);
    console.table(counts);

    if (mode !== "execute") {
      await client.query("ROLLBACK");
      console.log("Dry-run completado. No se elimino ningun dato. Use --execute para aplicar.");
      return;
    }

    for (const [name, query] of deleteQueries) {
      const result = await client.query(query);
      console.log(`${name}: ${result.rowCount} registros afectados`);
    }

    await client.query("COMMIT");
    console.log("Limpieza operativa aplicada correctamente.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error durante la limpieza operativa:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
