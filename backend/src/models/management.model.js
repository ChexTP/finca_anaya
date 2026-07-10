import { pool } from "../db.js";

const priorityRank = {
  alta: 3,
  media: 2,
  baja: 1,
};

const normalizeText = (value) => {
  return String(value || "").trim();
};

const normalizeUpper = (value) => {
  return normalizeText(value).toUpperCase();
};

const round2 = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

const round3 = (value) => {
  return Number(Number(value || 0).toFixed(3));
};

const parseBenefitFromName = (value) => {
  const text = normalizeUpper(value);

  if (text.includes("SEMI")) return "Semilavado";
  if (text.includes("NATURAL")) return "Natural";
  if (text.includes("LAVADO")) return "Lavado";

  return "";
};

// Replica la formula del Apps Script entregado por la empresa.
// Un pedido de Excelso exige comprar/procesar mas cafe del peso final pedido.
const calculateExcelsoRequiredKg = ({ requestedKg, benefit, productForm }) => {
  const kg = Number(requestedKg || 0);
  const form = normalizeUpper(productForm);
  const normalizedBenefit = normalizeUpper(benefit);

  if (!form.includes("EXCELSO")) return round2(kg);

  if (normalizedBenefit.includes("NATURAL")) {
    return round2(kg * 140 / 70);
  }

  if (normalizedBenefit.includes("LAVADO") || normalizedBenefit.includes("SEMI")) {
    return round2(kg * 94 / 70);
  }

  return round2(kg);
};

const getActiveSales = async () => {
  const result = await pool.query(
    `
    SELECT
      sales.id,
      sales.code,
      sales.status,
      sales.warehouse_priority,
      sales.estimated_delivery_date,
      sales.created_at,
      clients.name AS client_name,
      users.name AS seller_name
    FROM sales
    INNER JOIN clients ON clients.id = sales.client_id
    INNER JOIN users ON users.id = sales.seller_id
    WHERE sales.status NOT IN ('despachada', 'anulada')
    ORDER BY
      CASE sales.warehouse_priority
        WHEN 'alta' THEN 1
        WHEN 'media' THEN 2
        WHEN 'baja' THEN 3
        ELSE 4
      END ASC,
      sales.estimated_delivery_date ASC NULLS LAST,
      sales.created_at ASC
    `
  );

  return result.rows;
};

const getActiveSaleItems = async () => {
  const result = await pool.query(
    `
    SELECT
      sale_items.id,
      sale_items.sale_id,
      sale_items.description,
      sale_items.product_form,
      sale_items.process_type,
      sale_items.variety,
      sale_items.quantity_kg,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sale_items
    INNER JOIN sales ON sales.id = sale_items.sale_id
    LEFT JOIN coffee_types ON coffee_types.id = sale_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sale_items.coffee_profile_id
    WHERE sales.status NOT IN ('despachada', 'anulada')
    ORDER BY sale_items.sale_id ASC, sale_items.id ASC
    `
  );

  return result.rows;
};

const getSaleBlendItems = async () => {
  const result = await pool.query(
    `
    SELECT
      sale_blend_items.sale_item_id,
      sale_blend_items.percentage,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sale_blend_items
    INNER JOIN sale_items ON sale_items.id = sale_blend_items.sale_item_id
    INNER JOIN sales ON sales.id = sale_items.sale_id
    INNER JOIN coffee_lots ON coffee_lots.id = sale_blend_items.lot_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE sales.status NOT IN ('despachada', 'anulada')
    ORDER BY sale_blend_items.sale_item_id ASC, sale_blend_items.id ASC
    `
  );

  return result.rows;
};

const getActiveSamples = async () => {
  const result = await pool.query(
    `
    SELECT
      sample_requests.id,
      sample_requests.code,
      sample_requests.status,
      sample_requests.requester_name,
      sample_requests.requester_company,
      sample_requests.tentative_delivery_date,
      sample_requests.created_at,
      users.name AS created_by_name,
      COUNT(sample_request_items.id) AS items_count,
      COALESCE(SUM(sample_request_items.quantity_grams), 0) AS quantity_grams
    FROM sample_requests
    LEFT JOIN sample_request_items ON sample_request_items.sample_request_id = sample_requests.id
    LEFT JOIN users ON users.id = sample_requests.created_by
    WHERE sample_requests.status NOT IN ('entregada', 'cancelada')
    GROUP BY sample_requests.id, users.name
    ORDER BY sample_requests.tentative_delivery_date ASC NULLS LAST, sample_requests.created_at ASC
    `
  );

  return result.rows;
};

