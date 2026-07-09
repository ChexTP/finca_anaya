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
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.status,
      coffee_lots.net_weight_kg,
      coffee_lots.available_weight_kg,
      coffee_lots.humidity_percent,
      coffee_lots.performance_factor,
      coffee_lots.received_at,
      coffee_lots.lab_score,
      coffee_lots.created_at,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name
    FROM coffee_lots
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE ${conditions.join(" AND ")}
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
        ELSE 'type'
      END AS group_type,
      CASE
        WHEN coffee_lots.lot_kind = 'PROC' THEN coffee_lots.coffee_profile_id
        ELSE coffee_lots.coffee_type_id
      END AS group_id,
      CASE
        WHEN coffee_lots.lot_kind = 'PROC' THEN COALESCE(coffee_profiles.name, 'Sin perfil')
        ELSE COALESCE(coffee_types.name, 'Sin tipo')
      END AS group_name,
      COUNT(*) AS lots_count,
      SUM(coffee_lots.available_weight_kg) AS available_weight_kg,
      MIN(coffee_lots.created_at) AS oldest_lot_date
    FROM coffee_lots
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
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

export const adjustLotInventory = async ({ lotId, adjustmentType, quantityKg, reason, userId }) => {
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
    const movementType = adjustmentType === "increase" ? "ajuste_aumento" : "ajuste_disminucion";

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [lotId, movementType, quantityKg, reason, userId]
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
