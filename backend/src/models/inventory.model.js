import { pool } from "../db.js";

export const listAvailableLots = async ({ status, coffeeTypeId, coffeeProfileId }) => {
  const params = [];
  const conditions = ["coffee_lots.available_weight_kg > 0"];

  if (status) {
    params.push(status);
    conditions.push(`coffee_lots.status = $${params.length}`);
  } else {
    conditions.push("coffee_lots.status IN ('disponible', 'vendido_parcial')");
  }

  if (coffeeTypeId) {
    params.push(coffeeTypeId);
    conditions.push(`coffee_lots.coffee_type_id = $${params.length}`);
  }

  if (coffeeProfileId) {
    params.push(coffeeProfileId);
    conditions.push(`coffee_lots.coffee_profile_id = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      coffee_lots.id,
      coffee_lots.code,
      coffee_lots.lot_kind,
      coffee_lots.presentation,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.status,
      coffee_lots.net_weight_kg,
      coffee_lots.available_weight_kg,
      COALESCE(SUM(sale_item_lots.quantity_kg) FILTER (
        WHERE sale_item_lots.deducted_at IS NULL
          AND sales.status NOT IN ('despachada', 'anulada')
      ), 0) AS reserved_kg,
      GREATEST(
        coffee_lots.available_weight_kg - COALESCE(SUM(sale_item_lots.quantity_kg) FILTER (
          WHERE sale_item_lots.deducted_at IS NULL
            AND sales.status NOT IN ('despachada', 'anulada')
        ), 0),
        0
      ) AS operational_available_kg,
      coffee_lots.humidity_percent,
      coffee_lots.performance_factor,
      coffee_lots.received_at,
      coffee_lots.lab_score,
      coffee_lots.created_at,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      origin_process.code AS origin_process_code,
      origin_process.process_type AS origin_process_type,
      origin_process.process_location AS origin_process_location
    FROM coffee_lots
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN coffee_process_outputs origin_output ON origin_output.output_lot_id = coffee_lots.id
    LEFT JOIN coffee_processes origin_process ON origin_process.id = origin_output.process_id OR origin_process.output_lot_id = coffee_lots.id
    LEFT JOIN sale_item_lots ON sale_item_lots.lot_id = coffee_lots.id
    LEFT JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
    LEFT JOIN sales ON sales.id = sale_items.sale_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY coffee_lots.id, suppliers.name, coffee_types.name, coffee_profiles.name, origin_process.code, origin_process.process_type, origin_process.process_location
    ORDER BY coffee_lots.created_at ASC
    `,
    params
  );

  return result.rows;
};

export const getGroupedInventory = async () => {
  const result = await pool.query(
    `
    SELECT
      CASE
        WHEN coffee_lots.lot_kind = 'PROC' THEN 'profile'
        ELSE 'presentation_type'
      END AS group_type,
      CASE
        WHEN coffee_lots.lot_kind = 'PROC' THEN coffee_lots.coffee_profile_id
        ELSE coffee_lots.coffee_type_id
      END AS group_id,
      CASE
        WHEN coffee_lots.lot_kind = 'PROC' THEN COALESCE(coffee_profiles.name, 'Sin perfil')
        ELSE coffee_lots.presentation || ' - ' || COALESCE(coffee_types.name, 'Sin tipo')
      END AS group_name,
      COUNT(*) AS lots_count,
      SUM(coffee_lots.available_weight_kg) AS available_weight_kg,
      COALESCE(SUM(reservations.reserved_kg), 0) AS reserved_kg,
      GREATEST(SUM(coffee_lots.available_weight_kg) - COALESCE(SUM(reservations.reserved_kg), 0), 0) AS operational_available_kg,
      MIN(coffee_lots.created_at) AS oldest_lot_date
    FROM coffee_lots
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN (
      SELECT
        sale_item_lots.lot_id,
        SUM(sale_item_lots.quantity_kg) AS reserved_kg
      FROM sale_item_lots
      INNER JOIN sale_items ON sale_items.id = sale_item_lots.sale_item_id
      INNER JOIN sales ON sales.id = sale_items.sale_id
      WHERE sale_item_lots.deducted_at IS NULL
        AND sales.status NOT IN ('despachada', 'anulada')
      GROUP BY sale_item_lots.lot_id
    ) reservations ON reservations.lot_id = coffee_lots.id
    WHERE coffee_lots.status IN ('disponible', 'vendido_parcial')
      AND coffee_lots.available_weight_kg > 0
    GROUP BY group_type, group_id, group_name
    ORDER BY group_type ASC, group_name ASC
    `
  );

  return result.rows;
};

export const listLotMovements = async (lotId) => {
  const result = await pool.query(
    `
    SELECT
      inventory_movements.*,
      users.name AS created_by_name
    FROM inventory_movements
    LEFT JOIN users ON users.id = inventory_movements.created_by
    WHERE inventory_movements.lot_id = $1
    ORDER BY inventory_movements.created_at ASC
    `,
    [lotId]
  );

  return result.rows;
};

export const listSampleInventoryOutputs = async () => {
  const result = await pool.query(
    `
    SELECT
      inventory_movements.*,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.presentation,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.status AS lot_status,
      coffee_lots.available_weight_kg,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      users.name AS created_by_name
    FROM inventory_movements
    INNER JOIN coffee_lots ON coffee_lots.id = inventory_movements.lot_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN users ON users.id = inventory_movements.created_by
    WHERE inventory_movements.movement_type = 'salida_muestra'
    ORDER BY inventory_movements.created_at DESC
    `
  );

  return result.rows;
};

export const adjustLotInventory = async ({ lotId, adjustmentType, quantityKg, reason, userId }) => {
  return updateLotInventoryByMovement({
    lotId,
    quantityKg,
    notes: reason,
    userId,
    adjustmentType,
    movementType: adjustmentType === "increase" ? "ajuste_aumento" : "ajuste_disminucion",
  });
};

export const registerSampleInventoryOutput = async ({ lotId, quantityKg, sampleReference, notes, userId }) => {
  const reason = [
    sampleReference ? `Muestras: ${sampleReference}` : "Salida a muestras",
    notes,
  ].filter(Boolean).join(" - ");

  return updateLotInventoryByMovement({
    lotId,
    quantityKg,
    notes: reason,
    userId,
    adjustmentType: "decrease",
    movementType: "salida_muestra",
  });
};

const updateLotInventoryByMovement = async ({ lotId, adjustmentType, quantityKg, notes, userId, movementType }) => {
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
      [lotId]
    );
    const currentLot = currentResult.rows[0];

    if (!currentLot) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!["disponible", "vendido_parcial", "agotado"].includes(currentLot.status)) {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot: currentLot };
    }

    const currentAvailable = Number(currentLot.available_weight_kg);
    const signedQuantity = adjustmentType === "increase" ? quantityKg : -quantityKg;
    const newAvailable = Number((currentAvailable + signedQuantity).toFixed(3));

    if (newAvailable < 0) {
      await client.query("ROLLBACK");
      return { negativeInventory: true, lot: currentLot };
    }

    // Si el ajuste deja el lote en cero, queda agotado; si vuelve a tener cantidad, queda disponible.
    const newStatus = newAvailable === 0 ? "agotado" : "disponible";

    const result = await client.query(
      `
      UPDATE coffee_lots
      SET
        available_weight_kg = $1,
        status = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [newAvailable, newStatus, lotId]
    );

    const lot = result.rows[0];
    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [lotId, movementType, quantityKg, notes, userId]
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
