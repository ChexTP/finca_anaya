import test from "node:test";
import assert from "node:assert/strict";
import { compareNames, getNameInitial, matchesNameInitial } from "./alphabeticalNames.js";

test("nombres ordenados en espanol con tildes, espacios, numeros y desempate estable", () => {
  const names = ["Zulu", "\u00d1ora", "Nora", "\u00c1lvaro", "  ana", "Ana", "Cafe 10", "Cafe 2"];
  const contacts = names.map((name, id) => ({ id, name }));
  const before = contacts.map(({ name }) => name);
  const ordered = [...contacts].sort(compareNames);
  assert.deepEqual(ordered.map(({ name }) => name), ["\u00c1lvaro", "  ana", "Ana", "Cafe 2", "Cafe 10", "Nora", "\u00d1ora", "Zulu"]);
  assert.deepEqual(contacts.map(({ name }) => name), before);
});

test("letras agrupan vocales acentuadas sin mezclar N y enie", () => {
  for (const name of ["Ana", "\u00c1lvaro", "  \u00e1ngela"]) assert.equal(getNameInitial(name), "A");
  assert.equal(getNameInitial("\u00c9dgar"), "E");
  assert.equal(getNameInitial("\u00dcber"), "U");
  assert.equal(getNameInitial("\u00d1ora"), "\u00d1");
  assert.equal(matchesNameInitial("\u00d1ora", "N"), false);
  assert.equal(matchesNameInitial("\u00d1ora", "\u00d1"), true);
  for (const name of [null, "", "123 Cafe", "@Cafe"]) assert.equal(getNameInitial(name), "#");
  assert.equal(matchesNameInitial("Cualquier nombre", ""), true);
});
