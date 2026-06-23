import { pool } from "../db.js";

const LOW_INVENTORY_KG = 500;

export const getDashboardData = async ({ role, userId }) => {
  const [
    inventorySummary,
    labPendingLots,
    humidityAlerts,
    oldLots,
    activeProcesses,
    salesPendingBlend,
    pendingQuotes,
    salesToPrepare,
    dispatchedSalesWithDebt,
    overdueSales,
    overduePayables,
  ] = await Promise.all([
    getInventorySummary(),
    getLabPendingLots(role),
    getHumidityAlerts(role),
    getOldLots(role),
    getActiveProcesses(role),
    getSalesPendingBlend(role),
    getPendingQuotes(role, userId),
    getSalesToPrepare(role),
    getDispatchedSalesWithDebt(role),
    getOverdueSales(role),
    getOverduePayables(role),
  ]);

  return {
    counters: buildCounters({
      inventorySummary,
      labPendingLots,
      activeProcesses,
      salesPendingBlend,
      pendingQuotes,
      salesToPrepare,
      dispatchedSalesWithDebt,
      overdueSales,
      overduePayables,
    }),
    alerts: buildAlerts({
      role,
      inventorySummary,
      labPendingLots,
      humidityAlerts,
      oldLots,
      activeProcesses,
      salesPendingBlend,
      pendingQuotes,
      salesToPrepare,
      dispatchedSalesWithDebt,
      overdueSales,
      overduePayables,
    }),
  };
};

const buildCounters = ({
  inventorySummary,
  labPendingLots,
  activeProcesses,
  salesPendingBlend,
  pendingQuotes,
  salesToPrepare,
  dispatchedSalesWithDebt,
  overdueSales,
  overduePayables,
}) => ({
  availableInventoryKg: inventorySummary.total_available_kg || 0,
  lowInventoryGroups: inventorySummary.low_groups || 0,
  labPendingLots: labPendingLots.length,
  activeProcesses: activeProcesses.length,
  salesPendingBlend: salesPendingBlend.length,
  pendingQuotes: pendingQuotes.length,
  salesToPrepare: salesToPrepare.length,
  dispatchedSalesWithDebt: dispatchedSalesWithDebt.length,
  overdueSales: overdueSales.length,
  overduePayables: overduePayables.length,
});

