import test from 'node:test';
import assert from 'node:assert/strict';
import { setPrintUser, addPrintAudit } from './printAudit.js';

test('identifica creador e impresor y escapa nombres sin duplicar el pie', () => {
  setPrintUser({ name: 'Bodega <turno>' });
  const result = addPrintAudit('<html><head></head><body>Orden</body></html>', { createdBy: 'Sergio & equipo' });
  assert.ok(result.includes('Creado por: Sergio &amp; equipo'));
  assert.ok(result.includes('Generado para impresion por: Bodega &lt;turno&gt;'));
  assert.equal(addPrintAudit(result), result);
  setPrintUser({ name: 'Contabilidad' });
  assert.ok(addPrintAudit('<head></head><body></body>').includes('por: Contabilidad'));
  setPrintUser(null);
  assert.ok(addPrintAudit('<head></head><body></body>').includes('Usuario no identificado'));
});
