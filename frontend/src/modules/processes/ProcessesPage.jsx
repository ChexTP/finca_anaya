import { Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotCodeName } from "../../utils/coffeeLots";
import { getProcessStatusTone, processStatusLabels } from "../../utils/workflow";

const initialProcess = {
  quoteId: "",
  saleId: "",
  processType: "Trilladora",
  processLocation: "",
  notes: "",
};

const initialStartForm = {
  processType: "Trilladora",
  processLocation: "",
  estimatedReturnDate: "",
};

const processTypeOptions = ["Trilladora", "Seleccion electronica", "Otro proceso"];
const directInventoryProcessTypes = ["Trilladora", "Seleccion electronica"];

const initialPhysicalReviewForm = {
  outputs: [
    {
      coffeeProfileId: "",
      presentation: "Excelso",
      outputWeightKg: "",
      humidityPercent: "",
      performanceFactor: "",
      notes: "",
    },
  ],
};

const emptyProcessOutput = {
  coffeeProfileId: "",
  presentation: "Excelso",
  outputWeightKg: "",
  humidityPercent: "",
  performanceFactor: "",
  notes: "",
};

const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const formatProfileLabel = (profile) => {
  const code = profile?.internal_code || profile?.coffee_profile_code || profile?.code;
  const name = profile?.name || profile?.coffee_profile_name || "Perfil";

  return [code, name].filter(Boolean).join(" - ");
};

const formatDate = (value) => {
  if (!value) return "Sin fecha estimada";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");

  return [day, month, year].filter(Boolean).join("/");
};

