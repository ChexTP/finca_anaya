export const calculateLiquidationItem = (item) => {
  const netWeightKg = Number(item.netWeightKg);
  const base = item.purchaseBaseFactor === "" || item.purchaseBaseFactor == null ? 90 : Number(item.purchaseBaseFactor);
  const factor = item.performanceFactor === "" || item.performanceFactor == null ? base : Number(item.performanceFactor);
  const loadPrice = Number(item.purchasePriceFactor90 || 0);
  const adjustedPriceCarga = loadPrice > 0 ? Number((loadPrice * (1 + (base - factor) / 100)).toFixed(2)) : Number(item.purchasePricePerKg || 0) * 125;
  const purchasePricePerKg = Number((adjustedPriceCarga / 125).toFixed(2));
  if (![netWeightKg, base, factor, adjustedPriceCarga, purchasePricePerKg].every(Number.isFinite)
    || netWeightKg <= 0 || base <= 0 || factor <= 0 || loadPrice < 0 || purchasePricePerKg <= 0) {
    const error = new Error('Peso neto, factor y precio de liquidacion deben ser validos y mayores a cero');
    error.status = 400;
    throw error;
  }
  return { ...item, netWeightKg, purchaseBaseFactor: base, performanceFactor: factor,
    purchasePricePerKg, adjustedPriceCarga, adjustmentPercent: Number((base - factor).toFixed(2)),
    purchaseTotal: Number((netWeightKg * purchasePricePerKg).toFixed(2)) };
};

export const normalizeLiquidationSnapshot = (snapshot, items) => {
  const lotIds = items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (new Set(lotIds).size !== lotIds.length) {
    const error = new Error('La orden contiene un lote repetido');
    error.status = 400;
    throw error;
  }
  const rows = items.map(calculateLiquidationItem);
  const first = rows[0];
  return { ...snapshot, items: rows,
    isGrouped: rows.length > 1 || Boolean(snapshot.isGrouped),
    netWeightKg: Number(rows.reduce((sum, row) => sum + row.netWeightKg, 0).toFixed(3)),
    performanceFactor: rows.length === 1 ? first.performanceFactor : '',
    purchaseBaseFactor: rows.length === 1 ? first.purchaseBaseFactor : snapshot.purchaseBaseFactor,
    purchasePriceFactor90: rows.length === 1 ? first.purchasePriceFactor90 : null,
    purchasePricePerKg: rows.length === 1 ? first.purchasePricePerKg : null,
    purchaseTotal: Number(rows.reduce((sum, row) => sum + row.purchaseTotal, 0).toFixed(2)) };
};

// Historical documents are authoritative only when their saved line arithmetic agrees.
export const getVerifiedDocumentAmount = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const total = Number(snapshot.purchaseTotal);
  if (!Number.isFinite(total) || total <= 0) return null;
  const rows = Array.isArray(snapshot.items) && snapshot.items.length ? snapshot.items : [snapshot];
  const ids = rows.map(row => Number(row.id)).filter(id => Number.isInteger(id) && id > 0);
  if (new Set(ids).size !== ids.length) return null;
  let sum = 0;
  for (const row of rows) {
    const kg = Number(row.netWeightKg);
    const price = Number(row.purchasePricePerKg);
    const computed = Number((kg * price).toFixed(2));
    const saved = row.purchaseTotal == null || row.purchaseTotal === '' ? computed : Number(row.purchaseTotal);
    if (![kg, price, saved].every(Number.isFinite) || kg <= 0 || price <= 0 || Math.abs(computed - saved) > 0.01) return null;
    sum += saved;
  }
  return Math.abs(Number(sum.toFixed(2)) - total) <= 0.01 ? Number(total.toFixed(2)) : null;
};
