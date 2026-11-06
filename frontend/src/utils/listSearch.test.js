import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch, paginateItems } from "./listSearch.js";

test("buscar por varios campos tolera tildes, mayusculas, valores vacios y multiples palabras", () => {
  assert.equal(matchesSearch(" GEISHA lim\u00f3n ", [null, ["CD 40", "Geisha", "Limon"]]), true);
  assert.equal(matchesSearch("cd 40", ["CD 40", "Cliente"]), true);
  assert.equal(matchesSearch("123", [null, undefined, 123]), true);
  assert.equal(matchesSearch("otro", [null, undefined]), false);
  assert.equal(matchesSearch("   ", []), true);
});

test("paginar no muta ni pierde selecciones o cantidades fuera de la pagina visible", () => {
  const items = Array.from({ length: 21 }, (_, id) => ({ id, selected: true, quantityKg: id + 1 }));
  const page = paginateItems(items, 2);
  assert.equal(page.total, 21);
  assert.equal(page.pageCount, 3);
  assert.equal(page.start, 9);
  assert.equal(page.end, 16);
  assert.equal(page.items.length, 8);
  assert.equal(page.items[0], items[8]);
  assert.equal(items[20].quantityKg, 21);
  assert.equal(items.length, 21);
  assert.equal(paginateItems(items, 99).page, 3);
  assert.equal(paginateItems(items, -1).page, 1);
  assert.equal(paginateItems([], 99).start, 0);
  assert.equal(paginateItems([], 99).page, 1);
  assert.equal(paginateItems(items, 1, 10).end, 10);
});
