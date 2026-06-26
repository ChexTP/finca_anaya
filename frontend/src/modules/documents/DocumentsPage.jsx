import { Download, Eye, Printer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

const formatMoney = (currency, value) => `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("es-CO");
};

const buildDocumentHtml = (document) => {
  const currency = document.totals?.currency || "COP";
  const rows = document.items
    .map(
      (item) => `
        <tr>
          <td>${item.lotCode || item.coffeeProfile || item.coffeeType || item.description || "-"}</td>
          <td>${item.description || "-"}</td>
          <td>${item.quantityKg} kg</td>
          <td>${formatMoney(currency, item.unitPrice)}</td>
          <td>${formatMoney(currency, item.lineTotal)}</td>
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

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${document.code}</title>
        <style>
          body { color: #17201a; font-family: Arial, sans-serif; margin: 32px; }
          header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #d8ded8; padding-bottom: 16px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          h2 { font-size: 16px; margin: 24px 0 8px; }
          h3 { font-size: 14px; margin: 18px 0 8px; }
          p { font-size: 12px; margin: 3px 0; }
          table { border-collapse: collapse; margin-top: 14px; width: 100%; }
          th, td { border: 1px solid #d8ded8; font-size: 12px; padding: 8px; text-align: left; }
          th { background: #f3f6f3; }
          .totals { margin-left: auto; margin-top: 16px; width: 280px; }
          .totals p { display: flex; justify-content: space-between; }
          .total { border-top: 1px solid #17201a; font-weight: 700; padding-top: 6px; }
          @media print { button { display: none; } body { margin: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${document.title}</h1>
            <p><strong>Codigo:</strong> ${document.code}</p>
            <p><strong>Estado:</strong> ${document.status || document.paymentStatus || "-"}</p>
            ${document.externalInvoiceReference ? `<p><strong>Factura externa:</strong> ${document.externalInvoiceReference}</p>` : ""}
          </div>
          <div>
            <p><strong>${document.company?.name || "Finca Anaya"}</strong></p>
            <p>${document.company?.phone || ""}</p>
            <p>${document.company?.email || ""}</p>
            <p>${document.company?.address || ""}</p>
          </div>
        </header>

        <h2>Cliente</h2>
        <p><strong>Nombre:</strong> ${document.client?.name || "-"}</p>
        <p><strong>Telefono:</strong> ${document.client?.phone || "-"}</p>
        <p><strong>Direccion:</strong> ${document.client?.address || "-"}</p>
        <p><strong>Vendedor:</strong> ${document.seller?.name || "-"}</p>
        <p><strong>Fecha:</strong> ${formatDate(document.dates?.createdAt)}</p>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Descripcion</th>
              <th>Cantidad</th>
              <th>Precio kg</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
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
                    <p className="text-slate-500">{item.quantityKg} kg</p>
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
