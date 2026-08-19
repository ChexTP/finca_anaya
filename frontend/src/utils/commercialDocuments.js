import { companyBrand, getPrintableLogo } from "./brand";
import { formatRequestedKg } from "./coffeeCalculations";
import { printable } from "./printFormatting";

export const formatDocumentMoney = (currency, value) => {
  return `${currency || "COP"} ${Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  })}`;
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
    quote: "Cotización de Café",
    customer: "Cliente",
    date: "Fecha cotizacion",
    estimatedDeliveryDate: "Entrega estimada",
    quoteCode: "Cotizacion",
    intro: "De acuerdo con su solicitud, tenemos el placer de presentarle la siguiente oferta:",
    farm: "FINCA",
    presentation: "PRESENTACION",
    variety: "CAFE / PERFIL",
    process: "PROCESO",
    unitPrice: "PRECIO",
    quantity: "CANTIDAD (Kg)",
    lineTotal: "TOTAL",
    deliveryTime: "Tiempo de entrega",
    advance: "Anticipo",
    standard: "Norma / Factor",
    delivery: "Entrega",
    packaging: "Empaque",
    minimumOrder: "Pedido minimo",
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
    labAnalysis: "Analisis de laboratorio",
    product: "Producto",
    humidity: "Humedad",
    aroma: "Aroma",
    flavor: "Sabor",
    sweetness: "Dulzor",
    body: "Cuerpo",
    residual: "Residual",
    cleanCup: "Taza limpia",
    score: "Score",
    labNotes: "Notas",
    dispatchSupport: "Soporte de despacho",
    receiptUploaded: "Recibo cargado",
    supportDate: "Fecha soporte",
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
    unitPrice: "PRICE",
    quantity: "QTY (Kg)",
    lineTotal: "TOTAL",
    deliveryTime: "Delivery time",
    advance: "Advance payment",
    standard: "Standard / Factor",
    delivery: "Delivery",
    packaging: "Packaging",
    minimumOrder: "Minimum order",
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
    labAnalysis: "Laboratory analysis",
    product: "Product",
    humidity: "Humidity",
    aroma: "Aroma",
    flavor: "Flavor",
    sweetness: "Sweetness",
    body: "Body",
    residual: "Aftertaste",
    cleanCup: "Clean cup",
    score: "Score",
    labNotes: "Notes",
    dispatchSupport: "Dispatch support",
    receiptUploaded: "Receipt uploaded",
    supportDate: "Support date",
  },
};

const defaultQuoteTerms = {
  es: {
    advance: "30%",
    deliveryTime: "20 dias",
    minimumOrder: "12 Kg",
    standard: "3/20 UGQ",
    delivery: "",
    packaging: "Bolsa y tula tradicional",
    payment: "Consignacion nacional",
  },
  en: {
    advance: "30%",
    deliveryTime: "20 days",
    minimumOrder: "12 Kg",
    standard: "3/20 UGQ",
    delivery: "",
    packaging: "Traditional bag and jute sack",
    payment: "National bank transfer",
  },
};

const englishTermTranslations = {
  "8 dias": "8 days",
  "20 dias": "20 days",
  "12 Kg": "12 Kg",
  "Descripcion libre": "Free description",
  "Contraentrega en Pitalito Huila": "Cash on delivery in Pitalito Huila",
  "Pitalito Huila": "Pitalito Huila",
  "Bolsa y tula tradicional": "Traditional bag and jute sack",
  "Cajas x 20 Kg al vacio": "20 Kg vacuum boxes",
  "Cajas x 24 Kg al vacio": "24 Kg vacuum boxes",
  "Sacos x 70 Kg + bolsa": "70 Kg sacks + bag",
  "Sacos x 35 Kg + bolsa": "35 Kg sacks + bag",
  "Consignacion nacional": "National bank transfer",
  "Bancolombia - Ahorros - 453 0000 6876": "Bancolombia - Savings - 453 0000 6876",
};

