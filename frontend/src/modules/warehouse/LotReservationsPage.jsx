import { AlertTriangle, Eye, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotOption } from "../../utils/coffeeLots";
import { formatDate } from "./WarehousePage";
import { saleStatusLabels, getSaleStatusTone } from "../../utils/workflow";
import { useEffect, useMemo, useState } from "react";

const formatKg = (value) => `${Number(value || 0).toLocaleString("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})} kg`;

const getItemName = (item) => {
  return item.description || item.coffee_profile_name || item.coffee_type_name || item.variety || "Cafe solicitado";
};

const LotReservationsPage = () => {
  const [data, setData] = useState({ lots: [], deficits: [], totals: {} });
  const [search, setSearch] = useState("");
  const [onlyWithDeficit, setOnlyWithDeficit] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    setMessage("");
    setError("");

    try {
      const response = await apiRequest("/sales/lot-reservations");
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLots = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (data.lots || []).filter((lot) => {
      const text = [
        lot.code,
        lot.coffee_type_name,
        lot.coffee_profile_name,
        lot.commercial_classification,
        lot.coffee_variety,
        ...(lot.assignments || []).map((assignment) => `${assignment.sale_code} ${assignment.client_name} ${getItemName(assignment)}`),
      ].filter(Boolean).join(" ").toLowerCase();

      return !term || text.includes(term);
    });
  }, [data.lots, search]);

  const filteredDeficits = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (data.deficits || []).filter((item) => {
      const text = [
        item.sale_code,
        item.client_name,
        item.order_assignee,
        getItemName(item),
        item.product_form,
        item.process_type,
        item.variety,
      ].filter(Boolean).join(" ").toLowerCase();

      if (onlyWithDeficit && Number(item.missing_kg || 0) <= 0) return false;
      return !term || text.includes(term);
    });
  }, [data.deficits, onlyWithDeficit, search]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Lotes asignados</h1>
          <p className="text-sm text-slate-500">Reservas operativas, cafe libre y deficit de pedidos activos.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          type="button"
          onClick={loadData}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <div className="rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Fisico en bodega</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatKg(data.totals?.physical_kg)}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Reservado</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{formatKg(data.totals?.reserved_kg)}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Libre operativo</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatKg(data.totals?.operational_available_kg)}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Deficit</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{formatKg(data.totals?.missing_kg)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-3">
        <input
          className="min-w-64 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Buscar por lote, cliente, venta o cafe"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyWithDeficit}
            onChange={(event) => setOnlyWithDeficit(event.target.checked)}
          />
          Solo deficit
        </label>
      </div>

      <div className="rounded border border-rose-200 bg-white">
        <div className="flex items-center gap-2 border-b border-rose-100 px-4 py-3">
          <AlertTriangle size={16} className="text-rose-700" />
          <h2 className="text-sm font-semibold text-rose-900">Pedidos con deficit</h2>
        </div>
        {filteredDeficits.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin deficit" message="No hay pedidos incompletos con los filtros actuales." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-rose-50 text-rose-900">
                <tr>
                  <th className="px-3 py-2">Venta</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Cafe</th>
                  <th className="px-3 py-2">Pedido</th>
                  <th className="px-3 py-2">Reservado</th>
                  <th className="px-3 py-2">Faltante</th>
                  <th className="px-3 py-2">Entrega</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeficits.map((item) => (
                  <tr key={item.sale_item_id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-ink">{item.sale_code}</td>
                    <td className="px-3 py-2">{item.client_name}</td>
                    <td className="px-3 py-2">{getItemName(item)}</td>
                    <td className="px-3 py-2">{formatKg(item.required_kg)}</td>
                    <td className="px-3 py-2">{formatKg(item.reserved_kg)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-700">{formatKg(item.missing_kg)}</td>
                    <td className="px-3 py-2">{formatDate(item.estimated_delivery_date)}</td>
                    <td className="px-3 py-2">
                      <Link className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" to="/bodega/pendientes">
                        <Eye size={13} />
                        Ver pedidos
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Reservas por lote</h2>
        </div>
        {filteredLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin lotes" message="No hay lotes asignados o disponibles con los filtros actuales." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLots.map((lot) => (
              <details key={lot.id} className="group">
                <summary className="grid cursor-pointer gap-3 px-4 py-3 text-sm hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_140px_140px_140px]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{formatCoffeeLotOption(lot)}</p>
                    <p className="text-xs text-slate-500">{lot.status}</p>
                  </div>
                  <p><span className="text-slate-500">Fisico:</span> {formatKg(lot.available_weight_kg)}</p>
                  <p><span className="text-slate-500">Reservado:</span> {formatKg(lot.reserved_kg)}</p>
                  <p className={Number(lot.operational_available_kg) > 0 ? "text-emerald-700" : "text-rose-700"}>
                    <span className="text-slate-500">Libre:</span> {formatKg(lot.operational_available_kg)}
                  </p>
                </summary>
                <div className="px-4 pb-4">
                  {lot.assignments?.length ? (
                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Venta</th>
                            <th className="px-3 py-2">Cliente</th>
                            <th className="px-3 py-2">Cafe</th>
                            <th className="px-3 py-2">Kg reservados</th>
                            <th className="px-3 py-2">Estado</th>
                            <th className="px-3 py-2">Encargado</th>
                            <th className="px-3 py-2">Entrega</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lot.assignments.map((assignment) => (
                            <tr key={assignment.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-semibold text-ink">{assignment.sale_code}</td>
                              <td className="px-3 py-2">{assignment.client_name}</td>
                              <td className="px-3 py-2">{getItemName(assignment)}</td>
                              <td className="px-3 py-2">{formatKg(assignment.quantity_kg)}</td>
                              <td className="px-3 py-2">
                                <StatusBadge tone={getSaleStatusTone({ status: assignment.sale_status })}>
                                  {saleStatusLabels[assignment.sale_status] || assignment.sale_status}
                                </StatusBadge>
                              </td>
                              <td className="px-3 py-2">{assignment.order_assignee || "-"}</td>
                              <td className="px-3 py-2">{formatDate(assignment.estimated_delivery_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-500">Este lote no tiene reservas activas.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default LotReservationsPage;
