import { Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

const initialProcess = {
  quoteId: "",
  processLocation: "",
  notes: "",
};

const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const formatDate = (value) => {
  if (!value) return "Sin fecha estimada";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");

  return [day, month, year].filter(Boolean).join("/");
};

const ProcessesPage = () => {
  const { user } = useAuth();
  const [processes, setProcesses] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [form, setForm] = useState(initialProcess);
  const [selectedLots, setSelectedLots] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canCreateProcess = ["admin", "warehouse", "laboratory"].includes(user?.role);

  const selectedInputs = useMemo(() => {
    return Object.entries(selectedLots)
      .filter(([, value]) => value.enabled && Number(value.quantityKg) > 0)
      .map(([lotId, value]) => ({
        lotId: Number(lotId),
        quantityKg: Number(value.quantityKg),
      }));
  }, [selectedLots]);

  const totalSelectedKg = useMemo(() => {
    return selectedInputs.reduce((total, input) => total + input.quantityKg, 0).toFixed(3);
  }, [selectedInputs]);

  const loadData = async () => {
    const requests = [apiRequest("/processes")];

    if (canCreateProcess) {
      requests.push(apiRequest("/inventory/lots"));
      requests.push(apiRequest("/quotes?status=aceptada"));
    }

    const [processData, lotData = [], quoteData = []] = await Promise.all(requests);
    setProcesses(processData);
    setAvailableLots(lotData);
    setQuotes(quoteData.filter((quote) => quote.quote_type === "preventa"));
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const toggleLot = (lot) => {
    setSelectedLots((current) => ({
      ...current,
      [lot.id]: {
        enabled: !current[lot.id]?.enabled,
        quantityKg: current[lot.id]?.quantityKg || "",
      },
    }));
  };

  const updateLotQuantity = (lotId, quantityKg) => {
    setSelectedLots((current) => ({
      ...current,
      [lotId]: {
        enabled: true,
        quantityKg,
      },
    }));
  };

  const createProcess = async (event) => {
    event.preventDefault();

    if (selectedInputs.length === 0) {
      setError("Seleccione al menos un lote y una cantidad para procesar.");
      return;
    }

    const confirmed = window.confirm("Confirma crear este proceso y descontar esas cantidades del inventario?");

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest("/processes", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quoteId: form.quoteId ? Number(form.quoteId) : null,
          inputs: selectedInputs,
        }),
      });
      setForm(initialProcess);
      setSelectedLots({});
      await loadData();
      setMessage("Proceso creado correctamente. Las cantidades quedaron descontadas.");
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
          <h1 className="text-xl font-bold text-ink">Procesos</h1>
          <p className="text-sm text-slate-500">Cafe enviado a procesamiento y procesos finalizados.</p>
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

      {canCreateProcess && (
        <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createProcess}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Crear proceso</h2>
              <p className="text-sm text-slate-500">Seleccione los lotes y cantidades definidos para el proceso.</p>
            </div>
            <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Total: <span className="font-semibold text-ink">{totalSelectedKg} kg</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.quoteId}
              onChange={(event) => setForm({ ...form, quoteId: event.target.value })}
            >
              <option value="">Sin preventa asociada</option>
              {quotes.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {quote.code} - {quote.client_name}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ubicacion del proceso"
              value={form.processLocation}
              onChange={(event) => setForm({ ...form, processLocation: event.target.value })}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Observaciones"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Usar</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Tipo / Perfil</th>
                  <th className="px-3 py-2">Clasificacion</th>
                  <th className="px-3 py-2">Disponible</th>
                  <th className="px-3 py-2">Cantidad a procesar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {availableLots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedLots[lot.id]?.enabled)}
                        onChange={() => toggleLot(lot)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{lot.code}</td>
                    <td className="px-3 py-2">{lot.coffee_profile_name || lot.coffee_type_name || "-"}</td>
                    <td className="px-3 py-2">{lot.commercial_classification || "-"}</td>
                    <td className="px-3 py-2">{lot.available_weight_kg} kg</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                        type="number"
                        min="0"
                        step="0.001"
                        max={lot.available_weight_kg}
                        value={selectedLots[lot.id]?.quantityKg || ""}
                        onChange={(event) => updateLotQuantity(lot.id, event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving || selectedInputs.length === 0}
          >
            <Plus size={16} />
            Crear proceso
          </button>
        </form>
      )}

      {processes.length === 0 ? (
        <EmptyState title="Sin procesos" message="Los procesos creados desde bodega apareceran aqui." />
      ) : (
        <div className="grid gap-3">
          {processes.map((process) => (
            <div key={process.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{process.code}</p>
                  <p className="text-sm text-slate-500">
                    {process.quote_code ? `${process.quote_code} - ${process.quote_client_name}` : "Sin preventa asociada"}
                  </p>
                </div>
                <StatusBadge tone={process.status === "finalizado" ? "success" : "warning"}>{process.status}</StatusBadge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                <p>{process.total_input_kg} kg de entrada</p>
                <p>{process.process_location || "Sin ubicacion"}</p>
                <p>{process.output_lot_code || "Sin lote final"}</p>
              </div>
              {process.quote_code && (
                <p className="mt-2 text-sm text-slate-500">
                  Entrega estimada preventa: {formatDate(process.quote_estimated_delivery_date)}
                </p>
              )}
              {process.notes && <p className="mt-2 text-sm text-slate-500">{process.notes}</p>}
              {process.inputs?.length > 0 && (
                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Mezcla del proceso</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {process.inputs.map((input) => (
                      <div key={`${process.id}-${input.lot_id}`} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                        <p className="font-semibold text-ink">{input.lot_code}</p>
                        <p className="text-slate-600">{formatInputLabel(input)}</p>
                        <p className="text-slate-500">
                          {input.quantity_kg} kg - {input.input_percentage}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProcessesPage;
