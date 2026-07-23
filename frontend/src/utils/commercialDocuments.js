import { companyBrand, getPrintableLogo } from "./brand";

export const formatDocumentMoney = (currency, value) => {
  return `${currency || "COP"} ${Number(value || 0).toLocaleString("es-CO")}`;
};

export const formatDocumentDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO");
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

export const buildCommercialDocumentHtml = (document) => {
  const currency = document.totals?.currency || "COP";
  const isQuote = document.documentType === "Cotizacion" || document.documentType === "Preventa";
  const rows = document.items
    ?.map((item) => {
      const description = item.description || item.coffeeProfile || item.coffeeType || item.lotCode || "-";
      return `
        <tr>
          <td>Anaya</td>
          <td>${escapeHtml(description)}</td>
          <td>${escapeHtml(item.processType || "-")}</td>
          <td>${formatDocumentMoney(currency, item.unitPrice)}</td>
          <td>${escapeHtml(item.quantityKg || "-")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(document.code)}</title>
        <style>
          body { color: #111827; font-family: Arial, sans-serif; margin: 32px; }
          header { align-items: flex-start; display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
          h1 { font-size: 18px; margin: 0 0 6px; }
          h2 { font-size: 15px; margin: 24px 0 8px; }
          h3 { font-size: 14px; margin: 18px 0 8px; }
          p { font-size: 12px; margin: 3px 0; }
          table { border-collapse: collapse; margin-top: 14px; width: 100%; }
          th, td { border: 1px solid #111827; font-size: 12px; padding: 7px; text-align: center; vertical-align: middle; }
          th { background: #f2f2f2; font-weight: 700; }
          td:nth-child(2) { text-align: left; }
          .logo { border-radius: 3px; height: 58px; object-fit: cover; width: 98px; }
          .company { text-align: right; }
          .recipient { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 12px 0 16px; }
          .intro { margin: 16px 0 8px; }
          .totals { margin-left: auto; margin-top: 16px; width: 280px; }
          .totals p { display: flex; justify-content: space-between; }
          .total { border-top: 1px solid #111827; font-weight: 700; padding-top: 6px; }
          .terms { margin-top: 18px; width: 420px; }
          .terms td { text-align: left; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <img class="logo" src="${getPrintableLogo()}" alt="Anaya Coffee" />
          </div>
          <div class="company">
            <p><strong>${escapeHtml(companyBrand.legalName)}</strong></p>
            <p>NIT: ${escapeHtml(companyBrand.nit)}</p>
            <p>${escapeHtml(companyBrand.address)}</p>
            <p>Tel: ${escapeHtml(companyBrand.phone)}</p>
            <p>Email: ${escapeHtml(companyBrand.email)}</p>
            <p>Instagram: ${escapeHtml(companyBrand.instagram)}</p>
          </div>
        </header>

        <section class="recipient">
          <div>
            <p>Mr,</p>
            <p>${escapeHtml(document.client?.name || "-")}</p>
            <p>${escapeHtml(document.client?.address || "")}</p>
          </div>
          <div class="company">
            <p>Date: ${formatDocumentDate(document.dates?.createdAt)}</p>
            <p>${isQuote ? "Quotation" : "Invoice"} ${escapeHtml(document.code)}</p>
            ${document.externalInvoiceReference ? `<p>Factura externa: ${escapeHtml(document.externalInvoiceReference)}</p>` : ""}
          </div>
        </section>

        <p class="intro">${isQuote ? "Tenemos el placer de compartirle la siguiente oferta:" : "Detalle interno de venta:"}</p>

        <table>
          <thead>
            <tr>
              <th>FARM</th>
              <th>VARIETY</th>
              <th>PROCESS</th>
              <th>KG-CPS</th>
              <th>QTY (Kg)</th>
            </tr>
          </thead>
          <tbody>${rows || ""}</tbody>
        </table>

        <table class="terms">
          <tbody>
            <tr><td><strong>Anticipo:</strong></td><td>${escapeHtml(document.terms?.paymentTerms || "-")}</td></tr>
            <tr><td><strong>Tiempo de entrega:</strong></td><td>${formatDocumentDate(document.dates?.estimatedDeliveryDate || document.dates?.estimatedPaymentDate)}</td></tr>
            <tr><td><strong>Empaque:</strong></td><td>${escapeHtml(document.terms?.deliveryTerms || "-")}</td></tr>
            <tr><td><strong>Pago:</strong></td><td>${escapeHtml(document.paymentStatus || document.status || "-")}</td></tr>
            <tr><td><strong>Datos Bancarios:</strong></td><td>Bancolombia - Ahorros - 453 0000 6876</td></tr>
            <tr><td><strong>Empresa:</strong></td><td>${escapeHtml(companyBrand.legalName)}</td></tr>
            <tr><td><strong>Nit:</strong></td><td>${escapeHtml(companyBrand.nit)}</td></tr>
          </tbody>
        </table>

        <div class="totals">
          <p><span>Subtotal</span><span>${formatDocumentMoney(currency, document.totals?.subtotal)}</span></p>
          <p><span>Envio</span><span>${formatDocumentMoney(currency, document.totals?.shippingCost)}</span></p>
          <p class="total"><span>Total</span><span>${formatDocumentMoney(currency, document.totals?.total)}</span></p>
        </div>

        ${document.notes ? `<h3>Notas</h3><p>${escapeHtml(document.notes)}</p>` : ""}
      </body>
    </html>
  `;
};

export const openCommercialDocumentPrint = (document) => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("El navegador bloqueo la ventana de impresion.");
  }

  printWindow.document.write(buildCommercialDocumentHtml(document));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
