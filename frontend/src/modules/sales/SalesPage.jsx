import { Eye, PackageCheck, Printer, RefreshCw, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { getSaleNextAction, getSaleStatusTone, saleStatusLabels } from "../../utils/workflow";

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

const buildWarehouseOrderHtml = (sale) => {
  const productRows = sale.items
    ?.map(
      (item) => `
        <tr>
          <td>${item.description || item.coffee_profile_name || item.coffee_type_name || item.lot_code || "-"}</td>
          <td>${item.quantity_kg} kg</td>
        </tr>
      `
    )
    .join("");

  const finalBlendOrder = sale.items
    ?.filter((item) => item.blend_items?.length > 0)
    .map((item) => {
      return `
        <section class="lot-block">
          <div class="lot-head">
            <div>
              <h3>${item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"}</h3>
              <p>${item.quantity_kg} kg solicitados</p>
            </div>
            <strong>Mezcla final</strong>
          </div>
          <table class="mix-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Lote</th>
                <th>Porcentaje</th>
                <th>Kg estimados</th>
              </tr>
            </thead>
            <tbody>
              ${item.blend_items
                .map(
                  (blend) => `
                    <tr>
                      <td>${blend.commercial_classification || "-"}</td>
                      <td>${blend.lot_code || "-"}</td>
                      <td>${blend.percentage}%</td>
                      <td>${blend.calculated_quantity_kg} kg</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const deductedLots = sale.deductedLots
    ?.map((lot) => {
      const mixRows = lot.process_mix?.length
        ? `
          <table class="mix-table">
            <thead>
              <tr>
                <th>Lote origen</th>
                <th>Tipo / perfil</th>
                <th>Porcentaje</th>
                <th>Kg usados</th>
              </tr>
            </thead>
            <tbody>
              ${lot.process_mix
                .map(
                  (input) => `
                    <tr>
                      <td>${input.lot_code || "-"}</td>
                      <td>${formatInputLabel(input)}</td>
                      <td>${input.input_percentage}%</td>
                      <td>${input.quantity_kg} kg</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        `
        : `<p class="muted">Este lote no tiene mezcla de proceso registrada.</p>`;

      return `
        <section class="lot-block">
          <div class="lot-head">
            <div>
              <h3>${lot.lot_code}</h3>
              <p>${lot.coffee_profile_name || lot.coffee_type_name || lot.commercial_classification || lot.lot_kind || "-"}</p>
            </div>
            <strong>${lot.quantity_kg} kg a sacar</strong>
          </div>
          ${mixRows}
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Orden ${sale.code}</title>
        <style>
          body { color: #17201a; font-family: Arial, sans-serif; margin: 28px; }
          header { align-items: flex-start; border-bottom: 1px solid #d8ded8; display: flex; justify-content: space-between; gap: 24px; padding-bottom: 14px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          h2 { font-size: 15px; margin: 22px 0 8px; }
          h3 { font-size: 14px; margin: 0 0 3px; }
          p { font-size: 12px; margin: 3px 0; }
          table { border-collapse: collapse; margin-top: 10px; width: 100%; }
          th, td { border: 1px solid #d8ded8; font-size: 12px; padding: 8px; text-align: left; }
          th { background: #f3f6f3; }
          .meta { display: grid; gap: 4px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
          .lot-block { border: 1px solid #d8ded8; margin-top: 12px; padding: 12px; page-break-inside: avoid; }
          .lot-head { align-items: flex-start; display: flex; justify-content: space-between; gap: 16px; }
          .mix-table th { background: #fff7d6; }
          .muted { color: #667085; }
          .signature { display: grid; gap: 32px; grid-template-columns: 1fr 1fr; margin-top: 42px; }
          .line { border-top: 1px solid #17201a; padding-top: 6px; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Orden de alistamiento y mezcla</h1>
            <p><strong>Venta:</strong> ${sale.code}</p>
            ${sale.quote_code ? `<p><strong>Preventa:</strong> ${sale.quote_code}</p>` : ""}
            <p><strong>Fecha:</strong> ${formatDate(new Date())}</p>
          </div>
          <div>
            <p><strong>Finca Anaya</strong></p>
            <p>Documento operativo para bodega</p>
          </div>
        </header>

        <section class="meta">
          <p><strong>Cliente:</strong> ${sale.client_name || "-"}</p>
          <p><strong>Telefono:</strong> ${sale.client_phone || "-"}</p>
          <p><strong>Direccion:</strong> ${sale.client_address || "-"}</p>
          <p><strong>Estado:</strong> ${sale.status || "-"}</p>
        </section>

        <h2>Pedido</h2>
        <table>
          <thead>
            <tr>
              <th>Producto solicitado</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>${productRows || ""}</tbody>
        </table>

        <h2>Lotes y porcentajes de mezcla</h2>
        ${
          finalBlendOrder ||
          deductedLots ||
          '<p class="muted">No hay orden de mezcla ni lotes descontados registrados.</p>'
        }

        <section class="signature">
          <p class="line">Entrega bodega</p>
          <p class="line">Recibe / realiza mezcla</p>
        </section>
      </body>
    </html>
  `;
};

const initialPayment = {
  amount: "",
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
  notes: "",
};

const SalesPage = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [notes, setNotes] = useState("");
  const [paymentForm, setPaymentForm] = useState(initialPayment);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const canManageDispatch = ["admin", "accounting", "warehouse"].includes(user?.role);
  const showFinancialData = ["admin", "accounting"].includes(user?.role);

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
      setNotes("");
      setPaymentForm({
        ...initialPayment,
        amount: data.balance_due && Number(data.balance_due) > 0 ? String(data.balance_due) : "",
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

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${selectedSale.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          ...paymentForm,
          amount: Number(paymentForm.amount),
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

  useEffect(() => {
    loadSales().catch((requestError) => setError(requestError.message));
  }, []);

  const updateStatus = async (sale, action) => {
    const label = action === "prepare" ? "marcar esta venta como alistada" : "marcar esta venta como despachada";
    const confirmed = window.confirm(`Confirma ${label}?`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${sale.id}/${action}`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      await loadSales();
      await loadSaleDetail(sale.id, false);
      setMessage(action === "prepare" ? "Venta marcada como alistada." : "Venta marcada como despachada.");
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

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("El navegador bloqueo la ventana de impresion.");
      return;
    }

    printWindow.document.write(buildWarehouseOrderHtml(selectedSale));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setMessage("Orden abierta para imprimir o guardar como PDF.");
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Ventas</h1>
          <p className="text-sm text-slate-500">Alistamiento, despacho y seguimiento operativo.</p>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ventas registradas</h2>
          </div>
          {sales.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin ventas" message="Las ventas creadas desde cotizacion o directas apareceran aqui." />
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
                    {showFinancialData && <th className="px-3 py-2">Pago</th>}
                    {showFinancialData && <th className="px-3 py-2">Total</th>}
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-3 py-2 font-medium">{sale.code}</td>
                      <td className="px-3 py-2">{sale.client_name}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={getSaleStatusTone(sale)}>{saleStatusLabels[sale.status] || sale.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{getSaleNextAction(sale)}</td>
                      {showFinancialData && <td className="px-3 py-2">{sale.payment_status}</td>}
                      {showFinancialData && <td className="px-3 py-2">{formatMoney(sale.currency, sale.total)}</td>}
                      <td className="px-3 py-2">
                        <button
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => loadSaleDetail(sale.id)}
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

        <aside className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Detalle para bodega</h2>
          {loadingDetail ? (
            <p className="mt-3 text-sm text-slate-500">Cargando venta...</p>
          ) : !selectedSale ? (
            <div className="mt-3">
              <EmptyState title="Seleccione una venta" message="Aqui vera que lotes y cantidades debe alistar." />
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

              {showFinancialData && (
                <div className="rounded bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Total: {formatMoney(selectedSale.currency, selectedSale.total)}</p>
                  <p className="text-slate-500">Pagado: {formatMoney(selectedSale.currency, selectedSale.amount_paid)}</p>
                  <p className="font-semibold text-ink">Saldo: {formatMoney(selectedSale.currency, selectedSale.balance_due)}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedSale.items?.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-ink">{item.description || item.coffee_profile_name || item.coffee_type_name}</p>
                    <p className="text-slate-500">{item.quantity_kg} kg</p>
                  </div>
                ))}
              </div>

              {selectedSale.items?.some((item) => item.blend_items?.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Orden final de mezcla</p>
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
                                <p className="font-medium text-ink">{blend.lot_code}</p>
                                <p className="text-xs text-slate-600">
                                  {blend.commercial_classification || formatInputLabel(blend)}
                                </p>
                              </div>
                              <p className="text-right text-slate-700">
                                {blend.percentage}%<br />
                                <span className="text-xs text-slate-500">{blend.calculated_quantity_kg} kg estimados</span>
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
                          <p className="font-medium text-ink">{lot.lot_code}</p>
                          <p className="text-xs text-slate-500">
                            {lot.coffee_profile_name || lot.coffee_type_name || lot.commercial_classification || lot.lot_kind}
                          </p>
                        </div>
                        <span>{lot.quantity_kg} kg</span>
                      </div>
                      {lot.process_mix?.length > 0 && (
                        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-semibold uppercase text-amber-800">Orden de mezcla</p>
                          <div className="mt-2 space-y-2">
                            {lot.process_mix.map((input) => (
                              <div key={`${lot.id}-${input.lot_id}`} className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-ink">{input.lot_code}</p>
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={
                        saving ||
                        !["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "listo_para_ensamble", "ensamble_definido"].includes(selectedSale.status)
                      }
                      onClick={() => updateStatus(selectedSale, "prepare")}
                    >
                      <PackageCheck size={16} />
                      Alistada
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={saving || selectedSale.status !== "alistada"}
                      onClick={() => updateStatus(selectedSale, "dispatch")}
                    >
                      <Truck size={16} />
                      Despachada
                    </button>
                  </div>
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
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Valor a registrar"
                      type="number"
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
