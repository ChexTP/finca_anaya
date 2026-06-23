import { pool } from "../db.js";

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
    ORDER BY sales.created_at DESC
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
      coffee_profiles.name AS coffee_profile_name
    FROM sale_items
    LEFT JOIN coffee_lots ON coffee_lots.id = sale_items.lot_id
    LEFT JOIN coffee_types ON coffee_types.id = sale_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sale_items.coffee_profile_id
    WHERE sale_items.sale_id = $1
    ORDER BY sale_items.id ASC
    `,
    [id]
  );

  const lotsResult = await pool.query(
    `
    SELECT
      sale_item_lots.*,
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

  return {
    ...sale,
    items: itemsResult.rows,
    deductedLots: lotsResult.rows,
    payments: paymentsResult.rows,
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
          quantity_kg,
          unit_price,
          line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          sale.id,
          item.id,
          item.lot_id,
          item.coffee_type_id,
          item.coffee_profile_id,
          item.description,
          item.quantity_kg,
          item.unit_price,
          item.line_total,
        ]
      );
      const saleItem = saleItemResult.rows[0];
      let remainingKg = Number(item.quantity_kg);

      const allocations = await allocateLotsForItem(client, item, remainingKg);

      for (const allocation of allocations) {
        remainingKg = Number((remainingKg - allocation.quantityKg).toFixed(3));

        await client.query(
          `
          INSERT INTO sale_item_lots (sale_item_id, lot_id, quantity_kg)
          VALUES ($1, $2, $3)
          `,
          [saleItem.id, allocation.lotId, allocation.quantityKg]
        );

        await client.query(
          `
          INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
          VALUES ($1, 'venta_salida', $2, $3, $4)
          `,
          [allocation.lotId, allocation.quantityKg, `Cafe descontado para venta ${sale.code}`, createdBy]
        );
      }

      if (remainingKg > 0) {
        throw new Error("No hay inventario suficiente para convertir la cotizacion en venta");
      }
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
        estimated_payment_date,
        external_invoice_reference,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
          quantity_kg,
          unit_price,
          line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          sale.id,
          item.lotId,
          item.coffeeTypeId,
          item.coffeeProfileId,
          item.description,
          item.quantityKg,
          item.unitPrice,
          item.lineTotal,
        ]
      );
      const saleItem = saleItemResult.rows[0];
      let remainingKg = Number(item.quantityKg);
      const allocations = await allocateLotsForItem(
        client,
        {
          lot_id: item.lotId,
          coffee_type_id: item.coffeeTypeId,
          coffee_profile_id: item.coffeeProfileId,
        },
        remainingKg
      );

      for (const allocation of allocations) {
        remainingKg = Number((remainingKg - allocation.quantityKg).toFixed(3));

        await client.query(
          `
          INSERT INTO sale_item_lots (sale_item_id, lot_id, quantity_kg)
          VALUES ($1, $2, $3)
          `,
          [saleItem.id, allocation.lotId, allocation.quantityKg]
        );

        await client.query(
          `
          INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
          VALUES ($1, 'venta_salida', $2, $3, $4)
          `,
          [allocation.lotId, allocation.quantityKg, `Cafe descontado para venta directa ${sale.code}`, createdBy]
        );
      }

      if (remainingKg > 0) {
        throw new Error("No hay inventario suficiente para crear la venta directa");
      }
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

export const updateSaleOperationalStatus = async ({ saleId, status, notes }) => {
  const result = await pool.query(
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

  return result.rows[0];
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

    if (!["pendiente_alistamiento", "alistada"].includes(sale.status)) {
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

    const currentBalance = Number(sale.balance_due);

    if (amount > currentBalance) {
      await client.query("ROLLBACK");
      return { amountTooHigh: true, sale };
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

    const newAmountPaid = Number((Number(sale.amount_paid) + amount).toFixed(2));
    const newBalance = Number((Number(sale.total) - newAmountPaid).toFixed(2));
    const newPaymentStatus = newBalance === 0 ? "pagada" : "pago_parcial";

    const updateResult = await client.query(
      `
      UPDATE sales
      SET
        amount_paid = $1,
        balance_due = $2,
        payment_status = $3,
        estimated_payment_date = CASE WHEN $2 = 0 THEN NULL ELSE estimated_payment_date END,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [newAmountPaid, newBalance, newPaymentStatus, saleId]
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
