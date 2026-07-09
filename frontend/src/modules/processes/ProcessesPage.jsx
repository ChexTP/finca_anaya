import { Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { getProcessStatusTone, processStatusLabels } from "../../utils/workflow";

const initialProcess = {
  quoteId: "",
  saleId: "",
  processLocation: "",
  notes: "",
};

const initialStartForm = {
  processLocation: "",
  estimatedReturnDate: "",
};

const initialPhysicalReviewForm = {
  outputWeightKg: "",
  humidityPercent: "",
  performanceFactor: "",
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
  const [searchParams] = useSearchParams();
  const [processes, setProcesses] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [sales, setSales] = useState([]);
  const [form, setForm] = useState(initialProcess);
  const [selectedLots, setSelectedLots] = useState({});
  const [startProcessId, setStartProcessId] = useState(null);
  const [startForm, setStartForm] = useState(initialStartForm);
  const [physicalReviewProcessId, setPhysicalReviewProcessId] = useState(null);
  const [physicalReviewForm, setPhysicalReviewForm] = useState(initialPhysicalReviewForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canCreateProcess = ["admin", "warehouse"].includes(user?.role);

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
      requests.push(apiRequest("/sales"));
    }

    const [processData, lotData = [], quoteData = [], saleData = []] = await Promise.all(requests);
    setProcesses(processData);
    setAvailableLots(lotData);
    setQuotes(quoteData.filter((quote) => quote.quote_type === "preventa"));
    setSales(saleData.filter((sale) => !["despachada", "anulada"].includes(sale.status)));
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    const saleId = searchParams.get("saleId");
    if (saleId) setForm((current) => ({ ...current, saleId, quoteId: "" }));
  }, [searchParams]);

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

    const confirmed = window.confirm("Confirma solicitar este proceso para laboratorio?");

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
          saleId: form.saleId ? Number(form.saleId) : null,
          inputs: selectedInputs,
        }),
      });
      setForm(initialProcess);
      setSelectedLots({});
      await loadData();
      setMessage("Solicitud de proceso creada. Bodega debe confirmar cuando el cafe entre a procesamiento.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const openStartForm = (process) => {
    setStartProcessId(process.id);
    setStartForm({
      processLocation: process.process_location || "",
      estimatedReturnDate: process.estimated_return_date ? String(process.estimated_return_date).slice(0, 10) : "",
    });
    setPhysicalReviewProcessId(null);
    setError("");
    setMessage("");
  };

  const openPhysicalReviewForm = (process) => {
    setPhysicalReviewProcessId(process.id);
    setPhysicalReviewForm({
      outputWeightKg: process.output_weight_kg || "",
      humidityPercent: process.physical_humidity_percent || "",
      performanceFactor: process.physical_performance_factor || "",
    });
    setStartProcessId(null);
    setError("");
    setMessage("");
  };

  const startProcess = async (event, process) => {
    event.preventDefault();

    if (!startForm.estimatedReturnDate) {
      setError("La fecha estimada de regreso a bodega es obligatoria.");
      return;
    }

    if (!window.confirm(`Confirma iniciar el proceso ${process.code}?`)) return;

    setSaving(true);
    setError("");
    try {
      await apiRequest(`/processes/${process.id}/start`, {
        method: "PUT",
        body: JSON.stringify({
          processLocation: startForm.processLocation,
          estimatedReturnDate: startForm.estimatedReturnDate,
        }),
      });
      setStartProcessId(null);
      setStartForm(initialStartForm);
      await loadData();
      setMessage("Proceso iniciado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const sendProcessToLaboratory = async (process) => {
    if (!window.confirm(`Confirma que ${process.code} regreso a bodega para revision fisica?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/processes/${process.id}/pending-laboratory`, { method: "PUT", body: JSON.stringify({}) });
      await loadData();
      setMessage("Proceso recibido. Bodega debe completar la revision fisica.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const completePhysicalReview = async (event, process) => {
    event.preventDefault();

    if (!physicalReviewForm.outputWeightKg || !physicalReviewForm.humidityPercent || !physicalReviewForm.performanceFactor) {
      setError("Cantidad final, humedad y factor son obligatorios para la revision fisica.");
      return;
    }

    if (!window.confirm(`Confirma la revision fisica de ${process.code}?`)) return;

    setSaving(true);
    setError("");
    try {
      await apiRequest(`/processes/${process.id}/physical-review`, {
        method: "PUT",
        body: JSON.stringify({
          outputWeightKg: Number(physicalReviewForm.outputWeightKg),
          humidityPercent: Number(physicalReviewForm.humidityPercent),
          performanceFactor: Number(physicalReviewForm.performanceFactor),
        }),
      });
      setPhysicalReviewProcessId(null);
      setPhysicalReviewForm(initialPhysicalReviewForm);
      await loadData();
      setMessage("Revision fisica guardada. El proceso ya aparece en Laboratorio.");
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
              <h2 className="text-sm font-semibold text-slate-800">Solicitar proceso</h2>
              <p className="text-sm text-slate-500">Seleccione la venta, los lotes y las cantidades. Bodega o administracion controlan el inicio y el regreso fisico.</p>
            </div>
            <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Total: <span className="font-semibold text-ink">{totalSelectedKg} kg</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.quoteId}
              onChange={(event) => setForm({ ...form, quoteId: event.target.value, saleId: "" })}
            >
              <option value="">Sin preventa asociada</option>
              {quotes.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {quote.code} - {quote.client_name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.saleId}
              onChange={(event) => setForm({ ...form, saleId: event.target.value, quoteId: "" })}
            >
              <option value="">Sin venta asociada</option>
              {sales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.code} - {sale.client_name}
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
            Solicitar proceso
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
                    {process.sale_code
                      ? `${process.sale_code} - ${process.sale_client_name}`
                      : process.quote_code
                        ? `${process.quote_code} - ${process.quote_client_name}`
                        : "Sin venta o preventa asociada"}
                  </p>
                </div>
                <StatusBadge tone={getProcessStatusTone(process)}>
                  {processStatusLabels[process.status] || process.status}
                </StatusBadge>
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
              {process.sale_code && (
                <p className="mt-2 text-sm text-slate-500">
                  Entrega estimada venta: {formatDate(process.sale_estimated_delivery_date)}
                </p>
              )}
              {process.notes && <p className="mt-2 text-sm text-slate-500">{process.notes}</p>}
              {["admin", "warehouse"].includes(user?.role) && process.status === "pendiente" && (
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  type="button"
                  disabled={saving}
                  onClick={() => openStartForm(process)}
                >
                  <Save size={16} />
                  Iniciar proceso
                </button>
              )}
              {startProcessId === process.id && (
                <form className="mt-3 grid gap-3 rounded border border-emerald-100 bg-emerald-50 p-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => startProcess(event, process)}>
                  <label className="text-xs font-medium text-slate-600">
                    Fecha estimada de regreso
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      type="date"
                      value={startForm.estimatedReturnDate}
                      onChange={(event) => setStartForm({ ...startForm, estimatedReturnDate: event.target.value })}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Ubicacion del proceso
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Finca, bodega o lugar"
                      value={startForm.processLocation}
                      onChange={(event) => setStartForm({ ...startForm, processLocation: event.target.value })}
                    />
                  </label>
                  <button
                    className="self-end rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving}
                  >
                    Confirmar inicio
                  </button>
                </form>
              )}
              {["admin", "warehouse"].includes(user?.role) && process.status === "en_proceso" && (
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  type="button"
                  disabled={saving}
                  onClick={() => sendProcessToLaboratory(process)}
                >
                  <Save size={16} />
                  Recibir para revision fisica
                </button>
              )}
              {["admin", "warehouse"].includes(user?.role) && process.status === "pendiente_revision_fisica" && (
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  type="button"
                  disabled={saving}
                  onClick={() => openPhysicalReviewForm(process)}
                >
                  <Save size={16} />
                  Registrar revision fisica
                </button>
              )}
              {physicalReviewProcessId === process.id && (
                <form className="mt-3 grid gap-3 rounded border border-emerald-100 bg-emerald-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(event) => completePhysicalReview(event, process)}>
                  <label className="text-xs font-medium text-slate-600">
                    Cantidad final kg
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={physicalReviewForm.outputWeightKg}
                      onChange={(event) => setPhysicalReviewForm({ ...physicalReviewForm, outputWeightKg: event.target.value })}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Humedad %
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={physicalReviewForm.humidityPercent}
                      onChange={(event) => setPhysicalReviewForm({ ...physicalReviewForm, humidityPercent: event.target.value })}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Factor rendimiento
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={physicalReviewForm.performanceFactor}
                      onChange={(event) => setPhysicalReviewForm({ ...physicalReviewForm, performanceFactor: event.target.value })}
                    />
                  </label>
                  <button
                    className="self-end rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving}
                  >
                    Guardar revision
                  </button>
                </form>
              )}
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