const getActiveProcesses = async () => {
  const result = await pool.query(
    `
    SELECT
      coffee_processes.id,
      coffee_processes.code,
      coffee_processes.status,
      coffee_processes.process_location,
      coffee_processes.estimated_return_date,
      coffee_processes.total_input_kg,
      coffee_processes.output_weight_kg,
      sales.code AS sale_code,
      clients.name AS client_name,
      output_lot.code AS output_lot_code
    FROM coffee_processes
    LEFT JOIN sales ON sales.id = coffee_processes.sale_id
    LEFT JOIN clients ON clients.id = sales.client_id
    LEFT JOIN coffee_lots output_lot ON output_lot.id = coffee_processes.output_lot_id
    WHERE coffee_processes.status <> 'finalizado'
    ORDER BY coffee_processes.estimated_return_date ASC NULLS LAST, coffee_processes.created_at ASC
    `
  );

  return result.rows;
};

const groupBy = (rows, keyGetter) => {
  return rows.reduce((groups, row) => {
    const key = keyGetter(row);
    groups[key] = groups[key] || [];
    groups[key].push(row);
    return groups;
  }, {});
};

const getSaleItemName = (item) => {
  return (
    normalizeText(item.coffee_profile_name) ||
    normalizeText(item.description) ||
    normalizeText(item.variety) ||
    "Sin perfil"
  );
};

const getBlendComponentName = (blend) => {
  return [
    blend.lot_code,
    blend.lot_kind === "PROC" ? "Procesado" : blend.commercial_classification,
    blend.coffee_profile_name || blend.coffee_type_name || blend.coffee_variety,
  ]
    .filter(Boolean)
    .join(" - ");
};

const addDeficit = (groups, item) => {
  const key = `${item.productForm || "Sin forma"}|${item.benefit || "Sin beneficio"}|${item.name}`;

  if (!groups[key]) {
    groups[key] = {
      product_form: item.productForm || "Sin forma",
      benefit: item.benefit || "Sin beneficio",
      name: item.name,
      component_type: item.componentType,
      requested_kg: 0,
      required_kg: 0,
      orders: [],
    };
  }

  groups[key].requested_kg = round3(groups[key].requested_kg + item.requestedKg);
  groups[key].required_kg = round2(groups[key].required_kg + item.requiredKg);

  groups[key].orders.push({
    sale_code: item.sale.code,
    client_name: item.sale.client_name,
    seller_name: item.sale.seller_name,
    priority: item.sale.warehouse_priority,
    status: item.sale.status,
    requested_kg: item.requestedKg,
    required_kg: item.requiredKg,
    estimated_delivery_date: item.sale.estimated_delivery_date,
  });
};