const formatTermValue = (value, fallback, language) => {
  const term = value || fallback;
  if (language !== "en") return term;
  return englishTermTranslations[term] || term;
};

const englishCommercialTranslations = {
  Excelso: "Green bean",
  Pergamino: "Parchment coffee",
  "Al vacio": "Vacuum",
  "Empaque tradicional": "Traditional packaging",
  "Pergamino tradicional": "Traditional parchment coffee",
  Lavado: "Washed",
  Natural: "Natural",
  Semilavado: "Semi-washed",
  Honey: "Honey",
};

const formatCommercialValue = (value, language) => {
  if (language !== "en") return printable(value);

  return printable(englishCommercialTranslations[value] || value);
};

const formatPresentation = ({ productForm, packaging }, language) => {
  if (language !== "en") {
    return printable([productForm, packaging].filter(Boolean).join(" - "));
  }

  const translatedProductForm = englishCommercialTranslations[productForm] || productForm;
  const translatedPackaging = englishCommercialTranslations[packaging] || packaging;

  return printable([translatedProductForm, translatedPackaging].filter(Boolean).join(" - "));
};

const formatItemUnitPrice = (currency, item) => {
  const basis = item.priceBasis || item.pricingSnapshot?.priceBasis || item.pricing_snapshot?.priceBasis || "kg";
  const suffix = currency === "USD" && basis === "lb" ? "/LB" : "/KG";
  return `${formatDocumentMoney(currency, item.unitPrice)} ${suffix}`;
};

const getBankRows = (terms, text, language) => {
  if (language === "en") {
    return [
      ["Bank Country", terms.bankCountry || "Colombia"],
      ["Bank Name (Beneficiary)", terms.bankName || "Bancolombia"],
      ["SWIFT Code", terms.swiftCode || "COLOCOBM"],
      ["Account Number", terms.accountNumber || "453-000054-46 (Savings Account)"],
      ["Beneficiary Name", terms.beneficiaryName || "GLOBOX SAS"],
      ["Tax ID (Liendre)", terms.beneficiaryTaxId || "901.729.179"],
    ];
  }

  return [
    [text.payment, terms.paymentTerms || "Consignacion nacional"],
    [text.bankDetails, terms.bankDetails || "Bancolombia - Ahorros - 453 0000 6876"],
    [text.company, terms.company || "Asociación Huila Coffee Farmers"],
    [text.taxId, terms.taxId || "901847571"],
  ];
};

