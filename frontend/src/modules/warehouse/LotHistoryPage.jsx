import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotCodeName } from "../../utils/coffeeLots";
import { lotStatusLabels } from "../../utils/workflow";

const acceptedStatuses = ["pendiente_liquidacion", "disponible", "vendido_parcial", "agotado", "en_proceso", "procesado"];
const rejectedStatuses = ["rechazado", "retirado"];

const historyConfig = {
  accepted: {
    title: "Historico aceptados",
    description: "Lotes que pasaron laboratorio y continuaron el flujo operativo.",
    statuses: acceptedStatuses,
    emptyTitle: "Sin lotes aceptados",
    emptyMessage: "Los cafes aprobados por laboratorio apareceran aqui.",
  },
  rejected: {
    title: "Historico rechazados",
    description: "Lotes rechazados por laboratorio o retirados por el proveedor.",
    statuses: rejectedStatuses,
    emptyTitle: "Sin lotes rechazados",
    emptyMessage: "Los cafes rechazados por laboratorio apareceran aqui.",
  },
};

const getStatusTone = (status) => {
  if (["rechazado", "retirado"].includes(status)) return "danger";
  if (["disponible", "vendido_parcial", "procesado"].includes(status)) return "success";
  if (status === "pendiente_liquidacion") return "warning";
  return "neutral";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString("es-CO");
};

const normalizeText = (value) => String(value || "").toLowerCase();

const LotHistoryPage = ({ type = "accepted" }) => {
  const config = historyConfig[type] || historyConfig.accepted;
  const [lots, setLots] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    from: "",
    to: "",
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(`/lots?status=${config.statuses.join(",")}`);
      setLots(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [type]);

  const filteredLots = useMemo(() => {
    const search = normalizeText(filters.search);
    const fromTime = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
    const toTime = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null;

    return lots.filter((lot) => {
      const receivedTime = lot.received_at ? new Date(lot.received_at).getTime() : new Date(lot.created_at).getTime();
      const matchesDate = (!fromTime || receivedTime >= fromTime) && (!toTime || receivedTime <= toTime);
      const searchable = normalizeText([
        lot.code,
        lot.supplier_name,
        lot.coffee_type_name,
        lot.coffee_profile_name,
        lot.coffee_variety,
        lot.commercial_classification,
        lot.status,
        lotStatusLabels[lot.status],
      ].filter(Boolean).join(" "));

      return matchesDate && (!search || searchable.includes(search));
    });
  }, [filters, lots]);

  const totalKg = filteredLots.reduce((sum, lot) => sum + Number(lot.net_weight_kg || 0), 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">{config.title}</h1>
          <p className="text-sm text-slate-500">{config.description}</p>
        </div>
        <button
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={() => loadData().then(() => setMessage("Historico actualizado.")).catch((requestError) => setError(requestError.message))}
        >
          Actualizar
        </button>
      </div>

      {message && <div className="rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por lote, proveedor, cafe, clasificacion o estado"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
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
        <p className="mt-3 text-xs text-slate-500">
          Mostrando {filteredLots.length} lotes. Peso neto historico: {totalKg.toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg.
        </p>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Cargando historico...</div>
        ) : filteredLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title={config.emptyTitle} message={config.emptyMessage} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Cafe</th>
                  <th className="px-4 py-3">Llegada</th>
                  <th className="px-4 py-3">Peso neto</th>
                  <th className="px-4 py-3">Disponible</th>
                  <th className="px-4 py-3">Laboratorio</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-4 py-3 font-semibold text-ink">{lot.code}</td>
                    <td className="px-4 py-3 text-slate-600">{lot.supplier_name || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-ink">{formatCoffeeLotCodeName(lot)}</p>
                      <p className="text-xs text-slate-500">{[lot.presentation, lot.commercial_classification].filter(Boolean).join(" · ") || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(lot.received_at || lot.created_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{Number(lot.net_weight_kg || 0).toLocaleString("es-CO")} kg</td>
                    <td className="px-4 py-3 text-slate-600">{Number(lot.available_weight_kg || 0).toLocaleString("es-CO")} kg</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>Humedad: {lot.humidity_percent ?? "-"}%</p>
                      <p>Score: {lot.lab_score ?? "-"}</p>
                      <p className="text-xs text-slate-500">{lot.lab_notes || "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={getStatusTone(lot.status)}>{lotStatusLabels[lot.status] || lot.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default LotHistoryPage;
