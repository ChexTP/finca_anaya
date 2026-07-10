import { AlertTriangle, BarChart3, ClipboardList, Coffee, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const formatKg = (value, decimals = 2) => {
  return `${Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })} kg`;
};

const formatGrams = (value) => {
  return `${Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} g`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const priorityTone = {
  alta: "danger",
  media: "warning",
  baja: "neutral",
};

const saleStatusLabels = {
  pendiente_alistamiento: "Pendiente de decision",
  pendiente_bodega: "Pendiente de bodega",
  lote_asignado: "Con lote asignado",
  proceso_solicitado: "Proceso solicitado",
  en_proceso: "En proceso",
  listo_para_ensamble: "Listo para ensamble",
  ensamble_definido: "Ensamble definido",
  alistada: "Alistada",
};

const processStatusLabels = {
  pendiente: "Por iniciar",
  en_proceso: "En proceso",
  pendiente_revision_fisica: "Revision fisica",
  pendiente_laboratorio: "Laboratorio",
};

const kpiCards = [
  ["active_items", "Items en produccion", ClipboardList],
  ["high_priority_items", "Pedidos prioridad alta", AlertTriangle],
  ["ready_orders", "Ordenes listas", BarChart3],
  ["active_samples", "Muestras activas", ClipboardList],
  ["active_processes", "Procesos activos", Coffee],
  ["total_requested_kg", "Kg del pedido", BarChart3],
  ["total_required_kg", "Kg a procesar/comprar", BarChart3],
];

const DeficitTable = ({ title, rows, tone }) => {
  return (
    <div className="rounded border border-slate-200 bg-white">
      <div className={`border-b border-slate-200 px-4 py-3 ${tone === "danger" ? "bg-rose-50" : "bg-amber-50"}`}>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Sin deficit" message="No hay informacion pendiente para este grupo." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2">Insumo</th>
                <th className="px-3 py-2">Beneficio</th>
                <th className="px-3 py-2">Componente</th>
                <th className="px-3 py-2">Kg del pedido</th>
                <th className="px-3 py-2">Kg a procesar/comprar</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.product_form}-${row.benefit}-${row.name}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                  <td className="px-3 py-2">{row.benefit}</td>
                  <td className="px-3 py-2">{row.component_type}</td>
                  <td className="px-3 py-2 text-blue-700">{formatKg(row.requested_kg)}</td>
                  <td className="px-3 py-2 font-semibold text-rose-700">{formatKg(row.required_kg)}</td>
                  <td className="px-3 py-2">
                    <details>
                      <summary className="cursor-pointer text-leaf">{row.orders.length} pedidos</summary>
                      <div className="mt-2 space-y-2">
                        {row.orders.map((order, index) => (
                          <div key={`${order.sale_code}-${index}`} className="rounded bg-slate-50 p-2 text-xs text-slate-600">
                            <p className="font-semibold text-slate-800">{order.sale_code} - {order.client_name}</p>
                            <p>{order.seller_name} · {saleStatusLabels[order.status] || order.status}</p>
                            <p>Entrega: {formatDate(order.estimated_delivery_date)} · {formatKg(order.requested_kg)} del pedido</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ManagementPage = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/management/production-report");
      setReport(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const generatedAt = useMemo(() => {
    if (!report?.generated_at) return "";
    return new Date(report.generated_at).toLocaleString("es-CO");
  }, [report]);

  if (error) {
    return <p className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  }

  if (!report) {
    return <p className="text-sm text-slate-500">Cargando informe gerencial...</p>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Panel de produccion</h1>
          <p className="text-sm text-slate-500">
            Informe gerencial basado en pedidos, muestras, ensambles y cafe necesario.
          </p>
          <p className="mt-1 text-xs text-slate-400">Actualizado: {generatedAt}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={loadReport}
        >
          <RefreshCw size={16} />
          {loading ? "Actualizando..." : "Actualizar informe"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map(([key, label, Icon]) => (
          <div key={key} className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-ink">
                  {key.includes("_kg") ? formatKg(report.kpis[key]) : Number(report.kpis[key] || 0).toLocaleString("es-CO")}
                </p>
              </div>
              <div className="rounded bg-emerald-50 p-2 text-leaf">
                <Icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Estados de pedidos activos</h2>
          </div>
          {(report.statusSummary || []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Sin pedidos activos.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.statusSummary.map((item) => (
                <div key={item.status} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">Proxima entrega: {formatDate(item.next_delivery_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-ink">{item.orders_count}</p>
                    {Number(item.high_priority_count) > 0 && <p className="text-xs text-rose-600">{item.high_priority_count} alta</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Kg pendientes por cliente</h2>
          </div>
          {(report.clientPendingKg || []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Sin kg pendientes por cliente.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.clientPendingKg.map((client) => (
                <div key={client.client_name} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{client.client_name}</p>
                    <p className="text-xs text-slate-500">{client.orders_count} pedidos · entrega {formatDate(client.next_delivery_date)}</p>
                  </div>
                  <p className="text-sm font-bold text-rose-700">{formatKg(client.pending_kg)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Prioridad general</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(report.prioritySummary || []).map((item) => (
              <div key={item.priority} className="flex items-center justify-between gap-3 px-4 py-3">
                <StatusBadge tone={priorityTone[item.priority] || "neutral"}>{item.priority}</StatusBadge>
                <p className="text-lg font-bold text-ink">{item.orders_count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-2">
        <DeficitTable title="Deficit - Cafe Excelso" rows={report.deficit.excelso || []} tone="danger" />
        <DeficitTable title="Deficit - Cafe Pergamino" rows={report.deficit.pergamino || []} tone="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Atencion inmediata: prioridad alta</h2>
          </div>
          {(report.urgentSales || []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Sin pedidos de prioridad alta.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.urgentSales.map((sale) => (
                <div key={sale.sale_code} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{sale.sale_code} - {sale.client_name}</p>
                    <StatusBadge tone="danger">Alta</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Entrega: {formatDate(sale.estimated_delivery_date)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{sale.detail || "Sin detalle"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <Users size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Carga por responsable</h2>
          </div>
          {(report.sellerLoad || []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No hay pedidos activos.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.sellerLoad.map((seller) => (
                <div key={seller.seller_name} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{seller.seller_name}</p>
                    <StatusBadge tone={priorityTone[seller.max_priority] || "neutral"}>
                      {seller.max_priority}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {seller.orders_count} pedidos / {seller.items_count} items
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-leaf">Ver pedidos</summary>
                    <div className="mt-2 space-y-2">
                      {seller.orders.map((order) => (
                        <div key={order.sale_code} className="rounded bg-slate-50 p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">{order.sale_code} - {order.client_name}</p>
                            <StatusBadge tone={priorityTone[order.priority] || "neutral"}>{order.priority}</StatusBadge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {saleStatusLabels[order.status] || order.status} · entrega {formatDate(order.estimated_delivery_date)}
                          </p>
                          <div className="mt-2 space-y-1">
                            {order.items.map((item, index) => (
                              <p key={`${order.sale_code}-${index}`} className="text-xs text-slate-600">
                                {item.name} · {item.product_form || "-"} · {item.benefit || "-"} · {formatKg(item.quantity_kg)}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Muestras en proceso</h2>
          </div>
          {(report.samples || []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Sin muestras activas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Orden</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Entrega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.samples.map((sample) => (
                    <tr key={sample.code}>
                      <td className="px-3 py-2 font-medium">{sample.code}</td>
                      <td className="px-3 py-2">{sample.requester_name}</td>
                      <td className="px-3 py-2">{sample.status}</td>
                      <td className="px-3 py-2">{formatGrams(sample.quantity_grams)}</td>
                      <td className="px-3 py-2">{formatDate(sample.tentative_delivery_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ordenes 100% listas para envio</h2>
          </div>
          {(report.readyOrders || []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Ninguna orden esta lista todavia.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.readyOrders.map((sale) => (
                <div key={sale.sale_code} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{sale.sale_code} - {sale.client_name}</p>
                    <StatusBadge tone={priorityTone[sale.priority] || "neutral"}>{sale.priority}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Entrega: {formatDate(sale.estimated_delivery_date)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{sale.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Procesos activos</h2>
        </div>
        {(report.processes || []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Sin procesos activos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Proceso</th>
                  <th className="px-3 py-2">Venta</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Entrada</th>
                  <th className="px-3 py-2">Salida</th>
                  <th className="px-3 py-2">Regreso estimado</th>
                  <th className="px-3 py-2">Ubicacion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.processes.map((process) => (
                  <tr key={process.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{process.code}</td>
                    <td className="px-3 py-2">{process.sale_code || "-"}</td>
                    <td className="px-3 py-2">{process.client_name || "-"}</td>
                    <td className="px-3 py-2">{processStatusLabels[process.status] || process.status}</td>
                    <td className="px-3 py-2">{formatKg(process.total_input_kg)}</td>
                    <td className="px-3 py-2">{process.output_weight_kg ? formatKg(process.output_weight_kg) : "-"}</td>
                    <td className="px-3 py-2">{formatDate(process.estimated_return_date)}</td>
                    <td className="px-3 py-2">{process.process_location || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(report.deficit.captureErrors || []).length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50">
          <div className="border-b border-amber-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-amber-900">Errores de captura no sumados al deficit</h2>
          </div>
          <div className="divide-y divide-amber-100">
            {report.deficit.captureErrors.map((error) => (
              <div key={`${error.sale_code}-${error.coffee_name}`} className="px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">{error.sale_code} - {error.client_name}</p>
                <p>{error.coffee_name}: {error.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ManagementPage;
