import { Eye, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

const formatMoney = (currency, value) => {
  return `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;
};

const SalesPage = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const canManageDispatch = ["admin", "accounting", "warehouse"].includes(user?.role);
  const showFinancialData = ["admin", "accounting"].includes(user?.role);

  const loadSales = async () => {
    const data = await apiRequest("/sales");
    setSales(data);

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
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingDetail(false);
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
                        <StatusBadge tone={sale.status === "despachada" ? "success" : "warning"}>{sale.status}</StatusBadge>
                      </td>
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
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedSale.items?.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-ink">{item.description || item.coffee_profile_name || item.coffee_type_name}</p>
                    <p className="text-slate-500">{item.quantity_kg} kg</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Lotes a sacar</p>
                {selectedSale.deductedLots?.length ? (
                  selectedSale.deductedLots.map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-ink">{lot.lot_code}</span>
                      <span>{lot.quantity_kg} kg</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Esta venta no tiene lotes descontados registrados.</p>
                )}
              </div>

              {canManageDispatch && (
                <div className="space-y-3">
                  <textarea
                    className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Observaciones de bodega"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={saving || selectedSale.status !== "pendiente_alistamiento"}
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
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default SalesPage;
