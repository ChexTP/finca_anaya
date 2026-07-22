export const calculateOperationalKg = ({ quantityKg, productForm, processType }) => {
  const kg = Number(quantityKg || 0);
  const form = String(productForm || "").trim().toUpperCase();
  const process = String(processType || "").trim().toUpperCase();

  if (!Number.isFinite(kg) || kg <= 0) return 0;
  if (form !== "EXCELSO") return Number(kg.toFixed(3));
  if (process === "NATURAL") return Number((kg * 140 / 70).toFixed(3));
  if (process === "LAVADO") return Number((kg * 94 / 70).toFixed(3));

  return Number(kg.toFixed(3));
};

export const formatOperationalKg = (value) =>
  `${Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} kg`;
