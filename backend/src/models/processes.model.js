import { pool } from "../db.js";
import { getNextCode, reserveNextCodes } from "./codeCounters.model.js";

const directInventoryProcessTypes = ["Trilladora", "Seleccion electronica"];

export const getNextProcessCode = async () => {
  return getNextCode({ prefix: "PRO", tableName: "coffee_processes" });
};

export const listProcesses = async ({ status, processType }) => {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`coffee_processes.status = $${params.length}`);
  }

  if (processType) {
    params.push(processType);
    conditions.push(`coffee_processes.process_type = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      coffee_processes.*,
      quotes.code AS quote_code,
      quotes.estimated_delivery_date AS quote_estimated_delivery_date,
      clients.name AS quote_client_name,
      sales.code AS sale_code,
      sales.estimated_delivery_date AS sale_estimated_delivery_date,
      sale_clients.name AS sale_client_name,
      output_lot.code AS output_lot_code,
      output_profile.name AS output_lot_profile_name,
      users.name AS created_by_name,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'lot_id', coffee_process_inputs.lot_id,
              'lot_code', coffee_lots.code,
              'quantity_kg', coffee_process_inputs.quantity_kg,
              'input_percentage',
                CASE
                  WHEN coffee_processes.total_input_kg > 0
                  THEN ROUND((coffee_process_inputs.quantity_kg / coffee_processes.total_input_kg * 100)::numeric, 2)
                  ELSE 0
              END,
              'coffee_type_name', coffee_types.name,
              'coffee_profile_name', coffee_profiles.name,
              'supplier_name', suppliers.name,
              'commercial_classification', coffee_lots.commercial_classification
            )
            ORDER BY coffee_process_inputs.created_at ASC
          )
          FROM coffee_process_inputs
          INNER JOIN coffee_lots ON coffee_lots.id = coffee_process_inputs.lot_id
          LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
          LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
          LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
          WHERE coffee_process_inputs.process_id = coffee_processes.id
        ),
        '[]'::json
      ) AS inputs
      ,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', coffee_process_outputs.id,
              'coffee_profile_id', coffee_process_outputs.coffee_profile_id,
              'coffee_profile_name', coffee_profiles.name,
              'coffee_profile_code', coffee_profiles.internal_code,
              'presentation', coffee_process_outputs.presentation,
              'output_lot_id', coffee_process_outputs.output_lot_id,
              'output_lot_code', output_lots.code,
              'output_weight_kg', coffee_process_outputs.output_weight_kg,
              'humidity_percent', coffee_process_outputs.humidity_percent,
              'performance_factor', coffee_process_outputs.performance_factor,
              'notes', coffee_process_outputs.notes
            )
            ORDER BY coffee_process_outputs.id ASC
          )
          FROM coffee_process_outputs
          INNER JOIN coffee_profiles ON coffee_profiles.id = coffee_process_outputs.coffee_profile_id
          LEFT JOIN coffee_lots output_lots ON output_lots.id = coffee_process_outputs.output_lot_id
          WHERE coffee_process_outputs.process_id = coffee_processes.id
        ),
        '[]'::json
      ) AS outputs
    FROM coffee_processes
    LEFT JOIN quotes ON quotes.id = coffee_processes.quote_id
    LEFT JOIN clients ON clients.id = quotes.client_id
    LEFT JOIN sales ON sales.id = coffee_processes.sale_id
    LEFT JOIN clients sale_clients ON sale_clients.id = sales.client_id
    LEFT JOIN coffee_lots output_lot ON output_lot.id = coffee_processes.output_lot_id
    LEFT JOIN coffee_profiles output_profile ON output_profile.id = output_lot.coffee_profile_id
    LEFT JOIN users ON users.id = coffee_processes.created_by
    ${where}
    ORDER BY
      COALESCE(sales.estimated_delivery_date, quotes.estimated_delivery_date, DATE '9999-12-31') ASC,
      coffee_processes.created_at DESC
    `,
    params
  );

  return result.rows;
};

