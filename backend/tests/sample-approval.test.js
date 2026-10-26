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
      sample = { ...sample, status: params[0] };
      return { rows: [sample] };
    }
    if (sql.includes('FROM sample_requests')) return { rows: [sample] };
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
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await pool.end();
  }
});
