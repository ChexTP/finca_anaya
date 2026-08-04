import { companyBrand, getPrintableLogo } from "./brand";
import { printable } from "./printFormatting";

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
    date: "Fecha cotizacion",
    estimatedDeliveryDate: "Entrega estimada",
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
    advance: "Anticipo",
    standard: "Norma",
    delivery: "Entrega",
    packaging: "Empaque",
    payment: "Pago",
    bankDetails: "Datos Bancarios",
    company: "Empresa",
    taxId: "Nit",
    paymentTerms: "Condiciones de pago",
    deliveryTerms: "Condiciones de entrega",
    subtotal: "Subtotal",
    shipping: "Envio",
    total: "Total",
    notes: "Notas",
    termsTitle: "Terminos:",
  },
  en: {
    quote: "Coffee quotation",
    customer: "Customer",
    date: "Quotation date",
    estimatedDeliveryDate: "Estimated delivery",
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
    advance: "Advance payment",
    standard: "Standard",
    delivery: "Delivery",
    packaging: "Packaging",
    payment: "Payment",
    bankDetails: "Bank details",
    company: "Company",
    taxId: "Tax ID",
    paymentTerms: "Payment terms",
    deliveryTerms: "Delivery terms",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    notes: "Notes",
    termsTitle: "Terms:",
  },
};

const defaultQuoteTerms = {
  es: {
    advance: "30%",
    deliveryTime: "20 dias",
    standard: "3/20 UGQ o EP",
    delivery: "Contraentrega en Pitalito Huila",
    packaging: "Tula y bolsa tradicional",
    payment: "Consignacion nacional",
  },
  en: {
    advance: "30%",
    deliveryTime: "20 days",
    standard: "3/20 UGQ or EP",
    delivery: "Cash on delivery in Pitalito Huila",
    packaging: "Traditional bag and jute sack",
    payment: "National bank deposit",
  },
};

const englishTermTranslations = {
  "8 dias": "8 days",
  "20 dias": "20 days",
  "0/20 UGQ o EP": "0/20 UGQ or EP",
  "3/20 UGQ o EP": "3/20 UGQ or EP",
  "8/35 UGQ o EP": "8/35 UGQ or EP",
  "12/60 UGQ o EP": "12/60 UGQ or EP",
  "Contraentrega en Pitalito Huila": "Cash on delivery in Pitalito Huila",
  "Pitalito Huila": "Pitalito Huila",
  "Tula y bolsa tradicional": "Traditional bag and jute sack",
  "Empaque al vacio 20kg o 24kg": "Vacuum packaging 20kg or 24kg",
  "Sacos por 70kg mas bolsa": "70kg sacks plus bag",
  "Sacos por 35kg mas bolsa": "35kg sacks plus bag",
  "Consignacion nacional": "National bank deposit",
  "Bancolombia - Ahorros - 453 0000 6876": "Bancolombia - Savings - 453 0000 6876",
};

const formatTermValue = (value, fallback, language) => {
  const term = value || fallback;
  if (language !== "en") return term;
  return englishTermTranslations[term] || term;
};

