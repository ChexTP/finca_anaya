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