export const findProcessById = async (id) => {
  const processResult = await pool.query(
    `
    SELECT
      coffee_processes.*,
      quotes.code AS quote_code,
      quotes.estimated_delivery_date AS quote_estimated_delivery_date,
      clients.name AS quote_client_name,
      sales.code AS sale_code,
      sales.estimated_delivery_date AS sale_estimated_delivery_date,
      sale_clients.name AS sale_client_name,
      output_lot.code AS output_lot_code,
      output_profile.name AS output_lot_profile_name,
      users.name AS created_by_name
    FROM coffee_processes
    LEFT JOIN quotes ON quotes.id = coffee_processes.quote_id
    LEFT JOIN clients ON clients.id = quotes.client_id
    LEFT JOIN sales ON sales.id = coffee_processes.sale_id
    LEFT JOIN clients sale_clients ON sale_clients.id = sales.client_id
    LEFT JOIN coffee_lots output_lot ON output_lot.id = coffee_processes.output_lot_id
    LEFT JOIN coffee_profiles output_profile ON output_profile.id = output_lot.coffee_profile_id
    LEFT JOIN users ON users.id = coffee_processes.created_by
    WHERE coffee_processes.id = $1
    LIMIT 1
    `,
    [id]
  );
  const process = processResult.rows[0];

  if (!process) {
    return null;
  }

  const inputsResult = await pool.query(
    `
    SELECT
      coffee_process_inputs.*,
      coffee_lots.code AS lot_code,
      coffee_lots.available_weight_kg AS current_available_weight_kg,
      coffee_lots.commercial_classification,
      suppliers.name AS supplier_name,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      CASE
        WHEN coffee_processes.total_input_kg > 0
        THEN ROUND((coffee_process_inputs.quantity_kg / coffee_processes.total_input_kg * 100)::numeric, 2)
        ELSE 0
      END AS input_percentage
    FROM coffee_process_inputs
    INNER JOIN coffee_processes ON coffee_processes.id = coffee_process_inputs.process_id
    INNER JOIN coffee_lots ON coffee_lots.id = coffee_process_inputs.lot_id
    LEFT JOIN suppliers ON suppliers.id = coffee_lots.supplier_id
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    WHERE coffee_process_inputs.process_id = $1
    ORDER BY coffee_process_inputs.created_at ASC
    `,
    [id]
  );

  const outputsResult = await pool.query(
    `
    SELECT
      coffee_process_outputs.*,
      coffee_profiles.name AS coffee_profile_name,
      coffee_profiles.internal_code AS coffee_profile_code,
      output_lots.code AS output_lot_code
    FROM coffee_process_outputs
    INNER JOIN coffee_profiles ON coffee_profiles.id = coffee_process_outputs.coffee_profile_id
    LEFT JOIN coffee_lots output_lots ON output_lots.id = coffee_process_outputs.output_lot_id
    WHERE coffee_process_outputs.process_id = $1
    ORDER BY coffee_process_outputs.id ASC
    `,
    [id]
  );

  return {
    ...process,
    inputs: inputsResult.rows,
    outputs: outputsResult.rows,
  };
};

