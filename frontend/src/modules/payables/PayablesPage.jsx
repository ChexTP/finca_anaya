import { Eye, FileDown, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { openPurchaseOrderPrint } from "../../utils/purchaseOrderDocument";

const formatMoney = (value) => `COP ${Number(value || 0).toLocaleString("es-CO")}`;
const formatKg = (value) => `${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg`;

const getCoffeeName = (payable) => {
  return [
    payable.lot_presentation,
    payable.coffee_profile_name || payable.coffee_variety || payable.coffee_type_name || payable.commercial_classification,
  ].filter(Boolean).join(" - ") || "Cafe liquidado";
};

const PayablesPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    const payableData = await apiRequest("/payables");
    setOrders(payableData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) => [
      order.code,
      order.lot_code,
      order.supplier_name,
      getCoffeeName(order),
      order.performance_factor,
    ].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [orders, search]);

  const loadOrderDetail = async (orderId) => {
    const data = await apiRequest(`/payables/${orderId}`);
    setSelectedOrder(data);
    setMessage("");
    setError("");
  };

  const printOrder = async (order) => {
    try {
      const fullOrder = order.payments ? order : await apiRequest(`/payables/${order.id}`);
      openPurchaseOrderPrint(fullOrder);
      setMessage("Orden de compra abierta para imprimir o guardar como PDF.");
      setSelectedOrder(fullOrder);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Ordenes de compra</h1>
          <p className="text-sm text-slate-500">Documentos generados automaticamente al liquidar cafe comprado.</p>
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Lotes liquidados</h2>
            <p className="mt-1 text-xs text-slate-500">Busque por orden, lote, proveedor, cafe o factor.</p>
            <input
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Buscar orden de compra"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {filteredOrders.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin ordenes" message="Cuando se liquide un lote de cafe, aparecera aqui su orden de compra." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Orden</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Cafe</th>
                    <th className="px-3 py-2">Kilos</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-3 py-2 font-medium">{order.code}</td>
                      <td className="px-3 py-2">{order.lot_code || "-"}</td>
                      <td className="px-3 py-2">{order.supplier_name || "-"}</td>
                      <td className="px-3 py-2">{getCoffeeName(order)}</td>
                      <td className="px-3 py-2">{formatKg(order.net_weight_kg)}</td>
                      <td className="px-3 py-2">{formatMoney(order.total)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            onClick={() => loadOrderDetail(order.id)}
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded border border-leaf bg-emerald-50 px-2 py-1 text-xs font-semibold text-leaf hover:bg-emerald-100"
                            onClick={() => printOrder(order)}
                          >
                            <FileDown size={14} />
                            PDF
                          </button>
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
          {!selectedOrder ? (
            <EmptyState title="Seleccione una orden" message="Aqui vera el detalle y podra imprimir el formato de compra." />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Orden seleccionada</p>
                <h2 className="mt-1 text-lg font-bold text-ink">{selectedOrder.code}</h2>
                <p className="text-sm text-slate-500">{selectedOrder.lot_code || "-"} - {getCoffeeName(selectedOrder)}</p>
              </div>
              <div className="rounded bg-slate-50 p-3 text-sm">
                <p><span className="font-semibold">Proveedor:</span> {selectedOrder.supplier_name || "-"}</p>
                <p><span className="font-semibold">Telefono:</span> {selectedOrder.supplier_phone || "-"}</p>
                <p><span className="font-semibold">Direccion:</span> {selectedOrder.supplier_address || "-"}</p>
                <p><span className="font-semibold">Kilos:</span> {formatKg(selectedOrder.net_weight_kg)}</p>
                <p><span className="font-semibold">Factor:</span> {selectedOrder.performance_factor || "-"}</p>
                <p><span className="font-semibold">Precio kg:</span> {formatMoney(selectedOrder.purchase_price_per_kg)}</p>
                <p><span className="font-semibold">Total:</span> {formatMoney(selectedOrder.total)}</p>
              </div>
              <StatusBadge tone={selectedOrder.status === "pagada" ? "success" : "warning"}>
                {selectedOrder.status}
              </StatusBadge>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white"
                onClick={() => printOrder(selectedOrder)}
              >
                <FileDown size={16} />
                Imprimir / guardar PDF
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default PayablesPage;
