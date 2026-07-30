import { pool } from "../db.js";
import { getNextCode } from "./codeCounters.model.js";

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

export const getNextLotCode = async (lotKind = "LOT") => {
  const prefixes = {
    LOT: "LOT",
    PASILLA: "PAS",
    RECUPERACION: "REC",
  };

  return getNextCode({
    prefix: prefixes[lotKind] || "LOT",
    tableName: "coffee_lots",
  });
};

export const getNextProcessedLotCode = async () => {
  return getNextCode({
    prefix: "PROC",
    tableName: "coffee_lots",
  });
};

const getLotPayableCategoryId = async (client) => {
  const result = await client.query(
    `
    SELECT id, is_active
    FROM payable_categories
    WHERE name = 'Lote de cafe'
    LIMIT 1
    `
  );

  const category = result.rows[0];

  if (category?.id) {
    if (!category.is_active) {
      await client.query(
        `
        UPDATE payable_categories
        SET is_active = TRUE
        WHERE id = $1
        `,
        [category.id]
      );
    }

    return category.id;
  }

  const insertResult = await client.query(
    `
    INSERT INTO payable_categories (name, is_active)
    VALUES ('Lote de cafe', TRUE)
    ON CONFLICT (name) DO UPDATE
    SET is_active = TRUE
    RETURNING id
    `
  );

  return insertResult.rows[0]?.id || null;
};

const findPayableByLotForUpdate = async (client, lotId) => {
  const result = await client.query(
    `
    SELECT *
    FROM accounts_payable
    WHERE lot_id = $1
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
    `,
    [lotId]
  );

  return result.rows[0] || null;
};

