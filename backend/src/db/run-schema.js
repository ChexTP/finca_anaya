import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { pool } from "../db.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

const runSchema = async () => {
  try {
    const schemaPath = join(currentDir, "schema.sql");
    const schema = await readFile(schemaPath, "utf8");

    await pool.query(schema);
    console.log("Esquema de base de datos ejecutado correctamente");
  } catch (error) {
    console.error("Error al ejecutar el esquema:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

runSchema();