const buildAlerts = ({
  role,
  inventorySummary,
  labPendingLots,
  humidityAlerts,
  oldLots,
  activeProcesses,
  salesPendingBlend,
  pendingQuotes,
  salesToPrepare,
  dispatchedSalesWithDebt,
  overdueSales,
  overduePayables,
}) => {
  const alerts = [];

  if (["admin", "accounting", "warehouse", "seller"].includes(role)) {
    for (const item of inventorySummary.low_items) {
      alerts.push({
        type: "inventario_bajo",
        priority: "media",
        message: `Inventario bajo: ${item.group_name} tiene ${item.total_kg} kg disponibles`,
        data: item,
      });
    }
  }

  if (["admin", "laboratory"].includes(role)) {
    addListAlerts(alerts, "lotes_laboratorio", "alta", labPendingLots, (lot) => ({
      message: `Lote ${lot.code} pendiente de laboratorio`,
      data: lot,
    }));

    addListAlerts(alerts, "humedad_fuera_rango", "media", humidityAlerts, (lot) => ({
      message: `Lote ${lot.code} con humedad fuera de rango (${lot.humidity_percent}%)`,
      data: lot,
    }));
  }

  if (["admin", "accounting", "warehouse"].includes(role)) {
    addListAlerts(alerts, "lote_antiguo_bodega", "baja", oldLots, (lot) => ({
      message: `Lote ${lot.code} lleva mas de 15 dias en bodega`,
      data: lot,
    }));

    addListAlerts(alerts, "venta_por_alistar", "alta", salesToPrepare, (sale) => ({
      message: `Venta ${sale.code} pendiente de alistamiento`,
      data: sale,
    }));

    addListAlerts(alerts, "venta_despachada_con_saldo", "media", dispatchedSalesWithDebt, (sale) => ({
      message: `Venta ${sale.code} fue despachada y aun tiene saldo pendiente`,
      data: sale,
    }));
  }

  if (["admin", "laboratory", "warehouse"].includes(role)) {
    addListAlerts(alerts, "proceso_en_curso", "media", activeProcesses, (process) => ({
      message: `Proceso ${process.code} en curso`,
      data: process,
    }));
  }

  if (["admin", "laboratory"].includes(role)) {
    addListAlerts(alerts, "mezcla_pendiente", "alta", salesPendingBlend, (sale) => ({
      message: `Venta ${sale.code} tiene mezcla final pendiente`,
      data: sale,
    }));
  }

  if (["admin", "accounting", "seller"].includes(role)) {
    addListAlerts(alerts, "preventa_pendiente", "media", pendingQuotes, (quote) => ({
      message: `Preventa ${quote.code} pendiente de produccion o venta`,
      data: quote,
    }));
  }

  if (["admin", "accounting"].includes(role)) {
    addListAlerts(alerts, "venta_pago_vencido", "alta", overdueSales, (sale) => ({
      message: `Venta ${sale.code} tiene pago vencido`,
      data: sale,
    }));

    addListAlerts(alerts, "cuenta_por_pagar_vencida", "alta", overduePayables, (payable) => ({
      message: `Cuenta por pagar ${payable.code} tiene fecha de pago vencida`,
      data: payable,
    }));
  }

  return alerts;
};

const addListAlerts = (alerts, type, priority, rows, buildAlert) => {
  for (const row of rows) {
    const alert = buildAlert(row);
    alerts.push({
      type,
      priority,
      ...alert,
    });
  }
};

const getInventorySummary = async () => {
  const totalResult = await pool.query(
    `
    SELECT COALESCE(SUM(available_weight_kg), 0) AS total_available_kg
    FROM coffee_lots
    WHERE status = 'disponible'
    `
  );

  const lowResult = await pool.query(
    `
    SELECT *
    FROM (
      SELECT
        CASE
          WHEN coffee_lots.lot_kind = 'PROC' THEN COALESCE(coffee_profiles.name, 'Perfil sin definir')
          ELSE COALESCE(coffee_types.name, 'Tipo sin definir')
        END AS group_name,
        coffee_lots.lot_kind,
        COALESCE(SUM(coffee_lots.available_weight_kg), 0) AS total_kg
      FROM coffee_lots
      LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
      LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
      WHERE coffee_lots.status = 'disponible'
      GROUP BY group_name, coffee_lots.lot_kind
    ) inventory_groups
    WHERE total_kg < $1
    ORDER BY total_kg ASC
    LIMIT 10
    `,
    [LOW_INVENTORY_KG]
  );

  return {
    total_available_kg: Number(totalResult.rows[0].total_available_kg),
    low_groups: lowResult.rows.length,
    low_items: lowResult.rows.map((item) => ({
      ...item,
      total_kg: Number(item.total_kg),
    })),
  };
};

