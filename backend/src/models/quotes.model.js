import { pool } from "../db.js";
import { calculateOperationalKg } from "../utils/coffeeCalculations.js";
import { advanceCounterFromCode, getNextCode } from "./codeCounters.model.js";

export const getNextQuoteCode = async () => {
  return getNextCode({ prefix: "COT", tableName: "quotes" });
};

export const getNextPriceListCode = async () => {
  return getNextCode({ prefix: "LIST", tableName: "quotes" });
};

export const listQuotes = async ({ status, sellerId, clientId }) => {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`quotes.status = $${params.length}`);
  }

  if (sellerId) {
    params.push(sellerId);
    conditions.push(`quotes.seller_id = $${params.length}`);
  }

  if (clientId) {
    params.push(clientId);
    conditions.push(`quotes.client_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      quotes.*,
      clients.name AS client_name,
      users.name AS seller_name
    FROM quotes
    INNER JOIN clients ON clients.id = quotes.client_id
    INNER JOIN users ON users.id = quotes.seller_id
    ${where}
    ORDER BY quotes.created_at DESC
    `,
    params
  );

  return result.rows;
};

export const findQuoteById = async (id) => {
  const quoteResult = await pool.query(
    `
    SELECT
      quotes.*,
      clients.name AS client_name,
      clients.phone AS client_phone,
      clients.email AS client_email,
      clients.address AS client_address,
      clients.document_type AS client_document_type,
      clients.document_number AS client_document_number,
      clients.city AS client_city,
      clients.country AS client_country,
      users.name AS seller_name
    FROM quotes
    INNER JOIN clients ON clients.id = quotes.client_id
    INNER JOIN users ON users.id = quotes.seller_id
    WHERE quotes.id = $1
    LIMIT 1
    `,
    [id]
  );
  const quote = quoteResult.rows[0];

  if (!quote) {
    return null;
  }

  const itemsResult = await pool.query(
    `
    SELECT
      quote_items.*,
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
              'component_type', coffee_profile_components.component_type,
              'purchase_coffee_id', coffee_profile_components.purchase_coffee_id,
              'component_profile_id', coffee_profile_components.component_profile_id,
              'purchase_coffee_name', COALESCE(purchase_coffees.name, component_profiles.name),
              'purchase_coffee_family', COALESCE(purchase_coffees.family, component_profiles.category),
              'purchase_coffee_process_type', COALESCE(purchase_coffees.process_type, component_profiles.process_type),
              'component_profile_name', component_profiles.name,
              'component_profile_category', component_profiles.category,
              'component_profile_process_type', component_profiles.process_type,
              'percentage', coffee_profile_components.percentage
            )
            ORDER BY coffee_profile_components.sort_order ASC, coffee_profile_components.id ASC
          )
          FROM coffee_profile_components
          LEFT JOIN purchase_coffees ON purchase_coffees.id = coffee_profile_components.purchase_coffee_id
          LEFT JOIN coffee_profiles component_profiles ON component_profiles.id = coffee_profile_components.component_profile_id
          WHERE coffee_profile_components.coffee_profile_id = coffee_profiles.id
        ),
        '[]'::json
      ) AS profile_components
    FROM quote_items
    LEFT JOIN coffee_lots ON coffee_lots.id = quote_items.lot_id
    LEFT JOIN coffee_types ON coffee_types.id = quote_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = quote_items.coffee_profile_id
    LEFT JOIN purchase_coffees process_purchase ON process_purchase.id = coffee_profiles.process_purchase_coffee_id
    LEFT JOIN purchase_coffees base_purchase ON base_purchase.id = coffee_profiles.base_purchase_coffee_id
    WHERE quote_items.quote_id = $1
    ORDER BY quote_items.id ASC
    `,
    [id]
  );

  return {
    ...quote,
    items: itemsResult.rows,
  };
};

