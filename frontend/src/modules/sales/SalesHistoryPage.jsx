import { Download, Eye, Printer, RefreshCw } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { openCommercialDocumentPrint } from "../../utils/commercialDocuments";
import { saleStatusLabels } from "../../utils/workflow";

// Datos financieros desactivados: el historico conserva trazabilidad operativa sin pagos ni totales.
// const formatMoney = (currency, value) => `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO");
};

const toDateOnly = (value) => {
  if (!value) return "";
  return String(value).split("T")[0];
};

const formatSaleItemName = (item) => {
  return [item.description, item.coffee_profile_name, item.coffee_type_name]
    .filter(Boolean)
    .join(" - ") || "Producto";
};

const SalesHistoryPage = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [filters, setFilters] = useState({
    client: "",
    from: "",
    to: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canEditCodes = ["admin", "accounting"].includes(user?.role);

  const loadSales = async () => {
    setError("");
    const data = await apiRequest("/sales");
    setSales(data);
  };

  useEffect(() => {
    loadSales().catch((requestError) => setError(requestError.message));
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const saleDate = toDateOnly(sale.created_at);
      const searchTerm = filters.client.trim().toLowerCase();
      const matchesClient = !searchTerm || [
        sale.client_name,
        sale.code,
        sale.quote_code,
        sale.order_assignee,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
      const matchesFrom = !filters.from || saleDate >= filters.from;
      const matchesTo = !filters.to || saleDate <= filters.to;

      return matchesClient && matchesFrom && matchesTo;
    });
  }, [sales, filters]);

  const editSaleCode = async (sale) => {
    const newCode = window.prompt(`Nuevo codigo para ${sale.code}`, sale.code || "");
    if (newCode === null) return;

    const cleanCode = newCode.trim();
    if (!cleanCode) {
      setError("El codigo de la venta es obligatorio.");
      return;
    }

    if (!window.confirm(`Confirma cambiar el codigo ${sale.code} por ${cleanCode}?`)) return;

    setLoading(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${sale.id}/code`, {
        method: "PUT",
        body: JSON.stringify({ code: cleanCode }),
      });
      await loadSales();
      if (selectedSale?.id === sale.id) {
        await loadSaleDetail(sale.id);
      }
      setMessage("Codigo de venta actualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSaleDetail = async (saleId) => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const sale = await apiRequest(`/sales/${saleId}`);
      setSelectedSale(sale);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const printSaleDocument = async (saleId) => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const document = await apiRequest(`/documents/sales/${saleId}?includePayments=true`);
      openCommercialDocumentPrint(document);
      setMessage("Venta abierta para imprimir o guardar como PDF.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const viewDispatchReceipt = (sale) => {
    if (!sale.dispatch_receipt_image) return;

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      setError("El navegador bloqueo la ventana para ver el recibo.");
      return;
    }

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Recibo de despacho ${sale.code}</title>
          <style>
            body { margin: 0; background: #111827; display: grid; place-items: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100vh; object-fit: contain; background: white; }
          </style>
        </head>
        <body>
          <img src="${sale.dispatch_receipt_image}" alt="Recibo de despacho ${sale.code}" />
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Historico de ordenes</h1>
          <p className="text-sm text-slate-500">Consulta ordenes, clientes, productos y analisis de laboratorio.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadSales()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-5">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ordenes registradas</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Filtrar por cliente, codigo, cotizacion o encargado"
                value={filters.client}
                onChange={(event) => setFilters({ ...filters, client: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={filters.from}
                onChange={(event) => setFilters({ ...filters, from: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={filters.to}
                onChange={(event) => setFilters({ ...filters, to: event.target.value })}
              />
            </div>
          </div>

          {filteredSales.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin ordenes" message="No hay ordenes para los filtros seleccionados." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Estado</th>
                    {/* Pago y total desactivados por integracion con software contable externo. */}
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((sale) => {
                    const isExpanded = selectedSale?.id === sale.id;

                    return (
                      <Fragment key={sale.id}>
                        <tr>
                          <td className="px-3 py-2 font-medium">{sale.code}</td>
                          <td className="px-3 py-2">{sale.client_name}</td>
                          <td className="px-3 py-2">{formatDate(sale.created_at)}</td>
                          <td className="px-3 py-2"><StatusBadge>{saleStatusLabels[sale.status] || sale.status}</StatusBadge></td>
                          {/* <td className="px-3 py-2">{paymentStatusLabels[sale.payment_status] || sale.payment_status}</td>
                          <td className="px-3 py-2">{formatMoney(sale.currency, sale.total)}</td> */}
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                onClick={() => (isExpanded ? setSelectedSale(null) : loadSaleDetail(sale.id))}
                                type="button"
                              >
                                <Eye size={14} />
                                {isExpanded ? "Ocultar" : "Ver mas"}
                              </button>
                              <button
                                className="inline-flex items-center gap-1 rounded border border-leaf bg-emerald-50 px-2 py-1 text-xs font-semibold text-leaf hover:bg-emerald-100"
                                onClick={() => printSaleDocument(sale.id)}
                                type="button"
                              >
                                <Download size={14} />
                                PDF
                              </button>
                              {canEditCodes && (
                                <button
                                  className="inline-flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                                  disabled={loading}
                                  onClick={() => editSaleCode(sale)}
                                  type="button"
                                >
                                  Editar codigo
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50 px-4 py-4">
                              {loading ? (
                                <p className="text-sm text-slate-500">Cargando detalle...</p>
                              ) : (
                                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-slate-500">Productos y analisis</p>
                                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                                      {(selectedSale.items || []).map((item) => (
                                        <div key={item.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
                                          <p className="font-medium text-ink">{formatSaleItemName(item)}</p>
                                          <p className="text-slate-500">{item.quantity_kg} kg</p>
                                          <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                            <p>Humedad: {item.sale_humidity_percent || "-"}</p>
                                            <p>Aroma: {item.sale_lab_aroma || "-"} · Sabor: {item.sale_lab_flavor || "-"} · Dulzor: {item.sale_lab_sweetness || "-"}</p>
                                            <p>Cuerpo: {item.sale_lab_body || "-"} · Residual: {item.sale_lab_residual || "-"} · Taza limpia: {item.sale_lab_clean_cup || "-"}</p>
                                            <p>Score: {item.sale_lab_score || "-"}</p>
                                            {item.sale_lab_notes && <p>Notas: {item.sale_lab_notes}</p>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                                    <p className="font-semibold text-ink">{selectedSale.code}</p>
                                    <p className="text-slate-500">{selectedSale.client_name}</p>
                                    <p className="text-slate-500">{formatDate(selectedSale.created_at)}</p>
                                    <div className={`mt-3 rounded border p-3 ${
                                      selectedSale.dispatch_receipt_image
                                        ? "border-emerald-200 bg-emerald-50"
                                        : "border-slate-200 bg-slate-50"
                                    }`}>
                                      <p className={`text-xs font-semibold uppercase ${
                                        selectedSale.dispatch_receipt_image ? "text-emerald-800" : "text-slate-500"
                                      }`}>
                                        Recibo de despacho
                                      </p>
                                      <p className="mt-1 text-xs text-slate-600">
                                        {selectedSale.dispatch_receipt_image
                                          ? `Recibo cargado${selectedSale.dispatch_receipt_file_name ? `: ${selectedSale.dispatch_receipt_file_name}` : ""}`
                                          : "Esta venta aun no tiene recibo de despacho."}
                                      </p>
                                      {selectedSale.dispatch_receipt_uploaded_at && (
                                        <p className="text-xs text-slate-500">
                                          Subido: {formatDate(selectedSale.dispatch_receipt_uploaded_at)}
                                        </p>
                                      )}
                                      {selectedSale.dispatch_receipt_image && (
                                        <button
                                          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                          onClick={() => viewDispatchReceipt(selectedSale)}
                                          type="button"
                                        >
                                          <Eye size={14} />
                                          Ver recibo
                                        </button>
                                      )}
                                    </div>
                                    <button
                                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white"
                                      onClick={() => printSaleDocument(selectedSale.id)}
                                      type="button"
                                    >
                                      <Printer size={16} />
                                      Imprimir / guardar PDF
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SalesHistoryPage;
