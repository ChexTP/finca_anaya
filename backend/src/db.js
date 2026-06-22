import pg from "pg";
import { DATABASE_SSL, DATABASE_URL } from "./config.js";

const { Pool } = pg;

// Pool unico de PostgreSQL para todo el backend.
// Los modelos importan este pool y ejecutan consultas directas con pool.query.
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

export const testConnection = async () => {
  const result = await pool.query("SELECT NOW() AS now");
  return result.rows[0];
};