export const createQuote = async (quoteData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quoteResult = await client.query(
      `
      INSERT INTO quotes (
        code,
        client_id,
        seller_id,
        quote_type,
        status,
        currency,
        payment_terms,
        delivery_terms,
        shipping_cost,
        estimated_delivery_date,
        notes,
        quote_terms,
        subtotal,
        total
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `,
      [
        quoteData.code,
        quoteData.clientId,
        quoteData.sellerId,
        quoteData.quoteType,
        quoteData.status,
        quoteData.currency,
        quoteData.paymentTerms,
        quoteData.deliveryTerms,
        quoteData.shippingCost,
        quoteData.estimatedDeliveryDate,
        quoteData.notes,
        quoteData.terms,
        quoteData.subtotal,
        quoteData.total,
      ]
    );
    const quote = quoteResult.rows[0];
    await advanceCounterFromCode({ code: quote.code, client });

    for (const item of quoteData.items) {
      await client.query(
        `
        INSERT INTO quote_items (
          quote_id,
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
          line_total,
          price_basis,
          pricing_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `,
        [
          quote.id,
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
          item.priceBasis,
          item.pricingSnapshot || {},
        ]
      );
    }

    await client.query("COMMIT");
    return quote;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const ensureEditableSaleFromQuote = (sale) => {
  if (sale && ["alistada", "despachada", "anulada"].includes(sale.status)) {
    const error = new Error("La cotizacion ya tiene una venta alistada, despachada o anulada y no se puede sincronizar automaticamente");
    error.statusCode = 409;
    throw error;
  }
};

const clearSaleItemsForQuoteSync = async (client, saleId) => {
  // Antes de recrear items de cotizacion se eliminan las referencias de venta.
  await client.query("DELETE FROM sale_blend_items WHERE sale_id = $1", [saleId]);
  await client.query(
    `
    DELETE FROM sale_item_lots
    WHERE sale_item_id IN (
      SELECT id FROM sale_items WHERE sale_id = $1
    )
    AND deducted_at IS NULL
    `,
    [saleId]
  );
  await client.query("DELETE FROM sale_items WHERE sale_id = $1", [saleId]);
};

const syncSaleFromQuote = async (client, quote, quoteItems) => {
  const saleResult = await client.query(
    "SELECT * FROM sales WHERE quote_id = $1 FOR UPDATE",
    [quote.id]
  );
  const sale = saleResult.rows[0];

  if (!sale) return null;

  ensureEditableSaleFromQuote(sale);

  // Al cambiar la cotizacion, las reservas y ensambles pendientes dejan de ser confiables.
  // Se limpian para que bodega trabaje otra vez con la orden actualizada.
  await clearSaleItemsForQuoteSync(client, sale.id);

  const balanceDue = Number((Number(quote.total || 0) - Number(sale.amount_paid || 0)).toFixed(2));
  const paymentStatus = balanceDue <= 0
    ? "pagada"
    : Number(sale.amount_paid || 0) > 0
      ? "pago_parcial"
      : "pendiente_pago";

  await client.query(
    `
    UPDATE sales
    SET
      code = REGEXP_REPLACE($1, '^COT', 'VEN', 'i'),
      client_id = $2,
      seller_id = $3,
      payment_status = $4,
      currency = $5,
      subtotal = $6,
      shipping_cost = $7,
      total = $8,
      balance_due = GREATEST($8::numeric - COALESCE(amount_paid, 0), 0),
      estimated_delivery_date = $9,
      status = 'pendiente_bodega',
      blend_required = FALSE,
      updated_at = NOW()
    WHERE id = $10
    `,
    [
      quote.code,
      quote.client_id,
      quote.seller_id,
      paymentStatus,
      quote.currency,
      quote.subtotal,
      quote.shipping_cost,
      quote.total,
      quote.estimated_delivery_date,
      sale.id,
    ]
  );

  for (const item of quoteItems) {
    await client.query(
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
        calculateOperationalKg({
          quantityKg: item.quantity_kg,
          productForm: item.product_form,
          processType: item.process_type,
        }),
        item.unit_price,
        item.line_total,
      ]
    );
  }

  return sale;
};

export const updateQuote = async (id, quoteData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quoteResult = await client.query(
      `
      UPDATE quotes
      SET
        code = $1,
        client_id = $2,
        quote_type = $3,
        status = $4,
        currency = $5,
        payment_terms = $6,
        delivery_terms = $7,
        shipping_cost = $8,
        estimated_delivery_date = $9,
        notes = $10,
        quote_terms = $11,
        subtotal = $12,
        total = $13,
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
      `,
      [
        quoteData.code,
        quoteData.clientId,
        quoteData.quoteType,
        quoteData.status,
        quoteData.currency,
        quoteData.paymentTerms,
        quoteData.deliveryTerms,
        quoteData.shippingCost,
        quoteData.estimatedDeliveryDate,
        quoteData.notes,
        quoteData.terms,
        quoteData.subtotal,
        quoteData.total,
        id,
      ]
    );
    const quote = quoteResult.rows[0];

    if (!quote) {
      await client.query("ROLLBACK");
      return null;
    }
    await advanceCounterFromCode({ code: quote.code, client });

    const saleResult = await client.query(
      "SELECT * FROM sales WHERE quote_id = $1 FOR UPDATE",
      [id]
    );
    const sale = saleResult.rows[0];
    ensureEditableSaleFromQuote(sale);

    if (sale) {
      await clearSaleItemsForQuoteSync(client, sale.id);
    }

    await client.query("DELETE FROM quote_items WHERE quote_id = $1", [id]);

    const insertedItems = [];

    for (const item of quoteData.items) {
      const itemResult = await client.query(
        `
        INSERT INTO quote_items (
          quote_id,
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
          line_total,
          price_basis,
          pricing_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        `,
        [
          id,
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
          item.priceBasis,
          item.pricingSnapshot || {},
        ]
      );
      insertedItems.push(itemResult.rows[0]);
    }

    await syncSaleFromQuote(client, quote, insertedItems);

    await client.query("COMMIT");
    return quote;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateQuoteStatus = async (id, status) => {
  const result = await pool.query(
    `
    UPDATE quotes
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [status, id]
  );

  return result.rows[0];
};

export const quoteHasSale = async (id) => {
  const result = await pool.query("SELECT id FROM sales WHERE quote_id = $1 LIMIT 1", [id]);
  return Boolean(result.rows[0]);
};

export const quoteHasProcess = async (id) => {
  const result = await pool.query("SELECT id FROM coffee_processes WHERE quote_id = $1 LIMIT 1", [id]);
  return Boolean(result.rows[0]);
};

export const deleteQuoteById = async (id) => {
  const result = await pool.query(
    `
    DELETE FROM quotes
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
};
