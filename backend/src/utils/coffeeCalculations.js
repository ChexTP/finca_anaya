const normalizeText = (value) => String(value || "").trim().toUpperCase();

export const calculateOperationalKg = ({ quantityKg, productForm, processType }) => {
  const kg = Number(quantityKg || 0);
  const form = normalizeText(productForm);
  const process = normalizeText(processType);

  if (!Number.isFinite(kg) || kg <= 0) {
    return 0;
  }

  if (form !== "EXCELSO") {
    return Math.ceil(kg - Number.EPSILON);
  }

  if (process === "NATURAL") {
    return Math.ceil((kg * 140 / 70) - Number.EPSILON);
  }

  if (process === "LAVADO") {
    return Math.ceil((kg * 95 / 70) - Number.EPSILON);
  }

  // Semilavado aun no tiene factor confirmado por la empresa.
  return Math.ceil(kg - Number.EPSILON);
};
