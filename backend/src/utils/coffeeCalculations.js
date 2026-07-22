const normalizeText = (value) => String(value || "").trim().toUpperCase();

export const calculateOperationalKg = ({ quantityKg, productForm, processType }) => {
  const kg = Number(quantityKg || 0);
  const form = normalizeText(productForm);
  const process = normalizeText(processType);

  if (!Number.isFinite(kg) || kg <= 0) {
    return 0;
  }

  if (form !== "EXCELSO") {
    return Number(kg.toFixed(3));
  }

  if (process === "NATURAL") {
    return Number((kg * 140 / 70).toFixed(3));
  }

  if (process === "LAVADO") {
    return Number((kg * 94 / 70).toFixed(3));
  }

  // Semilavado aun no tiene factor confirmado por la empresa.
  return Number(kg.toFixed(3));
};