const buildDeficitReport = ({ sales, saleItems, blendItems }) => {
  const salesById = groupBy(sales, (sale) => sale.id);
  const blendsByItem = groupBy(blendItems, (blend) => blend.sale_item_id);
  const groups = {};
  const captureErrors = [];

  for (const item of saleItems) {
    const sale = salesById[item.sale_id]?.[0];
    if (!sale) continue;

    const itemBlends = blendsByItem[item.id] || [];
    const productForm = item.product_form || "Pergamino";
    const itemBenefit = item.process_type || item.coffee_type_name || "";
    const requestedKg = Number(item.quantity_kg || 0);

    if (itemBlends.length > 0) {
      const percentageTotal = round2(itemBlends.reduce((total, blend) => total + Number(blend.percentage || 0), 0));

      if (percentageTotal !== 100) {
        captureErrors.push({
          sale_code: sale.code,
          client_name: sale.client_name,
          coffee_name: getSaleItemName(item),
          requested_kg: requestedKg,
          reason: `Los porcentajes del ensamble suman ${percentageTotal}%`,
        });
        continue;
      }

      for (const blend of itemBlends) {
        const componentRequestedKg = round3(requestedKg * Number(blend.percentage || 0) / 100);
        const benefit = blend.coffee_type_name || parseBenefitFromName(getBlendComponentName(blend)) || itemBenefit;
        const componentName = getBlendComponentName(blend) || getSaleItemName(item);

        addDeficit(groups, {
          sale,
          productForm,
          benefit,
          name: componentName,
          componentType: blend.lot_kind === "PROC" ? "Proceso" : "Base",
          requestedKg: componentRequestedKg,
          requiredKg: calculateExcelsoRequiredKg({
            requestedKg: componentRequestedKg,
            benefit,
            productForm,
          }),
        });
      }

      continue;
    }

    const benefit = itemBenefit || parseBenefitFromName(getSaleItemName(item));

    addDeficit(groups, {
      sale,
      productForm,
      benefit,
      name: getSaleItemName(item),
      componentType: "Puro",
      requestedKg,
      requiredKg: calculateExcelsoRequiredKg({ requestedKg, benefit, productForm }),
    });
  }

  const rows = Object.values(groups).sort((a, b) => b.required_kg - a.required_kg);
  const excelso = rows.filter((row) => normalizeUpper(row.product_form).includes("EXCELSO"));
  const pergamino = rows.filter((row) => !normalizeUpper(row.product_form).includes("EXCELSO"));

  return {
    excelso,
    pergamino,
    captureErrors,
    totalRequestedKg: round3(rows.reduce((total, row) => total + Number(row.requested_kg || 0), 0)),
    totalRequiredKg: round2(rows.reduce((total, row) => total + Number(row.required_kg || 0), 0)),
  };
};

const buildUrgentSales = (sales, saleItems) => {
  const itemsBySale = groupBy(saleItems, (item) => item.sale_id);

  return sales
    .filter((sale) => sale.warehouse_priority === "alta")
    .map((sale) => ({
      sale_code: sale.code,
      client_name: sale.client_name,
      seller_name: sale.seller_name,
      status: sale.status,
      estimated_delivery_date: sale.estimated_delivery_date,
      detail: (itemsBySale[sale.id] || [])
        .map((item) => `${getSaleItemName(item)} | ${Number(item.quantity_kg).toLocaleString("es-CO")} kg`)
        .join("\n"),
    }));
};

const buildSellerLoad = (sales, saleItems) => {
  const itemsBySale = groupBy(saleItems, (item) => item.sale_id);
  const sellers = {};

  for (const sale of sales) {
    const sellerName = sale.seller_name || "Sin vendedor";
    sellers[sellerName] = sellers[sellerName] || {
      seller_name: sellerName,
      orders_count: 0,
      items_count: 0,
      max_priority: "baja",
      oldest_update: sale.created_at,
      orders: [],
    };

    const saleItemsForSale = itemsBySale[sale.id] || [];
    const seller = sellers[sellerName];
    seller.orders_count += 1;
    seller.items_count += saleItemsForSale.length;

    if ((priorityRank[sale.warehouse_priority] || 0) > (priorityRank[seller.max_priority] || 0)) {
      seller.max_priority = sale.warehouse_priority;
    }

    seller.orders.push({
      sale_code: sale.code,
      client_name: sale.client_name,
      priority: sale.warehouse_priority,
      status: sale.status,
      estimated_delivery_date: sale.estimated_delivery_date,
      items: saleItemsForSale.map((item) => ({
        name: getSaleItemName(item),
        product_form: item.product_form,
        benefit: item.process_type || item.coffee_type_name,
        quantity_kg: item.quantity_kg,
      })),
    });
  }

  return Object.values(sellers).sort((a, b) => b.items_count - a.items_count);
};

const buildReadyOrders = (sales, saleItems) => {
  const itemsBySale = groupBy(saleItems, (item) => item.sale_id);

  return sales
    .filter((sale) => sale.status === "alistada")
    .map((sale) => ({
      sale_code: sale.code,
      client_name: sale.client_name,
      seller_name: sale.seller_name,
      priority: sale.warehouse_priority,
      estimated_delivery_date: sale.estimated_delivery_date,
      detail: (itemsBySale[sale.id] || [])
        .map((item) => `${getSaleItemName(item)} | ${Number(item.quantity_kg).toLocaleString("es-CO")} kg`)
        .join("\n"),
    }));
};

