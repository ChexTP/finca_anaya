import { pool } from "../db.js";
import { getNextCode } from "./codeCounters.model.js";
import { logger } from "../utils/logger.js";
import { calculateOperationalKg } from "../utils/coffeeCalculations.js";

const requiredSaleItemKgSql = `
  CASE
    WHEN sale_items.product_form = 'Pergamino' AND sale_items.process_type = 'Natural' THEN CEIL(sale_items.quantity_kg * 140 / 70)
    WHEN sale_items.product_form = 'Pergamino' AND sale_items.process_type = 'Lavado' THEN CEIL(sale_items.quantity_kg * 95 / 70)
    ELSE CEIL(sale_items.quantity_kg)
  END
`;

export const getNextSaleCode = async () => {
  return getNextCode({ prefix: "VEN", tableName: "sales" });
};

export const listSales = async ({ status, paymentStatus, clientId, sellerId }) => {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`sales.status = $${params.length}`);
  }

  if (paymentStatus) {
    params.push(paymentStatus);
    conditions.push(`sales.payment_status = $${params.length}`);
  }

  if (clientId) {
    params.push(clientId);
    conditions.push(`sales.client_id = $${params.length}`);
  }

  if (sellerId) {
    params.push(sellerId);
    conditions.push(`sales.seller_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      sales.*,
      clients.name AS client_name,
      users.name AS seller_name,
      quotes.code AS quote_code
    FROM sales
    INNER JOIN clients ON clients.id = sales.client_id
    INNER JOIN users ON users.id = sales.seller_id
    LEFT JOIN quotes ON quotes.id = sales.quote_id
    ${where}
    ORDER BY
      CASE sales.warehouse_priority
        WHEN 'alta' THEN 1
        WHEN 'media' THEN 2
        WHEN 'baja' THEN 3
        ELSE 4
      END ASC,
      sales.estimated_delivery_date ASC NULLS LAST,
      sales.created_at DESC
    `,
    params
  );

  return result.rows;
};

export const findSaleById = async (id) => {
  const saleResult = await pool.query(
    `
    SELECT
      sales.*,
      clients.name AS client_name,
      clients.phone AS client_phone,
      clients.email AS client_email,
      clients.address AS client_address,
      clients.document_type AS client_document_type,
      clients.document_number AS client_document_number,
      clients.city AS client_city,
      clients.country AS client_country,
      users.name AS seller_name,
      quotes.code AS quote_code
    FROM sales
    INNER JOIN clients ON clients.id = sales.client_id
    INNER JOIN users ON users.id = sales.seller_id
    LEFT JOIN quotes ON quotes.id = sales.quote_id
    WHERE sales.id = $1
    LIMIT 1
    `,
    [id]
  );
  const sale = saleResult.rows[0];

  if (!sale) {
    return null;
  }

  const itemsResult = await pool.query(
    `
    SELECT
      sale_items.*,
      coffee_lots.code AS lot_code,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      coffee_profiles.category AS coffee_profile_category,
      process_purchase.name AS process_purchase_coffee_name,
      base_purchase.name AS base_purchase_coffee_name,
      coffee_profiles.process_percentage,
      coffee_profiles.base_percentage,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'purchase_coffee_id', coffee_profile_components.purchase_coffee_id,
              'purchase_coffee_name', purchase_coffees.name,
              'purchase_coffee_family', purchase_coffees.family,
              'purchase_coffee_process_type', purchase_coffees.process_type,
              'percentage', coffee_profile_components.percentage
            )
            ORDER BY coffee_profile_components.sort_order ASC, coffee_profile_components.id ASC
          )
          FROM coffee_profile_components
          INNER JOIN purchase_coffees ON purchase_coffees.id = coffee_profile_components.purchase_coffee_id
          WHERE coffee_profile_components.coffee_profile_id = coffee_profiles.id
        ),
        '[]'::json
      ) AS profile_components
    FROM sale_items
    LEFT JOIN coffee_lots ON coffee_lots.id = sale_items.lot_id
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = sale_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sale_items.coffee_profile_id
    LEFT JOIN purchase_coffees process_purchase ON process_purchase.id = coffee_profiles.process_purchase_coffee_id
    LEFT JOIN purchase_coffees base_purchase ON base_purchase.id = coffee_profiles.base_purchase_coffee_id
    WHERE sale_items.sale_id = $1
    ORDER BY sale_items.id ASC
    `,
    [id]
  );

  const lotsResult = await pool.query(
    `
    SELECT
      sale_item_lots.*,
      sale_item_lots.deducted_at,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.presentation,
      coffee_lots.commercial_classification,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'lot_id', coffee_process_inputs.lot_id,
              'lot_code', input_lots.code,
              'quantity_kg', coffee_process_inputs.quantity_kg,
              'input_percentage',
                CASE
                  WHEN coffee_processes.total_input_kg > 0
                  THEN ROUND((coffee_process_inputs.quantity_kg / coffee_processes.total_input_kg * 100)::numeric, 2)
                  ELSE 0
              END,
              'coffee_type_name', input_types.name,
              'coffee_profile_name', input_profiles.name,
              'supplier_name', input_suppliers.name,
              'commercial_classification', input_lots.commercial_classification
            )
            ORDER BY coffee_process_inputs.created_at ASC
          )
          FROM coffee_processes
          INNER JOIN coffee_process_inputs ON coffee_process_inputs.process_id = coffee_processes.id
          INNER JOIN coffee_lots input_lots ON input_lots.id = coffee_process_inputs.lot_id
          LEFT JOIN suppliers input_suppliers ON input_suppliers.id = input_lots.supplier_id
          LEFT JOIN coffee_types input_types ON input_types.id = input_lots.coffee_type_id
          LEFT JOIN coffee_profiles input_profiles ON input_profiles.id = input_lots.coffee_profile_id
          WHERE coffee_processes.output_lot_id = coffee_lots.id
        ),
        '[]'::json
      ) AS process_mix
    FROM sale_item_lots
    INNER JOIN coffee_lots ON coffee_lots.id = sale_item_lots.lot_id
    INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE sale_items.sale_id = $1
    ORDER BY sale_item_lots.id ASC
    `,
    [id]
  );

  const paymentsResult = await pool.query(
    `
    SELECT
      sale_payments.*,
      payment_methods.name AS payment_method_name,
      users.name AS registered_by_name
    FROM sale_payments
    LEFT JOIN payment_methods ON payment_methods.id = sale_payments.payment_method_id
    LEFT JOIN users ON users.id = sale_payments.registered_by
    WHERE sale_payments.sale_id = $1
    ORDER BY sale_payments.paid_at ASC, sale_payments.id ASC
    `,
    [id]
  );

  const blendResult = await pool.query(
    `
    SELECT
      sale_blend_items.*,
      sale_items.quantity_kg AS requested_quantity_kg,
      ROUND((sale_items.quantity_kg * sale_blend_items.percentage / 100)::numeric, 3) AS calculated_quantity_kg,
      ROUND(((${requiredSaleItemKgSql}) * sale_blend_items.percentage / 100)::numeric, 3) AS calculated_operational_kg,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.presentation,
      coffee_lots.commercial_classification,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sale_blend_items
    INNER JOIN sale_items ON sale_items.id = sale_blend_items.sale_item_id
    INNER JOIN coffee_lots ON coffee_lots.id = sale_blend_items.lot_id
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE sale_blend_items.sale_id = $1
    ORDER BY sale_blend_items.sale_item_id ASC, sale_blend_items.id ASC
    `,
    [id]
  );

  const assigneeHistoryResult = await pool.query(
    `
    SELECT
      sale_order_assignee_history.*,
      users.name AS changed_by_name
    FROM sale_order_assignee_history
    LEFT JOIN users ON users.id = sale_order_assignee_history.changed_by
    WHERE sale_order_assignee_history.sale_id = $1
    ORDER BY sale_order_assignee_history.created_at DESC
    `,
    [id]
  );

  const blendItemsBySaleItem = blendResult.rows.reduce((groups, blendItem) => {
    const key = blendItem.sale_item_id;
    groups[key] = groups[key] || [];
    groups[key].push(blendItem);
    return groups;
  }, {});

  const lotsBySaleItem = lotsResult.rows.reduce((groups, lot) => {
    const key = lot.sale_item_id;
    groups[key] = groups[key] || [];
    groups[key].push(lot);
    return groups;
  }, {});

  return {
    ...sale,
    items: itemsResult.rows.map((item) => {
      const assignedLots = lotsBySaleItem[item.id] || [];
      const reservedKg = assignedLots.reduce((total, lot) => total + Number(lot.quantity_kg || 0), 0);
      const requiredKg = calculateOperationalKg({
        quantityKg: item.quantity_kg,
        productForm: item.product_form,
        processType: item.process_type,
      });

      return {
        ...item,
        blend_items: blendItemsBySaleItem[item.id] || [],
        assigned_lots: assignedLots,
        reserved_kg: Number(reservedKg.toFixed(3)),
        missing_kg: Number(Math.max(requiredKg - reservedKg, 0).toFixed(3)),
      };
    }),
    deductedLots: lotsResult.rows,
    blendItems: blendResult.rows,
    payments: paymentsResult.rows,
    assigneeHistory: assigneeHistoryResult.rows,
  };
};

