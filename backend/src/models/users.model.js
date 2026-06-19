import { pool } from "../db.js";

export const findUserByUsername = async (username) => {
  const result = await pool.query(
    `
    SELECT users.*, roles.name AS role_name
    FROM users
    INNER JOIN roles ON roles.id = users.role_id
    WHERE users.username = $1
    LIMIT 1
    `,
    [username]
  );

  return result.rows[0];
};

export const findUserById = async (id) => {
  const result = await pool.query(
    `
    SELECT users.id, users.name, users.username, users.is_active, roles.name AS role_name
    FROM users
    INNER JOIN roles ON roles.id = users.role_id
    WHERE users.id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0];
};

export const listUsers = async () => {
  const result = await pool.query(
    `
    SELECT users.id, users.name, users.username, users.is_active, roles.name AS role
    FROM users
    INNER JOIN roles ON roles.id = users.role_id
    ORDER BY users.created_at DESC
    `
  );

  return result.rows;
};

export const findRoleByName = async (name) => {
  const result = await pool.query("SELECT * FROM roles WHERE name = $1 LIMIT 1", [name]);
  return result.rows[0];
};

export const createUser = async ({ name, username, passwordHash, roleId }) => {
  const result = await pool.query(
    `
    INSERT INTO users (name, username, password_hash, role_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, username, is_active, created_at
    `,
    [name, username, passwordHash, roleId]
  );

  return result.rows[0];
};

export const changeUserPassword = async (id, passwordHash) => {
  const result = await pool.query(
    `
    UPDATE users
    SET password_hash = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id
    `,
    [passwordHash, id]
  );

  return result.rows[0];
};

export const changeUserStatus = async (id, isActive) => {
  const result = await pool.query(
    `
    UPDATE users
    SET is_active = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, name, username, is_active
    `,
    [isActive, id]
  );

  return result.rows[0];
};