const buildStatusSummary = (sales) => {
  const labels = {
    pendiente_alistamiento: "Pendiente de decision",
    pendiente_bodega: "Pendiente de bodega",
    lote_asignado: "Con lote asignado",
    proceso_solicitado: "Proceso solicitado",
    en_proceso: "En proceso",
    listo_para_ensamble: "Listo para ensamble",
    ensamble_definido: "Ensamble definido",
    alistada: "Alistada",
  };

  const grouped = sales.reduce((summary, sale) => {
    summary[sale.status] = summary[sale.status] || {
      status: sale.status,
      label: labels[sale.status] || sale.status,
      orders_count: 0,
      high_priority_count: 0,
      next_delivery_date: null,
    };

    summary[sale.status].orders_count += 1;
    if (sale.warehouse_priority === "alta") summary[sale.status].high_priority_count += 1;

    if (
      sale.estimated_delivery_date &&
      (!summary[sale.status].next_delivery_date || sale.estimated_delivery_date < summary[sale.status].next_delivery_date)
    ) {
      summary[sale.status].next_delivery_date = sale.estimated_delivery_date;
    }

    return summary;
  }, {});

  return Object.values(grouped).sort((a, b) => b.orders_count - a.orders_count);
};

const buildClientPendingKg = (sales, saleItems) => {
  const salesById = groupBy(sales, (sale) => sale.id);
  const clients = {};

  for (const item of saleItems) {
    const sale = salesById[item.sale_id]?.[0];
    if (!sale || sale.status === "alistada") continue;

    const clientName = sale.client_name || "Sin cliente";
    clients[clientName] = clients[clientName] || {
      client_name: clientName,
      orders_count: 0,
      pending_kg: 0,
      next_delivery_date: null,
    };

    clients[clientName].pending_kg = round3(clients[clientName].pending_kg + Number(item.quantity_kg || 0));

    if (!clients[clientName].orderCodes) clients[clientName].orderCodes = new Set();
    clients[clientName].orderCodes.add(sale.code);
    clients[clientName].orders_count = clients[clientName].orderCodes.size;

    if (
      sale.estimated_delivery_date &&
      (!clients[clientName].next_delivery_date || sale.estimated_delivery_date < clients[clientName].next_delivery_date)
    ) {
      clients[clientName].next_delivery_date = sale.estimated_delivery_date;
    }
  }

  return Object.values(clients)
    .map(({ orderCodes, ...client }) => client)
    .sort((a, b) => b.pending_kg - a.pending_kg)
    .slice(0, 12);
};

const buildPrioritySummary = (sales) => {
  return ["alta", "media", "baja"].map((priority) => ({
    priority,
    orders_count: sales.filter((sale) => sale.warehouse_priority === priority).length,
  }));
};

export const getManagementProductionReport = async () => {
  const [sales, saleItems, blendItems, samples, processes] = await Promise.all([
    getActiveSales(),
    getActiveSaleItems(),
    getSaleBlendItems(),
    getActiveSamples(),
    getActiveProcesses(),
  ]);

  const deficit = buildDeficitReport({ sales, saleItems, blendItems });
  const urgentSales = buildUrgentSales(sales, saleItems);
  const sellerLoad = buildSellerLoad(sales, saleItems);
  const readyOrders = buildReadyOrders(sales, saleItems);
  const statusSummary = buildStatusSummary(sales);
  const clientPendingKg = buildClientPendingKg(sales, saleItems);
  const prioritySummary = buildPrioritySummary(sales);

  return {
    generated_at: new Date().toISOString(),
    kpis: {
      active_items: saleItems.length,
      high_priority_items: urgentSales.length,
      ready_orders: readyOrders.length,
      active_orders: sales.length,
      active_samples: samples.length,
      active_processes: processes.length,
      total_requested_kg: deficit.totalRequestedKg,
      total_required_kg: deficit.totalRequiredKg,
    },
    deficit,
    urgentSales,
    sellerLoad,
    statusSummary,
    prioritySummary,
    clientPendingKg,
    processes,
    samples,
    readyOrders,
  };
};
