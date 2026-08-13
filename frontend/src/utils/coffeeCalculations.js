export const calculateOperationalKg = ({ quantityKg, productForm, processType }) => {
  const kg = Number(quantityKg || 0);
  const form = String(productForm || "").trim().toUpperCase();
  const process = String(processType || "").trim().toUpperCase();

  if (!Number.isFinite(kg) || kg <= 0) return 0;
  if (form !== "EXCELSO") return Number(kg.toFixed(3));
  if (process === "NATURAL") return Number((kg * 140 / 70).toFixed(3));
  if (process === "LAVADO") return Number((kg * 95 / 70).toFixed(3));

  return Number(kg.toFixed(3));
};

export const roundKgUpToHalf = (value) => {
  const kg = Number(value || 0);
  if (!Number.isFinite(kg) || kg <= 0) return 0;

  return Math.ceil((kg - Number.EPSILON) * 2) / 2;
};

export const formatOperationalKg = (value) => {
  const roundedKg = roundKgUpToHalf(value);

  return `${roundedKg.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} kg`;
};

export const formatRequestedKg = (value, { locale = "es-CO", suffix = " kg", emptyValue = "-" } = {}) => {
  const kg = Number(value);

  if (!Number.isFinite(kg)) return emptyValue;

  return `${kg.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}${suffix}`;
};

export const formatQuantityInputValue = (value) => {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) return "";

  return Number(quantity.toFixed(2)).toString();
};

export const POUNDS_PER_KG = 2.2046;

const normalize = (value) => String(value || "").trim().toLowerCase();

export const fixedCommercialCosts = {
  millCostCop: 1215,
  transportCostCop: 172,
  vacuumCostCop: 1500,
  exportCostUsdLb: 0.45,
};

export const defaultCommercialPricing = {
  exchangeRate: "",
  millCostCop: String(fixedCommercialCosts.millCostCop),
  transportCostCop: String(fixedCommercialCosts.transportCostCop),
  vacuumCostCop: String(fixedCommercialCosts.vacuumCostCop),
  exportCostUsdLb: String(fixedCommercialCosts.exportCostUsdLb),
  usdIncoterm: "EXW",
};

export const calculateCommercialItemPrice = ({
  priceLoadCop,
  productForm,
  processType,
  packaging,
  currency = "COP",
  exchangeRate,
  millCostCop = fixedCommercialCosts.millCostCop,
  transportCostCop = fixedCommercialCosts.transportCostCop,
  vacuumCostCop = fixedCommercialCosts.vacuumCostCop,
  exportCostUsdLb = fixedCommercialCosts.exportCostUsdLb,
  usdIncoterm = "EXW",
}) => {
  const loadPrice = Number(priceLoadCop || 0);
  const rate = Number(exchangeRate || 0);
  const millCost = Number(millCostCop || 0);
  const transportCost = Number(transportCostCop || 0);
  const vacuumCost = Number(vacuumCostCop || 0);
  const exportCost = Number(exportCostUsdLb || 0);
  const form = normalize(productForm);
  const process = normalize(processType);
  const packageText = normalize(packaging);
  const isExcelso = form === "excelso";
  const isNatural = process === "natural";
  const isVacuum = packageText.includes("vacio") || packageText.includes("vacuum");

  if (!Number.isFinite(loadPrice) || loadPrice <= 0) {
    return {
      kgCpsPriceCop: 0,
      kgExcelsoPriceCop: 0,
      kgBasePriceCop: 0,
      kgVacuumPriceCop: 0,
      usdLbExw: 0,
      usdLbFob: 0,
      unitPrice: 0,
      priceBasis: currency === "USD" ? "lb" : "kg",
    };
  }

  const kgCpsPriceCop = loadPrice / 125;
  const kgExcelsoPriceCop = isNatural ? loadPrice / 62.5 : loadPrice / 93;
  const kgBasePriceCop = isExcelso
    ? kgExcelsoPriceCop + millCost + transportCost
    : kgCpsPriceCop;
  const kgVacuumPriceCop = kgBasePriceCop + (isVacuum ? vacuumCost : 0);
  const usdLbExw = rate > 0 ? kgBasePriceCop / POUNDS_PER_KG / rate : 0;
  const usdLbVacuumExw = rate > 0 ? kgVacuumPriceCop / POUNDS_PER_KG / rate : 0;
  const usdLbFob = usdLbExw + exportCost;
  const usdLbVacuumFob = usdLbVacuumExw + exportCost;
  const selectedUsd = usdIncoterm === "FOB"
    ? (isVacuum ? usdLbVacuumFob : usdLbFob)
    : (isVacuum ? usdLbVacuumExw : usdLbExw);

  return {
    kgCpsPriceCop: Number(kgCpsPriceCop.toFixed(2)),
    kgExcelsoPriceCop: Number(kgExcelsoPriceCop.toFixed(2)),
    kgBasePriceCop: Number(kgBasePriceCop.toFixed(2)),
    kgVacuumPriceCop: Number(kgVacuumPriceCop.toFixed(2)),
    usdLbExw: Number(usdLbExw.toFixed(4)),
    usdLbVacuumExw: Number(usdLbVacuumExw.toFixed(4)),
    usdLbFob: Number(usdLbFob.toFixed(4)),
    usdLbVacuumFob: Number(usdLbVacuumFob.toFixed(4)),
    unitPrice: Number((currency === "USD" ? selectedUsd : kgVacuumPriceCop).toFixed(currency === "USD" ? 4 : 2)),
    priceBasis: currency === "USD" ? "lb" : "kg",
  };
};

export const calculateCommercialLineTotal = ({ quantityKg, unitPrice, currency, priceBasis }) => {
  const kg = Number(quantityKg || 0);
  const price = Number(unitPrice || 0);

  if (!Number.isFinite(kg) || !Number.isFinite(price)) return 0;

  const amount = currency === "USD" && priceBasis === "lb"
    ? kg * POUNDS_PER_KG * price
    : kg * price;

  return Number(amount.toFixed(2));
};
