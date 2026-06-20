import { pool } from "../db.js";

const buildDateFilters = ({ dateFrom, dateTo, tableAlias = "sales", params }) => {
  const conditions = [];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`${tableAlias}.created_at::date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`${tableAlias}.created_at::date <= $${params.length}`);
  }

  return conditions;
};

export const getSalesSummaryReport = async ({ dateFrom, dateTo, currency }) => {
  const params = [];
  const conditions = ["sales.status <> 'anulada'"];

  conditions.push(...buildDateFilters({ dateFrom, dateTo, params }));

  if (currency) {
    params.push(currency);
    conditions.push(`sales.currency = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      sales.currency,
      COUNT(*) AS sales_count,
      COALESCE(SUM(sales.subtotal), 0) AS subtotal,
      COALESCE(SUM(sales.shipping_cost), 0) AS shipping_total,
      COALESCE(SUM(sales.total), 0) AS total,
      COALESCE(SUM(sales.amount_paid), 0) AS amount_paid,
      COALESCE(SUM(sales.balance_due), 0) AS balance_due
    FROM sales
    WHERE ${conditions.join(" AND ")}
    GROUP BY sales.currency
    ORDER BY sales.currency ASC
    `,
    params
  );

  return result.rows;
};

export const getSalesBySellerReport = async ({ dateFrom, dateTo, currency }) => {
  const params = [];
  const conditions = ["sales.status <> 'anulada'"];

  conditions.push(...buildDateFilters({ dateFrom, dateTo, params }));

  if (currency) {
    params.push(currency);
    conditions.push(`sales.currency = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      users.id AS seller_id,
      users.name AS seller_name,
      sales.currency,
      COUNT(*) AS sales_count,
      COALESCE(SUM(sales.subtotal), 0) AS subtotal,
      COALESCE(SUM(sales.total), 0) AS total,
      COALESCE(SUM(sales.balance_due), 0) AS balance_due
    FROM sales
    INNER JOIN users ON users.id = sales.seller_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY users.id, users.name, sales.currency
    ORDER BY total DESC
    `,
    params
  );

  return result.rows;
};

export const getSalesByProfileReport = async ({ dateFrom, dateTo, currency }) => {
  const params = [];
  const conditions = ["sales.status <> 'anulada'"];

  conditions.push(...buildDateFilters({ dateFrom, dateTo, params }));

  if (currency) {
    params.push(currency);
    conditions.push(`sales.currency = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      sales.currency,
      COALESCE(coffee_profiles.name, coffee_types.name, 'Sin perfil o tipo') AS coffee_group,
      COALESCE(SUM(sale_items.quantity_kg), 0) AS quantity_kg,
      COALESCE(SUM(sale_items.line_total), 0) AS total
    FROM sale_items
    INNER JOIN sales ON sales.id = sale_items.sale_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sale_items.coffee_profile_id
    LEFT JOIN coffee_types ON coffee_types.id = sale_items.coffee_type_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY sales.currency, coffee_group
    ORDER BY total DESC
    `,
    params
  );

  return result.rows;
};

export const getProfitReport = async ({ dateFrom, dateTo, currency }) => {
  const params = [];
  const conditions = ["sales.status <> 'anulada'"];

  conditions.push(...buildDateFilters({ dateFrom, dateTo, params }));

  if (currency) {
    params.push(currency);
    conditions.push(`sales.currency = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      sales.id AS sale_id,
      sales.code AS sale_code,
      sales.currency,
      clients.name AS client_name,
      users.name AS seller_name,
      sales.created_at,
      COALESCE(SUM(sale_items.line_total), 0) AS coffee_revenue,
      COALESCE(SUM(sale_item_lots.quantity_kg * COALESCE(coffee_lots.purchase_price_per_kg, 0)), 0) AS coffee_cost,
      COALESCE(SUM(sale_items.line_total), 0)
        - COALESCE(SUM(sale_item_lots.quantity_kg * COALESCE(coffee_lots.purchase_price_per_kg, 0)), 0)
        AS estimated_profit
    FROM sales
    INNER JOIN clients ON clients.id = sales.client_id
    INNER JOIN users ON users.id = sales.seller_id
    INNER JOIN sale_items ON sale_items.sale_id = sales.id
    LEFT JOIN sale_item_lots ON sale_item_lots.sale_item_id = sale_items.id
    LEFT JOIN coffee_lots ON coffee_lots.id = sale_item_lots.lot_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY sales.id, sales.code, sales.currency, clients.name, users.name, sales.created_at
    ORDER BY sales.created_at DESC
    `,
    params
  );

  return result.rows;
};

export const getAccountsReceivableReport = async ({ clientId, currency }) => {
  const params = [];
  const conditions = [
    "sales.status <> 'anulada'",
    "sales.payment_status IN ('pendiente_pago', 'pago_parcial')",
  ];

  if (clientId) {
    params.push(clientId);
    conditions.push(`sales.client_id = $${params.length}`);
  }

  if (currency) {
    params.push(currency);
    conditions.push(`sales.currency = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      sales.id,
      sales.code,
      sales.currency,
      clients.name AS client_name,
      sales.total,
      sales.amount_paid,
      sales.balance_due,
      sales.estimated_payment_date,
      sales.payment_status,
      sales.status
    FROM sales
    INNER JOIN clients ON clients.id = sales.client_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY sales.estimated_payment_date ASC NULLS LAST, sales.created_at ASC
    `,
    params
  );

  return result.rows;
};

export const getAccountsPayableReport = async ({ status, categoryId, supplierId }) => {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`accounts_payable.status = $${params.length}`);
  }

  if (categoryId) {
    params.push(categoryId);
    conditions.push(`accounts_payable.category_id = $${params.length}`);
  }

  if (supplierId) {
    params.push(supplierId);
    conditions.push(`accounts_payable.supplier_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      accounts_payable.id,
      accounts_payable.code,
      accounts_payable.status,
      payable_categories.name AS category_name,
      suppliers.name AS supplier_name,
      accounts_payable.third_party_name,
      coffee_lots.code AS lot_code,
      accounts_payable.description,
      accounts_payable.total,
      accounts_payable.amount_paid,
      accounts_payable.balance_due,
      accounts_payable.due_date,
      accounts_payable.created_at
    FROM accounts_payable
    INNER JOIN payable_categories ON payable_categories.id = accounts_payable.category_id
    LEFT JOIN suppliers ON suppliers.id = accounts_payable.supplier_id
    LEFT JOIN coffee_lots ON coffee_lots.id = accounts_payable.lot_id
    ${where}
    ORDER BY accounts_payable.due_date ASC NULLS LAST, accounts_payable.created_at DESC
    `,
    params
  );

  return result.rows;
};

export const getInventoryReport = async () => {
  const result = await pool.query(
    `
    SELECT
      CASE
        WHEN coffee_lots.lot_kind = 'PROC' THEN 'perfil'
        ELSE 'tipo'
      END AS group_type,
      CASE
        WHEN coffee_lots.lot_kind = 'PROC' THEN COALESCE(coffee_profiles.name, 'Sin perfil')
        ELSE COALESCE(coffee_types.name, 'Sin tipo')
      END AS group_name,
      COUNT(*) AS lots_count,
      COALESCE(SUM(coffee_lots.available_weight_kg), 0) AS available_weight_kg,
      COALESCE(SUM(coffee_lots.available_weight_kg * COALESCE(coffee_lots.purchase_price_per_kg, 0)), 0) AS estimated_cost_value,
      MIN(coffee_lots.created_at) AS oldest_lot_date
    FROM coffee_lots
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE coffee_lots.status = 'disponible'
      AND coffee_lots.available_weight_kg > 0
    GROUP BY group_type, group_name
    ORDER BY group_type ASC, group_name ASC
    `
  );

  return result.rows;
};
