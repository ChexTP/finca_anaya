import { escapeHtml, renderDocumentNotes } from "./documentNotes.js";

export const getWarehousePackaging = (item, sale) => (
  item.pricing_snapshot?.packaging || item.pricingSnapshot?.packaging
  || item.packaging || sale.warehouse_quote_terms?.packaging || ""
);

export const renderWarehouseNotes = (notes) => {
  const content = renderDocumentNotes(notes, "Notas para bodega");
  return content ? `<div style="border:1px solid #d6ad42;padding:10px;margin-top:14px;">${content}</div>` : "";
};

export const renderWarehousePackaging = (item, sale) => {
  const packaging = getWarehousePackaging(item, sale);
  return packaging ? `<strong>Empaque:</strong> ${escapeHtml(packaging)}` : "";
};
