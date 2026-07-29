import { pool } from "../db.js";

export const listLaboratoryHistory = async () => {
  const lotsResult = await pool.query(
    `
    SELECT
      coffee_lots.id,
      coffee_lots.code,
      coffee_lots.lot_kind,
      coffee_lots.commercial_classification,
      coffee_lots.coffee_variety,
      coffee_lots.humidity_percent,
      coffee_lots.lab_aroma,
      coffee_lots.lab_flavor,
      coffee_lots.lab_sweetness,
      coffee_lots.lab_body,
      coffee_lots.lab_residual,
      coffee_lots.lab_clean_cup,
      coffee_lots.lab_score,
      coffee_lots.lab_notes,
      coffee_lots.lab_reviewed_at,
      coffee_types.name AS coffee_type_name,
      coffee_profiles.name AS coffee_profile_name,
      users.name AS reviewed_by_name
    FROM coffee_lots
    LEFT JOIN coffee_types ON coffee_types.id = coffee_lots.coffee_type_id
    LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
    LEFT JOIN users ON users.id = coffee_lots.lab_reviewed_by
    WHERE coffee_lots.lab_reviewed_at IS NOT NULL
      AND coffee_lots.lot_kind <> 'PROC'
    ORDER BY coffee_lots.lab_reviewed_at DESC, coffee_lots.created_at DESC
    `
  );

  const processesResult = await pool.query(
    `
    WITH process_output_rows AS (
      SELECT
        coffee_process_outputs.process_id,
        coffee_process_outputs.id AS process_output_id,
        coffee_process_outputs.output_lot_id,
        coffee_profiles.name AS coffee_profile_name,
        coffee_process_outputs.output_weight_kg,
        coffee_process_outputs.humidity_percent,
        coffee_process_outputs.performance_factor
      FROM coffee_process_outputs
      LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_process_outputs.coffee_profile_id

      UNION ALL

      SELECT
        coffee_processes.id AS process_id,
        NULL::integer AS process_output_id,
        coffee_processes.output_lot_id,
        coffee_profiles.name AS coffee_profile_name,
        coffee_processes.output_weight_kg,
        coffee_processes.physical_humidity_percent,
        coffee_processes.physical_performance_factor
      FROM coffee_processes
      INNER JOIN coffee_lots ON coffee_lots.id = coffee_processes.output_lot_id
      LEFT JOIN coffee_profiles ON coffee_profiles.id = coffee_lots.coffee_profile_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM coffee_process_outputs
        WHERE coffee_process_outputs.process_id = coffee_processes.id
      )
    )
    SELECT
      coffee_processes.id,
      coffee_processes.code,
      coffee_processes.finalized_at,
      coffee_processes.physical_reviewed_at,
      coffee_processes.total_input_kg,
      coffee_processes.output_weight_kg,
      sales.code AS sale_code,
      clients.name AS client_name,
      COALESCE(
        json_agg(
          json_build_object(
            'process_output_id', process_output_rows.process_output_id,
            'output_lot_id', output_lots.id,
            'output_lot_code', output_lots.code,
            'coffee_profile_name', process_output_rows.coffee_profile_name,
            'output_weight_kg', process_output_rows.output_weight_kg,
            'humidity_percent', process_output_rows.humidity_percent,
            'performance_factor', process_output_rows.performance_factor,
            'lab_aroma', output_lots.lab_aroma,
            'lab_flavor', output_lots.lab_flavor,
            'lab_sweetness', output_lots.lab_sweetness,
            'lab_body', output_lots.lab_body,
            'lab_residual', output_lots.lab_residual,
            'lab_clean_cup', output_lots.lab_clean_cup,
            'lab_score', output_lots.lab_score,
            'lab_notes', output_lots.lab_notes,
            'lab_reviewed_at', output_lots.lab_reviewed_at,
            'reviewed_by_name', users.name
          )
          ORDER BY process_output_rows.process_output_id ASC NULLS LAST, output_lots.id ASC
        ) FILTER (WHERE process_output_rows.output_lot_id IS NOT NULL),
        '[]'::json
      ) AS outputs
    FROM coffee_processes
    LEFT JOIN sales ON sales.id = coffee_processes.sale_id
    LEFT JOIN clients ON clients.id = sales.client_id
    LEFT JOIN process_output_rows ON process_output_rows.process_id = coffee_processes.id
    LEFT JOIN coffee_lots output_lots ON output_lots.id = process_output_rows.output_lot_id
    LEFT JOIN users ON users.id = output_lots.lab_reviewed_by
    WHERE coffee_processes.status = 'finalizado'
      AND (
        process_output_rows.output_lot_id IS NOT NULL
        OR coffee_processes.output_lot_id IS NOT NULL
      )
    GROUP BY coffee_processes.id, sales.code, clients.name
    ORDER BY coffee_processes.finalized_at DESC NULLS LAST, coffee_processes.created_at DESC
    `
  );

  return {
    lots: lotsResult.rows,
    processes: processesResult.rows,
  };
};
