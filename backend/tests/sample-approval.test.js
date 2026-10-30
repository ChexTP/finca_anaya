import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { postSample, putSampleStatus, putSampleBlend } from '../src/controllers/samples.controller.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('solicitud de Muestras: creacion pendiente, aprobadores y bloqueo de preparacion', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let sample = { id: 7, status: 'enviada', created_by: 3, created_by_role: 'samples' };
  const updates = [];
  pool.query = async (sql, params) => {
    if (sql.includes('UPDATE sample_requests')) {
      updates.push(params);
      sample = { ...sample, status: params[0], notes: params[1] ?? sample.notes,
        sample_lab_notes: params[14] ? params[11] : sample.sample_lab_notes };
      return { rows: [sample] };
    }
    if (sql.includes('FROM sample_requests')) return { rows: [sample] };
    if (sql.includes('FROM sample_request_items')) return { rows: [{ id: 1, sample_request_id: 7, description: 'Cafe', quantity_grams: 250 }] };
    return { rows: [] };
  };
  pool.connect = async () => ({
    async query(sql, params) {
      if (sql.includes('INSERT INTO sample_requests')) {
        assert.equal(params[16], 'enviada');
        assert.equal(params[20], 3);
        return { rows: [sample] };
      }
      return { rows: [] };
    },
    release() {},
  });
  try {
    const created = response();
    await postSample({ user: { id: 3, role: 'samples' }, body: {
      code: 'MUE-TEST', requesterName: 'Cliente', requestedAt: '2026-10-26', status: 'solicitada',
      items: [{ description: 'Cafe prueba', quantityGrams: 250 }],
    } }, created);
    assert.equal(created.statusCode, 201);

    for (const role of ['admin', 'accounting', 'inventory_viewer']) {
      sample.status = 'enviada';
      const approved = response();
      await putSampleStatus({ params: { id: '7' }, user: { id: 5, role }, body: { status: 'aprobada' } }, approved);
      assert.equal(approved.statusCode, 200, role);
      assert.equal(sample.status, 'aprobada');
      assert.equal(updates.at(-1)[12], 5);
    }

    sample.status = 'enviada';
    const selfApproval = response();
    await putSampleStatus({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { status: 'aprobada' } }, selfApproval);
    assert.equal(selfApproval.statusCode, 409);

    for (const role of ['samples', 'admin']) {
      const blocked = response();
      await putSampleStatus({ params: { id: '7' }, user: { id: 3, role }, body: { status: 'en_preparacion' } }, blocked);
      assert.equal(blocked.statusCode, 409);
    }
    const blend = response();
    await putSampleBlend({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { items: [{}] } }, blend);
    assert.equal(blend.statusCode, 409);

    sample.status = 'aprobada';
    const start = response();
    await putSampleStatus({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { status: 'en_preparacion' } }, start);
    assert.equal(start.statusCode, 200);
    assert.equal(sample.status, 'en_preparacion');

    sample.status = 'enviada';
    sample.created_by_role = 'accounting';
    const legacy = response();
    await putSampleStatus({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { status: 'en_preparacion' } }, legacy);
    assert.equal(legacy.statusCode, 200);

    for (const role of ['laboratory', 'admin']) {
      sample = { ...sample, status: 'pendiente_laboratorio', notes: 'Nota original del cliente' };
      const labApproved = response();
      await putSampleStatus({ params: { id: '7' }, user: { id: 9, role }, body: { status: 'aprobada_laboratorio' } }, labApproved);
      assert.equal(labApproved.statusCode, 200, role);
      assert.equal(sample.notes, 'Nota original del cliente');
      assert.ok(updates.at(-1).slice(2, 11).every(value => value === null), 'No inventar ni sobrescribir catacion');
      const ready = response();
      await putSampleStatus({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { status: 'lista' } }, ready);
      assert.equal(ready.statusCode, 200);
      const delivered = response();
      await putSampleStatus({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { status: 'entregada' } }, delivered);
      assert.equal(delivered.statusCode, 200);
    }
    sample.status = 'pendiente_laboratorio';
    const noReason = response();
    await putSampleStatus({ params: { id: '7' }, user: { id: 9, role: 'laboratory' }, body: { status: 'en_preparacion' } }, noReason);
    assert.equal(noReason.statusCode, 400);
    const rejected = response();
    await putSampleStatus({ params: { id: '7' }, user: { id: 9, role: 'laboratory' }, body: { status: 'en_preparacion', notes: 'Corregir empaque' } }, rejected);
    assert.equal(rejected.statusCode, 200);
    assert.equal(sample.sample_lab_notes, 'Corregir empaque');
    assert.equal(sample.notes, 'Nota original del cliente');
    const blockedReady = response();
    await putSampleStatus({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { status: 'lista' } }, blockedReady);
    assert.equal(blockedReady.statusCode, 409);
    const blockedDelivery = response();
    await putSampleStatus({ params: { id: '7' }, user: { id: 3, role: 'samples' }, body: { status: 'entregada' } }, blockedDelivery);
    assert.equal(blockedDelivery.statusCode, 409);
    for (const role of ['samples', 'accounting', 'inventory_viewer']) {
      sample.status = 'pendiente_laboratorio';
      const forbidden = response();
      await putSampleStatus({ params: { id: '7' }, user: { id: 3, role }, body: { status: 'aprobada_laboratorio' } }, forbidden);
      assert.equal(forbidden.statusCode, 403);
    }
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await pool.end();
  }
});
