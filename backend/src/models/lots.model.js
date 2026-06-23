import { pool } from "../db.js";

export const findPackagingTypeById = async (id) => {
  const result = await pool.query("SELECT * FROM packaging_types WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0];
};

export const findCoffeeTypeById = async (id) => {
  const result = await pool.query("SELECT * FROM coffee_types WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0];
};

export const findCoffeeProfileById = async (id) => {
  const result = await pool.query("SELECT * FROM coffee_profiles WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0];
};

export const findPaymentMethodById = async (id) => {
  const result = await pool.query("SELECT * FROM payment_methods WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0];
};

export const getNextLotCode = async () => {
  return getNextCodeByPrefix("LOT");
};

export const getNextProcessedLotCode = async () => {
  return getNextCodeByPrefix("PROC");
};

const getNextCodeByPrefix = async (prefix) => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `
    SELECT code
    FROM coffee_lots
    WHERE code LIKE $1
    ORDER BY code DESC
    LIMIT 1
    `,
    [`${prefix}-${year}-%`]
  );

  const lastCode = result.rows[0]?.code;
  const lastNumber = lastCode ? Number(lastCode.split("-")[2]) : 0;
  const nextNumber = String(lastNumber + 1).padStart(4, "0");

  return `${prefix}-${year}-${nextNumber}`;
};

export const listLots = async ({ status, supplierId, coffeeTypeId }) => {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`coffee_lots.status = $${params.length}`);
  }

  if (supplierId) {
    params.push(supplierId);
    conditions.push(`coffee_lots.supplier_id = $${params.length}`);
  }

  if (coffeeTypeId) {
    params.push(coffeeTypeId);
    conditions.push(`coffee_lots.coffee_type_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      coffee_lots.*,
      DATE_PART('day', NOW() - coffee_lots.created_at)::INTEGER AS days_in_warehouse,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      packaging_types.name AS packaging_type_name
    FROM coffee_lots
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN packaging_types ON packaging_types.id = coffee_lots.packaging_type_id
    ${where}
    ORDER BY coffee_lots.created_at ASC
    `,
    params
  );

  return result.rows;
};

export const findLotById = async (id) => {
  const result = await pool.query(
    `
    SELECT
      coffee_lots.*,
      DATE_PART('day', NOW() - coffee_lots.created_at)::INTEGER AS days_in_warehouse,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      packaging_types.name AS packaging_type_name
    FROM coffee_lots
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN packaging_types ON packaging_types.id = coffee_lots.packaging_type_id
    WHERE coffee_lots.id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0];
};

export const createReceivedLot = async (lotData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO coffee_lots (
        code,
        supplier_id,
        coffee_type_id,
        status,
        gross_weight_kg,
        packaging_type_id,
        packaging_quantity,
        inner_bag_quantity,
        tare_weight_kg,
        net_weight_kg,
        available_weight_kg,
        humidity_percent,
        performance_factor,
        visual_status,
        visual_defect_percent,
        visual_notes,
        commercial_classification,
        origin_zone,
        initial_comment,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING *
      `,
      [
        lotData.code,
        lotData.supplierId,
        lotData.coffeeTypeId,
        lotData.status,
        lotData.grossWeightKg,
        lotData.packagingTypeId,
        lotData.packagingQuantity,
        lotData.innerBagQuantity,
        lotData.tareWeightKg,
        lotData.netWeightKg,
        lotData.availableWeightKg,
        lotData.humidityPercent,
        lotData.performanceFactor,
        lotData.visualStatus,
        lotData.visualDefectPercent,
        lotData.visualNotes,
        lotData.commercialClassification,
        lotData.originZone,
        lotData.initialComment,
        lotData.createdBy,
      ]
    );

    const lot = result.rows[0];

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        lot.id,
        lot.status === "rechazado" ? "recepcion_rechazada" : "recepcion",
        lot.net_weight_kg,
        lot.status === "rechazado"
          ? "Lote rechazado en recepcion visual"
          : "Lote recibido y pendiente de laboratorio",
        lotData.createdBy,
      ]
    );

    await client.query("COMMIT");
    return lot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateLotLabReview = async (id, reviewData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `
      SELECT *
      FROM coffee_lots
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );
    const currentLot = currentResult.rows[0];

    if (!currentLot) {
      await client.query("ROLLBACK");
      return null;
    }

    if (currentLot.status !== "pendiente_laboratorio") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot: currentLot };
    }

    const result = await client.query(
      `
      UPDATE coffee_lots
      SET
        status = $1,
        humidity_percent = $2,
        lab_aroma = $3,
        lab_fragrance = $4,
        lab_flavor = $5,
        lab_acidity = $6,
        lab_sweetness = $7,
        lab_body = $8,
        lab_balance = $9,
        lab_uniformity = $10,
        lab_residual = $11,
        lab_clean_cup = $12,
        lab_score = $13,
        lab_notes = $14,
        lab_reviewed_by = $15,
        lab_reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $16
      RETURNING *
      `,
      [
        reviewData.status,
        reviewData.humidityPercent,
        reviewData.aroma,
        reviewData.fragrance,
        reviewData.flavor,
        reviewData.acidity,
        reviewData.sweetness,
        reviewData.body,
        reviewData.balance,
        reviewData.uniformity,
        reviewData.residual,
        reviewData.cleanCup,
        reviewData.score,
        reviewData.notes,
        reviewData.reviewedBy,
        id,
      ]
    );

    const lot = result.rows[0];

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        lot.id,
        lot.status === "aprobado" ? "laboratorio_aprobado" : "laboratorio_rechazado",
        lot.net_weight_kg,
        lot.status === "aprobado"
          ? "Lote aprobado por laboratorio, pendiente de compra/pago"
          : "Lote rechazado por laboratorio",
        reviewData.reviewedBy,
      ]
    );

    await client.query("COMMIT");
    return lot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const markRejectedLotAsWithdrawn = async ({ id, notes, withdrawnBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `
      SELECT *
      FROM coffee_lots
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );
    const currentLot = currentResult.rows[0];

    if (!currentLot) {
      await client.query("ROLLBACK");
      return null;
    }

    if (currentLot.status !== "rechazado") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot: currentLot };
    }

    const result = await client.query(
      `
      UPDATE coffee_lots
      SET
        status = 'retirado',
        initial_comment = CASE
          WHEN $1::text IS NULL OR $1::text = '' THEN initial_comment
          WHEN initial_comment IS NULL OR initial_comment = '' THEN $1::text
          ELSE initial_comment || E'\nRetiro: ' || $1::text
        END,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [notes || null, id]
    );

    const lot = result.rows[0];

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, 'retiro_lote_rechazado', $2, $3, $4)
      `,
      [lot.id, lot.net_weight_kg, notes || "Lote rechazado retirado por proveedor", withdrawnBy]
    );

    await client.query("COMMIT");
    return lot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const registerLotPurchase = async (id, purchaseData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `
      SELECT *
      FROM coffee_lots
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );
    const currentLot = currentResult.rows[0];

    if (!currentLot) {
      await client.query("ROLLBACK");
      return null;
    }

    if (currentLot.status !== "aprobado") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot: currentLot };
    }

    const result = await client.query(
      `
      UPDATE coffee_lots
      SET
        status = 'disponible',
        available_weight_kg = net_weight_kg,
        purchase_price_per_kg = $1,
        purchase_total = $2,
        purchase_paid = TRUE,
        purchase_payment_method_id = $3,
        purchase_payment_reference = $4,
        purchase_paid_at = $5,
        purchase_registered_by = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
      `,
      [
        purchaseData.purchasePricePerKg,
        purchaseData.purchaseTotal,
        purchaseData.paymentMethodId,
        purchaseData.paymentReference,
        purchaseData.paidAt,
        purchaseData.registeredBy,
        id,
      ]
    );

    const lot = result.rows[0];

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        lot.id,
        "compra_pagada",
        lot.available_weight_kg,
        "Lote comprado/pagado y disponible para venta o proceso",
        purchaseData.registeredBy,
      ]
    );

    await client.query("COMMIT");
    return lot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const createInitialInventoryLot = async (lotData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO coffee_lots (
        code,
        supplier_id,
        coffee_type_id,
        coffee_profile_id,
        status,
        lot_kind,
        commercial_classification,
        gross_weight_kg,
        tare_weight_kg,
        net_weight_kg,
        available_weight_kg,
        humidity_percent,
        lab_score,
        origin_zone,
        initial_comment,
        purchase_price_per_kg,
        purchase_total,
        purchase_paid,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, 'disponible', $5, $6, $7, 0, $7, $7,
        $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING *
      `,
      [
        lotData.code,
        lotData.supplierId,
        lotData.coffeeTypeId,
        lotData.coffeeProfileId,
        lotData.lotKind,
        lotData.commercialClassification,
        lotData.weightKg,
        lotData.humidityPercent,
        lotData.score,
        lotData.originZone,
        lotData.initialComment,
        lotData.purchasePricePerKg,
        lotData.purchaseTotal,
        lotData.purchasePaid,
        lotData.createdBy,
      ]
    );

    const lot = result.rows[0];

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, 'carga_inicial', $2, $3, $4)
      `,
      [lot.id, lot.available_weight_kg, "Lote creado desde carga inicial de inventario", lotData.createdBy]
    );

    await client.query("COMMIT");
    return lot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