export const buildCommercialDocumentHtml = (document, { language = "es" } = {}) => {
  const text = labels[language] || labels.es;
  const defaultTerms = defaultQuoteTerms[language] || defaultQuoteTerms.es;
  const currency = document.totals?.currency || "COP";
  const isPriceList = document.documentType === "ListaPrecios";
  const isQuote = document.documentType === "Cotizacion" || document.documentType === "Preventa" || isPriceList;
  const showUnitPrice = isQuote;
  const showQuantityAndTotal = isQuote && !isPriceList;
  const terms = document.terms || {};
  const rows = document.items
    ?.map((item) => {
      const description = item.description || item.coffeeProfile || item.coffeeType || item.lotCode || "-";
      const itemPackaging = item.pricingSnapshot?.packaging || item.pricing_snapshot?.packaging || item.packaging;
      const presentation = formatPresentation({
        productForm: item.productForm,
        packaging: itemPackaging,
      }, language);
      return `
        <tr>
          <td>Anaya</td>
          <td><strong>${escapeHtml(presentation)}</strong></td>
          <td>${escapeHtml(printable(description))}</td>
          <td>${escapeHtml(formatCommercialValue(item.processType, language))}</td>
          ${showUnitPrice ? `<td>${formatItemUnitPrice(currency, item)}</td>` : ""}
          ${showQuantityAndTotal ? `<td>${escapeHtml(formatRequestedKg(item.quantityKg, {
            locale: language === "en" ? "en-US" : "es-CO",
            suffix: "",
          }))}</td>` : ""}
          ${showQuantityAndTotal ? `<td>${formatDocumentMoney(currency, item.lineTotal)}</td>` : ""}
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

        <h1>${isPriceList ? (language === "en" ? "Coffee Price List" : "Lista de precios de café") : text.quote}</h1>
        <p class="intro">${isPriceList
          ? escapeHtml(language === "en" ? "According to your request, we are pleased to present the following coffee price list." : "De acuerdo con su solicitud, presentamos la siguiente lista de precios de café.")
          : text.intro}</p>

        <table>
          <thead>
            <tr>
              <th>${text.farm}</th>
              <th>${text.presentation}</th>
              <th>${text.variety}</th>
              <th>${text.process}</th>
              ${showUnitPrice ? `<th>${text.unitPrice}</th>` : ""}
              ${showQuantityAndTotal ? `<th>${text.quantity}</th>` : ""}
              ${showQuantityAndTotal ? `<th>${text.lineTotal}</th>` : ""}
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
              <tr><td>${text.minimumOrder}:</td><td>${escapeHtml(formatTermValue(terms.minimumOrder, defaultTerms.minimumOrder, language))}</td></tr>
              <tr><td>${text.standard}:</td><td>${escapeHtml(formatTermValue(terms.qualityRule || terms.standard, defaultTerms.standard, language))}</td></tr>
              <tr><td>${text.delivery}:</td><td>${escapeHtml(formatTermValue(terms.deliveryTerms, defaultTerms.delivery, language))}</td></tr>
              <tr><td>${text.packaging}:</td><td>${escapeHtml(formatTermValue(terms.packaging, defaultTerms.packaging, language))}</td></tr>
              ${getBankRows(terms, text, language).map(([label, value]) => `<tr><td>${escapeHtml(label)}:</td><td>${escapeHtml(formatTermValue(value, value, language))}</td></tr>`).join("")}
            </tbody>
          </table>
        </section>

        ${showQuantityAndTotal ? `<div class="totals">
          <p><span>${text.subtotal}</span><span>${formatDocumentMoney(currency, document.totals?.subtotal)}</span></p>
          <p><span>${text.shipping}</span><span>${formatDocumentMoney(currency, document.totals?.shippingCost)}</span></p>
          <p class="total"><span>${text.total}</span><span>${formatDocumentMoney(currency, document.totals?.total)}</span></p>
        </div>` : ""}

        ${
          labRows
            ? `
              <h3>${text.labAnalysis}</h3>
              <table>
                <thead>
                  <tr>
                    <th>${text.product}</th>
                    <th>${text.humidity}</th>
                    <th>${text.aroma}</th>
                    <th>${text.flavor}</th>
                    <th>${text.sweetness}</th>
                    <th>${text.body}</th>
                    <th>${text.residual}</th>
                    <th>${text.cleanCup}</th>
                    <th>${text.score}</th>
                    <th>${text.labNotes}</th>
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
              <h3>${text.dispatchSupport}</h3>
              <p>${text.receiptUploaded}${document.dispatchReceipt.fileName ? `: ${escapeHtml(document.dispatchReceipt.fileName)}` : ""}</p>
              <p>${text.supportDate}: ${formatDocumentDate(document.dispatchReceipt.uploadedAt)}</p>
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

export const buildPriceListDocumentHtml = ({ client, currency = "COP", language = "es", terms = {}, items = [] }) => {
  const text = labels[language] || labels.es;
  const title = language === "en" ? "Coffee Price List" : "Lista de precios de café";
  const intro = language === "en"
    ? "According to your request, we are pleased to present the following coffee price list."
    : "De acuerdo con su solicitud, tenemos el placer de presentarle la siguiente lista de precios:";
  const priceHeader = currency === "USD" ? "PRECIO LB USD" : "PRECIO KG COP";
  const rows = items.map((item) => `
    <tr>
      <td>${escapeHtml(formatCommercialValue(item.productForm, language))}</td>
      <td>${escapeHtml(printable(item.name))}</td>
      <td>${escapeHtml(formatCommercialValue(item.processType, language))}</td>
      <td>${escapeHtml(formatCommercialValue(item.packaging || "", language))}</td>
      <td>${currency === "USD" ? `USD ${Number(item.usdLbExw || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : formatDocumentMoney("COP", item.kgVacuumPriceCop)}</td>
    </tr>
  `).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { color: #111827; font-family: Arial, sans-serif; margin: 32px; }
          header { align-items: flex-start; display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
          h1 { font-size: 19px; margin: 18px 0 8px; }
          p { font-size: 12px; margin: 3px 0; }
          table { border-collapse: collapse; margin-top: 14px; width: 100%; }
          th, td { border: 1px solid #111827; font-size: 12px; padding: 7px; text-align: center; vertical-align: middle; }
          th { background: #f2f2f2; font-weight: 700; }
          .logo { height: 78px; object-fit: contain; width: 165px; }
          .company { text-align: right; }
        </style>
      </head>
      <body>
        <header>
          <img class="logo" src="${getPrintableLogo()}" alt="Anaya Coffee" />
          <div class="company">
            <p><strong>${escapeHtml(companyBrand.legalName)}</strong></p>
            <p>NIT: ${escapeHtml(companyBrand.nit)}</p>
            <p>${escapeHtml(companyBrand.address)}</p>
            <p>Tel: ${escapeHtml(companyBrand.phone)}</p>
          </div>
        </header>
        ${client?.name ? `<p><strong>${text.customer}</strong></p><p>${escapeHtml(printable(client.name))}</p>` : ""}
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(intro)}</p>
        <table>
          <thead>
            <tr>
              <th>${text.presentation}</th>
              <th>${text.variety}</th>
              <th>${text.process}</th>
              <th>${language === "en" ? "PACKAGING" : "EMPAQUE"}</th>
              <th>${escapeHtml(priceHeader)}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="terms">
          <h2>${text.termsTitle}</h2>
          <table>
            <tbody>
              <tr><td>${text.advance}:</td><td>${escapeHtml(formatTermValue(terms.advance, defaultQuoteTerms[language]?.advance || defaultQuoteTerms.es.advance, language))}</td></tr>
              <tr><td>${text.deliveryTime}:</td><td>${escapeHtml(formatTermValue(terms.deliveryTime, defaultQuoteTerms[language]?.deliveryTime || defaultQuoteTerms.es.deliveryTime, language))}</td></tr>
              <tr><td>${text.minimumOrder}:</td><td>${escapeHtml(formatTermValue(terms.minimumOrder, defaultQuoteTerms[language]?.minimumOrder || defaultQuoteTerms.es.minimumOrder, language))}</td></tr>
              <tr><td>${text.standard}:</td><td>${escapeHtml(formatTermValue(terms.qualityRule || terms.standard, defaultQuoteTerms[language]?.standard || defaultQuoteTerms.es.standard, language))}</td></tr>
              <tr><td>${text.delivery}:</td><td>${escapeHtml(formatTermValue(terms.deliveryTerms, defaultQuoteTerms[language]?.delivery || defaultQuoteTerms.es.delivery, language))}</td></tr>
              <tr><td>${text.packaging}:</td><td>${escapeHtml(formatTermValue(terms.packaging, defaultQuoteTerms[language]?.packaging || defaultQuoteTerms.es.packaging, language))}</td></tr>
              ${getBankRows(terms, text, language).map(([label, value]) => `<tr><td>${escapeHtml(label)}:</td><td>${escapeHtml(formatTermValue(value, value, language))}</td></tr>`).join("")}
            </tbody>
          </table>
        </section>
      </body>
    </html>
  `;
};

export const openPriceListDocumentPrint = (document) => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("El navegador bloqueo la ventana de impresion.");
  }

  printWindow.document.write(buildPriceListDocumentHtml(document));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
