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

export const printHtmlDocument = (html, { title = "Documento", showPreviewAfterPrint = true } = {}) => {
  const iframe = document.createElement("iframe");
  const originalTitle = document.title;
  iframe.title = title;
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const printDocument = iframe.contentWindow?.document;

  if (!printDocument) {
    iframe.remove();
    throw new Error("No se pudo preparar el documento para imprimir.");
  }

  printDocument.open();
  printDocument.write(html);
  printDocument.close();

  const removeFrame = () => {
    setTimeout(() => {
      iframe.remove();
      document.title = originalTitle;
      if (showPreviewAfterPrint) {
        showPrintPreview({ html, title });
      }
    }, 1000);
  };

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    document.title = title;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    removeFrame();
  };

  iframe.onload = triggerPrint;
  setTimeout(triggerPrint, 250);
};
