import { useEffect, useState } from "react";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/dashboard")
      .then(setData)
      .catch((requestError) => setError(requestError.message));
  }, []);

  if (error) {
    return <p className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Cargando dashboard...</p>;
  }

  const counters = [
    ["Inventario disponible", `${data.counters.availableInventoryKg} kg`],
    ["Lotes laboratorio", data.counters.labPendingLots],
    ["Procesos activos", data.counters.activeProcesses],
    ["Ventas por alistar", data.counters.salesToPrepare],
    ["Cartera vencida", data.counters.overdueSales],
    ["Cuentas por pagar vencidas", data.counters.overduePayables],
  ];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-slate-500">Estado general de la operacion.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {counters.map(([label, value]) => (
          <div key={label} className="rounded border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Alertas</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {data.alerts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No hay alertas por ahora.</p>
          ) : (
            data.alerts.map((alert, index) => (
              <div key={`${alert.type}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm text-slate-700">{alert.message}</p>
                <StatusBadge tone={alert.priority === "alta" ? "danger" : "warning"}>{alert.priority}</StatusBadge>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;
