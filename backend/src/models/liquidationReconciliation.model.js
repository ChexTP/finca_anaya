import { pool } from '../db.js';
import { getVerifiedDocumentAmount } from '../utils/liquidationAmounts.js';

export const reconcileLiquidationAmounts = async () => {
  const client = await pool.connect();
  const report = { corrected: [], skipped: [], overpaid: [] };
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS liquidation_amount_corrections (
      id SERIAL PRIMARY KEY,
      payable_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      before_data JSONB NOT NULL,
      after_data JSONB NOT NULL,
      corrected_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    const result = await client.query(`
      SELECT p.* FROM accounts_payable p
      INNER JOIN payable_categories c ON c.id = p.category_id
      WHERE c.name = 'Lote de cafe'
        AND p.purchase_order_snapshot <> '{}'::jsonb
      ORDER BY p.id FOR UPDATE OF p
    `);
    for (const payable of result.rows) {
      const snapshot = payable.purchase_order_snapshot;
      const documentTotal = Number(snapshot?.purchaseTotal);
      if (!Number.isFinite(documentTotal) || documentTotal <= 0) continue;
      const total = getVerifiedDocumentAmount(snapshot);
      const snapshotRows = Array.isArray(snapshot.items) && snapshot.items.length ? snapshot.items : [snapshot];
      const mismatchedLot = payable.lot_id && snapshotRows.length === 1 && snapshotRows[0].id != null
        && Number(snapshotRows[0].id) !== Number(payable.lot_id);
      if (total === null || mismatchedLot) {
        report.skipped.push({ code: payable.code, reason: 'El total del documento no se puede validar con sus renglones guardados' });
        continue;
      }
      const ledger = await client.query(`SELECT COUNT(*)::int AS payment_count,
        COALESCE(SUM(amount), 0) AS paid FROM accounts_payable_payments WHERE payable_id = $1`, [payable.id]);
      const amountPaid = Number(ledger.rows[0].payment_count) > 0 ? Number(ledger.rows[0].paid) : Number(payable.amount_paid);
      const balance = Number(Math.max(total - amountPaid, 0).toFixed(2));
      const status = balance === 0 ? 'pagada' : amountPaid > 0 ? 'pago_parcial' : 'pendiente';
      if (amountPaid > total) report.overpaid.push({ code: payable.code, excessPaid: Number((amountPaid - total).toFixed(2)) });
      if (Math.abs(Number(payable.total) - total) <= 0.01
        && Math.abs(Number(payable.amount_paid) - amountPaid) <= 0.01
        && Math.abs(Number(payable.balance_due) - balance) <= 0.01 && payable.status === status) continue;
      const after = { total, amount_paid: amountPaid, balance_due: balance, status };
      await client.query(`INSERT INTO liquidation_amount_corrections (payable_id, code, before_data, after_data)
        VALUES ($1, $2, $3::jsonb, $4::jsonb)`, [payable.id, payable.code, JSON.stringify(payable), JSON.stringify(after)]);
      await client.query(`UPDATE accounts_payable SET total = $1, amount_paid = $2, balance_due = $3,
        status = $4, due_date = CASE WHEN $3::numeric = 0 THEN NULL ELSE due_date END, updated_at = NOW()
        WHERE id = $5`, [total, amountPaid, balance, status, payable.id]);
      const rows = Array.isArray(snapshot.items) && snapshot.items.length ? snapshot.items : [snapshot];
      if (payable.lot_id && rows.length === 1) {
        await client.query(`UPDATE coffee_lots SET purchase_price_per_kg = $1, purchase_total = $2, updated_at = NOW()
          WHERE id = $3 AND purchase_total = $4`, [Number(rows[0].purchasePricePerKg), total, payable.lot_id, payable.total]);
      }
      report.corrected.push({ code: payable.code, previousTotal: Number(payable.total), ...after });
    }
    await client.query('COMMIT');
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};
