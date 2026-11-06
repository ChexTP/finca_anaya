const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export const sortContactsByName = (contacts) => [...contacts].sort((left, right) => (
  collator.compare(String(left.name || "").trim(), String(right.name || "").trim())
  || Number(left.id || 0) - Number(right.id || 0)
));
