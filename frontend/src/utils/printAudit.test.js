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

test('imprime rol, cuenta y operario sin sustituir la identidad de acceso', () => {
  setPrintUser({ role: 'warehouse', username: 'bodega', name: 'Bodega', operator_name: 'Juan <Perez>' });
  const html = addPrintAudit('<head></head><body>Orden</body>');
  assert.ok(html.includes('Bodega (bodega) - Juan &lt;Perez&gt;'));
  setPrintUser({ role: 'admin', username: 'administrador', operator_name: 'Ana' });
  assert.ok(addPrintAudit('<head></head><body></body>').includes('Administrador (administrador) - Ana'));
  setPrintUser(null);
});
