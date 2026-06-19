import { pool } from "../db.js";

export const listCatalog = async (tableName) => {
  const result = await pool.query(
    `
    SELECT *
    FROM ${tableName}
    WHERE is_active = TRUE
    ORDER BY name ASC
    `
  );

  return result.rows;
};

