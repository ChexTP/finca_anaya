import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  FlaskConical,
  RefreshCw,
  SlidersHorizontal,
  Truck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const counterConfig = [
  ["availableInventoryKg", "Inventario disponible", "kg", Boxes],
  ["lowInventoryGroups", "Inventario bajo", "grupos", AlertTriangle],
  ["labPendingLots", "Lotes laboratorio", "lotes", FlaskConical],
  ["activeProcesses", "Procesos activos", "procesos", ClipboardList],
  ["salesPendingBlend", "Mezclas pendientes", "ventas", SlidersHorizontal],
  ["pendingQuotes", "Preventas pendientes", "preventas", ClipboardList],
  ["salesToPrepare", "Ventas por alistar", "ventas", Truck],
  ["dispatchedSalesWithDebt", "Despachadas con saldo", "ventas", WalletCards],
  ["overdueSales", "Cartera vencida", "ventas", WalletCards],
  ["overduePayables", "Cuentas vencidas", "cuentas", AlertTriangle],
];

const priorityTone = {
  alta: "danger",
  media: "warning",
  baja: "neutral",
};

const formatValue = (key, value) => {
  if (key === "availableInventoryKg") {
    return `${Number(value || 0).toLocaleString("es-CO")} kg`;
  }

  return Number(value || 0).toLocaleString("es-CO");
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const dashboard = await apiRequest("/dashboard");
      setData(dashboard);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const groupedAlerts = useMemo(() => {
    const alerts = data?.alerts || [];

    return {
      alta: alerts.filter((alert) => alert.priority === "alta"),
      media: alerts.filter((alert) => alert.priority === "media"),
      baja: alerts.filter((alert) => alert.priority === "baja"),
    };
  }, [data]);

  if (error) {
    return <p className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Cargando dashboard...</p>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-slate-500">Estado general de la operacion y alertas principales.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={loadDashboard}
        >
          <RefreshCw size={16} />
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {counterConfig.map(([key, label, unit, Icon]) => (
          <div key={key} className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-ink">{formatValue(key, data.counters[key])}</p>
                {key !== "availableInventoryKg" && <p className="text-xs text-slate-400">{unit}</p>}
              </div>
              <div className="rounded bg-emerald-50 p-2 text-leaf">
                <Icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {["alta", "media", "baja"].map((priority) => (
          <div key={priority} className="rounded border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Prioridad {priority}</h2>
              <StatusBadge tone={priorityTone[priority]}>{groupedAlerts[priority].length}</StatusBadge>
            </div>
            <div className="divide-y divide-slate-100">
              {groupedAlerts[priority].length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">Sin alertas.</p>
              ) : (
                groupedAlerts[priority].map((alert, index) => (
                  <div key={`${alert.type}-${index}`} className="px-4 py-3">
                    <p className="text-sm text-slate-700">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{alert.type}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DashboardPage;
