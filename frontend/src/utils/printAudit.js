let printUser = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

export const setPrintUser = (user) => { printUser = user; };

export const buildPrintAudit = ({ createdBy } = {}) => {
  const actor = printUser?.name || printUser?.username || "Usuario no identificado";
  const timestamp = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const creator = createdBy ? `Creado por: ${escapeHtml(createdBy)} | ` : "";
  return `<div class="document-print-audit">${creator}Generado para impresion por: ${escapeHtml(actor)} | ${escapeHtml(timestamp)}</div>`;
};

export const printAuditStyles = `<style>
  .document-print-audit { clear: both; margin-top: 12mm; padding-top: 2mm; border-top: 1px solid #cbd5e1; text-align: right; font: 10px/1.5 Arial, sans-serif; color: #475569; overflow-wrap: anywhere; }
  @media print { .document-print-audit { break-inside: avoid; } }
</style>`;

export const addPrintAudit = (html, options = {}) => {
  if (html.includes('class="document-print-audit"')) return html;
  return html.replace(/<\/head>/i, `${printAuditStyles}</head>`)
    .replace(/<\/body>/i, `${buildPrintAudit(options)}</body>`);
};
