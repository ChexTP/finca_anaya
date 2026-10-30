import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLiquidationItem, normalizeLiquidationSnapshot, getVerifiedDocumentAmount } from '../src/utils/liquidationAmounts.js';
import { calculateLiquidationPrices } from '../../frontend/src/utils/liquidationPrices.js';

test('la fila prevalece sobre cabecera obsoleta: reproduce el desfase exacto del 9%', () => {
  const row = { id: 46, netWeightKg: 1412.2, purchaseBaseFactor: 90, performanceFactor: 90, purchasePriceFactor90: 2000000 };
  const staleHeader = { performanceFactor: 81, purchaseTotal: 24628768 };
  assert.equal(calculateLiquidationItem({ ...row, performanceFactor: 81 }).purchaseTotal, 24628768);
  const snapshot = normalizeLiquidationSnapshot(staleHeader, [row]);
  assert.equal(snapshot.purchaseTotal, 22595200);
  assert.equal(snapshot.performanceFactor, 90);
  assert.equal(getVerifiedDocumentAmount(snapshot), 22595200);
});

test('frontend y backend coinciden con factores negociados y redondeos', () => {
  for (const [load, factor, base] of [[2000000, 81, 90], [1751234.567, 87.345, 90], [1850000, '', 90], [2000000, 95, 94], [2200000, null, null]]) {
    const front = calculateLiquidationPrices(load, factor, base);
    const back = calculateLiquidationItem({ netWeightKg: 125, purchasePriceFactor90: load, performanceFactor: factor, purchaseBaseFactor: base });
    assert.equal(back.purchasePricePerKg, front.purchasePricePerKg);
    assert.equal(back.purchaseTotal, Number((125 * front.purchasePricePerKg).toFixed(2)));
  }
});

test('precio por kilo heredado no se convierte en cero al editar', () => {
  assert.equal(calculateLiquidationPrices('', '', 90, 16000).purchasePricePerKg, 16000);
  assert.equal(calculateLiquidationItem({ netWeightKg: 100, purchasePricePerKg: 16000 }).purchaseTotal, 1600000);
});

test('agrupadas suman filas redondeadas y usan peso neto, no bruto', () => {
  const snapshot = normalizeLiquidationSnapshot({}, [
    { netWeightKg: 125, grossWeightKg: 140, purchasePriceFactor90: 2000000, performanceFactor: 90 },
    { netWeightKg: 50, grossWeightKg: 60, purchasePricePerKg: 10000 },
  ]);
  assert.equal(snapshot.purchaseTotal, 2500000);
  assert.equal(getVerifiedDocumentAmount(snapshot), 2500000);
});

test('conciliacion no adivina documentos incompletos o inconsistentes', () => {
  assert.equal(getVerifiedDocumentAmount({ purchaseTotal: 100 }), null);
  assert.equal(getVerifiedDocumentAmount({ purchaseTotal: 101, netWeightKg: 10, purchasePricePerKg: 10 }), null);
  assert.equal(getVerifiedDocumentAmount({ purchaseTotal: 100, netWeightKg: 10, purchasePricePerKg: 10 }), 100);
  assert.throws(() => calculateLiquidationItem({ netWeightKg: -1, purchasePricePerKg: 10 }));
  assert.throws(() => calculateLiquidationItem({ netWeightKg: 0, purchasePricePerKg: 10 }));
  assert.throws(() => normalizeLiquidationSnapshot({}, [
    { id: 1, netWeightKg: 10, purchasePricePerKg: 10 },
    { id: 1, netWeightKg: 10, purchasePricePerKg: 10 },
  ]), /repetido/);
});
