export const normalizeSearch = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

export const matchesSearch = (search, values) => {
  const text = normalizeSearch([values].flat(Infinity).filter((value) => value != null).join(" "));
  return normalizeSearch(search).split(/\s+/).filter(Boolean).every((term) => text.includes(term));
};

export const paginateItems = (items, requestedPage = 1, pageSize = 8) => {
  const size = Math.max(1, Math.floor(Number(pageSize) || 8));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.max(1, Math.min(Math.floor(Number(requestedPage) || 1), pageCount));
  const offset = (page - 1) * size;
  return { items: items.slice(offset, offset + size), total: items.length, page, pageCount,
    start: items.length ? offset + 1 : 0, end: Math.min(offset + size, items.length) };
};
