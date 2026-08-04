export const formatPrintableText = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return text
    .toLocaleLowerCase("es-CO")
    .replace(/(^|[\s/.,;:()_-])([a-záéíóúüñ])/g, (match, separator, letter) => (
      `${separator}${letter.toLocaleUpperCase("es-CO")}`
    ));
};

export const printable = (value, fallback = "-") => {
  const text = formatPrintableText(value);
  return text || fallback;
};
