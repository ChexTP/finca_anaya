import { pool } from "../db.js";
import { logger } from "../utils/logger.js";

export const getNextSaleCode = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `
    SELECT code
    FROM sales
    WHERE code LIKE $1
    ORDER BY code DESC
    LIMIT 1
    `,
    [`VEN-${year}-%`]
  );

  const lastCode = result.rows[0]?.code;
  const lastNumber = lastCode ? Number(lastCode.split("-")[2]) : 0;
  const nextNumber = String(lastNumber + 1).padStart(4, "0");

  return `VEN-${year}-${nextNumber}`;
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
      clients.address AS client_address,
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
      coffee_lots.commercial_classification,
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
              'commercial_classification', input_lots.commercial_classification
            )
            ORDER BY coffee_process_inputs.created_at ASC
          )
          FROM coffee_processes
          INNER JOIN coffee_process_inputs ON coffee_process_inputs.process_id = coffee_processes.id
          INNER JOIN coffee_lots input_lots ON input_lots.id = coffee_process_inputs.lot_id
          LEFT JOIN coffee_types input_types ON input_types.id = input_lots.coffee_type_id
          LEFT JOIN coffee_profiles input_profiles ON input_profiles.id = input_lots.coffee_profile_id
          WHERE coffee_processes.output_lot_id = coffee_lots.id
        ),
        '[]'::json
      ) AS process_mix
    FROM sale_item_lots
    INNER JOIN coffee_lots ON coffee_lots.id = sale_item_lots.lot_id
    INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
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
      ROUND((COALESCE(sale_items.operational_weight_kg, sale_items.quantity_kg) * sale_blend_items.percentage / 100)::numeric, 3) AS calculated_operational_kg,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.commercial_classification,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sale_blend_items
    INNER JOIN sale_items ON sale_items.id = sale_blend_items.sale_item_id
    INNER JOIN coffee_lots ON coffee_lots.id = sale_blend_items.lot_id
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

  return {
    ...sale,
    items: itemsResult.rows.map((item) => ({
      ...item,
      blend_items: blendItemsBySaleItem[item.id] || [],
    })),
    deductedLots: lotsResult.rows,
    blendItems: blendResult.rows,
    payments: paymentsResult.rows,
    assigneeHistory: assigneeHistoryResult.rows,
  };
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
      AND status IN ('lote_asignado', 'ensamble_definido')
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

    await client.query("DELETE FROM sale_blend_items WHERE sale_id = $1", [saleId]);

    for (const item of items) {
      const saleItemResult = await client.query(
        "SELECT id FROM sale_items WHERE id = $1 AND sale_id = $2 LIMIT 1",
        [item.saleItemId, saleId]
      );

      if (!saleItemResult.rows[0]) {
        throw new Error("El producto de venta no pertenece a esta venta");
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

      await client.query(
        `
        INSERT INTO sale_blend_items (sale_id, sale_item_id, lot_id, percentage, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [saleId, item.saleItemId, item.lotId, item.percentage, item.notes || null, createdBy]
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
      shortage_marked_by = CASE WHEN $1 THEN $3 ELSE NULL END,
      shortage_marked_at = CASE WHEN $1 THEN NOW() ELSE NULL END
    WHERE id = $4
      AND sale_id = $5
    RETURNING *
    `,
    [shortageMarked, notes || null, markedBy, saleItemId, saleId]
  );

  return result.rows[0];
};

export const replaceSaleLotAssignments = async ({ saleId, items, createdBy }) => {
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
        SELECT id, code, status, available_weight_kg
        FROM coffee_lots
        WHERE id = $1
        LIMIT 1
        `,
        [item.lotId]
      );
      const lot = lotResult.rows[0];

      if (!lot || !["disponible", "vendido_parcial"].includes(lot.status)) {
        throw new Error("El lote seleccionado no esta disponible para asignar");
      }

      if (Number(lot.available_weight_kg) < item.quantityKg) {
        throw new Error(`El lote ${lot.code || lot.id} no tiene cantidad suficiente`);
      }

      await client.query(
        `
        INSERT INTO sale_item_lots (sale_item_id, lot_id, quantity_kg, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [item.saleItemId, item.lotId, item.quantityKg, item.notes || null, createdBy]
      );
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

    if (quote.status !== "aceptada") {
      await client.query("ROLLBACK");
      return { invalidQuoteStatus: true, quote };
    }

    const existingSale = await client.query("SELECT id FROM sales WHERE quote_id = $1 LIMIT 1", [quoteId]);

    if (existingSale.rows[0]) {
      await client.query("ROLLBACK");
      return { alreadyConverted: true, saleId: existingSale.rows[0].id };
    }

    const balanceDue = Number((Number(quote.total) - amountPaid).toFixed(2));

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

export const updateSaleOperationalStatus = async ({ saleId, status, notes, userId }) => {
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
        updated_at = NOW()
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
