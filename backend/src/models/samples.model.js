import { pool } from "../db.js";

export const getNextSampleCode = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `
    SELECT code
    FROM sample_requests
    WHERE code LIKE $1
    ORDER BY code DESC
    LIMIT 1
    `,
    [`MUE-${year}-%`]
  );

  const lastCode = result.rows[0]?.code;
  const lastNumber = lastCode ? Number(lastCode.split("-")[2]) : 0;
  const nextNumber = String(lastNumber + 1).padStart(4, "0");

  return `MUE-${year}-${nextNumber}`;
};

export const listSampleRequests = async ({ createdBy, status }) => {
  const params = [];
  const conditions = [];

  if (createdBy) {
    params.push(createdBy);
    conditions.push(`sample_requests.created_by = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`sample_requests.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      sample_requests.*,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      created_user.name AS created_by_name,
      handled_user.name AS handled_by_name
    FROM sample_requests
    LEFT JOIN coffee_types ON coffee_types.id = sample_requests.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sample_requests.coffee_profile_id
    LEFT JOIN users created_user ON created_user.id = sample_requests.created_by
    LEFT JOIN users handled_user ON handled_user.id = sample_requests.handled_by
    ${where}
    ORDER BY sample_requests.created_at DESC
    `,
    params
  );

  return attachSampleItems(result.rows);
};

export const findSampleRequestById = async (id) => {
  const result = await pool.query(
    `
    SELECT
      sample_requests.*,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      created_user.name AS created_by_name,
      handled_user.name AS handled_by_name
    FROM sample_requests
    LEFT JOIN coffee_types ON coffee_types.id = sample_requests.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sample_requests.coffee_profile_id
    LEFT JOIN users created_user ON created_user.id = sample_requests.created_by
    LEFT JOIN users handled_user ON handled_user.id = sample_requests.handled_by
    WHERE sample_requests.id = $1
    LIMIT 1
    `,
    [id]
  );

  const [sample] = await attachSampleItems(result.rows);
  return sample;
};

const attachSampleItems = async (samples) => {
  if (samples.length === 0) return samples;

  const result = await pool.query(
    `
    SELECT
      sample_request_items.*,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sample_request_items
    LEFT JOIN coffee_types ON coffee_types.id = sample_request_items.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = sample_request_items.coffee_profile_id
    WHERE sample_request_items.sample_request_id = ANY($1::int[])
    ORDER BY sample_request_items.id ASC
    `,
    [samples.map((sample) => sample.id)]
  );

  const blendResult = await pool.query(
    `
    SELECT
      sample_item_blends.*,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM sample_item_blends
    JOIN coffee_lots ON coffee_lots.id = sample_item_blends.lot_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE sample_item_blends.sample_request_item_id = ANY($1::int[])
    ORDER BY sample_item_blends.id ASC
    `,
    [result.rows.map((item) => item.id)]
  );

  return samples.map((sample) => ({
    ...sample,
    items: result.rows
      .filter((item) => item.sample_request_id === sample.id)
      .map((item) => ({
        ...item,
        blend_items: blendResult.rows
          .filter((blend) => blend.sample_request_item_id === item.id)
          .map((blend) => ({
            ...blend,
            calculated_grams: Number((Number(item.quantity_grams) * Number(blend.percentage) / 100).toFixed(2)),
          })),
      })),
  }));
};

export const replaceSampleBlend = async ({ sampleId, items, createdBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const requestItems = await client.query(
      "SELECT id FROM sample_request_items WHERE sample_request_id = $1 ORDER BY id",
      [sampleId]
    );

    if (requestItems.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const validIds = new Set(requestItems.rows.map((item) => item.id));
    if (items.some((item) => !validIds.has(item.sampleItemId))) {
      throw new Error("Uno de los cafes no pertenece a esta solicitud de muestras");
    }

    await client.query(
      "DELETE FROM sample_item_blends WHERE sample_request_item_id = ANY($1::int[])",
      [[...validIds]]
    );

    for (const item of items) {
      const lotResult = await client.query(
        "SELECT id FROM coffee_lots WHERE id = $1 AND status IN ('disponible', 'vendido_parcial') AND available_weight_kg > 0",
        [item.lotId]
      );
      if (!lotResult.rows[0]) throw new Error("Uno de los lotes del ensamble no esta disponible");

      await client.query(
        `INSERT INTO sample_item_blends
          (sample_request_item_id, lot_id, percentage, notes, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.sampleItemId, item.lotId, item.percentage, item.notes, createdBy]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const hasCompleteSampleBlend = async (sampleId) => {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS incomplete_count
    FROM sample_request_items item
    WHERE item.sample_request_id = $1
      AND COALESCE((
        SELECT SUM(blend.percentage)
        FROM sample_item_blends blend
        WHERE blend.sample_request_item_id = item.id
      ), 0) <> 100
    `,
    [sampleId]
  );

  return result.rows[0].incomplete_count === 0;
};

export const createSampleRequest = async (sampleData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const firstItem = sampleData.items[0];
    const totalGrams = sampleData.items.reduce((total, item) => total + item.quantityGrams, 0);
    const totalPrice = sampleData.items.reduce((total, item) => total + (item.price || 0), 0);
    const result = await client.query(
    `
    INSERT INTO sample_requests (
      code,
      requester_name,
      requester_phone,
      requester_email,
      requester_company,
      requester_address,
      requester_city,
      requester_country,
      coffee_type_id,
      coffee_profile_id,
      description,
      quantity_kg,
      quantity_grams,
      is_charged,
      currency,
      price,
      requested_at,
      tentative_delivery_date,
      notes,
      created_by
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
    )
    RETURNING *
    `,
    [
      sampleData.code,
      sampleData.requesterName,
      sampleData.requesterPhone,
      sampleData.requesterEmail,
      sampleData.requesterCompany,
      sampleData.requesterAddress,
      sampleData.requesterCity,
      sampleData.requesterCountry,
      firstItem.coffeeTypeId,
      firstItem.coffeeProfileId,
      firstItem.description,
      totalGrams / 1000,
      totalGrams,
      totalPrice > 0,
      sampleData.currency,
      totalPrice > 0 ? totalPrice : null,
      sampleData.requestedAt,
      sampleData.tentativeDeliveryDate,
      sampleData.notes,
      sampleData.createdBy,
    ]
    );

    const sample = result.rows[0];
    for (const item of sampleData.items) {
      await client.query(
        `
        INSERT INTO sample_request_items (
          sample_request_id, coffee_type_id, coffee_profile_id, description, quantity_grams, price
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [sample.id, item.coffeeTypeId, item.coffeeProfileId, item.description, item.quantityGrams, item.price]
      );
    }

    await client.query("COMMIT");
    return sample;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateSampleRequestStatus = async ({ id, status, notes, labReview, handledBy }) => {
  const result = await pool.query(
    `
    UPDATE sample_requests
    SET
      status = $1,
      notes = COALESCE($2, notes),
      sample_humidity_percent = COALESCE($3, sample_humidity_percent),
      sample_lab_aroma = COALESCE($4, sample_lab_aroma),
      sample_lab_fragrance = COALESCE($5, sample_lab_fragrance),
      sample_lab_flavor = COALESCE($6, sample_lab_flavor),
      sample_lab_sweetness = COALESCE($7, sample_lab_sweetness),
      sample_lab_body = COALESCE($8, sample_lab_body),
      sample_lab_residual = COALESCE($9, sample_lab_residual),
      sample_lab_clean_cup = COALESCE($10, sample_lab_clean_cup),
      sample_lab_score = COALESCE($11, sample_lab_score),
      sample_lab_notes = COALESCE($12, sample_lab_notes),
      handled_by = $13,
      handled_at = NOW(),
      updated_at = NOW()
    WHERE id = $14
    RETURNING *
    `,
    [
      status,
      notes || null,
      labReview?.humidityPercent ?? null,
      labReview?.aroma ?? null,
      labReview?.fragrance ?? null,
      labReview?.flavor ?? null,
      labReview?.sweetness ?? null,
      labReview?.body ?? null,
      labReview?.residual ?? null,
      labReview?.cleanCup ?? null,
      labReview?.score ?? null,
      labReview?.notes || null,
      handledBy,
      id,
    ]
  );

  return result.rows[0];
};
