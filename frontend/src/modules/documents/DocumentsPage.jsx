import { Download, Eye, Printer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { companyBrand, getPrintableLogo } from "../../utils/brand";

const formatMoney = (currency, value) => `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

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

const buildDocumentHtml = (document) => {
  const currency = document.totals?.currency || "COP";
  const isQuote = document.documentType === "Cotizacion" || document.documentType === "Preventa";
  const rows = document.items
    .map(
      (item) => `
        <tr>
          <td>Anaya</td>
          <td>${item.description || item.coffeeProfile || item.coffeeType || item.lotCode || "-"}</td>
          <td>${item.processType || "-"}</td>
          <td>${formatMoney(currency, item.unitPrice)}</td>
          <td>${item.quantityKg}</td>
        </tr>
      `
    )
    .join("");

  const payments = document.payments?.length
    ? `
      <h3>Pagos</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Metodo</th>
            <th>Referencia</th>
            <th>Valor</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${document.payments
            .map(
              (payment) => `
                <tr>
                  <td>${formatDate(payment.paidAt)}</td>
                  <td>${payment.paymentMethod || "-"}</td>
                  <td>${payment.paymentReference || "-"}</td>
                  <td>${formatMoney(currency, payment.amount)}</td>
                  <td>${payment.notes || "-"}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `
    : document.totals?.amountPaid !== undefined
      ? "<h3>Pagos</h3><p>No hay abonos registrados para esta venta.</p>"
    : "";

  const labReviewRows = document.items
    .filter(hasLabReview)
    .map((item) => {
      const review = item.labReview || {};
      return `
        <tr>
          <td>${item.description || item.coffeeProfile || item.coffeeType || item.lotCode || "-"}</td>
          <td>${review.humidity || "-"}</td>
          <td>${review.aroma || "-"}</td>
          <td>${review.flavor || "-"}</td>
          <td>${review.sweetness || "-"}</td>
          <td>${review.body || "-"}</td>
          <td>${review.residual || "-"}</td>
          <td>${review.cleanCup || "-"}</td>
          <td>${review.score || "-"}</td>
          <td>${review.notes || "-"}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${document.code}</title>
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
          @media print { button { display: none; } body { margin: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <img class="logo" src="${getPrintableLogo()}" alt="Anaya Coffee" />
          </div>
          <div class="company">
            <p><strong>${companyBrand.legalName}</strong></p>
            <p>NIT: ${companyBrand.nit}</p>
            <p>${companyBrand.address}</p>
            <p>Tel: ${companyBrand.phone}</p>
            <p>Email: ${companyBrand.email}</p>
            <p>Instagram: ${companyBrand.instagram}</p>
          </div>
        </header>

        <section class="recipient">
          <div>
            <p>Mr,</p>
            <p>${document.client?.name || "-"}</p>
            <p>${document.client?.address || ""}</p>
          </div>
          <div class="company">
            <p>Date: ${formatDate(document.dates?.createdAt)}</p>
            <p>${isQuote ? "Quotation" : "Invoice"} ${document.code}</p>
            ${document.externalInvoiceReference ? `<p>Factura externa: ${document.externalInvoiceReference}</p>` : ""}
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
          <tbody>${rows}</tbody>
        </table>

        <table class="terms">
          <tbody>
            <tr><td><strong>Anticipo:</strong></td><td>${document.terms?.paymentTerms || "-"}</td></tr>
            <tr><td><strong>Tiempo de entrega:</strong></td><td>${formatDate(document.dates?.estimatedDeliveryDate || document.dates?.estimatedPaymentDate)}</td></tr>
            <tr><td><strong>Empaque:</strong></td><td>${document.terms?.deliveryTerms || "-"}</td></tr>
            <tr><td><strong>Pago:</strong></td><td>${document.paymentStatus || document.status || "-"}</td></tr>
            <tr><td><strong>Datos Bancarios:</strong></td><td>Bancolombia - Ahorros - 453 0000 6876</td></tr>
            <tr><td><strong>Empresa:</strong></td><td>${companyBrand.legalName}</td></tr>
            <tr><td><strong>Nit:</strong></td><td>${companyBrand.nit}</td></tr>
          </tbody>
        </table>

        <div class="totals">
          <p><span>Subtotal</span><span>${formatMoney(currency, document.totals?.subtotal)}</span></p>
          <p><span>Envio</span><span>${formatMoney(currency, document.totals?.shippingCost)}</span></p>
          <p class="total"><span>Total</span><span>${formatMoney(currency, document.totals?.total)}</span></p>
          ${
            document.totals?.amountPaid !== undefined
              ? `<p><span>Pagado</span><span>${formatMoney(currency, document.totals.amountPaid)}</span></p>
                 <p><span>Saldo</span><span>${formatMoney(currency, document.totals.balanceDue)}</span></p>`
              : ""
          }
        </div>

        ${payments}
        ${
          labReviewRows
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
                <tbody>${labReviewRows}</tbody>
              </table>
            `
            : ""
        }
        ${document.notes ? `<h3>Notas</h3><p>${document.notes}</p>` : ""}
      </body>
    </html>
  `;
};

const DocumentsPage = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [sales, setSales] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canSeeSales = ["admin", "accounting", "warehouse"].includes(user?.role);

  const loadData = async () => {
    const requests = [apiRequest("/quotes")];

    if (canSeeSales) {
      requests.push(apiRequest("/sales"));
    }

    const [quoteData, saleData = []] = await Promise.all(requests);
    setQuotes(quoteData);
    setSales(saleData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const loadQuoteDocument = async (quoteId) => {
    const document = await apiRequest(`/documents/quotes/${quoteId}`);
    setSelectedDocument(document);
    setMessage("");
    setError("");
  };

  const loadSaleDocument = async (saleId) => {
    const document = await apiRequest(`/documents/sales/${saleId}?includePayments=true`);
    setSelectedDocument(document);
    setMessage("");
    setError("");
  };

  const printDocument = () => {
    if (!selectedDocument) {
      setError("Seleccione un documento.");
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("El navegador bloqueo la ventana de impresion.");
      return;
    }

    printWindow.document.write(buildDocumentHtml(selectedDocument));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setMessage("Documento abierto para imprimir o guardar como PDF.");
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Documentos</h1>
          <p className="text-sm text-slate-500">Cotizaciones y ventas listas para impresion o PDF.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadData()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Cotizaciones y preventas</h2>
            </div>
            {quotes.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin cotizaciones" message="No hay documentos comerciales para imprimir." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quotes.map((quote) => (
                      <tr key={quote.id}>
                        <td className="px-3 py-2 font-medium">{quote.code}</td>
                        <td className="px-3 py-2">{quote.client_name}</td>
                        <td className="px-3 py-2">
                          <StatusBadge>{quote.status}</StatusBadge>
                        </td>
                        <td className="px-3 py-2">{formatMoney(quote.currency, quote.total)}</td>
                        <td className="px-3 py-2">
                          <button
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            onClick={() => loadQuoteDocument(quote.id)}
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {canSeeSales && (
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Ventas</h2>
              </div>
              {sales.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin ventas" message="Las ventas apareceran aqui para imprimir." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Codigo</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sales.map((sale) => (
                        <tr key={sale.id}>
                          <td className="px-3 py-2 font-medium">{sale.code}</td>
                          <td className="px-3 py-2">{sale.client_name}</td>
                          <td className="px-3 py-2">
                            <StatusBadge>{sale.status}</StatusBadge>
                          </td>
                          <td className="px-3 py-2">{formatMoney(sale.currency, sale.total)}</td>
                          <td className="px-3 py-2">
                            <button
                              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                              onClick={() => loadSaleDocument(sale.id)}
                            >
                              <Eye size={14} />
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Vista previa</h2>
          {!selectedDocument ? (
            <div className="mt-3">
              <EmptyState title="Seleccione un documento" message="Aqui vera la informacion antes de imprimir." />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold text-ink">{selectedDocument.title}</p>
                <p className="text-sm text-slate-500">{selectedDocument.code}</p>
                <p className="text-sm text-slate-500">{selectedDocument.client?.name}</p>
              </div>
              <div className="rounded bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">Subtotal: {formatMoney(selectedDocument.totals.currency, selectedDocument.totals.subtotal)}</p>
                <p className="text-slate-500">Envio: {formatMoney(selectedDocument.totals.currency, selectedDocument.totals.shippingCost)}</p>
                <p className="font-semibold text-ink">Total: {formatMoney(selectedDocument.totals.currency, selectedDocument.totals.total)}</p>
                {selectedDocument.totals.amountPaid !== undefined && (
                  <>
                    <p className="text-slate-500">Pagado: {formatMoney(selectedDocument.totals.currency, selectedDocument.totals.amountPaid)}</p>
                    <p className="font-semibold text-ink">Saldo: {formatMoney(selectedDocument.totals.currency, selectedDocument.totals.balanceDue)}</p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedDocument.items.map((item, index) => (
                  <div key={`${item.description}-${index}`} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-ink">{item.description || item.coffeeProfile || item.coffeeType || item.lotCode}</p>
                    <p className="text-slate-500">
                      {[item.productForm, item.processType, item.variety].filter(Boolean).join(" · ") || "Sin detalle"} · {item.quantityKg} kg
                    </p>
                    {hasLabReview(item) && (
                      <div className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <p className="font-semibold">Analisis laboratorio</p>
                        <p>
                          Humedad {item.labReview.humidity || "-"} · Aroma {item.labReview.aroma || "-"} · Sabor {item.labReview.flavor || "-"} · Score {item.labReview.score || "-"}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {selectedDocument.payments !== undefined && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Pagos registrados</p>
                  {selectedDocument.payments.length ? (
                    selectedDocument.payments.map((payment, index) => (
                      <div key={`${payment.paymentReference}-${index}`} className="rounded border border-slate-200 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink">{formatDate(payment.paidAt)}</p>
                            <p className="text-slate-500">{payment.paymentMethod || "-"} - {payment.paymentReference || "-"}</p>
                            {payment.notes && <p className="text-slate-500">{payment.notes}</p>}
                          </div>
                          <p className="font-semibold text-ink">
                            {formatMoney(selectedDocument.totals.currency, payment.amount)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-500">Sin pagos registrados.</p>
                  )}
                </div>
              )}
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white"
                onClick={printDocument}
              >
                <Printer size={16} />
                Imprimir / guardar PDF
              </button>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Download size={14} />
                En la ventana de impresion puede elegir “Guardar como PDF”.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default DocumentsPage;
