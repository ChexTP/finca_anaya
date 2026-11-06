import test from "node:test";
import assert from "node:assert/strict";
import { filterPriceListCatalog, togglePriceListResults } from "./priceListCatalog.js";

const options = [
  { id: "profile-1", label: "CD 01 - Geisha Jardin", category: "Exotico", processType: "Lavado", characterization: "Floral, limon" },
  { id: "profile-2", label: "CD 02 - Bourbon Rosado", category: "Varietal", processType: "Natural" },
  { id: "profile-3", label: "CD 03 - Regional", category: "Regional", processType: "Lavado" },
];
const selected = [{ id: "item-1", catalogId: "profile-1", priceLoadCop: "18500000", productForm: "Pergamino", packaging: "Tradicional" }];

test("busqueda por codigo, nombre, caracterizacion y multiples terminos sin tildes", () => {
  assert.deepEqual(filterPriceListCatalog(options, selected, { search: "GEISHA floral" }).map((item) => item.id), ["profile-1"]);
  assert.deepEqual(filterPriceListCatalog(options, selected, { search: "cd 02" }).map((item) => item.id), ["profile-2"]);
  assert.equal(filterPriceListCatalog(options, selected, { search: "lim\u00f3n" }).length, 1);
  assert.equal(filterPriceListCatalog(options, selected, { search: "   " }).length, 3);
  assert.equal(filterPriceListCatalog(options, selected, { search: "inexistente" }).length, 0);
});

test("categoria, proceso e inclusion se combinan sin alterar seleccion", () => {
  assert.deepEqual(filterPriceListCatalog(options, selected, { category: "Varietal", process: "Natural", inclusion: "excluded" }), [options[1]]);
  assert.equal(filterPriceListCatalog(options, selected, { category: "Varietal", process: "Lavado" }).length, 0);
  assert.deepEqual(filterPriceListCatalog(options, selected, { inclusion: "included" }), [options[0]]);
  assert.equal(selected[0].priceLoadCop, "18500000");
});

test("seleccion masiva solo afecta resultados y conserva precios/presentaciones de los incluidos", () => {
  const create = (option) => ({ id: `item-${option.id}`, catalogId: option.id, priceLoadCop: "1000000" });
  const added = togglePriceListResults(selected, options.slice(0, 2), true, create);
  assert.equal(added.length, 2);
  assert.equal(added[0], selected[0]);
  assert.equal(added[0].productForm, "Pergamino");
  assert.equal(added[0].priceLoadCop, "18500000");
  assert.equal(togglePriceListResults(added, options, true, create).length, 3);
  assert.deepEqual(togglePriceListResults(added, [options[1]], false, create), selected);
  assert.deepEqual(togglePriceListResults(added, [], false, create), added);
  assert.equal(selected.length, 1);
});
