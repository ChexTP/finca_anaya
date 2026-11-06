import test from "node:test";
import assert from "node:assert/strict";
import { getWarehousePackaging, renderWarehouseNotes, renderWarehousePackaging } from "./warehouseInstructions.js";

test("empaque individual tiene prioridad sobre condiciones generales", () => {
  const sale = { warehouse_quote_terms: { packaging: "Tradicional" } };
  assert.equal(getWarehousePackaging({ pricing_snapshot: { packaging: "Cajas x 20 Kg al vacio" } }, sale), "Cajas x 20 Kg al vacio");
  assert.equal(getWarehousePackaging({}, sale), "Tradicional");
  assert.equal(getWarehousePackaging({}, {}), "");
  assert.equal(renderWarehousePackaging({}, {}), "");
  assert.ok(renderWarehousePackaging({ packaging: '<Caja & bolsa>' }, {}).includes('&lt;Caja &amp; bolsa&gt;'));
});

test("nota interna conserva lineas, escapa HTML y se omite si esta vacia", () => {
  const html = renderWarehouseNotes("Separar 1 kg\nContramuestra <250g>");
  assert.ok(html.includes("Notas para bodega"));
  assert.ok(html.includes("Separar 1 kg\nContramuestra &lt;250g&gt;"));
  for (const value of [null, undefined, "", "  "]) assert.equal(renderWarehouseNotes(value), "");
});
