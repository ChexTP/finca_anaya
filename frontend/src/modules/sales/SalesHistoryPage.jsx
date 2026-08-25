import { Download, Eye, Printer, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { openCommercialDocumentPrint } from "../../utils/commercialDocuments";
import { paymentStatusLabels, saleStatusLabels } from "../../utils/workflow";

const formatMoney = (currency, value) => `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;

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

const initialPayment = {
  amount: "",
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
  notes: "",
};

const paymentFilters = [
  { key: "all", label: "Todas" },
  { key: "pendiente_pago", label: "Pendientes" },
  { key: "pago_parcial", label: "Pagos parciales" },
  { key: "pagada", label: "Pagos totales" },
];

const paymentStatusTone = (status) => {
  if (status === "pagada") return "success";
  if (status === "pago_parcial") return "warning";
  return "danger";
};

const SalesHistoryPage = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [filters, setFilters] = useState({
    client: "",
    from: "",
    to: "",
    payment: "all",
  });
  const [paymentForm, setPaymentForm] = useState(initialPayment);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const canEditCodes = ["admin", "accounting"].includes(user?.role);
  const canManagePayments = ["admin", "accounting"].includes(user?.role);

  const loadSales = async () => {
    setError("");
    const requests = [apiRequest("/sales")];

    if (canManagePayments) {
      requests.push(apiRequest("/catalogs"));
    }

    const [data, catalogData] = await Promise.all(requests);
    setSales(data);
    setCatalogs(catalogData || null);
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
        sale.payment_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
      const matchesFrom = !filters.from || saleDate >= filters.from;
      const matchesTo = !filters.to || saleDate <= filters.to;
      const matchesPayment = filters.payment === "all" || sale.payment_status === filters.payment;

      return matchesClient && matchesFrom && matchesTo && matchesPayment;
    });
  }, [sales, filters]);

  const paymentCounts = useMemo(() => {
    return sales.reduce(
      (counts, sale) => ({
        ...counts,
        all: counts.all + 1,
        [sale.payment_status]: (counts[sale.payment_status] || 0) + 1,
      }),
      { all: 0 }
    );
  }, [sales]);

  const paymentTotals = useMemo(() => {
    return filteredSales.reduce(
      (totals, sale) => {
        const currency = sale.currency || "COP";
        if (!totals[currency]) {
          totals[currency] = { total: 0, paid: 0, balance: 0 };
        }
        totals[currency].total += Number(sale.total || 0);
        totals[currency].paid += Number(sale.amount_paid || 0);
        totals[currency].balance += Number(sale.balance_due || 0);
        return totals;
      },
      {}
    );
  }, [filteredSales]);

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
      setPaymentForm({
        ...initialPayment,
        amount: "",
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const registerPayment = async (event) => {
    event.preventDefault();

    if (!selectedSale) {
      setError("Seleccione una venta.");
      return;
    }

    const paymentAmount = Number(paymentForm.amount);
    const balanceDue = Number(selectedSale.balance_due || 0);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Ingrese un valor de pago mayor a cero.");
      return;
    }

    if (paymentAmount > balanceDue) {
      setError("El pago no puede superar el saldo pendiente.");
      return;
    }

    if (!paymentForm.paymentMethodId || !paymentForm.paymentReference.trim()) {
      setError("Seleccione el metodo de pago y escriba una referencia.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${selectedSale.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          ...paymentForm,
          amount: paymentAmount,
          paymentMethodId: Number(paymentForm.paymentMethodId),
        }),
      });
      await loadSales();
      await loadSaleDetail(selectedSale.id);
      setMessage("Pago de venta registrado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const fillFullPayment = () => {
    if (!selectedSale) return;
    setPaymentForm((current) => ({
      ...current,
      amount: String(Number(selectedSale.balance_due || 0)),
    }));
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
    setReceiptPreview(sale);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Historico de ventas</h1>
          <p className="text-sm text-slate-500">Consulta ventas despachadas, pagos, productos y analisis de laboratorio.</p>
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
            <h2 className="text-sm font-semibold text-slate-800">Ventas registradas</h2>
            {canManagePayments && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {paymentFilters.map((filter) => (
                  <button
                    key={filter.key}
                    className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold ${
                      filters.payment === filter.key ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                    }`}
                    type="button"
                    onClick={() => setFilters({ ...filters, payment: filter.key })}
                  >
                    {filter.label} ({paymentCounts[filter.key] || 0})
                  </button>
                ))}
              </div>
            )}
            {canManagePayments && (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {Object.entries(paymentTotals).map(([currency, totals]) => (
                  <div key={currency} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{currency}</p>
                    <p className="text-slate-600">Total: {formatMoney(currency, totals.total)}</p>
                    <p className="text-emerald-700">Pagado: {formatMoney(currency, totals.paid)}</p>
                    <p className="font-semibold text-rose-700">Pendiente: {formatMoney(currency, totals.balance)}</p>
                  </div>
                ))}
              </div>
            )}
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
              <EmptyState title="Sin ventas" message="No hay ventas para los filtros seleccionados." />
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
                    {canManagePayments && <th className="px-3 py-2">Pago</th>}
                    {canManagePayments && <th className="px-3 py-2">Saldo</th>}
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((sale) => (
                        <tr key={sale.id}>
                          <td className="px-3 py-2 font-medium">{sale.code}</td>
                          <td className="px-3 py-2">{sale.client_name}</td>
                          <td className="px-3 py-2">{formatDate(sale.created_at)}</td>
                          <td className="px-3 py-2"><StatusBadge>{saleStatusLabels[sale.status] || sale.status}</StatusBadge></td>
                          {canManagePayments && (
                            <td className="px-3 py-2">
                              <StatusBadge tone={paymentStatusTone(sale.payment_status)}>
                                {paymentStatusLabels[sale.payment_status] || sale.payment_status}
                              </StatusBadge>
                            </td>
                          )}
                          {canManagePayments && <td className="px-3 py-2">{formatMoney(sale.currency, sale.balance_due)}</td>}
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                onClick={() => loadSaleDetail(sale.id)}
                                type="button"
                              >
                                <Eye size={14} />
                                Ver mas
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4">
          <div className="my-6 w-full max-w-6xl overflow-hidden rounded border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink">{selectedSale.code}</h2>
                <p className="text-sm text-slate-500">
                  {selectedSale.client_name} · {formatDate(selectedSale.created_at)}
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setSelectedSale(null)}
                type="button"
              >
                <X size={16} />
                Cerrar
              </button>
            </div>

            <div className="max-h-[82vh] overflow-y-auto p-5">
              {loading ? (
                <p className="text-sm text-slate-500">Cargando detalle...</p>
              ) : (
                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Productos y analisis</p>
                    <div className="grid gap-3 md:grid-cols-2">
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

                  <div className="space-y-3 rounded border border-slate-200 bg-white p-3 text-sm">
                    <div>
                      <p className="font-semibold text-ink">{selectedSale.code}</p>
                      <p className="text-slate-500">{selectedSale.client_name}</p>
                      <p className="text-slate-500">{formatDate(selectedSale.created_at)}</p>
                    </div>

                    {canManagePayments && (
                      <div className="rounded bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Estado de pago</p>
                        <StatusBadge tone={paymentStatusTone(selectedSale.payment_status)}>
                          {paymentStatusLabels[selectedSale.payment_status] || selectedSale.payment_status}
                        </StatusBadge>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>Total: {formatMoney(selectedSale.currency, selectedSale.total)}</p>
                          <p className="text-emerald-700">Pagado: {formatMoney(selectedSale.currency, selectedSale.amount_paid)}</p>
                          <p className="font-semibold text-rose-700">Pendiente: {formatMoney(selectedSale.currency, selectedSale.balance_due)}</p>
                        </div>
                      </div>
                    )}

                    <div className={`rounded border p-3 ${
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
                      className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white"
                      onClick={() => printSaleDocument(selectedSale.id)}
                      type="button"
                    >
                      <Printer size={16} />
                      Imprimir / guardar PDF
                    </button>

                    {canManagePayments && (
                      <div className="rounded border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Pagos registrados</p>
                        {selectedSale.payments?.length ? (
                          <div className="mt-2 space-y-2">
                            {selectedSale.payments.map((payment) => (
                              <div key={payment.id} className="rounded bg-slate-50 px-3 py-2">
                                <p className="font-semibold text-ink">
                                  {formatMoney(selectedSale.currency, payment.amount)}
                                </p>
                                <p className="text-xs text-slate-600">
                                  {payment.payment_method_name || "-"} · {payment.payment_reference || "-"} · {formatDate(payment.paid_at)}
                                </p>
                                {payment.notes && <p className="text-xs text-slate-500">{payment.notes}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">Sin pagos registrados.</p>
                        )}

                        {selectedSale.payment_status !== "pagada" && (
                          <form className="mt-3 space-y-2" onSubmit={registerPayment}>
                            <div className="flex items-center justify-between gap-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                              <span>Saldo por cobrar: {formatMoney(selectedSale.currency, selectedSale.balance_due)}</span>
                              <button
                                className="rounded border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800"
                                type="button"
                                onClick={fillFullPayment}
                              >
                                Pago total
                              </button>
                            </div>
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Valor recibido"
                              type="number"
                              min="0.01"
                              max={selectedSale.balance_due || undefined}
                              step="0.01"
                              value={paymentForm.amount}
                              onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                            />
                            <select
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              value={paymentForm.paymentMethodId}
                              onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethodId: event.target.value })}
                            >
                              <option value="">Metodo de pago</option>
                              {catalogs?.paymentMethods?.map((method) => (
                                <option key={method.id} value={method.id}>
                                  {method.name}
                                </option>
                              ))}
                            </select>
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Referencia o recibo"
                              value={paymentForm.paymentReference}
                              onChange={(event) => setPaymentForm({ ...paymentForm, paymentReference: event.target.value })}
                            />
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              type="date"
                              value={paymentForm.paidAt}
                              onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })}
                            />
                            <textarea
                              className="min-h-16 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Nota opcional"
                              value={paymentForm.notes}
                              onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                            />
                            <button
                              className="w-full rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              type="submit"
                              disabled={loading}
                            >
                              Registrar pago
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {receiptPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="font-semibold text-ink">Recibo de despacho {receiptPreview.code}</p>
                <p className="text-xs text-slate-500">{receiptPreview.dispatch_receipt_file_name || "Imagen asociada"}</p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setReceiptPreview(null)}
                type="button"
              >
                <X size={16} />
                Cerrar
              </button>
            </div>
            <div className="min-h-0 overflow-auto bg-slate-950 p-3">
              <img
                className="mx-auto max-h-[78vh] max-w-full object-contain"
                src={receiptPreview.dispatch_receipt_image}
                alt={`Recibo de despacho ${receiptPreview.code}`}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SalesHistoryPage;