const upsertLotPayableOnLiquidation = async ({ client, lot, purchaseTotal, notes, userId }) => {
  if (!purchaseTotal || Number(purchaseTotal) <= 0) {
    return null;
  }

  const categoryId = await getLotPayableCategoryId(client);

  if (!categoryId) {
    throw new Error("No se pudo preparar la categoria de cuenta por pagar 'Lote de cafe'");
  }

  const existingPayable = await findPayableByLotForUpdate(client, lot.id);
  const amountPaid = Number(existingPayable?.amount_paid || 0);
  const balanceDue = Number((Number(purchaseTotal) - amountPaid).toFixed(2));
  const status = balanceDue <= 0 ? "pagada" : amountPaid > 0 ? "pago_parcial" : "pendiente";
  const description = `Compra de cafe del lote ${lot.code}`;

  if (existingPayable) {
    const result = await client.query(
      `
      UPDATE accounts_payable
      SET
        category_id = $1,
        supplier_id = $2,
        third_party_name = NULL,
        description = $3,
        total = $4,
        balance_due = $5,
        status = $6,
        notes = CASE
          WHEN $7::text IS NULL OR $7::text = '' THEN notes
          WHEN notes IS NULL OR notes = '' THEN $7::text
          ELSE notes || E'\n' || $7::text
        END,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
      [
        categoryId,
        lot.supplier_id || null,
        description,
        purchaseTotal,
        Math.max(balanceDue, 0),
        status,
        notes ? `Liquidacion de lote: ${notes}` : "Cuenta actualizada desde liquidacion de lote",
        existingPayable.id,
      ]
    );

    return result.rows[0];
  }

  const code = await getNextCode({ prefix: "CXP", tableName: "accounts_payable", client });
  const result = await client.query(
    `
    INSERT INTO accounts_payable (
      code,
      category_id,
      supplier_id,
      lot_id,
      status,
      description,
      total,
      amount_paid,
      balance_due,
      notes,
      created_by
    )
    VALUES ($1, $2, $3, $4, 'pendiente', $5, $6, 0, $6, $7, $8)
    RETURNING *
    `,
    [
      code,
      categoryId,
      lot.supplier_id || null,
      lot.id,
      description,
      purchaseTotal,
      notes ? `Cuenta generada al liquidar lote. ${notes}` : "Cuenta generada automaticamente al liquidar lote",
      userId,
    ]
  );

  return result.rows[0];
};

const markLotPayableAsPaid = async ({ client, lot, paymentData }) => {
  let payable = await findPayableByLotForUpdate(client, lot.id);

  if (!payable && Number(lot.purchase_total || 0) > 0) {
    payable = await upsertLotPayableOnLiquidation({
      client,
      lot,
      purchaseTotal: Number(lot.purchase_total),
      notes: "Cuenta creada automaticamente al registrar pago del lote",
      userId: paymentData.registeredBy,
    });
  }

  if (!payable) {
    return null;
  }

  const balanceDue = Number(payable.balance_due || 0);

  if (balanceDue <= 0) {
    return payable;
  }

  await client.query(
    `
    INSERT INTO accounts_payable_payments (
      payable_id,
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
      payable.id,
      balanceDue,
      paymentData.paymentMethodId,
      paymentData.paymentReference,
      paymentData.paidAt,
      `Pago registrado desde el lote ${lot.code}`,
      paymentData.registeredBy,
    ]
  );

  const result = await client.query(
    `
    UPDATE accounts_payable
    SET
      amount_paid = total,
      balance_due = 0,
      status = 'pagada',
      due_date = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [payable.id]
  );

  return result.rows[0];
};

export const listLots = async ({ status, supplierId, coffeeTypeId }) => {
  const params = [];
  const conditions = [];

  if (status) {
    const statuses = String(status)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (statuses.length > 1) {
      params.push(statuses);
      conditions.push(`coffee_lots.status = ANY($${params.length})`);
    } else if (statuses.length === 1) {
      params.push(statuses[0]);
      conditions.push(`coffee_lots.status = $${params.length}`);
    }
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

export const updateLotCode = async ({ id, code }) => {
  const cleanCode = String(code || "").trim();

  const result = await pool.query(
    `
    UPDATE coffee_lots
    SET code = $1, updated_at = NOW()
    WHERE id = $2
      AND NOT EXISTS (
        SELECT 1
        FROM coffee_lots duplicated
        WHERE duplicated.code = $1
          AND duplicated.id <> coffee_lots.id
      )
    RETURNING *
    `,
    [cleanCode, id]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const existingLot = await findLotById(id);
  if (!existingLot) {
    return null;
  }

  const duplicateResult = await pool.query(
    `
    SELECT id
    FROM coffee_lots
    WHERE code = $1
      AND id <> $2
    LIMIT 1
    `,
    [cleanCode, id]
  );

  if (duplicateResult.rows[0]) {
    return { duplicate: true, lot: existingLot };
  }

  return existingLot;
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
        presentation,
        gross_weight_kg,
        packaging_type_id,
        packaging_quantity,
        inner_bag_quantity,
        tare_weight_kg,
        net_weight_kg,
        available_weight_kg,
        humidity_percent,
        performance_factor,
        received_at,
        coffee_variety,
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
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      )
      RETURNING *
      `,
      [
        lotData.code,
        lotData.supplierId,
        lotData.coffeeTypeId,
        lotData.status,
        lotData.presentation || "Pergamino",
        lotData.grossWeightKg,
        lotData.packagingTypeId,
        lotData.packagingQuantity,
        lotData.innerBagQuantity,
        lotData.tareWeightKg,
        lotData.netWeightKg,
        lotData.availableWeightKg,
        lotData.humidityPercent,
        lotData.performanceFactor,
        lotData.receivedAt,
        lotData.coffeeVariety,
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

export const updateLotReceptionData = async (id, lotData) => {
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

    if (!["pendiente_revision_fisica", "pendiente_laboratorio"].includes(currentLot.status)) {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot: currentLot };
    }

    const nextStatus = lotData.humidityPercent === null || lotData.performanceFactor === null
      ? "pendiente_revision_fisica"
      : "pendiente_laboratorio";

    const result = await client.query(
      `
      UPDATE coffee_lots
      SET
        supplier_id = $1,
        coffee_type_id = $2,
        status = $3,
        presentation = $4,
        gross_weight_kg = $5,
        packaging_type_id = $6,
        packaging_quantity = $7,
        inner_bag_quantity = $8,
        tare_weight_kg = $9,
        net_weight_kg = $10,
        available_weight_kg = 0,
        humidity_percent = $11,
        performance_factor = $12,
        received_at = $13,
        coffee_variety = $14,
        commercial_classification = $15,
        origin_zone = $16,
        updated_at = NOW()
      WHERE id = $17
      RETURNING *
      `,
      [
        lotData.supplierId,
        lotData.coffeeTypeId,
        nextStatus,
        lotData.presentation || "Pergamino",
        lotData.grossWeightKg,
        lotData.packagingTypeId,
        lotData.packagingQuantity,
        lotData.innerBagQuantity,
        lotData.tareWeightKg,
        lotData.netWeightKg,
        lotData.humidityPercent,
        lotData.performanceFactor,
        lotData.receivedAt,
        lotData.coffeeVariety,
        lotData.commercialClassification,
        lotData.originZone,
        id,
      ]
    );
    const lot = result.rows[0];

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, 'correccion_recepcion', $2, $3, $4)
      `,
      [lot.id, lot.net_weight_kg, "Correccion administrativa de datos de recepcion", lotData.updatedBy]
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
        status = CASE WHEN $1 = 'aprobado' THEN 'pendiente_liquidacion' ELSE 'rechazado' END,
        available_weight_kg = 0,
        humidity_percent = $2,
        performance_factor = $16,
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
        commercial_classification = $17,
        coffee_variety = $18,
        updated_at = NOW()
      WHERE id = $19
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
        reviewData.performanceFactor,
        reviewData.commercialClassification,
        reviewData.coffeeVariety,
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
        reviewData.status === "aprobado" ? "laboratorio_aprobado" : "laboratorio_rechazado",
        lot.net_weight_kg,
        reviewData.status === "aprobado"
          ? "Lote aprobado por laboratorio; pendiente de liquidacion antes de quedar disponible"
          : "Lote rechazado por laboratorio",
        reviewData.reviewedBy,
      ]
    );

    if (reviewData.classificationChanged) {
      await client.query(
        `
        INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
        VALUES ($1, 'laboratorio_reclasificacion', $2, $3, $4)
        `,
        [
          lot.id,
          lot.net_weight_kg,
          `Reclasificacion de laboratorio: ${currentLot.commercial_classification || "-"} / ${currentLot.coffee_variety || "-"} -> ${lot.commercial_classification || "-"} / ${lot.coffee_variety || "-"}. Nota: ${reviewData.classificationChangeNote}`,
          reviewData.reviewedBy,
        ]
      );
    }

    await client.query("COMMIT");
    return lot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const liquidateLot = async ({ id, purchasePricePerKg, notes, liquidatedBy }) => {
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

    if (currentLot.status !== "pendiente_liquidacion") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot: currentLot };
    }

    const purchaseTotal = purchasePricePerKg !== null
      ? Number((Number(currentLot.net_weight_kg) * Number(purchasePricePerKg)).toFixed(2))
      : null;

    const result = await client.query(
      `
      UPDATE coffee_lots
      SET
        status = 'disponible',
        available_weight_kg = net_weight_kg,
        purchase_price_per_kg = $1,
        purchase_total = $2,
        initial_comment = CASE
          WHEN $3::text IS NULL OR $3::text = '' THEN initial_comment
          WHEN initial_comment IS NULL OR initial_comment = '' THEN 'Liquidacion: ' || $3::text
          ELSE initial_comment || E'\nLiquidacion: ' || $3::text
        END,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [purchasePricePerKg, purchaseTotal, notes || null, id]
    );
    const lot = result.rows[0];

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, 'lote_liquidado', $2, $3, $4)
      `,
      [lot.id, lot.net_weight_kg, notes || "Lote liquidado y disponible para uso", liquidatedBy]
    );

    await upsertLotPayableOnLiquidation({
      client,
      lot,
      purchaseTotal,
      notes,
      userId: liquidatedBy,
    });

    await client.query("COMMIT");
    return lot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateLotPhysicalReview = async (id, reviewData) => {
  const result = await pool.query(
    `
    UPDATE coffee_lots
    SET
      humidity_percent = $1,
      performance_factor = $2,
      status = 'pendiente_laboratorio',
      updated_at = NOW()
    WHERE id = $3
      AND status = 'pendiente_revision_fisica'
    RETURNING *
    `,
    [reviewData.humidityPercent, reviewData.performanceFactor, id]
  );

  return result.rows[0];
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

    const cannotRegisterPurchase =
      !currentLot.lab_reviewed_at ||
      currentLot.purchase_paid ||
      ["pendiente_laboratorio", "pendiente_liquidacion", "rechazado", "retirado"].includes(currentLot.status);

    if (cannotRegisterPurchase) {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot: currentLot };
    }

    const result = await client.query(
      `
      UPDATE coffee_lots
      SET
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
        0,
        "Pago de compra registrado sin modificar la disponibilidad del lote",
        purchaseData.registeredBy,
      ]
    );

    await markLotPayableAsPaid({
      client,
      lot,
      paymentData: purchaseData,
    });

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
        presentation,
        lot_kind,
        commercial_classification,
        gross_weight_kg,
        tare_weight_kg,
        net_weight_kg,
        available_weight_kg,
        humidity_percent,
        lab_score,
        received_at,
        coffee_variety,
        origin_zone,
        initial_comment,
        purchase_price_per_kg,
        purchase_total,
        purchase_paid,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, 'disponible', $5, $6, $7, $8, 0, $8, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      RETURNING *
      `,
      [
        lotData.code,
        lotData.supplierId,
        lotData.coffeeTypeId,
        lotData.coffeeProfileId,
        lotData.presentation || (lotData.lotKind === "PROC" ? "Excelso" : "Pergamino"),
        lotData.lotKind,
        lotData.commercialClassification,
        lotData.weightKg,
        lotData.humidityPercent,
        lotData.score,
        lotData.receivedAt,
        lotData.coffeeVariety,
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
