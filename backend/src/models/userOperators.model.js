import { pool } from "../db.js";

let ensurePromise;

export const ensureUserOperatorColumn = () => {
  if (!ensurePromise) {
    ensurePromise = pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS operator_name VARCHAR(120)")
      .catch((error) => { ensurePromise = null; throw error; });
  }
  return ensurePromise;
};

export const getUserOperator = async (id) => {
  await ensureUserOperatorColumn();
  const result = await pool.query("SELECT operator_name FROM users WHERE id = $1", [id]);
  return result.rows[0]?.operator_name || null;
};

export const listUserOperators = async () => {
  await ensureUserOperatorColumn();
  const result = await pool.query("SELECT id, operator_name FROM users");
  return new Map(result.rows.map((row) => [Number(row.id), row.operator_name]));
};

export const changeUserOperator = async (id, operatorName) => {
  await ensureUserOperatorColumn();
  const result = await pool.query(`
    UPDATE users SET operator_name = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, name, username, operator_name
  `, [operatorName || null, id]);
  return result.rows[0];
};
