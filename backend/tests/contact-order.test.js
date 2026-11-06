import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db.js";
import { listClients } from "../src/models/clients.model.js";
import { listSuppliers } from "../src/models/suppliers.model.js";

test("clientes y proveedores devueltos alfabeticamente sin consultas adicionales", async () => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: 1, name: "Zulu" }, { id: 2, name: "Nora" }, { id: 3, name: "\u00d1ora" }, { id: 4, name: "\u00c1lvaro" }, { id: 5, name: "ana" }] };
  };
  try {
    for (const contacts of [await listClients({ search: "cafe" }), await listSuppliers()]) {
      assert.deepEqual(contacts.map(({ name }) => name), ["\u00c1lvaro", "ana", "Nora", "\u00d1ora", "Zulu"]);
    }
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].params, ["%cafe%"]);
    assert.ok(calls[0].sql.includes("ILIKE $1"));
  } finally { pool.query = original; }
});