export const buildCommercialDocumentHtml = (document, { language = "es" } = {}) => {
  const text = labels[language] || labels.es;
  const defaultTerms = defaultQuoteTerms[language] || defaultQuoteTerms.es;
  const currency = document.totals?.currency || "COP";
  const isQuote = document.documentType === "Cotizacion" || document.documentType === "Preventa";
  const showCommercialAmounts = isQuote;
  const terms = document.terms || {};
  const rows = document.items
    ?.map((item) => {
      const description = item.description || item.coffeeProfile || item.coffeeType || item.lotCode || "-";
      return `
        <tr>
          <td>Anaya</td>
          <td><strong>${escapeHtml(printable(item.productForm))}</strong></td>
          <td>${escapeHtml(printable(description))}</td>
          <td>${escapeHtml(printable(item.processType))}</td>
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
          <td>${escapeHtml(printable(description))}</td>
          <td>${escapeHtml(review.humidity || "-")}</td>
          <td>${escapeHtml(printable(review.aroma))}</td>
          <td>${escapeHtml(printable(review.flavor))}</td>
          <td>${escapeHtml(printable(review.sweetness))}</td>
          <td>${escapeHtml(printable(review.body))}</td>
          <td>${escapeHtml(printable(review.residual))}</td>
          <td>${escapeHtml(printable(review.cleanCup))}</td>
          <td>${escapeHtml(review.score || "-")}</td>
          <td>${escapeHtml(printable(review.notes))}</td>
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
          .logo { height: 72px; object-fit: contain; width: 150px; }
          .company { text-align: right; }
          .recipient { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 12px 0 16px; }
          .client-box p { line-height: 1.35; }
          .intro { margin: 16px 0 8px; }
          .totals { margin-left: auto; margin-top: 16px; width: 280px; }
          .totals p { display: flex; justify-content: space-between; }
          .total { border-top: 1px solid #111827; font-weight: 700; padding-top: 6px; }
          .terms { margin-top: 22px; width: 620px; }
          .terms h2 { font-size: 14px; margin: 0 0 14px; }
          .terms table { border-collapse: collapse; margin-top: 0; width: 100%; }
          .terms td { border: 0; font-size: 13px; padding: 2px 6px; text-align: left; }
          .terms td:first-child { font-weight: 700; width: 210px; }
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
            <p><strong>${escapeHtml(printable(document.client?.name))}</strong></p>
            ${document.client?.documentType || document.client?.documentNumber ? `<p>${escapeHtml(document.client?.documentType || "Documento")}: ${escapeHtml(document.client?.documentNumber || "-")}</p>` : ""}
            ${document.client?.address ? `<p>${escapeHtml(printable(document.client.address))}</p>` : ""}
            ${document.client?.city || document.client?.country ? `<p>${escapeHtml([printable(document.client?.city, ""), printable(document.client?.country, "")].filter(Boolean).join(" - "))}</p>` : ""}
            ${document.client?.phone ? `<p>${escapeHtml(document.client.phone)}</p>` : ""}
            ${document.client?.email ? `<p>${escapeHtml(String(document.client.email).toLocaleLowerCase("es-CO"))}</p>` : ""}
          </div>
          <div class="company">
            <p>${text.date}: ${formatDocumentDate(document.dates?.createdAt)}</p>
            ${document.dates?.estimatedDeliveryDate ? `<p>${text.estimatedDeliveryDate}: ${formatDocumentDate(document.dates.estimatedDeliveryDate)}</p>` : ""}
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

        <section class="terms">
          <h2>${text.termsTitle}</h2>
          <table>
            <tbody>
              <tr><td>${text.advance}:</td><td>${escapeHtml(formatTermValue(terms.advance, defaultTerms.advance, language))}</td></tr>
              <tr><td>${text.deliveryTime}:</td><td>${escapeHtml(formatTermValue(terms.deliveryTime, defaultTerms.deliveryTime, language))}</td></tr>
              <tr><td>${text.standard}:</td><td>${escapeHtml(formatTermValue(terms.standard, defaultTerms.standard, language))}</td></tr>
              <tr><td>${text.delivery}:</td><td>${escapeHtml(formatTermValue(terms.deliveryTerms, defaultTerms.delivery, language))}</td></tr>
              <tr><td>${text.packaging}:</td><td>${escapeHtml(formatTermValue(terms.packaging, defaultTerms.packaging, language))}</td></tr>
              <tr><td>${text.payment}:</td><td>${escapeHtml(formatTermValue(terms.paymentTerms, defaultTerms.payment, language))}</td></tr>
              <tr><td>${text.bankDetails}:</td><td>${escapeHtml(formatTermValue(terms.bankDetails, companyBrand.bankDetails, language))}</td></tr>
              <tr><td>${text.company}:</td><td>${escapeHtml(terms.company || companyBrand.legalName)}</td></tr>
              <tr><td>${text.taxId}:</td><td>${escapeHtml(terms.taxId || companyBrand.nit)}</td></tr>
            </tbody>
          </table>
        </section>

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
