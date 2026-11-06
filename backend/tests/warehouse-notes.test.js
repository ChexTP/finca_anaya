import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db.js";
import { updateQuote, createQuote } from "../src/models/quotes.model.js";
import { createSampleRequest, updateSampleRequest } from "../src/models/samples.model.js";
import { addWarehouseNotesColumns } from "../src/db/warehouse-notes.js";
import { quoteContentUnchanged } from "../src/utils/quoteContent.js";

const item = { lot_id: null, coffee_type_id: null, coffee_profile_id: 2, description: "Cafe", product_form: "Excelso", process_type: "Lavado", variety: null, quantity_kg: "10", operational_weight_kg: "10", unit_price: "100", line_total: "1000", price_basis: "kg", pricing_snapshot: { packaging: "Cajas x 20 Kg al vacio" } };
const nextItem = { lotId: null, coffeeTypeId: null, coffeeProfileId: 2, description: "Cafe", productForm: "Excelso", processType: "Lavado", variety: null, quantityKg: 10, operationalWeightKg: 10, unitPrice: 100, lineTotal: 1000, priceBasis: "kg", pricingSnapshot: item.pricing_snapshot };
const quote = { id: 1, code: "TEST", client_id: 2, quote_type: "preventa", status: "aceptada", currency: "COP", payment_terms: null, delivery_terms: null, estimated_delivery_date: null, shipping_cost: "0", subtotal: "1000", total: "1000", quote_terms: { packaging: "Tradicional" }, notes: "Cliente", warehouse_notes: "Anterior" };
const data = { code: "TEST", clientId: 2, quoteType: "preventa", status: "aceptada", currency: "COP", paymentTerms: null, deliveryTerms: null, estimatedDeliveryDate: null, shippingCost: 0, subtotal: 1000, total: 1000, terms: quote.quote_terms, notes: "Cliente", warehouseNotes: "Separar 1 kg\nSacar contramuestra", items: [nextItem] };

test("solo notas no cambia el contenido operativo; empaque, cantidades y precios si", () => {
  assert.equal(quoteContentUnchanged(quote, [item], data), true);
  for (const change of [{ quantityKg: 11 }, { unitPrice: 99 }, { productForm: "Pergamino" }, { pricingSnapshot: { packaging: "Tradicional" } }]) {
    assert.equal(quoteContentUnchanged(quote, [item], { ...data, items: [{ ...nextItem, ...change }] }), false);
  }
  assert.equal(quoteContentUnchanged(quote, [item], { ...data, terms: { packaging: "Otro" } }), false);
});

test("persistencia separada en cotizacion, lista y muestra; editar notas no toca lotes ni estados", async () => {
  const original = pool.connect;
  const queries = [];
  pool.connect = async () => ({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.startsWith("SELECT * FROM quotes")) return { rows: [quote] };
      if (sql.startsWith("SELECT * FROM quote_items")) return { rows: [item] };
      if (sql.startsWith("SELECT * FROM sales")) return { rows: [{ id: 9, status: "pendiente_laboratorio" }] };
      if (sql.includes("UPDATE quotes") || sql.includes("INSERT INTO quotes")) return { rows: [{ ...quote, warehouse_notes: data.warehouseNotes }] };
      if (sql.includes("INSERT INTO sample_requests") || sql.includes("UPDATE sample_requests")) return { rows: [{ id: 7 }] };
      return { rows: [] };
    }, release() {},
  });
  try {
    await updateQuote(1, data);
    assert.equal(queries.find(({ sql }) => sql.includes("UPDATE quotes")).params[14], data.warehouseNotes);
    assert.ok(!queries.some(({ sql }) => /DELETE|UPDATE sales|inventory_movements/.test(sql)));
    assert.equal(queries.at(-1).sql, "COMMIT");
    for (const quoteType of ["preventa", "lista_precios"]) {
      queries.length = 0;
      await createQuote({ ...data, quoteType });
      const insert = queries.find(({ sql }) => sql.includes("INSERT INTO quotes"));
      assert.equal(insert.params[10], "Cliente");
      assert.equal(insert.params[14], data.warehouseNotes);
    }
    const sample = { id: 7, items: [{ description: "Cafe", quantityGrams: 250 }], notes: "Nota cliente", warehouseNotes: data.warehouseNotes };
    queries.length = 0;
    await createSampleRequest(sample);
    const created = queries.find(({ sql }) => sql.includes("INSERT INTO sample_requests"));
    assert.equal(created.params[19], "Nota cliente");
    assert.equal(created.params[21], data.warehouseNotes);
    await updateSampleRequest(sample);
    const updated = queries.find(({ sql }) => sql.includes("UPDATE sample_requests"));
    assert.equal(updated.params[18], "Nota cliente");
    assert.equal(updated.params[21], data.warehouseNotes);
  } finally { pool.connect = original; }
});

test("migracion aditiva e idempotente sin cambiar registros previos", async () => {
  let sql;
  await addWarehouseNotesColumns({ query: async (value) => { sql = value; } });
  assert.ok(sql.includes("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS warehouse_notes TEXT"));
  assert.ok(sql.includes("ALTER TABLE sample_requests ADD COLUMN IF NOT EXISTS warehouse_notes TEXT"));
  assert.ok(!/UPDATE|DELETE|DROP/.test(sql));
});
