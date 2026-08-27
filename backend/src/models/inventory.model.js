import { pool } from "../db.js";

export const listAvailableLots = async ({ status, coffeeTypeId, coffeeProfileId }) => {
  const params = [];
  const conditions = ["coffee_lots.available_weight_kg > 0", "coffee_lots.status <> 'retirado'"];

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
      coffee_lots.process_variant,
      coffee_lots.presentation,
      coffee_lots.coffee_type_id,
      coffee_lots.coffee_profile_id,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.status,
      coffee_lots.gross_weight_kg,
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
      coffee_lots.lab_notes,
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
        WHEN coffee_lots.lot_kind = 'PROC' THEN
          CASE
            WHEN coffee_lots.process_variant = 'ensamblado'
              THEN 'Proceso ensamblado - ' || COALESCE(coffee_profiles.name, 'Sin perfil')
            ELSE 'Proceso normal - ' || COALESCE(coffee_profiles.name, 'Sin perfil')
          END
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

export const listInventoryInProcess = async () => {
  const result = await pool.query(
    `
    SELECT
      coffee_process_inputs.id,
      coffee_process_inputs.process_id,
      coffee_process_inputs.lot_id,
      coffee_process_inputs.quantity_kg,
      coffee_process_inputs.created_at,
      coffee_process_inputs.received_at,
      coffee_processes.code AS process_code,
      coffee_processes.status AS process_status,
      coffee_processes.process_type,
      coffee_processes.process_location,
      coffee_processes.estimated_return_date,
      sales.code AS sale_code,
      clients.name AS client_name,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.presentation,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.humidity_percent,
      coffee_lots.performance_factor,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM coffee_process_inputs
    INNER JOIN coffee_processes ON coffee_processes.id = coffee_process_inputs.process_id
    INNER JOIN coffee_lots ON coffee_lots.id = coffee_process_inputs.lot_id
    LEFT JOIN sales ON sales.id = coffee_processes.sale_id
    LEFT JOIN clients ON clients.id = sales.client_id
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE coffee_processes.status IN ('en_proceso', 'pendiente_revision_fisica', 'pendiente_laboratorio')
      AND coffee_process_inputs.received_at IS NULL
    ORDER BY coffee_processes.updated_at DESC, coffee_process_inputs.created_at ASC
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

export const listFarmShipments = async () => {
  const result = await pool.query(
    `
    SELECT
      'farm_shipment' AS source_type,
      farm_shipments.*,
      shipped_user.name AS shipped_by_name,
      received_user.name AS received_by_name
    FROM farm_shipments
    LEFT JOIN users shipped_user ON shipped_user.id = farm_shipments.shipped_by
    LEFT JOIN users received_user ON received_user.id = farm_shipments.received_by
    ORDER BY farm_shipments.shipped_at DESC, farm_shipments.id DESC
    `
  );

  return result.rows;
};

export const listFarmProcessInputShipments = async () => {
  const result = await pool.query(
    `
    SELECT
      'process_input' AS source_type,
      coffee_process_inputs.id,
      coffee_process_inputs.lot_id,
      coffee_process_inputs.quantity_kg,
      coffee_process_inputs.created_at,
      coffee_process_inputs.created_at AS shipped_at,
      coffee_process_inputs.received_at,
      coffee_processes.code AS process_code,
      coffee_processes.status AS process_status,
      coffee_processes.process_type,
      coffee_processes.process_location,
      coffee_processes.estimated_return_date,
      coffee_lots.code AS lot_code,
      coffee_lots.lot_kind,
      coffee_lots.presentation,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.humidity_percent,
      coffee_lots.performance_factor,
      coffee_lots.lab_aroma,
      coffee_lots.lab_flavor,
      coffee_lots.lab_sweetness,
      coffee_lots.lab_body,
      coffee_lots.lab_residual,
      coffee_lots.lab_clean_cup,
      coffee_lots.lab_score,
      coffee_lots.lab_notes,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      received_user.name AS received_by_name
    FROM coffee_process_inputs
    INNER JOIN coffee_processes ON coffee_processes.id = coffee_process_inputs.process_id
    INNER JOIN coffee_lots ON coffee_lots.id = coffee_process_inputs.lot_id
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN users received_user ON received_user.id = coffee_process_inputs.received_by
    WHERE COALESCE(coffee_processes.process_type, '') NOT IN ('Trilladora', 'Seleccionadora', 'Seleccion electronica')
    ORDER BY coffee_process_inputs.created_at DESC, coffee_process_inputs.id DESC
    `
  );

  return result.rows;
};

export const sendLotToFarm = async ({ lotId, quantityKg, userId }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lotResult = await client.query(
      `
      SELECT
        coffee_lots.*,
        suppliers.name AS supplier_name,
        coffee_types.name AS coffee_type_name,
        coffee_profiles.name AS coffee_profile_name
      FROM coffee_lots
      LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
      LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
      LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
      WHERE coffee_lots.id = $1
      FOR UPDATE OF coffee_lots
      `,
      [lotId]
    );
    const lot = lotResult.rows[0];

    if (!lot) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!["disponible", "vendido_parcial"].includes(lot.status)) {
      await client.query("ROLLBACK");
      return { invalidStatus: true, lot };
    }

    const currentAvailable = Number(lot.available_weight_kg || 0);
    let shipmentQuantityKg = Number(quantityKg || 0);
    const roundingToleranceKg = 0.5;

    if (shipmentQuantityKg > currentAvailable && shipmentQuantityKg - currentAvailable <= roundingToleranceKg) {
      shipmentQuantityKg = currentAvailable;
    }

    if (shipmentQuantityKg > currentAvailable) {
      await client.query("ROLLBACK");
      return { negativeInventory: true, lot };
    }

    const newAvailable = Number((currentAvailable - shipmentQuantityKg).toFixed(3));
    const newStatus = newAvailable === 0 ? "agotado" : lot.status === "vendido_parcial" ? "vendido_parcial" : "disponible";

    const shipmentResult = await client.query(
      `
      INSERT INTO farm_shipments (
        lot_id,
        lot_code,
        supplier_name,
        presentation,
        lot_kind,
        commercial_classification,
        coffee_type_name,
        coffee_profile_name,
        coffee_variety,
        quantity_kg,
        humidity_percent,
        performance_factor,
        lab_aroma,
        lab_flavor,
        lab_sweetness,
        lab_body,
        lab_residual,
        lab_clean_cup,
        lab_score,
        lab_notes,
        shipped_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *
      `,
      [
        lot.id,
        lot.code || `LOT-${lot.id}`,
        lot.supplier_name,
        lot.presentation,
        lot.lot_kind,
        lot.commercial_classification,
        lot.coffee_type_name,
        lot.coffee_profile_name,
        lot.coffee_variety,
        shipmentQuantityKg,
        lot.humidity_percent,
        lot.performance_factor,
        lot.lab_aroma,
        lot.lab_flavor,
        lot.lab_sweetness,
        lot.lab_body,
        lot.lab_residual,
        lot.lab_clean_cup,
        lot.lab_score,
        lot.lab_notes,
        userId,
      ]
    );

    await client.query(
      `
      UPDATE coffee_lots
      SET available_weight_kg = $1, status = $2, updated_at = NOW()
      WHERE id = $3
      `,
      [newAvailable, newStatus, lot.id]
    );

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, 'envio_finca', $2, $3, $4)
      `,
      [lot.id, shipmentQuantityKg, `Cafe enviado a finca para regresar como proceso`, userId]
    );

    await client.query("COMMIT");
    return shipmentResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const markFarmShipmentAsReceived = async ({ shipmentId, userId }) => {
  const result = await pool.query(
    `
    UPDATE farm_shipments
    SET received_at = NOW(), received_by = $2
    WHERE id = $1 AND received_at IS NULL
    RETURNING *
    `,
    [shipmentId, userId]
  );

  return result.rows[0] || null;
};

export const markFarmProcessInputAsReceived = async ({ inputId, userId }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inputResult = await client.query(
      `
      UPDATE coffee_process_inputs
      SET received_at = NOW(), received_by = $2
      WHERE id = $1 AND received_at IS NULL
      RETURNING *
      `,
      [inputId, userId]
    );
    const input = inputResult.rows[0];

    if (!input) {
      await client.query("ROLLBACK");
      return null;
    }

    const pendingResult = await client.query(
      `
      SELECT COUNT(*)::int AS pending_count
      FROM coffee_process_inputs
      WHERE process_id = $1 AND received_at IS NULL
      `,
      [input.process_id]
    );

    if (Number(pendingResult.rows[0]?.pending_count || 0) === 0) {
      await client.query(
        `
        UPDATE coffee_processes
        SET status = 'finalizado', finalized_by = $2, finalized_at = COALESCE(finalized_at, NOW()), updated_at = NOW()
        WHERE id = $1
        `,
        [input.process_id, userId]
      );
    }

    await client.query("COMMIT");
    return input;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