export const updateSaleCode = async ({ id, code }) => {
  const cleanCode = String(code || "").trim();

  const result = await pool.query(
    `
    UPDATE sales
    SET code = $1, updated_at = NOW()
    WHERE id = $2
      AND NOT EXISTS (
        SELECT 1
        FROM sales duplicated
        WHERE duplicated.code = $1
          AND duplicated.id <> sales.id
      )
    RETURNING *
    `,
    [cleanCode, id]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const existingSale = await findSaleById(id);
  if (!existingSale) {
    return null;
  }

  const duplicateResult = await pool.query(
    `
    SELECT id
    FROM sales
    WHERE code = $1
      AND id <> $2
    LIMIT 1
    `,
    [cleanCode, id]
  );

  if (duplicateResult.rows[0]) {
    return { duplicate: true, sale: existingSale };
  }

  return existingSale;
};

export const haveCompleteSaleItemReviews = async (saleId) => {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS pending_count
    FROM sale_items
    WHERE sale_id = $1
      AND (
        sale_humidity_percent IS NULL OR TRIM(sale_humidity_percent) = '' OR
        sale_lab_aroma IS NULL OR TRIM(sale_lab_aroma) = '' OR
        sale_lab_flavor IS NULL OR TRIM(sale_lab_flavor) = '' OR
        sale_lab_sweetness IS NULL OR TRIM(sale_lab_sweetness) = '' OR
        sale_lab_body IS NULL OR TRIM(sale_lab_body) = '' OR
        sale_lab_residual IS NULL OR TRIM(sale_lab_residual) = '' OR
        sale_lab_clean_cup IS NULL OR TRIM(sale_lab_clean_cup) = '' OR
        sale_lab_score IS NULL OR TRIM(sale_lab_score) = ''
      )
    `,
    [saleId]
  );

  return result.rows[0]?.pending_count === 0;
};

export const markSalePendingLaboratory = async ({ saleId, notes }) => {
  const result = await pool.query(
    `
    UPDATE sales
    SET status = 'pendiente_laboratorio', notes = COALESCE($1, notes), updated_at = NOW()
    WHERE id = $2
      AND status IN ('lote_asignado', 'listo_para_ensamble', 'ensamble_definido')
    RETURNING *
    `,
    [notes || null, saleId]
  );

  return result.rows[0];
};

export const updateSaleItemReviews = async ({ saleId, itemReviews, status, notes }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 FOR UPDATE", [saleId]);
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (sale.status !== "pendiente_laboratorio") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, sale };
    }

    const saleItemsResult = await client.query(
      "SELECT id FROM sale_items WHERE sale_id = $1 ORDER BY id",
      [saleId]
    );
    const validIds = new Set(saleItemsResult.rows.map((item) => item.id));

    if (status === "aprobada_laboratorio") {
      if (
        saleItemsResult.rows.length === 0 ||
        itemReviews.length !== saleItemsResult.rows.length ||
        itemReviews.some((review) => !validIds.has(review.saleItemId))
      ) {
        throw new Error("Debe registrar analisis para cada producto de la venta");
      }

      for (const review of itemReviews) {
        await client.query(
          `
          UPDATE sale_items
          SET
            sale_humidity_percent = $1,
            sale_lab_aroma = $2,
            sale_lab_flavor = $3,
            sale_lab_sweetness = $4,
            sale_lab_body = $5,
            sale_lab_residual = $6,
            sale_lab_clean_cup = $7,
            sale_lab_score = $8,
            sale_lab_notes = $9
          WHERE id = $10 AND sale_id = $11
          `,
          [
            review.humidityPercent,
            review.aroma,
            review.flavor,
            review.sweetness,
            review.body,
            review.residual,
            review.cleanCup,
            review.score,
            review.notes,
            review.saleItemId,
            saleId,
          ]
        );
      }
    }

    const updateResult = await client.query(
      `
      UPDATE sales
      SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [status, notes || null, saleId]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const replaceSaleBlendOrder = async ({ saleId, items, createdBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 FOR UPDATE", [saleId]);
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    const saleItemsResult = await client.query(
      `
      SELECT id, ${requiredSaleItemKgSql} AS required_kg
      FROM sale_items
      WHERE sale_id = $1
      `,
      [saleId]
    );
    const saleItemsById = saleItemsResult.rows.reduce((itemsById, item) => {
      itemsById[item.id] = item;
      return itemsById;
    }, {});

    const existingAssignmentsResult = await client.query(
      `
      SELECT sale_item_lots.*
      FROM sale_item_lots
      INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
      WHERE sale_items.sale_id = $1
        AND sale_item_lots.deducted_at IS NULL
      FOR UPDATE
      `,
      [saleId]
    );
    const existingAssignmentsByKey = existingAssignmentsResult.rows.reduce((assignments, assignment) => {
      assignments[`${assignment.sale_item_id}-${assignment.lot_id}`] = assignment;
      return assignments;
    }, {});

    await client.query("DELETE FROM sale_blend_items WHERE sale_id = $1", [saleId]);

    const desiredAssignments = new Map();
    const desiredByLot = new Map();

    for (const item of items) {
      const saleItem = saleItemsById[item.saleItemId];

      if (!saleItem) {
        throw new Error("El producto de venta no pertenece a esta venta");
      }

      const assignmentKey = `${item.saleItemId}-${item.lotId}`;
      const existingAssignment = existingAssignmentsByKey[assignmentKey];

      if (!existingAssignment) {
        throw new Error("El lote del ensamble debe estar asignado por bodega a ese producto");
      }

      const lotResult = await client.query(
        `
        SELECT id, status, available_weight_kg
        FROM coffee_lots
        WHERE id = $1
        LIMIT 1
        `,
        [item.lotId]
      );
      const lot = lotResult.rows[0];

      if (!lot || !["disponible", "vendido_parcial"].includes(lot.status) || Number(lot.available_weight_kg) <= 0) {
        throw new Error("El lote seleccionado para mezcla no esta disponible en inventario");
      }

      const calculatedQuantityKg = Number((Number(saleItem.required_kg || 0) * Number(item.percentage || 0) / 100).toFixed(3));
      const desiredAssignment = desiredAssignments.get(assignmentKey) || {
        saleItemId: item.saleItemId,
        lotId: item.lotId,
        quantityKg: 0,
        notes: existingAssignment.notes || item.notes || null,
      };
      desiredAssignment.quantityKg = Number((desiredAssignment.quantityKg + calculatedQuantityKg).toFixed(3));
      desiredAssignments.set(assignmentKey, desiredAssignment);
      desiredByLot.set(item.lotId, Number(((desiredByLot.get(item.lotId) || 0) + calculatedQuantityKg).toFixed(3)));

      await client.query(
        `
        INSERT INTO sale_blend_items (sale_id, sale_item_id, lot_id, percentage, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [saleId, item.saleItemId, item.lotId, item.percentage, item.notes || null, createdBy]
      );
    }

    for (const [lotId, desiredQuantityKg] of desiredByLot.entries()) {
      const lotAvailabilityResult = await client.query(
        `
        SELECT
          coffee_lots.id,
          coffee_lots.code,
          coffee_lots.available_weight_kg,
          COALESCE(SUM(other_assignments.quantity_kg) FILTER (WHERE other_sales.id IS NOT NULL), 0) AS reserved_other_sales_kg
        FROM coffee_lots
        LEFT JOIN sale_item_lots other_assignments
          ON other_assignments.lot_id = coffee_lots.id
          AND other_assignments.deducted_at IS NULL
        LEFT JOIN sale_items other_items
          ON other_items.id = other_assignments.sale_item_id
        LEFT JOIN sales other_sales
          ON other_sales.id = other_items.sale_id
          AND other_sales.id <> $2
          AND other_sales.status NOT IN ('despachada', 'anulada')
        WHERE coffee_lots.id = $1
        GROUP BY coffee_lots.id
        LIMIT 1
        `,
        [lotId, saleId]
      );
      const lotAvailability = lotAvailabilityResult.rows[0];
      const freeOperationalKg = Number(lotAvailability?.available_weight_kg || 0) - Number(lotAvailability?.reserved_other_sales_kg || 0);

      if (!lotAvailability || freeOperationalKg < desiredQuantityKg) {
        throw new Error(`El lote ${lotAvailability?.code || lotId} no tiene cantidad suficiente para el ensamble final`);
      }
    }

    await client.query(
      `
      DELETE FROM sale_item_lots
      WHERE sale_item_id IN (
        SELECT id
        FROM sale_items
        WHERE sale_id = $1
      )
      AND deducted_at IS NULL
      `,
      [saleId]
    );

    for (const assignment of desiredAssignments.values()) {
      await client.query(
        `
        INSERT INTO sale_item_lots (sale_item_id, lot_id, quantity_kg, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [assignment.saleItemId, assignment.lotId, assignment.quantityKg, assignment.notes, createdBy]
      );
    }

    await client.query(
      `
      UPDATE sales
      SET status = 'ensamble_definido', blend_required = TRUE, updated_at = NOW()
      WHERE id = $1
        AND status IN ('pendiente_bodega', 'lote_asignado', 'proceso_solicitado', 'en_proceso', 'listo_para_ensamble', 'ensamble_definido')
      `,
      [saleId]
    );

    await client.query("COMMIT");
    return sale;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const markSaleWithoutBlend = async ({ saleId }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 FOR UPDATE", [saleId]);
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (sale.status !== "listo_para_ensamble") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, sale };
    }

    await client.query("DELETE FROM sale_blend_items WHERE sale_id = $1", [saleId]);
    const updateResult = await client.query(
      `
      UPDATE sales
      SET status = 'pendiente_bodega', blend_required = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [saleId]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const returnSaleToWarehouseForAssignments = async ({ saleId, notes }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 FOR UPDATE", [saleId]);
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!["listo_para_ensamble", "ensamble_definido", "pendiente_laboratorio"].includes(sale.status)) {
      await client.query("ROLLBACK");
      return { invalidStatus: true, sale };
    }

    // Si laboratorio detecta que faltaron lotes, la orden de ensamble deja de ser valida.
    await client.query("DELETE FROM sale_blend_items WHERE sale_id = $1", [saleId]);

    const cleanNote = String(notes || "Venta devuelta a bodega para revisar/asignar lotes").trim();
    const noteLine = `[${new Date().toISOString()}] ${cleanNote}`;
    const nextNotes = [sale.notes, noteLine].filter(Boolean).join("\n");

    const updateResult = await client.query(
      `
      UPDATE sales
      SET status = 'pendiente_bodega', blend_required = FALSE, notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [nextNotes, saleId]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const markSaleReadyForBlend = async ({ saleId, notes }) => {
  const result = await pool.query(
    `
    UPDATE sales
    SET
      status = 'listo_para_ensamble',
      blend_required = TRUE,
      notes = COALESCE($2, notes),
      updated_at = NOW()
    WHERE id = $1
      AND status IN ('pendiente_alistamiento', 'pendiente_bodega', 'lote_asignado', 'proceso_solicitado', 'en_proceso', 'listo_para_ensamble', 'ensamble_definido')
    RETURNING *
    `,
    [saleId, notes || null]
  );

  return result.rows[0];
};

export const updateSaleWarehousePriority = async ({ saleId, priority }) => {
  const result = await pool.query(
    `
    UPDATE sales
    SET warehouse_priority = $1, updated_at = NOW()
    WHERE id = $2
      AND status <> 'anulada'
    RETURNING *
    `,
    [priority, saleId]
  );

  return result.rows[0];
};

export const updateSaleOrderAssignee = async ({ saleId, assignee, changedBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query("SELECT * FROM sales WHERE id = $1 FOR UPDATE", [saleId]);
    const currentSale = currentResult.rows[0];

    if (!currentSale || currentSale.status === "anulada") {
      await client.query("ROLLBACK");
      return null;
    }

    const normalizedAssignee = assignee || null;
    const previousAssignee = currentSale.order_assignee || null;

    const result = await client.query(
      `
      UPDATE sales
      SET order_assignee = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [normalizedAssignee, saleId]
    );

    if ((previousAssignee || "") !== (normalizedAssignee || "")) {
      await client.query(
        `
        INSERT INTO sale_order_assignee_history (sale_id, previous_assignee, new_assignee, changed_by)
        VALUES ($1, $2, $3, $4)
        `,
        [saleId, previousAssignee, normalizedAssignee, changedBy]
      );
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateSaleItemShortage = async ({ saleId, saleItemId, shortageMarked, notes, markedBy }) => {
  const result = await pool.query(
    `
    UPDATE sale_items
    SET
      shortage_marked = $1,
      shortage_notes = $2,
      shortage_marked_by = CASE WHEN $1 THEN $3::integer ELSE NULL END,
      shortage_marked_at = CASE WHEN $1 THEN NOW() ELSE NULL END
    WHERE id = $4
      AND sale_id = $5
    RETURNING *
    `,
    [shortageMarked, notes || null, markedBy || null, saleItemId, saleId]
  );

  return result.rows[0];
};

export const replaceSaleLotAssignments = async ({ saleId, items, itemAssignees = [], createdBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query("SELECT * FROM sales WHERE id = $1 FOR UPDATE", [saleId]);
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (["pendiente_laboratorio", "aprobada_laboratorio", "alistada", "despachada", "anulada"].includes(sale.status)) {
      await client.query("ROLLBACK");
      return { invalidStatus: true, sale };
    }

    await client.query(
      `
      DELETE FROM sale_item_lots
      WHERE sale_item_id IN (
        SELECT id
        FROM sale_items
        WHERE sale_id = $1
      )
      AND deducted_at IS NULL
      `,
      [saleId]
    );

    const quantityByLot = new Map();

    for (const item of items) {
      const saleItemResult = await client.query(
        "SELECT id FROM sale_items WHERE id = $1 AND sale_id = $2 LIMIT 1",
        [item.saleItemId, saleId]
      );

      if (!saleItemResult.rows[0]) {
        throw new Error("El producto no pertenece a esta venta");
      }

      const lotResult = await client.query(
        `
        SELECT
          coffee_lots.id,
          coffee_lots.code,
          coffee_lots.status,
          coffee_lots.available_weight_kg,
          COALESCE(SUM(other_assignments.quantity_kg) FILTER (WHERE other_sales.id IS NOT NULL), 0) AS reserved_other_sales_kg
        FROM coffee_lots
        LEFT JOIN sale_item_lots other_assignments
          ON other_assignments.lot_id = coffee_lots.id
          AND other_assignments.deducted_at IS NULL
        LEFT JOIN sale_items other_items
          ON other_items.id = other_assignments.sale_item_id
        LEFT JOIN sales other_sales
          ON other_sales.id = other_items.sale_id
          AND other_sales.id <> $2
          AND other_sales.status NOT IN ('despachada', 'anulada')
        WHERE coffee_lots.id = $1
        GROUP BY coffee_lots.id
        LIMIT 1
        `,
        [item.lotId, saleId]
      );
      const lot = lotResult.rows[0];

      if (!lot || !["disponible", "vendido_parcial"].includes(lot.status)) {
        throw new Error("El lote seleccionado no esta disponible para asignar");
      }

      const reservedInThisSave = quantityByLot.get(item.lotId) || 0;
      const freeOperationalKg = Number(lot.available_weight_kg) - Number(lot.reserved_other_sales_kg || 0) - reservedInThisSave;

      if (freeOperationalKg < item.quantityKg) {
        throw new Error(`El lote ${lot.code || lot.id} no tiene cantidad operativa suficiente. Libre operativo: ${Math.max(freeOperationalKg, 0).toFixed(3)} kg`);
      }

      quantityByLot.set(item.lotId, reservedInThisSave + item.quantityKg);

      await client.query(
        `
        INSERT INTO sale_item_lots (sale_item_id, lot_id, quantity_kg, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [item.saleItemId, item.lotId, item.quantityKg, item.notes || null, createdBy]
      );
    }

    for (const itemAssignee of itemAssignees) {
      const saleItemId = Number(itemAssignee.saleItemId);
      const assignee = String(itemAssignee.assignee || "").trim() || null;

      if (!Number.isInteger(saleItemId)) {
        throw new Error("El encargado del producto no tiene un producto valido");
      }

      if (assignee && assignee.length > 120) {
        throw new Error("El encargado del producto no puede superar 120 caracteres");
      }

      const result = await client.query(
        `
        UPDATE sale_items
        SET item_assignee = $1
        WHERE id = $2
          AND sale_id = $3
        RETURNING id
        `,
        [assignee, saleItemId, saleId]
      );

      if (!result.rows[0]) {
        throw new Error("El producto del encargado no pertenece a esta venta");
      }

    }

    await client.query(
      `
      UPDATE sales
      SET status = 'lote_asignado', updated_at = NOW()
      WHERE id = $1
        AND status IN ('pendiente_alistamiento', 'pendiente_bodega', 'lote_asignado', 'proceso_solicitado', 'listo_para_ensamble', 'ensamble_definido')
      `,
      [saleId]
    );

    await client.query("COMMIT");
    return sale;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const removeSaleLotAssignment = async ({ assignmentId }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const assignmentResult = await client.query(
      `
      SELECT
        sale_item_lots.*,
        sales.id AS sale_id,
        sales.code AS sale_code,
        sales.status AS sale_status,
        coffee_lots.code AS lot_code
      FROM sale_item_lots
      INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
      INNER JOIN sales ON sales.id = sale_items.sale_id
      INNER JOIN coffee_lots ON coffee_lots.id = sale_item_lots.lot_id
      WHERE sale_item_lots.id = $1
      FOR UPDATE
      `,
      [assignmentId]
    );
    const assignment = assignmentResult.rows[0];

    if (!assignment) {
      await client.query("ROLLBACK");
      return null;
    }

    if (
      assignment.deducted_at ||
      ["alistada", "despachada", "anulada"].includes(assignment.sale_status)
    ) {
      await client.query("ROLLBACK");
      return { locked: true, assignment };
    }

    await client.query("DELETE FROM sale_item_lots WHERE id = $1", [assignmentId]);

    await client.query("COMMIT");
    return { assignment };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getOperationalLotReservations = async () => {
  const lotsResult = await pool.query(
    `
    SELECT
      coffee_lots.id,
      coffee_lots.code,
      coffee_lots.lot_kind,
      coffee_lots.presentation,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.available_weight_kg,
      coffee_lots.status,
      coffee_lots.received_at,
      coffee_lots.created_at,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      COALESCE(SUM(sale_item_lots.quantity_kg) FILTER (
        WHERE sale_item_lots.deducted_at IS NULL
          AND sales.status NOT IN ('despachada', 'anulada')
      ), 0) AS reserved_kg
    FROM coffee_lots
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN sale_item_lots ON sale_item_lots.lot_id = coffee_lots.id
    LEFT JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
    LEFT JOIN sales ON sales.id = sale_items.sale_id
    WHERE coffee_lots.status IN ('disponible', 'vendido_parcial', 'agotado')
    GROUP BY coffee_lots.id, suppliers.name, coffee_types.name, coffee_profiles.name
    HAVING coffee_lots.available_weight_kg > 0
      OR COALESCE(SUM(sale_item_lots.quantity_kg) FILTER (
        WHERE sale_item_lots.deducted_at IS NULL
          AND sales.status NOT IN ('despachada', 'anulada')
      ), 0) > 0
    ORDER BY coffee_lots.received_at ASC, coffee_lots.created_at ASC
    `
  );

  const assignmentsResult = await pool.query(
    `
    SELECT
      sale_item_lots.id,
      sale_item_lots.lot_id,
      sale_item_lots.sale_item_id,
      sale_item_lots.quantity_kg,
      sale_item_lots.notes,
      sale_item_lots.created_at,
      sales.id AS sale_id,
      sales.code AS sale_code,
      sales.status AS sale_status,
      sales.warehouse_priority,
      sales.order_assignee,
      sales.estimated_delivery_date,
      clients.name AS client_name,
      sale_items.description,
      sale_items.product_form,
      sale_items.process_type,
      sale_items.variety,
      sale_items.quantity_kg AS requested_quantity_kg,
      sale_items.operational_weight_kg,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sale_item_lots
    INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
    INNER JOIN sales ON sales.id = sale_items.sale_id
    INNER JOIN clients ON clients.id = sales.client_id
    LEFT JOIN coffee_types ON coffee_types.id = sale_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sale_items.coffee_profile_id
    WHERE sales.status NOT IN ('despachada', 'anulada')
      AND sale_item_lots.deducted_at IS NULL
    ORDER BY sales.estimated_delivery_date ASC NULLS LAST, sales.created_at ASC, sale_item_lots.id ASC
    `
  );

  const deficitsResult = await pool.query(
    `
    SELECT
      sale_items.id AS sale_item_id,
      sales.id AS sale_id,
      sales.code AS sale_code,
      sales.status AS sale_status,
      sales.warehouse_priority,
      sales.order_assignee,
      sales.estimated_delivery_date,
      clients.name AS client_name,
      sale_items.description,
      sale_items.product_form,
      sale_items.process_type,
      sale_items.variety,
      sale_items.quantity_kg AS requested_quantity_kg,
      ${requiredSaleItemKgSql} AS required_kg,
      sale_items.shortage_marked,
      sale_items.shortage_notes,
      COALESCE(SUM(sale_item_lots.quantity_kg), 0) AS reserved_kg,
      COALESCE(SUM(sale_item_lots.quantity_kg) FILTER (WHERE sale_item_lots.notes ILIKE '[Proceso]%'), 0) AS reserved_process_kg,
      COALESCE(SUM(sale_item_lots.quantity_kg) FILTER (WHERE sale_item_lots.notes ILIKE '[Base]%'), 0) AS reserved_base_kg,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.id AS coffee_profile_id,
      coffee_profiles.name AS coffee_profile_name,
      coffee_profiles.category AS coffee_profile_category,
      base_purchase.name AS base_purchase_coffee_name,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'purchase_coffee_id', coffee_profile_components.purchase_coffee_id,
              'purchase_coffee_name', purchase_coffees.name,
              'purchase_coffee_family', purchase_coffees.family,
              'purchase_coffee_process_type', purchase_coffees.process_type,
              'percentage', coffee_profile_components.percentage
            )
            ORDER BY coffee_profile_components.sort_order ASC, coffee_profile_components.id ASC
          )
          FROM coffee_profile_components
          INNER JOIN purchase_coffees ON purchase_coffees.id = coffee_profile_components.purchase_coffee_id
          WHERE coffee_profile_components.coffee_profile_id = coffee_profiles.id
        ),
        '[]'::json
      ) AS profile_components
    FROM sale_items
    INNER JOIN sales ON sales.id = sale_items.sale_id
    INNER JOIN clients ON clients.id = sales.client_id
    LEFT JOIN sale_item_lots ON sale_item_lots.sale_item_id = sale_items.id
    LEFT JOIN coffee_types ON coffee_types.id = sale_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sale_items.coffee_profile_id
    LEFT JOIN purchase_coffees base_purchase ON base_purchase.id = coffee_profiles.base_purchase_coffee_id
    WHERE sales.status NOT IN ('despachada', 'anulada')
    GROUP BY sale_items.id, sales.id, clients.name, coffee_types.name, coffee_profiles.id, coffee_profiles.name, coffee_profiles.category, base_purchase.name
    ORDER BY sales.estimated_delivery_date ASC NULLS LAST, sales.created_at ASC, sale_items.id ASC
    `
  );

  const assignmentsByLot = assignmentsResult.rows.reduce((groups, assignment) => {
    groups[assignment.lot_id] = groups[assignment.lot_id] || [];
    groups[assignment.lot_id].push(assignment);
    return groups;
  }, {});

  const lots = lotsResult.rows.map((lot) => {
    const reservedKg = Number(lot.reserved_kg || 0);
    const physicalKg = Number(lot.available_weight_kg || 0);

    return {
      ...lot,
      available_weight_kg: physicalKg,
      reserved_kg: Number(reservedKg.toFixed(3)),
      operational_available_kg: Number(Math.max(physicalKg - reservedKg, 0).toFixed(3)),
      assignments: assignmentsByLot[lot.id] || [],
    };
  });

  const deficits = deficitsResult.rows
    .map((item) => {
      const requiredKg = Number(item.required_kg || 0);
      const reservedKg = Number(item.reserved_kg || 0);
      const reservedProcessKg = Number(item.reserved_process_kg || 0);
      const reservedBaseKg = Number(item.reserved_base_kg || 0);
      const isExoticProfile = item.coffee_profile_category === "Exotico";
      const processTargetKg = isExoticProfile ? Math.ceil((requiredKg * 0.4) - Number.EPSILON) : 0;
      const baseTargetKg = isExoticProfile ? Math.ceil((requiredKg * 0.6) - Number.EPSILON) : 0;
      const processMissingKg = Math.ceil(Math.max(processTargetKg - reservedProcessKg, 0) - Number.EPSILON);
      const baseMissingKg = Math.ceil(Math.max(baseTargetKg - reservedBaseKg, 0) - Number.EPSILON);
      const missingKg = isExoticProfile
        ? Number((processMissingKg + baseMissingKg).toFixed(3))
        : Number(Math.max(requiredKg - reservedKg, 0).toFixed(3));

      return {
        ...item,
        required_kg: Number(requiredKg.toFixed(3)),
        reserved_kg: Number(reservedKg.toFixed(3)),
        reserved_process_kg: Number(reservedProcessKg.toFixed(3)),
        reserved_base_kg: Number(reservedBaseKg.toFixed(3)),
        process_target_kg: processTargetKg,
        base_target_kg: baseTargetKg,
        process_missing_kg: processMissingKg,
        base_missing_kg: baseMissingKg,
        missing_kg: missingKg,
      };
    })
    .filter((item) => item.shortage_marked || item.missing_kg > 0);

  return {
    lots,
    deficits,
    totals: {
      physical_kg: Number(lots.reduce((total, lot) => total + Number(lot.available_weight_kg || 0), 0).toFixed(3)),
      reserved_kg: Number(lots.reduce((total, lot) => total + Number(lot.reserved_kg || 0), 0).toFixed(3)),
      operational_available_kg: Number(lots.reduce((total, lot) => total + Number(lot.operational_available_kg || 0), 0).toFixed(3)),
      missing_kg: Number(deficits.reduce((total, item) => total + Number(item.missing_kg || 0), 0).toFixed(3)),
    },
  };
};

export const convertQuoteToSale = async ({
  quoteId,
  code,
  paymentStatus,
  amountPaid,
  estimatedPaymentDate,
  externalInvoiceReference,
  notes,
  paymentMethodId,
  paymentReference,
  paidAt,
  createdBy,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quoteResult = await client.query(
      `
      SELECT *
      FROM quotes
      WHERE id = $1
      FOR UPDATE
      `,
      [quoteId]
    );
    const quote = quoteResult.rows[0];

    if (!quote) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!["enviada", "aceptada"].includes(quote.status)) {
      await client.query("ROLLBACK");
      return { invalidQuoteStatus: true, quote };
    }

    if (quote.quote_type === "lista_precios") {
      await client.query("ROLLBACK");
      return { invalidQuoteType: true, quote };
    }

    const existingSale = await client.query("SELECT id FROM sales WHERE quote_id = $1 LIMIT 1", [quoteId]);

    if (existingSale.rows[0]) {
      await client.query("ROLLBACK");
      return { alreadyConverted: true, saleId: existingSale.rows[0].id };
    }

    const balanceDue = Number((Number(quote.total) - amountPaid).toFixed(2));

    if (quote.status !== "aceptada") {
      await client.query(
        `
        UPDATE quotes
        SET status = 'aceptada',
            updated_at = NOW()
        WHERE id = $1
        `,
        [quote.id]
      );
    }

    const saleResult = await client.query(
      `
      INSERT INTO sales (
        code,
        quote_id,
        client_id,
        seller_id,
        payment_status,
        currency,
        subtotal,
        shipping_cost,
        total,
        amount_paid,
        balance_due,
        estimated_delivery_date,
        estimated_payment_date,
        external_invoice_reference,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
      `,
      [
        code,
        quote.id,
        quote.client_id,
        quote.seller_id,
        paymentStatus,
        quote.currency,
        quote.subtotal,
        quote.shipping_cost,
        quote.total,
        amountPaid,
        balanceDue,
        quote.estimated_delivery_date,
        estimatedPaymentDate || null,
        externalInvoiceReference || null,
        notes || null,
        createdBy,
      ]
    );
    const sale = saleResult.rows[0];

    if (amountPaid > 0) {
      await client.query(
        `
        INSERT INTO sale_payments (
          sale_id,
          amount,
          payment_method_id,
          payment_reference,
          paid_at,
          notes,
          registered_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          sale.id,
          amountPaid,
          paymentMethodId || null,
          paymentReference || null,
          paidAt || new Date(),
          "Pago inicial registrado al crear la venta",
          createdBy,
        ]
      );
    }

    const itemsResult = await client.query(
      `
      SELECT *
      FROM quote_items
      WHERE quote_id = $1
      ORDER BY id ASC
      `,
      [quote.id]
    );

    for (const item of itemsResult.rows) {
      const saleItemResult = await client.query(
        `
        INSERT INTO sale_items (
          sale_id,
          quote_item_id,
          lot_id,
          coffee_type_id,
          coffee_profile_id,
          description,
          product_form,
          process_type,
          variety,
          quantity_kg,
          operational_weight_kg,
          unit_price,
          line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        `,
        [
          sale.id,
          item.id,
          item.lot_id,
          item.coffee_type_id,
          item.coffee_profile_id,
          item.description,
          item.product_form,
          item.process_type,
          item.variety,
          item.quantity_kg,
          item.operational_weight_kg,
          item.unit_price,
          item.line_total,
        ]
      );
    }

    await client.query("COMMIT");
    return sale;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const createDirectSale = async ({
  code,
  clientId,
  sellerId,
  paymentStatus,
  currency,
  subtotal,
  shippingCost,
  total,
  amountPaid,
  estimatedDeliveryDate,
  estimatedPaymentDate,
  externalInvoiceReference,
  notes,
  paymentMethodId,
  paymentReference,
  paidAt,
  items,
  createdBy,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const balanceDue = Number((total - amountPaid).toFixed(2));

    const saleResult = await client.query(
      `
      INSERT INTO sales (
        code,
        client_id,
        seller_id,
        payment_status,
        currency,
        subtotal,
        shipping_cost,
        total,
        amount_paid,
        balance_due,
        estimated_delivery_date,
        estimated_payment_date,
        external_invoice_reference,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
      `,
      [
        code,
        clientId,
        sellerId,
        paymentStatus,
        currency,
        subtotal,
        shippingCost,
        total,
        amountPaid,
        balanceDue,
        estimatedDeliveryDate || null,
        estimatedPaymentDate || null,
        externalInvoiceReference || null,
        notes || null,
        createdBy,
      ]
    );
    const sale = saleResult.rows[0];

    if (amountPaid > 0) {
      await client.query(
        `
        INSERT INTO sale_payments (
          sale_id,
          amount,
          payment_method_id,
          payment_reference,
          paid_at,
          notes,
          registered_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          sale.id,
          amountPaid,
          paymentMethodId,
          paymentReference,
          paidAt || new Date(),
          "Pago inicial registrado al crear venta directa",
          createdBy,
        ]
      );
    }

    for (const item of items) {
      const saleItemResult = await client.query(
        `
        INSERT INTO sale_items (
          sale_id,
          lot_id,
          coffee_type_id,
          coffee_profile_id,
          description,
          product_form,
          process_type,
          variety,
          quantity_kg,
          operational_weight_kg,
          unit_price,
          line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        `,
        [
          sale.id,
          item.lotId,
          item.coffeeTypeId,
          item.coffeeProfileId,
          item.description,
          item.productForm,
          item.processType,
          item.variety,
          item.quantityKg,
          item.operationalWeightKg,
          item.unitPrice,
          item.lineTotal,
        ]
      );
    }

    await client.query("COMMIT");
    return sale;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateSaleOperationalStatus = async ({ saleId, status, notes, userId, dispatchReceipt = null }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query(
      `
      SELECT *
      FROM sales
      WHERE id = $1
      FOR UPDATE
      `,
      [saleId]
    );
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (status === "alistada") {
      if (sale.status !== "aprobada_laboratorio") {
        await client.query("ROLLBACK");
        return { missingLabReview: true, sale };
      }

      const hasLabReview = await haveCompleteSaleItemReviews(saleId);

      if (!hasLabReview) {
        await client.query("ROLLBACK");
        return { missingLabReview: true, sale };
      }

      const pendingAssignments = await client.query(
        `
        SELECT
          sale_item_lots.*,
          coffee_lots.code AS lot_code,
          coffee_lots.available_weight_kg,
          coffee_lots.status AS lot_status
        FROM sale_item_lots
        INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
        INNER JOIN coffee_lots ON coffee_lots.id = sale_item_lots.lot_id
        WHERE sale_items.sale_id = $1
          AND sale_item_lots.deducted_at IS NULL
        ORDER BY sale_item_lots.id ASC
        FOR UPDATE
        `,
        [saleId]
      );

      if (pendingAssignments.rows.length === 0) {
        await client.query("ROLLBACK");
        return { missingAssignments: true, sale };
      }

      for (const assignment of pendingAssignments.rows) {
        if (!["disponible", "vendido_parcial"].includes(assignment.lot_status)) {
          throw new Error(`El lote ${assignment.lot_code || assignment.lot_id} no esta disponible para alistar`);
        }

        const available = Number(assignment.available_weight_kg);
        const quantity = Number(assignment.quantity_kg);

        if (available < quantity) {
          throw new Error(`El lote ${assignment.lot_code || assignment.lot_id} no tiene cantidad suficiente`);
        }

        const newAvailable = Number((available - quantity).toFixed(3));
        const newStatus = newAvailable === 0 ? "agotado" : "vendido_parcial";

        await client.query(
          `
          UPDATE coffee_lots
          SET available_weight_kg = $1, status = $2, updated_at = NOW()
          WHERE id = $3
          `,
          [newAvailable, newStatus, assignment.lot_id]
        );

        await client.query(
          `
          UPDATE sale_item_lots
          SET deducted_at = NOW()
          WHERE id = $1
          `,
          [assignment.id]
        );

        await client.query(
          `
          INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
          VALUES ($1, 'venta_salida', $2, $3, $4)
          `,
          [assignment.lot_id, quantity, `Cafe alistado para venta ${sale.code}`, userId]
        );
      }
    }

    const updateResult = await client.query(
      `
      UPDATE sales
      SET
        status = $1,
        notes = COALESCE($2, notes),
        dispatch_receipt_image = COALESCE($4::text, dispatch_receipt_image),
        dispatch_receipt_file_name = COALESCE($5::text, dispatch_receipt_file_name),
        dispatch_receipt_mime_type = COALESCE($6::text, dispatch_receipt_mime_type),
        dispatch_receipt_uploaded_by = COALESCE($7::integer, dispatch_receipt_uploaded_by),
        dispatch_receipt_uploaded_at = CASE
          WHEN $4::text IS NULL THEN dispatch_receipt_uploaded_at
          ELSE NOW()
        END,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [
        status,
        notes || null,
        saleId,
        dispatchReceipt?.image || null,
        dispatchReceipt?.fileName || null,
        dispatchReceipt?.mimeType || null,
        dispatchReceipt ? userId : null,
      ]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const cancelSale = async ({ saleId, notes, cancelledBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query(
      `
      SELECT *
      FROM sales
      WHERE id = $1
      FOR UPDATE
      `,
      [saleId]
    );
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (sale.status === "despachada") {
      await client.query("ROLLBACK");
      return { alreadyDispatched: true, sale };
    }

    if (sale.status === "anulada") {
      await client.query("ROLLBACK");
      return { alreadyCancelled: true, sale };
    }

    if (!["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "proceso_solicitado", "en_proceso", "listo_para_ensamble", "ensamble_definido", "pendiente_laboratorio", "aprobada_laboratorio", "alistada"].includes(sale.status)) {
      await client.query("ROLLBACK");
      return { invalidStatus: true, sale };
    }

    const deductedLotsResult = await client.query(
      `
      SELECT
        sale_item_lots.lot_id,
        SUM(sale_item_lots.quantity_kg) AS quantity_kg
      FROM sale_item_lots
      INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
      WHERE sale_items.sale_id = $1
        AND sale_item_lots.deducted_at IS NOT NULL
      GROUP BY sale_item_lots.lot_id
      `,
      [saleId]
    );

    for (const deductedLot of deductedLotsResult.rows) {
      const lotResult = await client.query(
        `
        SELECT *
        FROM coffee_lots
        WHERE id = $1
        FOR UPDATE
        `,
        [deductedLot.lot_id]
      );
      const lot = lotResult.rows[0];
      const returnedKg = Number(deductedLot.quantity_kg);
      const newAvailable = Number((Number(lot.available_weight_kg) + returnedKg).toFixed(3));

      await client.query(
        `
        UPDATE coffee_lots
        SET available_weight_kg = $1, status = 'disponible', updated_at = NOW()
        WHERE id = $2
        `,
        [newAvailable, lot.id]
      );

      await client.query(
        `
        INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
        VALUES ($1, 'venta_anulada_entrada', $2, $3, $4)
        `,
        [lot.id, returnedKg, `Inventario devuelto por anulacion de venta ${sale.code}`, cancelledBy]
      );
    }

    const updateResult = await client.query(
      `
      UPDATE sales
      SET status = 'anulada', notes = COALESCE($1, notes), updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [notes || null, saleId]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteSaleById = async (saleId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query(
      `
      SELECT *
      FROM sales
      WHERE id = $1
      FOR UPDATE
      `,
      [saleId]
    );
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (sale.status === "despachada") {
      await client.query("ROLLBACK");
      return { alreadyDispatched: true, sale };
    }

    // Los procesos fisicos no se borran: solo se desligan de la venta de prueba eliminada.
    await client.query(
      `
      UPDATE coffee_processes
      SET sale_id = NULL, updated_at = NOW()
      WHERE sale_id = $1
      `,
      [saleId]
    );

    const deletedResult = await client.query(
      `
      DELETE FROM sales
      WHERE id = $1
      RETURNING *
      `,
      [saleId]
    );

    await client.query("COMMIT");
    return deletedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const registerSalePayment = async ({
  saleId,
  amount,
  paymentMethodId,
  paymentReference,
  paidAt,
  notes,
  registeredBy,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleResult = await client.query(
      `
      SELECT *
      FROM sales
      WHERE id = $1
      FOR UPDATE
      `,
      [saleId]
    );
    const sale = saleResult.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return null;
    }

    if (sale.status === "anulada") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, sale };
    }

    const paidResult = await client.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS amount_paid
      FROM sale_payments
      WHERE sale_id = $1
      `,
      [saleId]
    );
    const currentAmountPaid = Number(paidResult.rows[0].amount_paid);
    const currentBalance = Number((Number(sale.total) - currentAmountPaid).toFixed(2));

    logger.info("Validando abono de venta", {
      saleId,
      saleCode: sale.code,
      total: Number(sale.total),
      currentAmountPaid,
      currentBalance,
      paymentAmount: amount,
      registeredBy,
    });

    if (amount > currentBalance) {
      logger.warn("Abono rechazado por superar saldo pendiente", {
        saleId,
        saleCode: sale.code,
        currentBalance,
        paymentAmount: amount,
        registeredBy,
      });

      await client.query("ROLLBACK");
      return {
        amountTooHigh: true,
        sale: {
          ...sale,
          amount_paid: currentAmountPaid,
          balance_due: currentBalance,
        },
      };
    }

    await client.query(
      `
      INSERT INTO sale_payments (
        sale_id,
        amount,
        payment_method_id,
        payment_reference,
        paid_at,
        notes,
        registered_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [saleId, amount, paymentMethodId, paymentReference, paidAt, notes || null, registeredBy]
    );

    const newAmountPaid = Number((currentAmountPaid + amount).toFixed(2));
    const newBalance = Number(Math.max(Number(sale.total) - newAmountPaid, 0).toFixed(2));
    const newPaymentStatus = newBalance === 0 ? "pagada" : "pago_parcial";

    const updateResult = await client.query(
      `
      UPDATE sales
      SET
        amount_paid = $1,
        balance_due = $2,
        payment_status = $3,
        estimated_payment_date = CASE WHEN $2::numeric = 0 THEN NULL ELSE estimated_payment_date END,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [newAmountPaid, newBalance, newPaymentStatus, saleId]
    );

    await client.query("COMMIT");
    logger.info("Abono de venta registrado", {
      saleId,
      saleCode: sale.code,
      paymentAmount: amount,
      newAmountPaid,
      newBalance,
      newPaymentStatus,
      registeredBy,
    });
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const allocateLotsForItem = async (client, item, requiredKg) => {
  if (!item.lot_id && !item.coffee_profile_id && !item.coffee_type_id) {
    throw new Error("No se puede descontar inventario de un item sin lote, tipo o perfil");
  }

  const params = [];
  const conditions = [
    "status = 'disponible'",
    "available_weight_kg > 0",
  ];

  if (item.lot_id) {
    params.push(item.lot_id);
    conditions.push(`id = $${params.length}`);
  } else {
    if (item.coffee_profile_id) {
      params.push(item.coffee_profile_id);
      conditions.push(`coffee_profile_id = $${params.length}`);
    }

    if (item.coffee_type_id) {
      params.push(item.coffee_type_id);
      conditions.push(`coffee_type_id = $${params.length}`);
    }
  }

  const lotsResult = await client.query(
    `
    SELECT *
    FROM coffee_lots
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at ASC
    FOR UPDATE
    `,
    params
  );

  let remainingKg = requiredKg;
  const allocations = [];

  for (const lot of lotsResult.rows) {
    if (remainingKg <= 0) {
      break;
    }

    const available = Number(lot.available_weight_kg);
    const quantityKg = Number(Math.min(available, remainingKg).toFixed(3));
    const newAvailable = Number((available - quantityKg).toFixed(3));
    const newStatus = newAvailable === 0 ? "agotado" : "disponible";

    await client.query(
      `
      UPDATE coffee_lots
      SET available_weight_kg = $1, status = $2, updated_at = NOW()
      WHERE id = $3
      `,
      [newAvailable, newStatus, lot.id]
    );

    allocations.push({ lotId: lot.id, quantityKg });
    remainingKg = Number((remainingKg - quantityKg).toFixed(3));
  }

  if (remainingKg > 0) {
    throw new Error("No hay inventario suficiente para completar la venta");
  }

  return allocations;
};
