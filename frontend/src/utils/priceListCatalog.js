const normalizeSearch = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

export const filterPriceListCatalog = (options, items, { search = "", category = "", process = "", inclusion = "all" }) => {
  const selectedIds = new Set(items.map((item) => item.catalogId));
  const terms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  return options.filter((option) => {
    const text = normalizeSearch([option.label, option.category, option.processType, option.characterization].filter(Boolean).join(" "));
    return terms.every((term) => text.includes(term))
      && (!category || option.category === category)
      && (!process || option.processType === process)
      && (inclusion === "all" || (inclusion === "included" ? selectedIds.has(option.id) : !selectedIds.has(option.id)));
  });
};

export const togglePriceListResults = (items, options, checked, createItem) => {
  const ids = new Set(options.map((option) => option.id));
  if (!checked) return items.filter((item) => !ids.has(item.catalogId));
  const selectedIds = new Set(items.map((item) => item.catalogId));
  return [...items, ...options.filter((option) => !selectedIds.has(option.id)).map(createItem)];
};