export const updateProcessAdminData = async (id, processData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `
      SELECT *
      FROM coffee_processes
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );
    const currentProcess = currentResult.rows[0];

    if (!currentProcess) {
      await client.query("ROLLBACK");
      return null;
    }

    const codeResult = await client.query(
      `
      SELECT id
      FROM coffee_processes
      WHERE code = $1
        AND id <> $2
      LIMIT 1
      `,
      [processData.code, id]
    );

    if (codeResult.rows[0]) {
      await client.query("ROLLBACK");
      return { duplicate: true, process: currentProcess };
    }

    const noteParts = [
      currentProcess.notes || "",
      `[Correccion administrativa ${new Date().toISOString().slice(0, 10)}] ${processData.changeNote}`,
    ].filter(Boolean);

    const result = await client.query(
      `
      UPDATE coffee_processes
      SET
        code = $1,
        status = $2,
        process_type = $3,
        process_location = $4,
        estimated_return_date = $5,
        total_input_kg = $6,
        output_weight_kg = $7,
        physical_humidity_percent = $8,
        physical_performance_factor = $9,
        notes = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
      `,
      [
        processData.code,
        processData.status,
        processData.processType,
        processData.processLocation,
        processData.estimatedReturnDate,
        processData.totalInputKg,
        processData.outputWeightKg,
        processData.physicalHumidityPercent,
        processData.physicalPerformanceFactor,
        noteParts.join("\n"),
        id,
      ]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const createProcess = async ({ code, quoteId, saleId, processType, processLocation, notes, inputs, createdBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const totalInputKg = inputs.reduce((total, input) => total + input.quantityKg, 0);

    const processResult = await client.query(
      `
      INSERT INTO coffee_processes (code, quote_id, sale_id, process_type, process_location, notes, total_input_kg, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [code, quoteId || null, saleId || null, processType || "Otro proceso", processLocation || null, notes || null, totalInputKg, createdBy]
    );
    const process = processResult.rows[0];

    for (const input of inputs) {
      const lotResult = await client.query(
        `
        SELECT id, code, status, available_weight_kg
        FROM coffee_lots
        WHERE id = $1
        LIMIT 1
        `,
        [input.lotId]
      );
      const lot = lotResult.rows[0];

      if (!lot) {
        throw new Error(`No existe el lote ${input.lotId}`);
      }

      if (!["disponible", "vendido_parcial"].includes(lot.status)) {
        throw new Error(`El lote ${lot.code || lot.id} no esta disponible para proceso`);
      }

      if (Number(lot.available_weight_kg) < input.quantityKg) {
        throw new Error(`El lote ${lot.code || lot.id} no tiene cantidad suficiente`);
      }

      await client.query(
        `
        INSERT INTO coffee_process_inputs (process_id, lot_id, quantity_kg)
        VALUES ($1, $2, $3)
        `,
        [process.id, input.lotId, input.quantityKg]
      );

    }

    if (saleId) {
      await client.query(
        `
        UPDATE sales
        SET status = 'proceso_solicitado', updated_at = NOW()
        WHERE id = $1
          AND status <> 'anulada'
        `,
        [saleId]
      );
    }

    await client.query("COMMIT");
    return process;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const startProcess = async ({ processId, processType, processLocation, estimatedReturnDate, notes, startedBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const processResult = await client.query(
      `
      SELECT *
      FROM coffee_processes
      WHERE id = $1
      FOR UPDATE
      `,
      [processId]
    );
    const process = processResult.rows[0];

    if (!process) {
      await client.query("ROLLBACK");
      return null;
    }

    if (process.status !== "pendiente") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, process };
    }

    const inputsResult = await client.query(
      `
      SELECT *
      FROM coffee_process_inputs
      WHERE process_id = $1
      ORDER BY id ASC
      `,
      [processId]
    );

    for (const input of inputsResult.rows) {
      const lotResult = await client.query(
        `
        SELECT *
        FROM coffee_lots
        WHERE id = $1
        FOR UPDATE
        `,
        [input.lot_id]
      );
      const lot = lotResult.rows[0];

      if (!lot || !["disponible", "vendido_parcial"].includes(lot.status)) {
        throw new Error(`El lote ${lot?.code || input.lot_id} no esta disponible para iniciar proceso`);
      }

      const currentAvailable = Number(lot.available_weight_kg);
      const quantity = Number(input.quantity_kg);

      if (currentAvailable < quantity) {
        throw new Error(`El lote ${lot.code || lot.id} no tiene cantidad suficiente`);
      }

      const newAvailable = Number((currentAvailable - quantity).toFixed(3));
      const newStatus = newAvailable === 0 ? "en_proceso" : "vendido_parcial";

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
        VALUES ($1, 'proceso_salida', $2, $3, $4)
        `,
        [
          lot.id,
          quantity,
          `Cafe enviado a ${processType || process.process_type || "proceso"} en ${process.code}`,
          startedBy,
        ]
      );
    }

    const updateResult = await client.query(
      `
      UPDATE coffee_processes
      SET
        status = 'en_proceso',
        process_type = COALESCE($1, process_type),
        process_location = COALESCE($2, process_location),
        estimated_return_date = $3,
        notes = COALESCE($4, notes),
        started_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [processType || null, processLocation || null, estimatedReturnDate || null, notes || null, processId]
    );

    if (process.sale_id) {
      await client.query(
        `
        UPDATE sales
        SET status = 'en_proceso', updated_at = NOW()
        WHERE id = $1
          AND status <> 'anulada'
        `,
        [process.sale_id]
      );
    }

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const markProcessPendingLaboratory = async ({ processId, notes }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const processResult = await client.query(
      `
      SELECT *
      FROM coffee_processes
      WHERE id = $1
      FOR UPDATE
      `,
      [processId]
    );
    const process = processResult.rows[0];

    if (!process) {
      await client.query("ROLLBACK");
      return null;
    }

    if (process.status !== "en_proceso") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, process };
    }

    const updateResult = await client.query(
      `
      UPDATE coffee_processes
      SET
        status = 'pendiente_revision_fisica',
        notes = COALESCE($1, notes),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [notes || null, processId]
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

export const completeProcessPhysicalReview = async ({
  processId,
  outputWeightKg,
  humidityPercent,
  performanceFactor,
  outputs = [],
  reviewedBy,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const processResult = await client.query(
      `
      SELECT *
      FROM coffee_processes
      WHERE id = $1
      FOR UPDATE
      `,
      [processId]
    );
    const process = processResult.rows[0];

    if (!process || process.status !== "pendiente_revision_fisica") {
      await client.query("ROLLBACK");
      return null;
    }

    const cleanOutputs = outputs.length
      ? outputs
      : [{
          coffeeProfileId: null,
          presentation: "Excelso",
          outputWeightKg,
          humidityPercent,
          performanceFactor,
          notes: null,
        }];

    const totalOutputKg = cleanOutputs.reduce((total, output) => total + Number(output.outputWeightKg || 0), 0);
    const createsInventoryDirectly = directInventoryProcessTypes.includes(process.process_type);

    if (totalOutputKg <= 0 || totalOutputKg > Number(process.total_input_kg)) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("DELETE FROM coffee_process_outputs WHERE process_id = $1", [processId]);
    const savedOutputs = [];

    for (const output of cleanOutputs) {
      if (!output.coffeeProfileId) {
        throw new Error("Cada salida del proceso debe tener perfil comercial");
      }

      const profileResult = await client.query(
        "SELECT id, is_active FROM coffee_profiles WHERE id = $1 LIMIT 1",
        [output.coffeeProfileId]
      );
      const profile = profileResult.rows[0];

      if (!profile || !profile.is_active) {
        throw new Error("Perfil comercial de salida no encontrado o inactivo");
      }

      const insertedOutput = await client.query(
        `
        INSERT INTO coffee_process_outputs (
          process_id,
          coffee_profile_id,
          presentation,
          output_weight_kg,
          humidity_percent,
          performance_factor,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          processId,
          output.coffeeProfileId,
          output.presentation || "Excelso",
          output.outputWeightKg,
          output.humidityPercent,
          output.performanceFactor,
          output.notes || null,
        ]
      );
      savedOutputs.push(insertedOutput.rows[0]);
    }

    if (createsInventoryDirectly) {
      const outputCodes = await reserveNextCodes({
        prefix: "PROC",
        tableName: "coffee_lots",
        count: savedOutputs.length,
        client,
      });
      const createdLots = [];

      for (const [index, output] of savedOutputs.entries()) {
        const code = outputCodes[index];
        const outputResult = await client.query(
          `
          INSERT INTO coffee_lots (
            code,
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
            performance_factor,
            initial_comment,
            created_by
          )
          VALUES ($1, $2, 'disponible', $3, 'PROC', 'Procesado', $4, 0, $4, $4, NULL, NULL, $5, $6)
          RETURNING *
          `,
          [
            code,
            output.coffee_profile_id,
            output.presentation || "Excelso",
            output.output_weight_kg,
            [
              `Lote generado por ${process.process_type} ${process.code}`,
              output.notes,
            ].filter(Boolean).join("\n"),
            reviewedBy,
          ]
        );
        const newLot = outputResult.rows[0];
        createdLots.push(newLot);

        await client.query(
          `
          UPDATE coffee_process_outputs
          SET output_lot_id = $1, updated_at = NOW()
          WHERE id = $2
          `,
          [newLot.id, output.id]
        );

        await client.query(
          `
          INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
          VALUES ($1, 'proceso_entrada', $2, $3, $4)
          `,
          [newLot.id, output.output_weight_kg, `Lote generado por ${process.process_type} ${process.code}`, reviewedBy]
        );
      }

      const firstLot = createdLots[0];

      await client.query(
        `
        UPDATE coffee_processes
        SET
          status = 'finalizado',
          output_lot_id = $1,
          output_weight_kg = $2,
          physical_humidity_percent = NULL,
          physical_performance_factor = NULL,
          physical_reviewed_by = $3,
          physical_reviewed_at = NOW(),
          finalized_by = $3,
          finalized_at = NOW(),
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [firstLot.id, Number(totalOutputKg.toFixed(3)), reviewedBy, processId]
      );

      await client.query(
        `
        UPDATE coffee_lots
        SET status = 'agotado', updated_at = NOW()
        WHERE id IN (
          SELECT lot_id
          FROM coffee_process_inputs
          WHERE process_id = $1
        )
        AND available_weight_kg = 0
        `,
        [processId]
      );

      await client.query("COMMIT");
      return createdLots.length === 1 ? createdLots[0] : createdLots;
    }

    const weightedHumidity = cleanOutputs.reduce(
      (total, output) => total + Number(output.humidityPercent || 0) * Number(output.outputWeightKg || 0),
      0
    ) / totalOutputKg;
    const hasPerformanceFactor = cleanOutputs.some((output) => output.performanceFactor !== null && output.performanceFactor !== undefined);
    const weightedPerformance = hasPerformanceFactor
      ? cleanOutputs.reduce(
          (total, output) => total + Number(output.performanceFactor || 0) * Number(output.outputWeightKg || 0),
          0
        ) / totalOutputKg
      : null;

    const updateResult = await client.query(
      `
      UPDATE coffee_processes
      SET
        status = 'pendiente_laboratorio',
        output_weight_kg = $1,
        physical_humidity_percent = $2,
        physical_performance_factor = $3,
        physical_reviewed_by = $4,
        physical_reviewed_at = NOW(),
        lab_pending_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [
        Number(totalOutputKg.toFixed(3)),
        Number(weightedHumidity.toFixed(2)),
        weightedPerformance === null ? null : Number(weightedPerformance.toFixed(2)),
        reviewedBy,
        processId,
      ]
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

export const finishProcess = async ({ processId, outputLot, finalizedBy }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const processResult = await client.query(
      `
      SELECT *
      FROM coffee_processes
      WHERE id = $1
      FOR UPDATE
      `,
      [processId]
    );
    const process = processResult.rows[0];

    if (!process) {
      await client.query("ROLLBACK");
      return null;
    }

    if (process.status !== "pendiente_laboratorio") {
      await client.query("ROLLBACK");
      return { invalidStatus: true, process };
    }

    if (
      !process.output_weight_kg ||
      process.physical_humidity_percent === null ||
      (process.process_type !== "Trilladora" && process.physical_performance_factor === null)
    ) {
      await client.query("ROLLBACK");
      return { missingPhysicalReview: true, process };
    }

    const outputsResult = await client.query(
      `
      SELECT
        coffee_process_outputs.*,
        coffee_profiles.name AS coffee_profile_name,
        coffee_profiles.internal_code AS coffee_profile_code
      FROM coffee_process_outputs
      INNER JOIN coffee_profiles ON coffee_profiles.id = coffee_process_outputs.coffee_profile_id
      WHERE coffee_process_outputs.process_id = $1
      ORDER BY coffee_process_outputs.id ASC
      `,
      [processId]
    );

    const outputs = outputsResult.rows.length
      ? outputsResult.rows
      : [{
          id: null,
          coffee_profile_id: outputLot.coffeeProfileId,
          output_weight_kg: process.output_weight_kg,
          humidity_percent: process.physical_humidity_percent,
          performance_factor: process.physical_performance_factor,
          notes: outputLot.initialComment,
        }];
    const reviewsByOutputId = (outputLot.outputReviews || []).reduce((reviews, review) => {
      reviews[Number(review.processOutputId)] = review;
      return reviews;
    }, {});

    const outputCodes = await reserveNextCodes({
      prefix: "PROC",
      tableName: "coffee_lots",
      count: outputs.length,
      client,
    });
    const createdLots = [];

    for (const [index, output] of outputs.entries()) {
      const code = outputCodes[index];
      const outputReview = output.id ? reviewsByOutputId[Number(output.id)] : outputLot;
      const outputInitialComment = [
        outputReview?.initialComment,
        output.notes,
      ].filter(Boolean).join("\n");

      const outputResult = await client.query(
      `
      INSERT INTO coffee_lots (
        code,
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
        lab_aroma,
        lab_fragrance,
        lab_flavor,
        lab_acidity,
        lab_sweetness,
        lab_body,
        lab_balance,
        lab_uniformity,
        lab_residual,
        lab_clean_cup,
        lab_score,
        lab_notes,
        lab_reviewed_by,
        lab_reviewed_at,
        performance_factor,
        initial_comment,
        created_by
      )
      VALUES (
        $1, $2, 'disponible', $3, 'PROC', 'Procesado', $4, 0, $4, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, NOW(), $20, $19, $18
      )
      RETURNING *
      `,
      [
        code,
        output.coffee_profile_id,
        output.presentation || "Excelso",
        output.output_weight_kg,
        output.humidity_percent,
        outputReview?.aroma,
        outputReview?.fragrance,
        outputReview?.flavor,
        outputReview?.acidity,
        outputReview?.sweetness,
        outputReview?.body,
        outputReview?.balance,
        outputReview?.uniformity,
        outputReview?.residual,
        outputReview?.cleanCup,
        outputReview?.score,
        outputReview?.notes,
        finalizedBy,
        outputInitialComment,
        output.performance_factor,
      ]
    );
      const newLot = outputResult.rows[0];
      createdLots.push(newLot);

      if (output.id) {
        await client.query(
          `
          UPDATE coffee_process_outputs
          SET output_lot_id = $1, updated_at = NOW()
          WHERE id = $2
          `,
          [newLot.id, output.id]
        );
      }

      await client.query(
        `
        INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
        VALUES ($1, 'proceso_entrada', $2, $3, $4)
        `,
        [newLot.id, output.output_weight_kg, `Lote generado por proceso ${process.code}`, finalizedBy]
      );
    }

    const firstLot = createdLots[0];

    await client.query(
      `
      UPDATE coffee_processes
      SET
        status = 'finalizado',
        output_lot_id = $1,
        output_weight_kg = $2,
        finalized_by = $3,
        finalized_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [firstLot.id, process.output_weight_kg, finalizedBy, processId]
    );

    if (process.sale_id) {
      await client.query(
        `
        UPDATE sales
        SET status = 'listo_para_ensamble', blend_required = NULL, updated_at = NOW()
        WHERE id = $1
          AND status <> 'anulada'
        `,
        [process.sale_id]
      );
    }

    await client.query(
      `
      UPDATE coffee_lots
      SET status = 'agotado', updated_at = NOW()
      WHERE id IN (
        SELECT lot_id
        FROM coffee_process_inputs
        WHERE process_id = $1
      )
      AND available_weight_kg = 0
      `,
      [processId]
    );

    await client.query("COMMIT");
    return createdLots.length === 1 ? createdLots[0] : createdLots;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
