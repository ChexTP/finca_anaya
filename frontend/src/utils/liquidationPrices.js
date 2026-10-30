export const calculateLiquidationPrices = (priceFactor90, performanceFactor, baseFactor = 90, fallbackPricePerKg = 0) => {
  const basePriceCarga = Number(priceFactor90 || 0);
  const base = baseFactor === "" || baseFactor == null ? 90 : Number(baseFactor);
  const factor = performanceFactor === "" || performanceFactor == null ? base : Number(performanceFactor);
  if (!Number.isFinite(basePriceCarga) || basePriceCarga <= 0 || !Number.isFinite(base) || !Number.isFinite(factor)) {
    const price = Number(fallbackPricePerKg || 0);
    const purchasePricePerKg = Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : 0;
    return { adjustmentPercent: 0, adjustedPriceCarga: Number((purchasePricePerKg * 125).toFixed(2)), purchasePricePerKg };
  }
  const adjustmentPercent = base - factor;
  const adjustedPriceCarga = Number((basePriceCarga * (1 + adjustmentPercent / 100)).toFixed(2));
  return { adjustmentPercent: Number(adjustmentPercent.toFixed(2)), adjustedPriceCarga, purchasePricePerKg: Number((adjustedPriceCarga / 125).toFixed(2)) };
};