const getLabPendingLots = async (role) => {
  if (!["admin", "laboratory"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, humidity_percent, created_at
    FROM coffee_lots
    WHERE status = 'pendiente_laboratorio'
    ORDER BY created_at ASC
    LIMIT 10
    `
  );

  return result.rows;
};

const getHumidityAlerts = async (role) => {
  if (!["admin", "laboratory"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, humidity_percent, status, created_at
    FROM coffee_lots
    WHERE humidity_percent IS NOT NULL
      AND (humidity_percent < 10 OR humidity_percent > 12)
      AND status IN ('pendiente_laboratorio', 'aprobado', 'disponible')
    ORDER BY created_at DESC
    LIMIT 10
    `
  );

  return result.rows;
};

const getOldLots = async (role) => {
  if (!["admin", "accounting", "warehouse"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, available_weight_kg, created_at
    FROM coffee_lots
    WHERE status = 'disponible'
      AND available_weight_kg > 0
      AND created_at <= NOW() - INTERVAL '15 days'
    ORDER BY created_at ASC
    LIMIT 10
    `
  );

  return result.rows;
};

const getActiveProcesses = async (role) => {
  if (!["admin", "laboratory", "warehouse"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, process_location, total_input_kg, created_at
    FROM coffee_processes
    WHERE status = 'en_proceso'
    ORDER BY created_at ASC
    LIMIT 10
    `
  );

  return result.rows;
};

const getSalesPendingBlend = async (role) => {
  if (!["admin", "laboratory"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT DISTINCT
      sales.id,
      sales.code,
      sales.status,
      sales.created_at,
      clients.name AS client_name
    FROM sales
    INNER JOIN clients ON clients.id = sales.client_id
    INNER JOIN sale_items ON sale_items.sale_id = sales.id
    WHERE sales.status IN ('pendiente_alistamiento', 'alistada')
      AND NOT EXISTS (
        SELECT 1
        FROM sale_blend_items
        WHERE sale_blend_items.sale_item_id = sale_items.id
      )
    ORDER BY sales.created_at ASC
    LIMIT 10
    `
  );

  return result.rows;
};

const getPendingQuotes = async (role, userId) => {
  if (!["admin", "accounting", "seller"].includes(role)) {
    return [];
  }

  const params = [];
  const conditions = [
    "quotes.quote_type = 'preventa'",
    "quotes.status IN ('enviada', 'aceptada')",
    "sales.id IS NULL",
  ];

  if (role === "seller") {
    params.push(userId);
    conditions.push(`quotes.seller_id = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      quotes.id,
      quotes.code,
      quotes.status,
      quotes.estimated_delivery_date,
      clients.name AS client_name
    FROM quotes
    INNER JOIN clients ON clients.id = quotes.client_id
    LEFT JOIN sales ON sales.quote_id = quotes.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY quotes.estimated_delivery_date ASC NULLS LAST, quotes.created_at ASC
    LIMIT 10
    `,
    params
  );

  return result.rows;
};

const getSalesToPrepare = async (role) => {
  if (!["admin", "accounting", "warehouse"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, payment_status, balance_due, created_at
    FROM sales
    WHERE status = 'pendiente_alistamiento'
    ORDER BY created_at ASC
    LIMIT 10
    `
  );

  return result.rows;
};

const getDispatchedSalesWithDebt = async (role) => {
  if (!["admin", "accounting", "warehouse"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, payment_status, balance_due, estimated_payment_date, updated_at
    FROM sales
    WHERE status = 'despachada'
      AND payment_status IN ('pendiente_pago', 'pago_parcial')
    ORDER BY estimated_payment_date ASC NULLS LAST, updated_at ASC
    LIMIT 10
    `
  );

  return result.rows;
};

const getOverdueSales = async (role) => {
  if (!["admin", "accounting"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, balance_due, estimated_payment_date
    FROM sales
    WHERE payment_status IN ('pendiente_pago', 'pago_parcial')
      AND estimated_payment_date IS NOT NULL
      AND estimated_payment_date <= CURRENT_DATE
    ORDER BY estimated_payment_date ASC
    LIMIT 10
    `
  );

  return result.rows;
};

const getOverduePayables = async (role) => {
  if (!["admin", "accounting"].includes(role)) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT id, code, balance_due, due_date
    FROM accounts_payable
    WHERE status IN ('pendiente', 'pago_parcial')
      AND due_date IS NOT NULL
      AND due_date <= CURRENT_DATE
    ORDER BY due_date ASC
    LIMIT 10
    `
  );

  return result.rows;
};
