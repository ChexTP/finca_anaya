import { companyBrand, getPrintableLogo } from "./brand";

export const formatDocumentMoney = (currency, value) => {
  return `${currency || "COP"} ${Number(value || 0).toLocaleString("es-CO")}`;
};

export const formatDocumentDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO");
};

const hasLabReview = (item) => {
  const review = item.labReview || {};
  return [
    review.humidity,
    review.aroma,
    review.flavor,
    review.sweetness,
    review.body,
    review.residual,
    review.cleanCup,
    review.score,
  ].some((value) => value !== null && value !== undefined && value !== "");
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const labels = {
  es: {
    quote: "Cotizacion de cafe",
    customer: "Cliente",
    date: "Fecha",
    quoteCode: "Cotizacion",
    intro: "De acuerdo con su solicitud, presentamos la siguiente cotizacion de cafe.",
    farm: "FINCA",
    presentation: "PRESENTACION",
    variety: "CAFE / PERFIL",
    process: "PROCESO",
    unitPrice: "PRECIO KG",
    quantity: "CANTIDAD (Kg)",
    lineTotal: "TOTAL",
    deliveryTime: "Tiempo de entrega",
    paymentTerms: "Condiciones de pago",
    deliveryTerms: "Condiciones de entrega",
    subtotal: "Subtotal",
    shipping: "Envio",
    total: "Total",
    notes: "Notas",
  },
  en: {
    quote: "Coffee quotation",
    customer: "Customer",
    date: "Date",
    quoteCode: "Quotation",
    intro: "According to your request, we are pleased to present the following coffee quotation.",
    farm: "FARM",
    presentation: "PRESENTATION",
    variety: "COFFEE / PROFILE",
    process: "PROCESS",
    unitPrice: "PRICE KG",
    quantity: "QTY (Kg)",
    lineTotal: "TOTAL",
    deliveryTime: "Delivery time",
    paymentTerms: "Payment terms",
    deliveryTerms: "Delivery terms",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    notes: "Notes",
  },
};

export const buildCommercialDocumentHtml = (document, { language = "es" } = {}) => {
  const text = labels[language] || labels.es;
  const currency = document.totals?.currency || "COP";
  const isQuote = document.documentType === "Cotizacion" || document.documentType === "Preventa";
  const showCommercialAmounts = isQuote;
  const rows = document.items
    ?.map((item) => {
      const description = item.description || item.coffeeProfile || item.coffeeType || item.lotCode || "-";
      return `
        <tr>
          <td>Anaya</td>
          <td><strong>${escapeHtml(item.productForm || "-")}</strong></td>
          <td>${escapeHtml(description)}</td>
          <td>${escapeHtml(item.processType || "-")}</td>
          ${showCommercialAmounts ? `<td>${formatDocumentMoney(currency, item.unitPrice)}</td>` : ""}
          <td>${escapeHtml(item.quantityKg || "-")}</td>
          ${showCommercialAmounts ? `<td>${formatDocumentMoney(currency, item.lineTotal)}</td>` : ""}
        </tr>
      `;
    })
    .join("");

  const labRows = document.items
    ?.filter(hasLabReview)
    .map((item) => {
      const review = item.labReview || {};
      const description = item.description || item.coffeeProfile || item.coffeeType || item.lotCode || "-";

      return `
        <tr>
          <td>${escapeHtml(description)}</td>
          <td>${escapeHtml(review.humidity || "-")}</td>
          <td>${escapeHtml(review.aroma || "-")}</td>
          <td>${escapeHtml(review.flavor || "-")}</td>
          <td>${escapeHtml(review.sweetness || "-")}</td>
          <td>${escapeHtml(review.body || "-")}</td>
          <td>${escapeHtml(review.residual || "-")}</td>
          <td>${escapeHtml(review.cleanCup || "-")}</td>
          <td>${escapeHtml(review.score || "-")}</td>
          <td>${escapeHtml(review.notes || "-")}</td>
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
          .logo { height: 72px; object-fit: contain; width: 150px; }
          .company { text-align: right; }
          .recipient { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 12px 0 16px; }
          .intro { margin: 16px 0 8px; }
          .totals { margin-left: auto; margin-top: 16px; width: 280px; }
          .totals p { display: flex; justify-content: space-between; }
          .total { border-top: 1px solid #111827; font-weight: 700; padding-top: 6px; }
          .terms { margin-top: 18px; width: 520px; }
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
            <p><strong>${text.customer}</strong></p>
            <p>${escapeHtml(document.client?.name || "-")}</p>
            <p>${escapeHtml(document.client?.address || "")}</p>
            <p>${escapeHtml(document.client?.phone || "")}</p>
            <p>${escapeHtml(document.client?.email || "")}</p>
          </div>
          <div class="company">
            <p>${text.date}: ${formatDocumentDate(document.dates?.createdAt)}</p>
            <p>${text.quoteCode}: ${escapeHtml(document.code)}</p>
          </div>
        </section>

        <h1>${text.quote}</h1>
        <p class="intro">${text.intro}</p>

        <table>
          <thead>
            <tr>
              <th>${text.farm}</th>
              <th>${text.presentation}</th>
              <th>${text.variety}</th>
              <th>${text.process}</th>
              ${showCommercialAmounts ? `<th>${text.unitPrice}</th>` : ""}
              <th>${text.quantity}</th>
              ${showCommercialAmounts ? `<th>${text.lineTotal}</th>` : ""}
            </tr>
          </thead>
          <tbody>${rows || ""}</tbody>
        </table>

        <table class="terms">
          <tbody>
            <tr><td><strong>${text.deliveryTime}:</strong></td><td>${formatDocumentDate(document.dates?.estimatedDeliveryDate || document.dates?.estimatedPaymentDate)}</td></tr>
            <tr><td><strong>${text.paymentTerms}:</strong></td><td>${escapeHtml(document.terms?.paymentTerms || "-")}</td></tr>
            <tr><td><strong>${text.deliveryTerms}:</strong></td><td>${escapeHtml(document.terms?.deliveryTerms || "-")}</td></tr>
            <tr><td><strong>Empresa:</strong></td><td>${escapeHtml(companyBrand.legalName)}</td></tr>
            <tr><td><strong>Nit:</strong></td><td>${escapeHtml(companyBrand.nit)}</td></tr>
          </tbody>
        </table>

        ${showCommercialAmounts ? `<div class="totals">
          <p><span>${text.subtotal}</span><span>${formatDocumentMoney(currency, document.totals?.subtotal)}</span></p>
          <p><span>${text.shipping}</span><span>${formatDocumentMoney(currency, document.totals?.shippingCost)}</span></p>
          <p class="total"><span>${text.total}</span><span>${formatDocumentMoney(currency, document.totals?.total)}</span></p>
        </div>` : ""}

        ${
          labRows
            ? `
              <h3>Analisis de laboratorio</h3>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Humedad</th>
                    <th>Aroma</th>
                    <th>Sabor</th>
                    <th>Dulzor</th>
                    <th>Cuerpo</th>
                    <th>Residual</th>
                    <th>Taza limpia</th>
                    <th>Score</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>${labRows}</tbody>
              </table>
            `
            : ""
        }

        ${document.notes ? `<h3>${text.notes}</h3><p>${escapeHtml(document.notes)}</p>` : ""}

        ${
          document.dispatchReceipt?.hasImage
            ? `
              <h3>Soporte de despacho</h3>
              <p>Recibo cargado${document.dispatchReceipt.fileName ? `: ${escapeHtml(document.dispatchReceipt.fileName)}` : ""}</p>
              <p>Fecha soporte: ${formatDocumentDate(document.dispatchReceipt.uploadedAt)}</p>
            `
            : ""
        }
      </body>
    </html>
  `;
};

export const openCommercialDocumentPrint = (document, options = {}) => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("El navegador bloqueo la ventana de impresion.");
  }

  printWindow.document.write(buildCommercialDocumentHtml(document, options));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
