const showPrintPreview = ({ html, title }) => {
  const existingPreview = document.getElementById("print-preview-overlay");
  if (existingPreview) existingPreview.remove();

  const overlay = document.createElement("div");
  overlay.id = "print-preview-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.background = "rgba(15, 23, 42, 0.72)";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.padding = "18px";
  overlay.style.gap = "10px";

  const toolbar = document.createElement("div");
  toolbar.style.display = "flex";
  toolbar.style.justifyContent = "space-between";
  toolbar.style.alignItems = "center";
  toolbar.style.gap = "12px";
  toolbar.style.background = "#ffffff";
  toolbar.style.borderRadius = "8px";
  toolbar.style.padding = "10px 12px";
  toolbar.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.22)";

  const titleNode = document.createElement("strong");
  titleNode.textContent = title;
  titleNode.style.color = "#0f172a";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const printButton = document.createElement("button");
  printButton.type = "button";
  printButton.textContent = "Imprimir / guardar PDF";
  printButton.style.border = "1px solid #2f6f4f";
  printButton.style.borderRadius = "6px";
  printButton.style.background = "#2f6f4f";
  printButton.style.color = "#ffffff";
  printButton.style.fontWeight = "700";
  printButton.style.padding = "8px 12px";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Cerrar vista previa";
  closeButton.style.border = "1px solid #cbd5e1";
  closeButton.style.borderRadius = "6px";
  closeButton.style.background = "#ffffff";
  closeButton.style.color = "#0f172a";
  closeButton.style.fontWeight = "700";
  closeButton.style.padding = "8px 12px";

  const previewFrame = document.createElement("iframe");
  previewFrame.title = title;
  previewFrame.style.flex = "1";
  previewFrame.style.width = "100%";
  previewFrame.style.border = "0";
  previewFrame.style.borderRadius = "8px";
  previewFrame.style.background = "#ffffff";
  previewFrame.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.22)";

  actions.appendChild(printButton);
  actions.appendChild(closeButton);
  toolbar.appendChild(titleNode);
  toolbar.appendChild(actions);
  overlay.appendChild(toolbar);
  overlay.appendChild(previewFrame);
  document.body.appendChild(overlay);

  const previewDocument = previewFrame.contentWindow?.document;
  if (previewDocument) {
    previewDocument.open();
    previewDocument.write(html);
    previewDocument.close();
  }

  closeButton.addEventListener("click", () => overlay.remove());
  printButton.addEventListener("click", () => {
    previewFrame.contentWindow?.focus();
    previewFrame.contentWindow?.print();
  });
};

export const printHtmlDocument = (html, { title = "Documento" } = {}) => {
  const fullHtml = html.includes("<title>")
    ? html
    : html.replace("<head>", `<head><title>${title}</title>`);
  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank", "noopener,noreferrer");

  if (!tab) {
    URL.revokeObjectURL(url);
    showPrintPreview({ html: fullHtml, title });
    return;
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
