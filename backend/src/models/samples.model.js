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

  return result.rows;
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

  return result.rows[0];
};

export const createSampleRequest = async (sampleData) => {
  const result = await pool.query(
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
      $11, $12, $13, $14, $15, $16, $17, $18, $19
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
      sampleData.coffeeTypeId,
      sampleData.coffeeProfileId,
      sampleData.description,
      sampleData.quantityKg,
      sampleData.isCharged,
      sampleData.currency,
      sampleData.price,
      sampleData.requestedAt,
      sampleData.tentativeDeliveryDate,
      sampleData.notes,
      sampleData.createdBy,
    ]
  );

  return result.rows[0];
};

export const updateSampleRequestStatus = async ({ id, status, notes, handledBy }) => {
  const result = await pool.query(
    `
    UPDATE sample_requests
    SET
      status = $1,
      notes = COALESCE($2, notes),
      handled_by = $3,
      handled_at = NOW(),
      updated_at = NOW()
    WHERE id = $4
    RETURNING *
    `,
    [status, notes || null, handledBy, id]
  );

  return result.rows[0];
};
