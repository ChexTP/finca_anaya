export const printHtmlDocument = (html, { title = "Documento" } = {}) => {
  const iframe = document.createElement("iframe");
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
    setTimeout(() => iframe.remove(), 1000);
  };

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    removeFrame();
  };

  iframe.onload = triggerPrint;
  setTimeout(triggerPrint, 250);
};
