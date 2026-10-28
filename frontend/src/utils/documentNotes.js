const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

export const renderDocumentNotes = (notes, label = "Notas") => {
  const text = String(notes ?? "").trim();
  if (!text) return "";
  return `<section class="document-notes" style="margin-top:18px;overflow-wrap:anywhere;text-align:left;">
    <h3 style="font-size:13px;margin:0 0 6px;">${escapeHtml(label)}</h3>
    <p style="white-space:pre-wrap;font-size:12px;line-height:1.5;margin:0;">${escapeHtml(text)}</p>
  </section>`;
};
