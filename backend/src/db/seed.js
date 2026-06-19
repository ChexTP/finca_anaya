import bcrypt from "bcryptjs";
import { pool } from "../db.js";

const roles = [
  ["admin", "Administrador"],
  ["warehouse", "Bodega"],
  ["laboratory", "Laboratorio"],
  ["accounting", "Contabilidad"],
  ["seller", "Vendedor"],
];

const initialUsers = [
  { name: "Administrador", username: "admin", password: "admin123", role: "admin" },
  { name: "Bodega", username: "bodega", password: "bodega123", role: "warehouse" },
  { name: "Laboratorio", username: "laboratorio", password: "laboratorio123", role: "laboratory" },
  { name: "Contabilidad", username: "contabilidad", password: "contabilidad123", role: "accounting" },
];

const coffeeTypes = ["Pergamino", "Trillado", "Procesado", "Especial"];
const packagingTypes = [
  ["Costal o saco de fique", 0.7],
  ["Tula o estopa", 0.2],
  ["Bolsa interna", 0.05],
];
const paymentMethods = ["Efectivo", "Transferencia", "Cheque", "Otro"];
const payableCategories = ["Lote de cafe", "Gasto operativo", "Transporte", "Otro"];

const seedCatalog = async (table, rows, columns) => {
  for (const row of rows) {
    const values = Array.isArray(row) ? row : [row];
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

    await pool.query(
      `
      INSERT INTO ${table} (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (${columns[0]}) DO NOTHING
      `,
      values
    );
  }
};

const runSeed = async () => {
  try {
    await seedCatalog("roles", roles, ["name", "label"]);
    await seedCatalog("coffee_types", coffeeTypes, ["name"]);
    await seedCatalog("packaging_types", packagingTypes, ["name", "tare_kg"]);
    await seedCatalog("payment_methods", paymentMethods, ["name"]);
    await seedCatalog("payable_categories", payableCategories, ["name"]);

    for (let index = 1; index <= 17; index += 1) {
      await pool.query(
        `
        INSERT INTO coffee_profiles (name)
        VALUES ($1)
        ON CONFLICT (name) DO NOTHING
        `,
        [`Perfil ${index}`]
      );
    }

    for (const user of initialUsers) {
      const roleResult = await pool.query("SELECT id FROM roles WHERE name = $1", [user.role]);
      const role = roleResult.rows[0];

      if (!role) {
        throw new Error(`No existe el rol ${user.role}`);
      }

      const passwordHash = await bcrypt.hash(user.password, 10);

      await pool.query(
        `
        INSERT INTO users (name, username, password_hash, role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING
        `,
        [user.name, user.username, passwordHash, role.id]
      );
    }

    console.log("Datos iniciales creados correctamente");
  } catch (error) {
    console.error("Error al crear datos iniciales:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

runSeed();