const ProcessesPage = ({
  fixedProcessType = null,
  title = "Procesos",
  description = "Cafe enviado a procesamiento y procesos finalizados.",
}) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultProcessType = fixedProcessType || "Trilladora";
  const [processes, setProcesses] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [sales, setSales] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [form, setForm] = useState({ ...initialProcess, processType: defaultProcessType });
  const [selectedLots, setSelectedLots] = useState({});
  const [startProcessId, setStartProcessId] = useState(null);
  const [startForm, setStartForm] = useState({ ...initialStartForm, processType: defaultProcessType });
  const [physicalReviewProcessId, setPhysicalReviewProcessId] = useState(null);
  const [physicalReviewForm, setPhysicalReviewForm] = useState(initialPhysicalReviewForm);
  const [processSearch, setProcessSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canCreateProcess = ["admin", "warehouse"].includes(user?.role);
  const actionLabel = fixedProcessType === "Trilladora"
    ? "Enviar a trilladora"
    : fixedProcessType === "Seleccion electronica"
      ? "Enviar a seleccionadora"
      : "Solicitar proceso";
  const actionDescription = fixedProcessType === "Trilladora"
    ? "Seleccione los lotes y cantidades que salen hacia trilladora. Bodega o administracion controlan el regreso fisico."
    : fixedProcessType === "Seleccion electronica"
      ? "Seleccione los lotes y cantidades que salen hacia seleccionadora. Bodega o administracion controlan el regreso fisico."
      : "Seleccione la venta, los lotes y las cantidades. Bodega o administracion controlan el inicio y el regreso fisico.";
  const startActionLabel = fixedProcessType === "Trilladora"
    ? "Confirmar envio a trilladora"
    : fixedProcessType === "Seleccion electronica"
      ? "Confirmar envio a seleccionadora"
      : "Confirmar inicio";
  const startButtonLabel = fixedProcessType === "Trilladora"
    ? "Enviar a trilladora"
    : fixedProcessType === "Seleccion electronica"
      ? "Enviar a seleccionadora"
      : "Iniciar proceso";
  const operationLabel = fixedProcessType ? "envio" : "proceso";
  const createsInventoryDirectly = (process) => directInventoryProcessTypes.includes(process?.process_type);
  const requiresProcessPerformanceFactor = (process) => !createsInventoryDirectly(process);
  const requiresProcessHumidity = (process) => !createsInventoryDirectly(process);

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

  const selectedSale = useMemo(() => {
    return sales.find((sale) => String(sale.id) === String(form.saleId));
  }, [form.saleId, sales]);

  const filteredProcesses = useMemo(() => {
    const search = processSearch.trim().toLowerCase();
    if (!search) return processes;

    return processes.filter((process) => {
      const text = [
        process.code,
        process.sale_code,
        process.sale_client_name,
        process.quote_code,
        process.quote_client_name,
        process.process_type,
        process.process_location,
        process.output_lot_code,
        process.notes,
        ...(process.inputs || []).flatMap((input) => [
          input.lot_code,
          input.coffee_profile_name,
          input.coffee_type_name,
          input.commercial_classification,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }, [processes, processSearch]);

  const loadData = async () => {
    const processQuery = fixedProcessType ? `?processType=${encodeURIComponent(fixedProcessType)}` : "";
    const requests = [apiRequest(`/processes${processQuery}`)];

    if (canCreateProcess) {
      requests.push(apiRequest("/inventory/lots"));
      requests.push(apiRequest("/quotes?status=aceptada"));
      requests.push(apiRequest("/sales"));
      requests.push(apiRequest("/catalogs"));
    }

    const [processData, lotData = [], quoteData = [], saleData = [], catalogData = null] = await Promise.all(requests);
    setProcesses(processData);
    setAvailableLots(lotData);
    setQuotes(quoteData.filter((quote) => quote.quote_type === "preventa"));
    setSales(saleData.filter((sale) => !["despachada", "anulada"].includes(sale.status)));
    setCatalogs(catalogData);
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

    const confirmed = window.confirm(`Confirma ${actionLabel.toLowerCase()}?`);

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
      setForm({ ...initialProcess, processType: defaultProcessType });
      setSelectedLots({});
      await loadData();
      setMessage(`${actionLabel} creado correctamente. Bodega debe confirmar cuando el cafe salga.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const openStartForm = (process) => {
    setStartProcessId(process.id);
    setStartForm({
      processType: fixedProcessType || process.process_type || "Trilladora",
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
      outputs: process.outputs?.length
        ? process.outputs.map((output) => ({
            coffeeProfileId: output.coffee_profile_id || "",
            presentation: output.presentation || "Excelso",
            outputWeightKg: output.output_weight_kg || "",
            humidityPercent: output.humidity_percent || "",
            performanceFactor: output.performance_factor || "",
            notes: output.notes || "",
          }))
        : [{ ...emptyProcessOutput }],
    });
    setStartProcessId(null);
    setError("");
    setMessage("");
  };

  const updatePhysicalOutput = (index, field, value) => {
    setPhysicalReviewForm((current) => ({
      ...current,
      outputs: current.outputs.map((output, outputIndex) => (
        outputIndex === index ? { ...output, [field]: value } : output
      )),
    }));
  };

  const addPhysicalOutput = () => {
    setPhysicalReviewForm((current) => ({
      ...current,
      outputs: [...current.outputs, { ...emptyProcessOutput }],
    }));
  };

  const removePhysicalOutput = (index) => {
    setPhysicalReviewForm((current) => ({
      ...current,
      outputs: current.outputs.length === 1
        ? [{ ...emptyProcessOutput }]
        : current.outputs.filter((_, outputIndex) => outputIndex !== index),
    }));
  };

  const startProcess = async (event, process) => {
    event.preventDefault();

    if (!startForm.estimatedReturnDate) {
      setError("La fecha estimada de regreso a bodega es obligatoria.");
      return;
    }

    if (!window.confirm(`Confirma ${startActionLabel.toLowerCase()} ${process.code}?`)) return;

    setSaving(true);
    setError("");
    try {
      await apiRequest(`/processes/${process.id}/start`, {
        method: "PUT",
        body: JSON.stringify({
          processType: startForm.processType,
          processLocation: startForm.processLocation,
          estimatedReturnDate: startForm.estimatedReturnDate,
        }),
      });
      setStartProcessId(null);
      setStartForm({ ...initialStartForm, processType: defaultProcessType });
      await loadData();
      setMessage(`${startActionLabel} correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const sendProcessToLaboratory = async (process) => {
    const directInventory = createsInventoryDirectly(process);
    if (!window.confirm(`Confirma que ${process.code} regreso a bodega${directInventory ? "" : " para revision fisica"}?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/processes/${process.id}/pending-laboratory`, { method: "PUT", body: JSON.stringify({}) });
      await loadData();
      setMessage(directInventory
        ? "Cafe recibido. Registre el peso de regreso para llevarlo a inventario."
        : "Cafe recibido. Bodega debe completar la revision fisica.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const completePhysicalReview = async (event, process) => {
    event.preventDefault();
    const requiresPerformanceFactor = requiresProcessPerformanceFactor(process);
    const requiresHumidity = requiresProcessHumidity(process);

    const invalidOutput = physicalReviewForm.outputs.find((output) => (
      !output.coffeeProfileId ||
      !output.presentation ||
      !output.outputWeightKg ||
      (requiresHumidity && !output.humidityPercent) ||
      (requiresPerformanceFactor && !output.performanceFactor)
    ));

    if (invalidOutput) {
      setError(createsInventoryDirectly(process)
        ? "Cada salida debe tener perfil comercial, presentacion y cantidad final."
        : requiresPerformanceFactor
        ? "Cada salida debe tener perfil comercial, presentacion, cantidad final, humedad y factor."
        : "Cada salida debe tener perfil comercial, presentacion, cantidad final y humedad.");
      return;
    }

    if (!window.confirm(createsInventoryDirectly(process)
      ? `Confirma registrar el regreso de ${process.code}?`
      : `Confirma la revision fisica de ${process.code}?`)) return;

    setSaving(true);
    setError("");
    try {
      await apiRequest(`/processes/${process.id}/physical-review`, {
        method: "PUT",
        body: JSON.stringify({
          outputs: physicalReviewForm.outputs.map((output) => ({
            coffeeProfileId: Number(output.coffeeProfileId),
            presentation: output.presentation,
            outputWeightKg: Number(output.outputWeightKg),
            humidityPercent: output.humidityPercent === "" ? null : Number(output.humidityPercent),
            performanceFactor: output.performanceFactor === "" ? null : Number(output.performanceFactor),
            notes: output.notes || null,
          })),
        }),
      });
      setPhysicalReviewProcessId(null);
      setPhysicalReviewForm(initialPhysicalReviewForm);
      await loadData();
      setMessage(createsInventoryDirectly(process)
        ? `Cafe recibido. El ${operationLabel} ya quedo disponible en inventario.`
        : `Revision fisica guardada. El ${operationLabel} ya aparece en Laboratorio.`);
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
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
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

      <div className="rounded border border-slate-200 bg-white p-3">
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Buscar por perfil, lote, cliente, venta o ubicacion"
          value={processSearch}
          onChange={(event) => setProcessSearch(event.target.value)}
        />
      </div>

      {canCreateProcess && (
        <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createProcess}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">{actionLabel}</h2>
              <p className="text-sm text-slate-500">{actionDescription}</p>
            </div>
            <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Total: <span className="font-semibold text-ink">{totalSelectedKg} kg</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.quoteId}
              onChange={(event) => setForm({ ...form, quoteId: event.target.value, saleId: "" })}
              disabled={Boolean(form.saleId)}
            >
              <option value="">{form.saleId ? "Proceso asociado a venta" : "Sin preventa asociada"}</option>
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
            {fixedProcessType ? (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {fixedProcessType}
              </div>
            ) : (
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.processType}
                onChange={(event) => setForm({ ...form, processType: event.target.value })}
              >
                {processTypeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder={fixedProcessType ? "Ubicacion o destino" : "Ubicacion del proceso"}
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

          {selectedSale && (
            <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Proceso asociado a la venta <span className="font-semibold">{selectedSale.code}</span> de {selectedSale.client_name}.
            </p>
          )}

          <div className="mt-4 overflow-x-auto rounded border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Usar</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Tipo / Perfil</th>
                  <th className="px-3 py-2">Clasificacion</th>
                  <th className="px-3 py-2">Disponible</th>
                  <th className="px-3 py-2">{fixedProcessType ? "Cantidad a enviar" : "Cantidad a procesar"}</th>
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
                    <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(lot)}</td>
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
            {actionLabel}
          </button>
        </form>
      )}

      {filteredProcesses.length === 0 ? (
        <EmptyState
          title={fixedProcessType ? "Sin envios" : "Sin procesos"}
          message={fixedProcessType ? "Los envios creados desde bodega apareceran aqui." : "Los procesos creados desde bodega apareceran aqui."}
        />
      ) : (
        <div className="grid gap-3">
          {filteredProcesses.map((process) => (
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
                <p>{[process.process_type, process.process_location].filter(Boolean).join(" - ") || "Sin ubicacion"}</p>
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
              {process.outputs?.length > 0 && (
                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Salidas registradas</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {process.outputs.map((output) => (
                      <div key={output.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                        <p className="font-semibold text-ink">
                          {output.output_lot_code || "Sin lote PROC"} - {formatProfileLabel(output)}
                        </p>
                        <p className="text-slate-600">
                          {output.presentation || "Excelso"} · {output.output_weight_kg} kg
                          {output.humidity_percent !== null && output.humidity_percent !== undefined ? ` · Humedad ${output.humidity_percent}%` : ""}
                          {output.performance_factor !== null && output.performance_factor !== undefined ? ` · Factor ${output.performance_factor}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {["admin", "warehouse"].includes(user?.role) && process.status === "pendiente" && (
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  type="button"
                  disabled={saving}
                  onClick={() => openStartForm(process)}
                >
                  <Save size={16} />
                  {startButtonLabel}
                </button>
              )}
              {startProcessId === process.id && (
                <form className="mt-3 grid min-w-0 gap-3 rounded border border-emerald-100 bg-emerald-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={(event) => startProcess(event, process)}>
                  <label className="text-xs font-medium text-slate-600">
                    Fecha estimada de regreso
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      type="date"
                      value={startForm.estimatedReturnDate}
                      onChange={(event) => setStartForm({ ...startForm, estimatedReturnDate: event.target.value })}
                    />
                  </label>
                  {fixedProcessType ? (
                    <div className="self-end rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      {fixedProcessType}
                    </div>
                  ) : (
                    <label className="text-xs font-medium text-slate-600">
                      Destino del cafe
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        value={startForm.processType}
                        onChange={(event) => setStartForm({ ...startForm, processType: event.target.value })}
                      >
                        {processTypeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="text-xs font-medium text-slate-600">
                    {fixedProcessType ? "Ubicacion o destino" : "Ubicacion del proceso"}
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
                    {startActionLabel}
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
                  {createsInventoryDirectly(process) ? "Recibir en bodega" : "Recibir para revision fisica"}
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
                  {createsInventoryDirectly(process) ? "Registrar peso de regreso" : "Registrar revision fisica"}
                </button>
              )}
              {physicalReviewProcessId === process.id && (
                <form className="mt-3 min-w-0 space-y-3 rounded border border-emerald-100 bg-emerald-50 p-3" onSubmit={(event) => completePhysicalReview(event, process)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{fixedProcessType ? "Salidas del envio" : "Salidas del proceso"}</p>
                      <p className="text-xs text-slate-600">
                        {requiresProcessPerformanceFactor(process)
                          ? "Divida el cafe recibido por perfil comercial, peso, humedad y factor."
                          : createsInventoryDirectly(process)
                            ? "Registre el cafe recibido por perfil comercial, presentacion y peso. No requiere laboratorio."
                            : "Divida el cafe recibido por perfil comercial, peso y humedad."}
                      </p>
                    </div>
                    <button
                      className="inline-flex items-center gap-1 rounded border border-leaf bg-white px-3 py-2 text-xs font-semibold text-leaf hover:bg-emerald-50"
                      type="button"
                      onClick={addPhysicalOutput}
                    >
                      <Plus size={14} />
                      Agregar salida
                    </button>
                  </div>
                  {physicalReviewForm.outputs.map((output, index) => (
                    <div key={`process-output-${index}`} className="rounded border border-emerald-200 bg-white p-3">
                      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
                        <select
                          className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                          value={output.coffeeProfileId}
                          onChange={(event) => updatePhysicalOutput(index, "coffeeProfileId", event.target.value)}
                        >
                          <option value="">Perfil comercial</option>
                          {catalogs?.coffeeProfiles?.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {formatProfileLabel(profile)}
                            </option>
                          ))}
                        </select>
                        <select
                          className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                          value={output.presentation}
                          onChange={(event) => updatePhysicalOutput(index, "presentation", event.target.value)}
                        >
                          <option value="Pergamino">Pergamino</option>
                          <option value="Excelso">Excelso</option>
                        </select>
                        <input
                          className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Cantidad final kg"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={output.outputWeightKg}
                          onChange={(event) => updatePhysicalOutput(index, "outputWeightKg", event.target.value)}
                        />
                        {requiresProcessHumidity(process) && (
                          <input
                            className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Humedad %"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={output.humidityPercent}
                            onChange={(event) => updatePhysicalOutput(index, "humidityPercent", event.target.value)}
                          />
                        )}
                        {requiresProcessPerformanceFactor(process) && (
                          <input
                            className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Factor"
                            type="number"
                            min="0"
                            step="0.01"
                            value={output.performanceFactor}
                            onChange={(event) => updatePhysicalOutput(index, "performanceFactor", event.target.value)}
                          />
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Observacion opcional de esta salida"
                          value={output.notes}
                          onChange={(event) => updatePhysicalOutput(index, "notes", event.target.value)}
                        />
                        <button
                          className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          type="button"
                          onClick={() => removePhysicalOutput(index)}
                          disabled={physicalReviewForm.outputs.length === 1}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving}
                  >
                    {createsInventoryDirectly(process) ? "Guardar y llevar a inventario" : "Guardar revision"}
                  </button>
                </form>
              )}
              {process.inputs?.length > 0 && (
                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{fixedProcessType ? "Mezcla del envio" : "Mezcla del proceso"}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {process.inputs.map((input) => (
                      <div key={`${process.id}-${input.lot_id}`} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                        <p className="font-semibold text-ink">{formatCoffeeLotCodeName(input)}</p>
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
