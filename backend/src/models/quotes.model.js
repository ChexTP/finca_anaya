import { pool } from "../db.js";

export const getNextQuoteCode = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `
    SELECT code
    FROM quotes
    WHERE code LIKE $1
    ORDER BY code DESC
    LIMIT 1
    `,
    [`COT-${year}-%`]
  );

  const lastCode = result.rows[0]?.code;
  const lastNumber = lastCode ? Number(lastCode.split("-")[2]) : 0;
  const nextNumber = String(lastNumber + 1).padStart(4, "0");

  return `COT-${year}-${nextNumber}`;
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
        subtotal,
        total
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        quoteData.subtotal,
        quoteData.total,
      ]
    );
    const quote = quoteResult.rows[0];

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
          line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
