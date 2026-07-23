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

  if (normalizedBenefit.includes("LAVADO")) {
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
      sales.order_assignee,
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
      sale_items.operational_weight_kg,
      sale_items.shortage_marked,
      sale_items.shortage_notes,
      coffee_profiles.category AS coffee_profile_category,
      process_purchase.name AS process_purchase_coffee_name,
      base_purchase.name AS base_purchase_coffee_name,
      coffee_profiles.process_percentage,
      coffee_profiles.base_percentage,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sale_items
    INNER JOIN sales ON sales.id = sale_items.sale_id
    LEFT JOIN coffee_types ON coffee_types.id = sale_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sale_items.coffee_profile_id
    LEFT JOIN purchase_coffees process_purchase ON process_purchase.id = coffee_profiles.process_purchase_coffee_id
    LEFT JOIN purchase_coffees base_purchase ON base_purchase.id = coffee_profiles.base_purchase_coffee_id
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

const getAvailableLots = async () => {
  const result = await pool.query(
    `
    SELECT
      coffee_lots.id,
      coffee_lots.code,
      coffee_lots.lot_kind,
      coffee_lots.commercial_classification,
      coffee_lots.available_weight_kg,
      coffee_lots.coffee_variety,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM coffee_lots
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE coffee_lots.status IN ('disponible', 'vendido_parcial')
      AND coffee_lots.available_weight_kg > 0
    ORDER BY coffee_lots.received_at ASC, coffee_lots.created_at ASC
    `
  );

  return result.rows;
};

const getPendingAssignments = async () => {
  const result = await pool.query(
    `
    SELECT
      sale_item_lots.quantity_kg,
      sale_items.description,
      sale_items.product_form,
      sale_items.process_type,
      sale_items.variety,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sale_item_lots
    INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
    INNER JOIN sales ON sales.id = sale_items.sale_id
    INNER JOIN coffee_lots ON coffee_lots.id = sale_item_lots.lot_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE sales.status NOT IN ('despachada', 'anulada')
      AND sale_item_lots.deducted_at IS NULL
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
      lot_code: item.lotCode || null,
      requested_kg: 0,
      required_kg: 0,
      available_kg: 0,
      assigned_kg: 0,
      in_process_kg: 0,
      missing_kg: 0,
      orders: [],
    };
  }

  groups[key].requested_kg = round3(groups[key].requested_kg + item.requestedKg);
  groups[key].required_kg = round2(groups[key].required_kg + item.requiredKg);

  groups[key].orders.push({
    sale_code: item.sale.code,
    client_name: item.sale.client_name,
    seller_name: item.sale.seller_name,
    order_assignee: item.sale.order_assignee,
    priority: item.sale.warehouse_priority,
    status: item.sale.status,
    requested_kg: item.requestedKg,
    required_kg: item.requiredKg,
    estimated_delivery_date: item.sale.estimated_delivery_date,
    shortage_marked: Boolean(item.shortageMarked),
    shortage_notes: item.shortageNotes || null,
  });
};

const buildSearchText = (value) => {
  return normalizeUpper(
    [
      value.code,
      value.lot_code,
      value.name,
      value.coffee_profile_name,
      value.coffee_type_name,
      value.commercial_classification,
      value.coffee_variety,
      value.variety,
      value.description,
      value.benefit,
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const rowMatchesCoffee = (row, candidate) => {
  const rowText = buildSearchText(row);
  const candidateText = buildSearchText(candidate);

  if (row.lot_code && candidate.lot_code === row.lot_code) return true;
  if (row.lot_code && candidate.code === row.lot_code) return true;
  if (row.benefit && candidate.coffee_type_name && normalizeUpper(row.benefit) !== normalizeUpper(candidate.coffee_type_name)) return false;

  const rowName = normalizeUpper(row.name);
  const profile = normalizeUpper(candidate.coffee_profile_name);
  const classification = normalizeUpper(candidate.commercial_classification);
  const variety = normalizeUpper(candidate.coffee_variety || candidate.variety);

  return Boolean(
    (profile && rowText.includes(profile)) ||
    (classification && rowText.includes(classification)) ||
    (variety && rowName.includes(variety)) ||
    candidateText.includes(rowName)
  );
};

const enrichDeficitRows = ({ rows, availableLots, pendingAssignments, activeProcesses }) => {
  return rows.map((row) => {
    const availableKg = availableLots
      .filter((lot) => rowMatchesCoffee(row, lot))
      .reduce((total, lot) => total + Number(lot.available_weight_kg || 0), 0);

    const assignedKg = pendingAssignments
      .filter((assignment) => rowMatchesCoffee(row, assignment))
      .reduce((total, assignment) => total + Number(assignment.quantity_kg || 0), 0);

    const inProcessKg = activeProcesses
      .filter((process) => {
        if (row.orders.some((order) => order.sale_code === process.sale_code)) return true;
        return rowMatchesCoffee(row, {
          code: process.output_lot_code,
          name: process.output_lot_code,
        });
      })
      .reduce((total, process) => total + Number(process.output_weight_kg || process.total_input_kg || 0), 0);

    const hasManualShortage = row.orders.some((order) => order.shortage_marked);
    const effectiveAvailableKg = hasManualShortage ? 0 : availableKg;
    const missingKg = Math.max(Number(row.required_kg || 0) - effectiveAvailableKg - assignedKg - inProcessKg, 0);

    return {
      ...row,
      available_kg: round3(availableKg),
      assigned_kg: round3(assignedKg),
      in_process_kg: round3(inProcessKg),
      missing_kg: round3(missingKg),
      manual_shortage: hasManualShortage,
    };
  });
};

const buildDeficitReport = ({ sales, saleItems, blendItems, availableLots, pendingAssignments, activeProcesses }) => {
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
    const operationalKg = Number(item.operational_weight_kg || 0) || calculateExcelsoRequiredKg({
      requestedKg,
      benefit: itemBenefit,
      productForm,
    });

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
        const componentRequiredKg = round3(operationalKg * Number(blend.percentage || 0) / 100);
        const benefit = blend.coffee_type_name || parseBenefitFromName(getBlendComponentName(blend)) || itemBenefit;
        const componentName = getBlendComponentName(blend) || getSaleItemName(item);

        addDeficit(groups, {
          sale,
          productForm,
          benefit,
          name: componentName,
          componentType: blend.lot_kind === "PROC" ? "Proceso" : "Base",
          lotCode: blend.lot_code,
          requestedKg: componentRequestedKg,
          requiredKg: componentRequiredKg,
          shortageMarked: item.shortage_marked,
          shortageNotes: item.shortage_notes,
        });
      }

      continue;
    }

    if (
      item.coffee_profile_category === "Exotico" &&
      item.process_purchase_coffee_name &&
      item.base_purchase_coffee_name &&
      Number(item.process_percentage || 0) > 0 &&
      Number(item.base_percentage || 0) > 0
    ) {
      const processKg = round3(operationalKg * Number(item.process_percentage) / 100);
      const baseKg = round3(operationalKg * Number(item.base_percentage) / 100);

      addDeficit(groups, {
        sale,
        productForm,
        benefit: itemBenefit,
        name: item.process_purchase_coffee_name,
        componentType: "Proceso sugerido",
        requestedKg: round3(requestedKg * Number(item.process_percentage) / 100),
        requiredKg: processKg,
        shortageMarked: item.shortage_marked,
        shortageNotes: item.shortage_notes,
      });

      addDeficit(groups, {
        sale,
        productForm,
        benefit: itemBenefit,
        name: item.base_purchase_coffee_name,
        componentType: "Base sugerida",
        requestedKg: round3(requestedKg * Number(item.base_percentage) / 100),
        requiredKg: baseKg,
        shortageMarked: item.shortage_marked,
        shortageNotes: item.shortage_notes,
      });

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
      requiredKg: operationalKg,
      shortageMarked: item.shortage_marked,
      shortageNotes: item.shortage_notes,
    });
  }

  const rows = enrichDeficitRows({
    rows: Object.values(groups),
    availableLots,
    pendingAssignments,
    activeProcesses,
  }).sort((a, b) => b.missing_kg - a.missing_kg || b.required_kg - a.required_kg);
  const excelso = rows.filter((row) => normalizeUpper(row.product_form).includes("EXCELSO"));
  const pergamino = rows.filter((row) => !normalizeUpper(row.product_form).includes("EXCELSO"));

  return {
    excelso,
    pergamino,
    captureErrors,
    totalRequestedKg: round3(rows.reduce((total, row) => total + Number(row.requested_kg || 0), 0)),
    totalRequiredKg: round2(rows.reduce((total, row) => total + Number(row.required_kg || 0), 0)),
    totalAvailableKg: round3(rows.reduce((total, row) => total + Number(row.available_kg || 0), 0)),
    totalAssignedKg: round3(rows.reduce((total, row) => total + Number(row.assigned_kg || 0), 0)),
    totalInProcessKg: round3(rows.reduce((total, row) => total + Number(row.in_process_kg || 0), 0)),
    totalMissingKg: round3(rows.reduce((total, row) => total + Number(row.missing_kg || 0), 0)),
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
      order_assignee: sale.order_assignee,
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
      order_assignee: sale.order_assignee,
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
      order_assignee: sale.order_assignee,
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
    pendiente_laboratorio: "Pendiente laboratorio",
    aprobada_laboratorio: "Aprobada laboratorio",
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

const buildManagementAlerts = ({ sales, deficit, processes }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alerts = [];

  for (const row of [...deficit.excelso, ...deficit.pergamino]) {
    if (Number(row.missing_kg) > 0) {
      alerts.push({
        type: "faltante_cafe",
        priority: "alta",
        message: `${row.name}: faltan ${round3(row.missing_kg)} kg estimados.`,
      });
    }
  }

  for (const error of deficit.captureErrors) {
    alerts.push({
      type: "ensamble_incompleto",
      priority: "alta",
      message: `${error.sale_code}: ${error.reason}.`,
    });
  }

  for (const sale of sales) {
    if (!sale.estimated_delivery_date) continue;
    const deliveryDate = new Date(sale.estimated_delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);
    const days = Math.ceil((deliveryDate.getTime() - today.getTime()) / 86400000);

    if (days <= 1 && sale.status !== "alistada") {
      alerts.push({
        type: "entrega_cercana",
        priority: days < 0 ? "alta" : "media",
        message: `${sale.code} de ${sale.client_name}: entrega ${days < 0 ? "vencida" : "para hoy/manana"} y aun no esta alistada.`,
      });
    }
  }

  for (const process of processes) {
    if (!process.estimated_return_date) continue;
    const returnDate = new Date(process.estimated_return_date);
    returnDate.setHours(0, 0, 0, 0);

    if (returnDate < today) {
      alerts.push({
        type: "proceso_atrasado",
        priority: "alta",
        message: `${process.code}: proceso con regreso estimado vencido.`,
      });
    }
  }

  return alerts.slice(0, 30);
};

export const flattenManagementReport = (report) => {
  const rows = [];

  rows.push(
    ...report.deficit.excelso.map((row) => ({
      seccion: "Deficit Excelso",
      nombre: row.name,
      beneficio: row.benefit,
      componente: row.component_type,
      kg_pedido: row.requested_kg,
      kg_requerido: row.required_kg,
      kg_disponible: row.available_kg,
      kg_asignado: row.assigned_kg,
      kg_en_proceso: row.in_process_kg,
      kg_faltante: row.missing_kg,
      detalle: `${row.orders.length} pedidos | Encargados: ${[...new Set(row.orders.map((order) => order.order_assignee || "Sin encargado"))].join(", ")}`,
    })),
    ...report.deficit.pergamino.map((row) => ({
      seccion: "Deficit Pergamino",
      nombre: row.name,
      beneficio: row.benefit,
      componente: row.component_type,
      kg_pedido: row.requested_kg,
      kg_requerido: row.required_kg,
      kg_disponible: row.available_kg,
      kg_asignado: row.assigned_kg,
      kg_en_proceso: row.in_process_kg,
      kg_faltante: row.missing_kg,
      detalle: `${row.orders.length} pedidos | Encargados: ${[...new Set(row.orders.map((order) => order.order_assignee || "Sin encargado"))].join(", ")}`,
    })),
    ...report.alerts.map((alert) => ({
      seccion: "Alertas",
      nombre: alert.type,
      beneficio: "",
      componente: alert.priority,
      kg_pedido: "",
      kg_requerido: "",
      kg_disponible: "",
      kg_asignado: "",
      kg_en_proceso: "",
      kg_faltante: "",
      detalle: alert.message,
    })),
    ...report.processes.map((process) => ({
      seccion: "Procesos activos",
      nombre: process.code,
      beneficio: process.status,
      componente: process.sale_code || "",
      kg_pedido: process.total_input_kg,
      kg_requerido: process.output_weight_kg || "",
      kg_disponible: "",
      kg_asignado: "",
      kg_en_proceso: process.total_input_kg,
      kg_faltante: "",
      detalle: `${process.client_name || ""} ${process.process_location || ""}`.trim(),
    }))
  );

  return rows;
};

export const getManagementProductionReport = async () => {
  const [sales, saleItems, blendItems, samples, processes, availableLots, pendingAssignments] = await Promise.all([
    getActiveSales(),
    getActiveSaleItems(),
    getSaleBlendItems(),
    getActiveSamples(),
    getActiveProcesses(),
    getAvailableLots(),
    getPendingAssignments(),
  ]);

  const deficit = buildDeficitReport({
    sales,
    saleItems,
    blendItems,
    availableLots,
    pendingAssignments,
    activeProcesses: processes,
  });
  const urgentSales = buildUrgentSales(sales, saleItems);
  const sellerLoad = buildSellerLoad(sales, saleItems);
  const readyOrders = buildReadyOrders(sales, saleItems);
  const statusSummary = buildStatusSummary(sales);
  const clientPendingKg = buildClientPendingKg(sales, saleItems);
  const prioritySummary = buildPrioritySummary(sales);
  const alerts = buildManagementAlerts({ sales, deficit, processes });

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
      total_available_kg: deficit.totalAvailableKg,
      total_assigned_kg: deficit.totalAssignedKg,
      total_in_process_kg: deficit.totalInProcessKg,
      total_missing_kg: deficit.totalMissingKg,
      alerts_count: alerts.length,
    },
    deficit,
    alerts,
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
