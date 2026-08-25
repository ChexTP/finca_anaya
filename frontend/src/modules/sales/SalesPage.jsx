import { Eye, FileDown, FlaskConical, ImagePlus, PackageCheck, Printer, RefreshCw, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotCodeName } from "../../utils/coffeeLots";
import { openCommercialDocumentPrint } from "../../utils/commercialDocuments";
import { readImageFileAsDataUrl } from "../../utils/files";
import { printHtmlDocument } from "../../utils/printHtml";
import { getSaleNextAction, getSaleStatusTone, paymentStatusLabels, saleStatusLabels } from "../../utils/workflow";
import { buildWarehouseOrderHtml as buildWarehouseOrderDocumentHtml } from "../warehouse/WarehousePage";

const formatMoney = (currency, value) => {
  return `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO");
};

const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const formatLabValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const hasSaleItemLabReview = (item) => {
  return [
    item.sale_humidity_percent,
    item.sale_lab_aroma,
    item.sale_lab_flavor,
    item.sale_lab_sweetness,
    item.sale_lab_body,
    item.sale_lab_residual,
    item.sale_lab_clean_cup,
    item.sale_lab_score,
  ].every((value) => value !== null && value !== undefined && String(value).trim() !== "");
};

const buildSaleItemLabSummary = (item) => {
  if (!hasSaleItemLabReview(item)) return null;

  return `Humedad ${formatLabValue(item.sale_humidity_percent)} · Aroma ${formatLabValue(item.sale_lab_aroma)} · Sabor ${formatLabValue(item.sale_lab_flavor)} · Dulzor ${formatLabValue(item.sale_lab_sweetness)} · Cuerpo ${formatLabValue(item.sale_lab_body)} · Residual ${formatLabValue(item.sale_lab_residual)} · Taza limpia ${formatLabValue(item.sale_lab_clean_cup)} · Score ${formatLabValue(item.sale_lab_score)}`;
};

const initialPayment = {
  amount: "",
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
  notes: "",
};

const operationalFilters = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "process", label: "En proceso" },
  { key: "lab", label: "Laboratorio" },
  { key: "prepare", label: "Aprobadas lab" },
  { key: "alistada", label: "Alistadas" },
  { key: "despachada", label: "Despachadas" },
];

const paymentFilters = [
  { key: "all", label: "Todos los pagos" },
  { key: "pendiente_pago", label: "Pendientes" },
  { key: "pago_parcial", label: "Parciales" },
  { key: "pagada", label: "Pagadas" },
];

const roleCopy = {
  accounting: {
    title: "Ordenes operativas",
    subtitle: "Seguimiento de pedidos, bodega, laboratorio y despacho.",
    detailTitle: "Detalle operativo",
    empty: "Seleccione una orden para revisar productos, lotes y soporte operativo.",
  },
  warehouse: {
    title: "Despachos",
    subtitle: "Ordenes que requieren salidas de inventario, laboratorio o despacho.",
    detailTitle: "Detalle para bodega",
    empty: "Seleccione una venta para ver lotes, cantidades y orden de alistamiento.",
  },
  seller: {
    title: "Seguimiento de ordenes",
    subtitle: "Estado de las ordenes asociadas a sus solicitudes.",
    detailTitle: "Seguimiento comercial",
    empty: "Seleccione una venta para ver su estado general.",
  },
};

const getOperationalFilterKey = (status) => {
  if (["pendiente_alistamiento", "pendiente_bodega", "lote_asignado"].includes(status)) return "pending";
  if (["proceso_solicitado", "en_proceso"].includes(status)) return "process";
  if (["listo_para_ensamble", "ensamble_definido"].includes(status)) return "pending";
  if (status === "pendiente_laboratorio") return "lab";
  if (status === "aprobada_laboratorio") return "prepare";
  return status;
};

const SalesPage = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [orderAssignee, setOrderAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [dispatchReceiptFile, setDispatchReceiptFile] = useState(null);
  const [adminManualStatus, setAdminManualStatus] = useState("aprobada_laboratorio");
  const [adminManualReceiptFile, setAdminManualReceiptFile] = useState(null);
  const [paymentForm, setPaymentForm] = useState(initialPayment);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [saleCodeSearch, setSaleCodeSearch] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDispatchReceiptFile(null);
    setAdminManualReceiptFile(null);
    setAdminManualStatus("aprobada_laboratorio");
  }, [selectedSale?.id]);

  const canManageDispatch = ["admin", "accounting", "warehouse"].includes(user?.role);
  const canManageOrderAssignee = ["admin", "accounting"].includes(user?.role);
  // Datos financieros desactivados: pagos, totales y saldos se manejan en software contable externo.
  const showFinancialData = false;
  const canEditCodes = ["admin", "accounting"].includes(user?.role);
  const canDeleteRecords = user?.role === "admin";
  const pageCopy = roleCopy[user?.role] || {
    title: "Ordenes",
    subtitle: "Alistamiento, despacho y seguimiento operativo.",
    detailTitle: "Detalle de orden",
    empty: "Seleccione una orden para revisar su informacion.",
  };

  const saleCounts = useMemo(() => {
    return sales.reduce(
      (counts, sale) => ({
        ...counts,
        all: counts.all + 1,
        [getOperationalFilterKey(sale.status)]: (counts[getOperationalFilterKey(sale.status)] || 0) + 1,
      }),
      { all: 0 }
    );
  }, [sales]);

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

  const filteredSales = useMemo(() => {
    const searchTerm = saleCodeSearch.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesStatus = statusFilter === "all" || getOperationalFilterKey(sale.status) === statusFilter;
      const matchesPayment = !showFinancialData || paymentFilter === "all" || sale.payment_status === paymentFilter;
      const matchesAssignee = assigneeFilter === "all" || (sale.order_assignee || "Sin encargado") === assigneeFilter;
      const matchesSearch = !searchTerm || [
        sale.code,
        sale.client_name,
        sale.quote_code,
        sale.order_assignee,
        sale.status,
        sale.payment_status,
        ...(sale.items || []).map((item) => (
          item.description || item.coffee_profile_name || item.coffee_type_name || item.variety
        )),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);

      return matchesStatus && matchesPayment && matchesAssignee && matchesSearch;
    });
  }, [sales, statusFilter, paymentFilter, assigneeFilter, saleCodeSearch, showFinancialData]);

  const assigneeOptions = useMemo(() => {
    return [...new Set(sales.map((sale) => sale.order_assignee || "Sin encargado"))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [sales]);

  const loadSales = async () => {
    const requests = [apiRequest("/sales")];

    if (showFinancialData) {
      requests.push(apiRequest("/catalogs"));
    }

    const [data, catalogData] = await Promise.all(requests);
    setSales(data);
    setCatalogs(catalogData || null);

    if (selectedSale) {
      const stillExists = data.find((sale) => sale.id === selectedSale.id);
      if (stillExists) {
        await loadSaleDetail(selectedSale.id, false);
      } else {
        setSelectedSale(null);
      }
    }
  };

  const loadSaleDetail = async (saleId, withLoading = true) => {
    if (withLoading) {
      setLoadingDetail(true);
    }

    try {
      const data = await apiRequest(`/sales/${saleId}`);
      setSelectedSale(data);
      setOrderAssignee(data.order_assignee || "");
      setNotes("");
      setPaymentForm({
        ...initialPayment,
        amount: "",
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingDetail(false);
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
      setError("Ingrese un valor de abono mayor a cero.");
      return;
    }

    if (paymentAmount > balanceDue) {
      setError("El abono no puede ser mayor al saldo pendiente.");
      return;
    }

    setSaving(true);
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
      await loadSaleDetail(selectedSale.id, false);
      setMessage("Pago registrado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateOrderAssignee = async () => {
    if (!selectedSale) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/order-assignee`, {
        method: "PUT",
        body: JSON.stringify({ assignee: orderAssignee.trim() || null }),
      });
      setSelectedSale(response.data);
      setOrderAssignee(response.data.order_assignee || "");
      await loadSales();
      setMessage("Encargado de pedido actualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const editSaleCode = async (sale) => {
    const newCode = window.prompt(`Nuevo codigo para ${sale.code}`, sale.code || "");
    if (newCode === null) return;

    const cleanCode = newCode.trim();
    if (!cleanCode) {
      setError("El codigo de la venta es obligatorio.");
      return;
    }

    if (!window.confirm(`Confirma cambiar el codigo ${sale.code} por ${cleanCode}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${sale.id}/code`, {
        method: "PUT",
        body: JSON.stringify({ code: cleanCode }),
      });
      await loadSales();
      if (selectedSale?.id === sale.id) {
        await loadSaleDetail(sale.id, false);
      }
      setMessage("Codigo de venta actualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSale = async (sale) => {
    const confirmation = window.prompt(
      `Esto eliminara la venta ${sale.code} y liberara sus reservas de prueba. Escriba ELIMINAR para confirmar.`
    );

    if (confirmation !== "ELIMINAR") return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${sale.id}`, { method: "DELETE" });
      if (selectedSale?.id === sale.id) {
        setSelectedSale(null);
        setOrderAssignee("");
        setNotes("");
        setDispatchReceiptFile(null);
      }
      await loadSales();
      setMessage(`Venta ${sale.code} eliminada correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSales().catch((requestError) => setError(requestError.message));
  }, []);

  const updateStatus = async (sale, action) => {
    const label =
      action === "send-lab"
        ? "enviar esta venta a laboratorio"
        : action === "prepare"
          ? "marcar esta venta como alistada"
          : "marcar esta venta como despachada";

    if (action === "dispatch" && !dispatchReceiptFile) {
      setError("Antes de despachar debe cargar la foto del recibo.");
      return;
    }

    const confirmed = window.confirm(`Confirma ${label}?`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const adminOverrideStatus =
        user?.role === "admin" && action === "prepare"
          ? "alistada"
          : user?.role === "admin" && action === "dispatch"
            ? "despachada"
            : null;
      const payload = { notes };

      if (adminOverrideStatus) {
        payload.status = adminOverrideStatus;
      }

      if (action === "dispatch") {
        const image = await readImageFileAsDataUrl(
          dispatchReceiptFile,
          "No se pudo leer la foto del recibo"
        );
        payload.dispatchReceipt = {
          image,
          fileName: dispatchReceiptFile.name,
          mimeType: dispatchReceiptFile.type,
        };
      }

      await apiRequest(adminOverrideStatus ? `/sales/${sale.id}/admin-status` : `/sales/${sale.id}/${action}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await loadSales();
      await loadSaleDetail(sale.id, false);
      if (action === "dispatch") {
        setDispatchReceiptFile(null);
      }
      setMessage(
        action === "send-lab"
          ? "Venta enviada a laboratorio."
          : action === "prepare"
            ? "Venta marcada como alistada."
            : "Venta marcada como despachada."
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateAdminManualStatus = async () => {
    if (!selectedSale || user?.role !== "admin") return;

    if (adminManualStatus === "despachada" && !adminManualReceiptFile) {
      setError("Para marcar como despachada debe cargar la foto de la guia o recibo.");
      return;
    }

    const confirmed = window.confirm(
      `Confirma cambiar manualmente ${selectedSale.code} a ${saleStatusLabels[adminManualStatus] || adminManualStatus}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = { status: adminManualStatus, notes };

      if (adminManualStatus === "despachada") {
        const image = await readImageFileAsDataUrl(
          adminManualReceiptFile,
          "No se pudo leer la foto de la guia"
        );
        payload.dispatchReceipt = {
          image,
          fileName: adminManualReceiptFile.name,
          mimeType: adminManualReceiptFile.type,
        };
      }

      await apiRequest(`/sales/${selectedSale.id}/admin-status`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await loadSales();
      await loadSaleDetail(selectedSale.id, false);
      setAdminManualReceiptFile(null);
      setMessage(`Venta ${selectedSale.code} actualizada manualmente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const printWarehouseOrder = () => {
    if (!selectedSale) {
      setError("Seleccione una venta para imprimir la orden.");
      return;
    }

    printHtmlDocument(buildWarehouseOrderDocumentHtml(selectedSale), { title: `Orden ${selectedSale.code}` });
    setMessage("Orden abierta para imprimir o guardar como PDF.");
  };

  const printQuotePdf = async (quoteId) => {
    if (!quoteId) {
      setError("Esta venta no tiene cotizacion asociada.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const document = await apiRequest(`/documents/quotes/${quoteId}`);
      openCommercialDocumentPrint(document);
      setMessage("Cotizacion abierta para imprimir o guardar como PDF.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">{pageCopy.title}</h1>
          <p className="text-sm text-slate-500">{pageCopy.subtitle}</p>
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ordenes registradas</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {operationalFilters.map((filter) => (
                <button
                  key={filter.key}
                  className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold ${
                    statusFilter === filter.key ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                  }`}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                >
                  {filter.label} ({saleCounts[filter.key] || 0})
                </button>
              ))}
            </div>
            {showFinancialData && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {paymentFilters.map((filter) => (
                  <button
                    key={filter.key}
                    className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold ${
                      paymentFilter === filter.key ? "border-ink bg-slate-100 text-ink" : "border-slate-200 bg-white text-slate-700"
                    }`}
                    type="button"
                    onClick={() => setPaymentFilter(filter.key)}
                  >
                    {filter.label} ({paymentCounts[filter.key] || 0})
                  </button>
                ))}
              </div>
            )}
            {canManageOrderAssignee && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Encargado</span>
                <select
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs"
                  value={assigneeFilter}
                  onChange={(event) => setAssigneeFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  {assigneeOptions.map((assignee) => (
                    <option key={assignee} value={assignee}>
                      {assignee}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <input
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Buscar ordenes por codigo, cliente, cotizacion, cafe, encargado o estado"
              value={saleCodeSearch}
              onChange={(event) => setSaleCodeSearch(event.target.value)}
            />
          </div>
          {filteredSales.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin ordenes" message="Las ordenes creadas desde este modulo apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Siguiente accion</th>
                    {canManageOrderAssignee && <th className="px-3 py-2">Encargado</th>}
                    {showFinancialData && <th className="px-3 py-2">Pago</th>}
                    {showFinancialData && <th className="px-3 py-2">Total</th>}
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-3 py-2 font-medium">{sale.code}</td>
                      <td className="px-3 py-2">{sale.client_name}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={getSaleStatusTone(sale)}>{saleStatusLabels[sale.status] || sale.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{getSaleNextAction(sale)}</td>
                      {canManageOrderAssignee && <td className="px-3 py-2">{sale.order_assignee || "-"}</td>}
                      {showFinancialData && <td className="px-3 py-2">{paymentStatusLabels[sale.payment_status] || sale.payment_status}</td>}
                      {showFinancialData && <td className="px-3 py-2">{formatMoney(sale.currency, sale.total)}</td>}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            onClick={() => loadSaleDetail(sale.id)}
                            type="button"
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                          {sale.quote_id && (
                            <button
                              className="inline-flex items-center gap-1 rounded border border-leaf bg-emerald-50 px-2 py-1 text-xs font-semibold text-leaf hover:bg-emerald-100 disabled:opacity-60"
                              disabled={saving}
                              onClick={() => printQuotePdf(sale.quote_id)}
                              type="button"
                            >
                              <FileDown size={14} />
                              PDF cotizacion
                            </button>
                          )}
                          {canEditCodes && (
                            <button
                              className="inline-flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                              disabled={saving}
                              onClick={() => editSaleCode(sale)}
                              type="button"
                            >
                              Editar codigo
                            </button>
                          )}
                          {canDeleteRecords && (
                            <button
                              className="inline-flex items-center gap-1 rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              disabled={saving || sale.status === "despachada"}
                              onClick={() => deleteSale(sale)}
                              type="button"
                            >
                              <Trash2 size={14} />
                              Eliminar
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

        <aside className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">{pageCopy.detailTitle}</h2>
          {loadingDetail ? (
            <p className="mt-3 text-sm text-slate-500">Cargando venta...</p>
          ) : !selectedSale ? (
            <div className="mt-3">
              <EmptyState title="Seleccione una venta" message={pageCopy.empty} />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold text-ink">{selectedSale.code}</p>
                <p className="text-sm text-slate-500">{selectedSale.client_name}</p>
                <p className="text-sm text-slate-500">{selectedSale.client_address || "Sin direccion"}</p>
                <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  {getSaleNextAction(selectedSale)}
                </p>
              </div>

              {canManageOrderAssignee && (
                <div className="rounded border border-slate-200 p-3">
                  <label className="text-xs font-semibold uppercase text-slate-500">Encargado de pedido</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Nombre de la persona"
                      value={orderAssignee}
                      maxLength={120}
                      onChange={(event) => setOrderAssignee(event.target.value)}
                      disabled={saving}
                    />
                    <button
                      className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      type="button"
                      onClick={updateOrderAssignee}
                      disabled={saving}
                    >
                      Guardar
                    </button>
                  </div>
                  {selectedSale.assigneeHistory?.length > 0 && (
                    <details className="mt-3 text-xs text-slate-500">
                      <summary className="cursor-pointer text-leaf">Ver historial de encargado</summary>
                      <div className="mt-2 space-y-1">
                        {selectedSale.assigneeHistory.map((entry) => (
                          <p key={entry.id}>
                            {entry.previous_assignee || "Sin encargado"} a {entry.new_assignee || "Sin encargado"} · {entry.changed_by_name || "-"} · {formatDate(entry.created_at)}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {showFinancialData && (
                <div className="rounded bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Total: {formatMoney(selectedSale.currency, selectedSale.total)}</p>
                  <p className="text-slate-500">Pagado: {formatMoney(selectedSale.currency, selectedSale.amount_paid)}</p>
                  <p className="font-semibold text-ink">Saldo: {formatMoney(selectedSale.currency, selectedSale.balance_due)}</p>
                </div>
              )}

              {selectedSale.quote_id && (
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  disabled={saving}
                  onClick={() => printQuotePdf(selectedSale.quote_id)}
                  type="button"
                >
                  <FileDown size={17} />
                  Imprimir / guardar PDF de cotizacion
                </button>
              )}
              {canDeleteRecords && (
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded border border-rose-300 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  disabled={saving || selectedSale.status === "despachada"}
                  onClick={() => deleteSale(selectedSale)}
                  type="button"
                >
                  <Trash2 size={17} />
                  Eliminar venta de prueba
                </button>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedSale.items?.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-ink">{item.description || item.coffee_profile_name || item.coffee_type_name}</p>
                    <p className="text-slate-500">{item.quantity_kg} kg</p>
                    {buildSaleItemLabSummary(item) && (
                      <div className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <p className="font-semibold">Analisis laboratorio</p>
                        <p>{buildSaleItemLabSummary(item)}</p>
                        {item.sale_lab_notes && <p className="mt-1 text-emerald-700">Notas: {item.sale_lab_notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedSale.items?.some((item) => item.blend_items?.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Registro de mezcla guardado</p>
                  {selectedSale.items
                    .filter((item) => item.blend_items?.length > 0)
                    .map((item) => (
                      <div key={`blend-${item.id}`} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                        <p className="font-semibold text-ink">
                          {item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"}
                        </p>
                        <p className="text-xs text-slate-600">{item.quantity_kg} kg solicitados</p>
                        <div className="mt-2 space-y-2">
                          {item.blend_items.map((blend) => (
                            <div key={blend.id} className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-ink">{formatCoffeeLotCodeName(blend)}</p>
                                <p className="text-xs text-slate-600">
                                  {blend.commercial_classification || formatInputLabel(blend)}
                                </p>
                              </div>
                              <p className="text-right text-slate-700">
                                {blend.percentage}%<br />
                                <span className="text-xs text-slate-500">
                                  {blend.calculated_operational_kg || blend.calculated_quantity_kg} kg estimados
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Lotes a sacar</p>
                {selectedSale.deductedLots?.length ? (
                  selectedSale.deductedLots.map((lot) => (
                    <div key={lot.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{formatCoffeeLotCodeName(lot)}</p>
                          <p className="text-xs text-slate-500">
                            {lot.coffee_profile_name || lot.coffee_type_name || lot.commercial_classification || lot.lot_kind}
                          </p>
                        </div>
                        <span>{lot.quantity_kg} kg</span>
                      </div>
                      {lot.process_mix?.length > 0 && (
                        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-semibold uppercase text-amber-800">Mezcla de proceso registrada</p>
                          <div className="mt-2 space-y-2">
                            {lot.process_mix.map((input) => (
                              <div key={`${lot.id}-${input.lot_id}`} className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-ink">{formatCoffeeLotCodeName(input)}</p>
                                  <p className="text-xs text-slate-600">{formatInputLabel(input)}</p>
                                </div>
                                <p className="text-right text-slate-700">
                                  {input.input_percentage}%<br />
                                  <span className="text-xs text-slate-500">{input.quantity_kg} kg usados</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Esta venta no tiene lotes descontados registrados.</p>
                )}
              </div>

              {canManageDispatch && (
                <div className="space-y-3">
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                    onClick={printWarehouseOrder}
                  >
                    <Printer size={16} />
                    Imprimir orden / guardar PDF
                  </button>
                  <textarea
                    className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Observaciones de bodega"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  {(selectedSale.status === "alistada" ||
                    (user?.role === "admin" && selectedSale.status !== "despachada" && selectedSale.status !== "anulada")) && (
                    <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-amber-900">Recibo obligatorio para despacho</p>
                          <p className="text-xs text-slate-600">
                            Cargue la foto del recibo generado antes de marcar la venta como despachada.
                          </p>
                          {dispatchReceiptFile && (
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              Archivo seleccionado: {dispatchReceiptFile.name}
                            </p>
                          )}
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                          <ImagePlus size={15} />
                          {dispatchReceiptFile ? "Cambiar recibo" : "Subir recibo"}
                          <input
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={(event) => setDispatchReceiptFile(event.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded border border-leaf bg-emerald-50 px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-100 disabled:opacity-60"
                      disabled={
                        saving ||
                        !["lote_asignado", "ensamble_definido"].includes(selectedSale.status)
                      }
                      onClick={() => updateStatus(selectedSale, "send-lab")}
                      type="button"
                    >
                      <FlaskConical size={16} />
                      Enviar a laboratorio
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={
                        saving ||
                        (user?.role !== "admin" && selectedSale.status !== "aprobada_laboratorio")
                      }
                      onClick={() => updateStatus(selectedSale, "prepare")}
                      type="button"
                    >
                      <PackageCheck size={16} />
                      Alistada
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={saving || !dispatchReceiptFile || (user?.role !== "admin" && selectedSale.status !== "alistada")}
                      onClick={() => updateStatus(selectedSale, "dispatch")}
                      type="button"
                    >
                      <Truck size={16} />
                      Despachada
                    </button>
                  </div>
                </div>
              )}

              {user?.role === "admin" && selectedSale.status !== "despachada" && selectedSale.status !== "anulada" && (
                <div className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Correccion manual administrativa</p>
                    <p className="text-xs text-amber-800">
                      Use esta opcion solo para cerrar pedidos que quedaron bloqueados por cambios del flujo anterior.
                    </p>
                  </div>
                  <label className="grid gap-1 text-xs font-semibold uppercase text-amber-900">
                    Estado a dejar
                    <select
                      className="rounded border border-amber-300 bg-white px-3 py-2 text-sm font-normal normal-case text-ink"
                      value={adminManualStatus}
                      onChange={(event) => setAdminManualStatus(event.target.value)}
                      disabled={saving}
                    >
                      <option value="aprobada_laboratorio">Aprobada laboratorio</option>
                      <option value="alistada">Alistada</option>
                      <option value="despachada">Despachada</option>
                    </select>
                  </label>
                  {adminManualStatus === "despachada" && (
                    <div className="rounded border border-amber-300 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-amber-900">Foto de guia obligatoria</p>
                          <p className="text-xs text-slate-600">
                            Esta imagen quedara guardada en el historico de la venta despachada.
                          </p>
                          {adminManualReceiptFile && (
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              Archivo seleccionado: {adminManualReceiptFile.name}
                            </p>
                          )}
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                          <ImagePlus size={15} />
                          {adminManualReceiptFile ? "Cambiar guia" : "Subir guia"}
                          <input
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={(event) => setAdminManualReceiptFile(event.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                    type="button"
                    onClick={updateAdminManualStatus}
                    disabled={saving || (adminManualStatus === "despachada" && !adminManualReceiptFile)}
                  >
                    Aplicar correccion manual
                  </button>
                </div>
              )}

              {showFinancialData && (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Pagos</p>
                  {selectedSale.payments?.length ? (
                    selectedSale.payments.map((payment) => (
                      <div key={payment.id} className="rounded border border-slate-200 p-3 text-sm">
                        <p className="font-medium text-ink">{formatMoney(selectedSale.currency, payment.amount)}</p>
                        <p className="text-slate-500">{payment.payment_method_name} - {payment.payment_reference}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Sin pagos registrados.</p>
                  )}

                  <form className="space-y-3" onSubmit={registerPayment}>
                    <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Saldo pendiente para abonar: {formatMoney(selectedSale.currency, selectedSale.balance_due)}
                    </p>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Valor del abono"
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
                      placeholder="Referencia"
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
                      className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Notas del pago"
                      value={paymentForm.notes}
                      onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                    />
                    <button
                      className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={saving || selectedSale.payment_status === "pagada"}
                    >
                      Registrar pago
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default SalesPage;
