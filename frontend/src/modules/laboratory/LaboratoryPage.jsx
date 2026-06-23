import { ClipboardCheck, FlaskConical, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialReview = {
  decision: "aprobado",
  humidityPercent: "",
  aroma: "",
  fragrance: "",
  flavor: "",
  acidity: "",
  sweetness: "",
  body: "",
  balance: "",
  uniformity: "",
  residual: "",
  cleanCup: "",
  score: "",
  notes: "",
};

const initialFinish = {
  coffeeProfileId: "",
  outputWeightKg: "",
  humidityPercent: "",
  aroma: "",
  fragrance: "",
  flavor: "",
  acidity: "",
  sweetness: "",
  body: "",
  balance: "",
  uniformity: "",
  residual: "",
  cleanCup: "",
  score: "",
  notes: "",
  initialComment: "",
};

const cuppingFields = [
  ["aroma", "Aroma"],
  ["fragrance", "Fragancia"],
  ["flavor", "Sabor"],
  ["acidity", "Acidez"],
  ["sweetness", "Dulzor"],
  ["body", "Cuerpo"],
  ["balance", "Balance"],
  ["uniformity", "Uniformidad"],
  ["residual", "Residual"],
  ["cleanCup", "Taza limpia"],
];

const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const LaboratoryPage = () => {
  const [activePanel, setActivePanel] = useState("lots");
  const [lots, setLots] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [review, setReview] = useState(initialReview);
  const [finishForm, setFinishForm] = useState(initialFinish);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [lotData, processData, catalogData] = await Promise.all([
      apiRequest("/lots?status=pendiente_laboratorio"),
      apiRequest("/processes?status=en_proceso"),
      apiRequest("/catalogs"),
    ]);

    setLots(lotData);
    setProcesses(processData);
    setCatalogs(catalogData);

    if (selectedLot) {
      const updatedSelectedLot = lotData.find((lot) => lot.id === selectedLot.id);
      setSelectedLot(updatedSelectedLot || null);
    }

    if (selectedProcess) {
      const updatedSelectedProcess = processData.find((process) => process.id === selectedProcess.id);
      setSelectedProcess(updatedSelectedProcess || null);
    }
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const selectLot = (lot) => {
    setActivePanel("lots");
    setSelectedLot(lot);
    setReview({
      ...initialReview,
      humidityPercent: lot.humidity_percent || "",
    });
    setMessage("");
    setError("");
  };

  const selectProcess = (process) => {
    setActivePanel("processes");
    setSelectedProcess(process);
    setFinishForm({
      ...initialFinish,
      outputWeightKg: process.output_weight_kg || "",
    });
    setMessage("");
    setError("");
  };

  const submitReview = async (event) => {
    event.preventDefault();

    if (!selectedLot) {
      setError("Seleccione un lote para revisar.");
      return;
    }

    const confirmed = window.confirm("Confirma guardar esta revision de laboratorio?");

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${selectedLot.id}/lab-review`, {
        method: "PUT",
        body: JSON.stringify({
          ...review,
          humidityPercent: Number(review.humidityPercent),
          score: review.score === "" ? null : Number(review.score),
        }),
      });
      setReview(initialReview);
      setSelectedLot(null);
      await loadData();
      setMessage("Revision de laboratorio guardada correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const finishProcess = async (event) => {
    event.preventDefault();

    if (!selectedProcess) {
      setError("Seleccione un proceso para finalizar.");
      return;
    }

    const confirmed = window.confirm("Confirma finalizar este proceso y crear el lote PROC?");

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/processes/${selectedProcess.id}/finish`, {
        method: "PUT",
        body: JSON.stringify({
          ...finishForm,
          coffeeProfileId: Number(finishForm.coffeeProfileId),
          outputWeightKg: Number(finishForm.outputWeightKg),
          humidityPercent: Number(finishForm.humidityPercent),
          score: Number(finishForm.score),
        }),
      });
      setFinishForm(initialFinish);
      setSelectedProcess(null);
      await loadData();
      setMessage("Proceso finalizado correctamente. El lote PROC quedo disponible.");
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
          <h1 className="text-xl font-bold text-ink">Laboratorio</h1>
          <p className="text-sm text-slate-500">Revision de lotes recibidos y cierre de procesos.</p>
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

      <div className="grid gap-5 xl:grid-cols-[170px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <button
            className={`flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm ${
              activePanel === "lots" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setActivePanel("lots")}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <ClipboardCheck size={16} />
              Lotes
            </span>
            <span className="text-xs">{lots.length}</span>
          </button>
          <button
            className={`flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm ${
              activePanel === "processes" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setActivePanel("processes")}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <FlaskConical size={16} />
              Procesos
            </span>
            <span className="text-xs">{processes.length}</span>
          </button>
        </aside>

        {activePanel === "lots" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Lotes pendientes</h2>
              </div>
              {lots.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin lotes pendientes" message="Los lotes recibidos por bodega apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {lots.map((lot) => (
                    <button
                      key={lot.id}
                      className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selectedLot?.id === lot.id ? "bg-emerald-50" : "bg-white"
                      }`}
                      onClick={() => selectLot(lot)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{lot.code}</p>
                          <p className="text-sm text-slate-500">{lot.supplier_name || "Sin proveedor"}</p>
                        </div>
                        <StatusBadge tone="warning">{lot.humidity_percent}% humedad</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{lot.net_weight_kg} kg netos</p>
                      <p className="text-sm text-slate-500">
                        Factor rendimiento: {lot.performance_factor ?? "-"}
                      </p>
                      <p className="text-sm text-slate-500">
                        Clasificacion: {lot.commercial_classification || "-"}
                      </p>
                      {lot.visual_notes && <p className="mt-1 text-sm text-slate-500">{lot.visual_notes}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={submitReview}>
            <h2 className="text-sm font-semibold text-slate-800">Prueba de lote recibido</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedLot ? `Lote seleccionado: ${selectedLot.code}` : "Seleccione un lote pendiente."}
            </p>

            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={review.decision}
                onChange={(event) => setReview({ ...review, decision: event.target.value })}
              >
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Humedad %"
                type="number"
                step="0.01"
                value={review.humidityPercent}
                onChange={(event) => setReview({ ...review, humidityPercent: event.target.value })}
              />

              {review.decision === "aprobado" && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cuppingFields.map(([field, label]) => (
                    <input
                      key={field}
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder={label}
                      value={review[field]}
                      onChange={(event) => setReview({ ...review, [field]: event.target.value })}
                    />
                  ))}
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Score"
                    type="number"
                    step="0.01"
                    value={review.score}
                    onChange={(event) => setReview({ ...review, score: event.target.value })}
                  />
                </div>
              )}

              <textarea
                className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notas de laboratorio"
                value={review.notes}
                onChange={(event) => setReview({ ...review, notes: event.target.value })}
              />
              <button
                className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving || !selectedLot}
              >
                <Save size={16} />
                Guardar revision
              </button>
            </div>
          </form>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Procesos pendientes</h2>
              </div>
              {processes.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin procesos pendientes" message="Los procesos creados por bodega apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {processes.map((process) => (
                    <button
                      key={process.id}
                      className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selectedProcess?.id === process.id ? "bg-emerald-50" : "bg-white"
                      }`}
                      onClick={() => selectProcess(process)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{process.code}</p>
                          <p className="text-sm text-slate-500">
                            {process.quote_code ? `${process.quote_code} - ${process.quote_client_name}` : "Sin preventa asociada"}
                          </p>
                        </div>
                        <StatusBadge tone="warning">{process.status}</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{process.total_input_kg} kg de entrada</p>
                      <p className="text-sm text-slate-500">{process.process_location || "Sin ubicacion"}</p>
                      {process.inputs?.length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {process.inputs.map((input) => (
                            <div key={`${process.id}-${input.lot_id}`} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                              <p className="font-semibold text-ink">{input.lot_code}</p>
                              <p className="text-slate-600">{formatInputLabel(input)}</p>
                              <p className="text-slate-500">
                                {input.quantity_kg} kg - {input.input_percentage}%
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="rounded border border-slate-200 bg-white p-4" onSubmit={finishProcess}>
            <div className="flex items-center gap-2">
              <FlaskConical size={17} className="text-leaf" />
              <h2 className="text-sm font-semibold text-slate-800">Finalizar proceso</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {selectedProcess ? `Proceso seleccionado: ${selectedProcess.code}` : "Seleccione un proceso pendiente."}
            </p>

            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={finishForm.coffeeProfileId}
                onChange={(event) => setFinishForm({ ...finishForm, coffeeProfileId: event.target.value })}
              >
                <option value="">Perfil comercial</option>
                {catalogs?.coffeeProfiles?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Cantidad final kg"
                  type="number"
                  step="0.001"
                  max={selectedProcess?.total_input_kg || undefined}
                  value={finishForm.outputWeightKg}
                  onChange={(event) => setFinishForm({ ...finishForm, outputWeightKg: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Humedad final %"
                  type="number"
                  step="0.01"
                  value={finishForm.humidityPercent}
                  onChange={(event) => setFinishForm({ ...finishForm, humidityPercent: event.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cuppingFields.map(([field, label]) => (
                  <input
                    key={field}
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder={label}
                    value={finishForm[field]}
                    onChange={(event) => setFinishForm({ ...finishForm, [field]: event.target.value })}
                  />
                ))}
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Score"
                  type="number"
                  step="0.01"
                  value={finishForm.score}
                  onChange={(event) => setFinishForm({ ...finishForm, score: event.target.value })}
                />
              </div>

              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notas del proceso"
                value={finishForm.notes}
                onChange={(event) => setFinishForm({ ...finishForm, notes: event.target.value })}
              />
              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Comentario inicial del lote PROC"
                value={finishForm.initialComment}
                onChange={(event) => setFinishForm({ ...finishForm, initialComment: event.target.value })}
              />
              <button
                className="inline-flex items-center justify-center gap-2 rounded bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving || !selectedProcess}
              >
                <Save size={16} />
                Crear lote PROC
              </button>
            </div>
          </form>
          </div>
        )}
      </div>
    </section>
  );
};

export default LaboratoryPage;
