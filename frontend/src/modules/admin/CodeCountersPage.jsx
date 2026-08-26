import { RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import { apiRequest } from "../../utils/api";

const CodeCountersPage = () => {
  const [counters, setCounters] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingPrefix, setSavingPrefix] = useState("");

  const loadCounters = async () => {
    setMessage("");
    setError("");
    const data = await apiRequest("/code-counters");
    setCounters(data);
    setFormValues(data.reduce((values, counter) => ({
      ...values,
      [counter.prefix]: String(counter.nextNumber),
    }), {}));
  };

  useEffect(() => {
    loadCounters().catch((requestError) => setError(requestError.message));
  }, []);

  const updateCounter = async (counter) => {
    const nextNumber = Number(formValues[counter.prefix]);

    if (!Number.isInteger(nextNumber) || nextNumber <= 0) {
      setError("El consecutivo debe ser un numero entero mayor a cero.");
      return;
    }

    if (!window.confirm(`Confirma que el proximo ${counter.prefix} sea ${counter.prefix}-${counter.year}-${String(nextNumber).padStart(4, "0")}?`)) {
      return;
    }

    setSavingPrefix(counter.prefix);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/code-counters/${counter.prefix}`, {
        method: "PUT",
        body: JSON.stringify({
          year: counter.year,
          nextNumber,
        }),
      });
      await loadCounters();
      setMessage("Consecutivo actualizado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingPrefix("");
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Consecutivos</h1>
          <p className="text-sm text-slate-500">Alinea los codigos del sistema con talonarios o registros fisicos.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          type="button"
          onClick={loadCounters}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Ajuste estos consecutivos solo durante carga inicial o correcciones controladas. El numero guardado sera el proximo codigo que generara el sistema.
        LOT y PROC comparten el mismo talonario fisico, por eso ambos avanzan sobre el mismo numero.
      </p>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Proximos codigos</h2>
        </div>
        {counters.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin consecutivos" message="Actualice para cargar la configuracion." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Modulo</th>
                  <th className="px-3 py-2">Prefijo</th>
                  <th className="px-3 py-2">Ultimo usado</th>
                  <th className="px-3 py-2">Proximo numero</th>
                  <th className="px-3 py-2">Proximo codigo</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {counters.map((counter) => {
                  const nextNumber = Number(formValues[counter.prefix] || 0);
                  const nextCode = ["LOT", "PROC"].includes(counter.prefix)
                    ? `LOT/PROC-${counter.year}-${String(nextNumber || 0).padStart(4, "0")}`
                    : `${counter.prefix}-${counter.year}-${String(nextNumber || 0).padStart(4, "0")}`;

                  return (
                    <tr key={counter.prefix}>
                      <td className="px-3 py-2 font-medium">{counter.label}</td>
                      <td className="px-3 py-2">{counter.prefix}</td>
                      <td className="px-3 py-2">{counter.lastUsedNumber || 0}</td>
                      <td className="px-3 py-2">
                        <input
                          className="w-32 rounded border border-slate-300 px-3 py-2 text-sm"
                          type="number"
                          min="1"
                          step="1"
                          value={formValues[counter.prefix] || ""}
                          onChange={(event) => setFormValues({ ...formValues, [counter.prefix]: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-ink">{nextCode}</td>
                      <td className="px-3 py-2">
                        <button
                          className="inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          type="button"
                          disabled={savingPrefix === counter.prefix}
                          onClick={() => updateCounter(counter)}
                        >
                          <Save size={14} />
                          Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default CodeCountersPage;
