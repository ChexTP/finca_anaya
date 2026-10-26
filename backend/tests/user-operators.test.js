import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { updateUserOperator } from '../src/controllers/users.controller.js';
import { getUserOperator } from '../src/models/userOperators.model.js';
import { requireRoles } from '../src/middlewares/auth.middleware.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('solo admin puede asignar operarios; guardar no cambia cuentas, roles ni claves', async () => {
  const originalQuery = pool.query;
  let savedName = null;
  pool.query = async (sql, params) => {
    if (sql.includes('UPDATE users')) {
      assert.match(sql, /SET operator_name = \$1, updated_at = NOW\(\)/);
      assert.ok(!sql.includes('password_hash'));
      assert.ok(!sql.includes('SET name'));
      assert.ok(!sql.includes('role_id'));
      savedName = params[0];
      if (params[1] === '404') return { rows: [] };
      return { rows: [{ id: 2, name: 'Bodega', username: 'bodega', operator_name: savedName }] };
    }
    if (sql.startsWith('SELECT operator_name')) return { rows: [{ operator_name: savedName }] };
    return { rows: [] };
  };
  try {
    for (const role of ['accounting', 'warehouse', 'samples', 'inventory_viewer']) {
      let allowed = false;
      const res = response();
      requireRoles('admin')({ user: { role } }, res, () => { allowed = true; });
      assert.equal(allowed, false);
      assert.equal(res.statusCode, 403);
    }
    let allowed = false;
    requireRoles('admin')({ user: { role: 'admin' } }, response(), () => { allowed = true; });
    assert.equal(allowed, true);

    const saved = response();
    await updateUserOperator({ params: { id: '2' }, body: { operatorName: '  Juan Perez  ', username: 'changed', role: 'admin' } }, saved);
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.data.username, 'bodega');
    assert.equal(await getUserOperator(2), 'Juan Perez');
    assert.ok(!('password_hash' in saved.body.data));

    const cleared = response();
    await updateUserOperator({ params: { id: '2' }, body: { operatorName: '' } }, cleared);
    assert.equal(await getUserOperator(2), null);
    for (const operatorName of [null, {}, 'a'.repeat(121)]) {
      const invalid = response();
      await updateUserOperator({ params: { id: '2' }, body: { operatorName } }, invalid);
      assert.equal(invalid.statusCode, 400);
    }
    const missing = response();
    await updateUserOperator({ params: { id: '404' }, body: { operatorName: 'Juan' } }, missing);
    assert.equal(missing.statusCode, 404);
  } finally {
    pool.query = originalQuery;
    await pool.end();
  }
});
