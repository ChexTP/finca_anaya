import { ClipboardCheck, FlaskConical, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotOption } from "../../utils/coffeeLots";
import { getProcessNextAction, getProcessStatusTone, getSaleStatusTone, processStatusLabels, saleStatusLabels } from "../../utils/workflow";

const initialReview = {
  decision: "aprobado",
  aroma: "",
  flavor: "",
  sweetness: "",
  body: "",
  residual: "",
  cleanCup: "",
  score: "",
  notes: "",
  commercialClassification: "",
  coffeeVariety: "",
  classificationChangeNote: "",
};

const initialFinish = {
  coffeeProfileId: "",
  aroma: "",
  flavor: "",
  sweetness: "",
  body: "",
  residual: "",
  cleanCup: "",
  score: "",
  notes: "",
  initialComment: "",
};

const initialSampleReview = {
  decision: "aprobada_laboratorio",
  itemReviews: [],
  notes: "",
};

const cuppingFields = [
  ["aroma", "Aroma"],
  ["flavor", "Sabor"],
  ["sweetness", "Dulzor"],
  ["body", "Cuerpo"],
  ["residual", "Residual"],
  ["cleanCup", "Taza limpia"],
];

const commercialCategories = ["Procesado", "Base", "Regional", "Varietal", "Exotico"];

const processFilters = [
  { key: "pendiente_laboratorio", label: "Por analizar" },
];

const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const formatRequestedCoffee = (item = {}) => {
  const details = [item.coffee_type_name, item.coffee_profile_name, item.description].filter(Boolean);
  return [...new Set(details)].join(" - ") || "Cafe sin especificar";
};

const buildBlankSampleItemReviews = (sample) => {
  return (sample.items || []).map((item) => ({
    sampleItemId: item.id,
    humidityPercent: item.sample_humidity_percent || "",
    aroma: item.sample_lab_aroma || "",
    flavor: item.sample_lab_flavor || "",
    sweetness: item.sample_lab_sweetness || "",
    body: item.sample_lab_body || "",
    residual: item.sample_lab_residual || "",
    cleanCup: item.sample_lab_clean_cup || "",
    score: item.sample_lab_score || "",
    notes: item.sample_lab_notes || "",
  }));
};

const formatDate = (value) => {
  if (!value) return "Sin fecha estimada";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");

  return [day, month, year].filter(Boolean).join("/");
};

const LaboratoryPage = () => {
  const [activePanel, setActivePanel] = useState("lots");
  const [processFilter, setProcessFilter] = useState("pendiente_laboratorio");
  const [lots, setLots] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [samples, setSamples] = useState([]);
  const [sales, setSales] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [blendRows, setBlendRows] = useState([]);
  const [review, setReview] = useState(initialReview);
  const [finishForm, setFinishForm] = useState(initialFinish);
  const [sampleReview, setSampleReview] = useState(initialSampleReview);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [lotData, processData, sampleData, saleData, availableLotData, catalogData] = await Promise.all([
      apiRequest("/lots?status=pendiente_laboratorio"),
      apiRequest("/processes"),
      apiRequest("/samples?status=pendiente_laboratorio"),
      apiRequest("/sales"),
      apiRequest("/inventory/lots"),
      apiRequest("/catalogs"),
    ]);

    setLots(lotData);
    setProcesses(processData.filter((process) => process.status === "pendiente_laboratorio"));
    setSamples(sampleData);
    setSales(saleData.filter((sale) => ["listo_para_ensamble", "ensamble_definido"].includes(sale.status)));
    setAvailableLots(availableLotData);
    setCatalogs(catalogData);

    if (selectedLot) {
      const updatedSelectedLot = lotData.find((lot) => lot.id === selectedLot.id);
      setSelectedLot(updatedSelectedLot || null);
    }

    if (selectedProcess) {
      const updatedSelectedProcess = processData.find((process) => process.id === selectedProcess.id);
      setSelectedProcess(updatedSelectedProcess || null);
    }

    if (selectedSample) {
      const updatedSelectedSample = sampleData.find((sample) => sample.id === selectedSample.id);
      setSelectedSample(updatedSelectedSample || null);
    }
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const processCounts = useMemo(() => {
    return processes.reduce(
      (counts, process) => ({
        ...counts,
        all: counts.all + 1,
        [process.status]: (counts[process.status] || 0) + 1,
      }),
      { all: 0 }
    );
  }, [processes]);

  const filteredProcesses = useMemo(() => {
    return processes.filter((process) => processFilter === "all" || process.status === processFilter);
  }, [processes, processFilter]);

  const selectLot = (lot) => {
    setActivePanel("lots");
    setSelectedLot(lot);
    setReview({
      ...initialReview,
      commercialClassification: lot.commercial_classification || "",
      coffeeVariety: lot.coffee_variety || "",
    });
    setMessage("");
    setError("");
  };

  const selectProcess = (process) => {
    setActivePanel("processes");
    setSelectedProcess(process);
    setFinishForm({
      ...initialFinish,
    });
    setMessage("");
    setError("");
  };

  const selectSample = (sample) => {
    setActivePanel("samples");
    setSelectedSample(sample);
    setSampleReview({
      ...initialSampleReview,
      itemReviews: buildBlankSampleItemReviews(sample),
    });
    setMessage("");
    setError("");
  };

  const updateSampleItemReview = (index, field, value) => {
    setSampleReview((currentReview) => ({
      ...currentReview,
      itemReviews: currentReview.itemReviews.map((itemReview, itemIndex) =>
        itemIndex === index ? { ...itemReview, [field]: value } : itemReview
      ),
    }));
  };

  const selectSaleForBlend = async (saleId) => {
    if (!saleId) {
      setSelectedSale(null);
      setBlendRows([]);
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const sale = await apiRequest(`/sales/${saleId}`);
      setSelectedSale(sale);
      const existingRows = sale.blendItems?.map((item) => ({
        saleItemId: String(item.sale_item_id),
        category: item.commercial_classification || "",
        lotId: String(item.lot_id),
        percentage: String(item.percentage),
        notes: item.notes || "",
      }));

      setBlendRows(
        existingRows?.length
          ? existingRows
          : [
              {
                saleItemId: sale.items?.[0]?.id ? String(sale.items[0].id) : "",
                category: "",
                lotId: "",
                percentage: "",
                notes: "",
              },
            ]
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateBlendRow = (index, field, value) => {
    setBlendRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        return {
          ...row,
          [field]: value,
          ...(field === "category" ? { lotId: "" } : {}),
        };
      })
    );
  };

  const addBlendRow = () => {
    setBlendRows((currentRows) => [
      ...currentRows,
      {
        saleItemId: selectedSale?.items?.[0]?.id ? String(selectedSale.items[0].id) : "",
        category: "",
        lotId: "",
        percentage: "",
        notes: "",
      },
    ]);
  };

  const removeBlendRow = (index) => {
    setBlendRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  };

  const saveBlendOrder = async (event) => {
    event.preventDefault();

    if (!selectedSale) {
      setError("Seleccione una venta para crear la mezcla.");
      return;
    }

    const confirmed = window.confirm("Confirma guardar esta orden de mezcla para bodega?");

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${selectedSale.id}/blend-order`, {
        method: "PUT",
        body: JSON.stringify({
          items: blendRows.map((row) => ({
            saleItemId: Number(row.saleItemId),
            lotId: Number(row.lotId),
            percentage: Number(row.percentage),
            notes: row.notes || null,
          })),
        }),
      });
      await selectSaleForBlend(selectedSale.id);
      setMessage("Orden de mezcla guardada. Bodega ya puede imprimir el documento.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const releaseWithoutBlend = async () => {
    if (!selectedSale) return;
    if (!window.confirm("Confirma que esta venta no requiere mezcla y puede volver a bodega?")) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${selectedSale.id}/without-blend`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      setSelectedSale(null);
      setBlendRows([]);
      await loadData();
      setMessage("Venta liberada sin mezcla. Bodega ya puede asignar el lote procesado y alistar.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
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
      const classificationChanged =
        (selectedLot.commercial_classification || "") !== (review.commercialClassification || "") ||
        (selectedLot.coffee_variety || "") !== (review.coffeeVariety || "");

      if (classificationChanged && !review.classificationChangeNote.trim()) {
        throw new Error("Debe escribir una nota interna explicando el cambio de clasificacion.");
      }

      await apiRequest(`/lots/${selectedLot.id}/lab-review`, {
        method: "PUT",
        body: JSON.stringify({
          ...review,
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

  const submitSampleReview = async (event) => {
    event.preventDefault();

    if (!selectedSample) {
      setError("Seleccione una muestra para revisar.");
      return;
    }

    if (sampleReview.decision === "en_preparacion" && !sampleReview.notes.trim()) {
      setError("Para rechazar una muestra debe escribir una nota de laboratorio.");
      return;
    }

    const confirmed = window.confirm(
      sampleReview.decision === "aprobada_laboratorio"
        ? `Confirma aprobar el analisis de ${selectedSample.code}?`
        : `Confirma rechazar ${selectedSample.code} y devolverla a preparacion?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const requestBody = {
        status: sampleReview.decision,
        notes: sampleReview.notes || undefined,
      };

      if (sampleReview.decision === "aprobada_laboratorio") {
        requestBody.itemReviews = sampleReview.itemReviews.map((itemReview) => ({
          sampleItemId: itemReview.sampleItemId,
          humidityPercent: itemReview.humidityPercent,
          aroma: itemReview.aroma,
          flavor: itemReview.flavor,
          sweetness: itemReview.sweetness,
          body: itemReview.body,
          residual: itemReview.residual,
          cleanCup: itemReview.cleanCup,
          score: itemReview.score,
          notes: itemReview.notes || null,
        }));
      }

      await apiRequest(`/samples/${selectedSample.id}/status`, {
        method: "PUT",
        body: JSON.stringify(requestBody),
      });
      setSampleReview(initialSampleReview);
      setSelectedSample(null);
      await loadData();
      setMessage(
        sampleReview.decision === "aprobada_laboratorio"
          ? "Analisis de muestra aprobado. El usuario de muestras ya puede marcarla como lista."
          : "Muestra rechazada y devuelta a preparacion."
      );
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
          <p className="text-sm text-slate-500">Lotes, procesos y mezclas separados por trabajo pendiente.</p>
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
          <button
            className={`flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm ${
              activePanel === "samples" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setActivePanel("samples")}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <FlaskConical size={16} />
              Muestras
            </span>
            <span className="text-xs">{samples.length}</span>
          </button>
          <button
            className={`flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm ${
              activePanel === "blends" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setActivePanel("blends")}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <FlaskConical size={16} />
              Mezclas
            </span>
            <span className="text-xs">{sales.length}</span>
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
                        <StatusBadge tone="warning">
                          {lot.humidity_percent === null ? "Humedad pendiente" : `${lot.humidity_percent}% humedad`}
                        </StatusBadge>
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
              {selectedLot && (
                <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Revision fisica de Bodega: humedad {selectedLot.humidity_percent}%, factor {selectedLot.performance_factor}.
                </div>
              )}

              {selectedLot && (
                <div className="rounded border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Clasificacion final del cafe</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <select
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      value={review.commercialClassification}
                      onChange={(event) => setReview({ ...review, commercialClassification: event.target.value })}
                    >
                      <option value="">Sin categoria</option>
                      <option value="Regional">Regional</option>
                      <option value="Varietal">Varietal</option>
                      <option value="Exotico">Exotico</option>
                    </select>
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Variedad, nombre o codigo exacto"
                      value={review.coffeeVariety}
                      onChange={(event) => setReview({ ...review, coffeeVariety: event.target.value })}
                    />
                  </div>
                  {((selectedLot.commercial_classification || "") !== (review.commercialClassification || "") ||
                    (selectedLot.coffee_variety || "") !== (review.coffeeVariety || "")) && (
                    <textarea
                      className="mt-3 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Nota interna del cambio, ej. Pasa a regional por no cumplir perfil varietal"
                      value={review.classificationChangeNote}
                      onChange={(event) => setReview({ ...review, classificationChangeNote: event.target.value })}
                      required
                    />
                  )}
                </div>
              )}

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
        ) : activePanel === "processes" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Procesos por etapa</h2>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {processFilters.map((filter) => (
                    <button
                      key={filter.key}
                      className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold ${
                        processFilter === filter.key
                          ? "border-leaf bg-emerald-50 text-leaf"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                      type="button"
                      onClick={() => setProcessFilter(filter.key)}
                    >
                      {filter.label} ({processCounts[filter.key] || 0})
                    </button>
                  ))}
                </div>
              </div>
              {filteredProcesses.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin procesos pendientes" message="Los procesos creados por bodega apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredProcesses.map((process) => (
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
                      <p className="mt-2 text-sm text-slate-600">{process.total_input_kg} kg de entrada</p>
                      <p className="text-sm font-medium text-slate-700">{getProcessNextAction(process)}</p>
                      <p className="text-sm text-slate-500">{process.process_location || "Sin ubicacion"}</p>
                      {process.estimated_return_date && (
                        <p className="text-sm text-slate-500">
                          Regreso estimado a bodega: {formatDate(process.estimated_return_date)}
                        </p>
                      )}
                      {process.quote_code && (
                        <p className="text-sm text-slate-500">
                          Entrega estimada: {formatDate(process.quote_estimated_delivery_date)}
                        </p>
                      )}
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
              <h2 className="text-sm font-semibold text-slate-800">Gestionar proceso</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {selectedProcess ? `Proceso seleccionado: ${selectedProcess.code}` : "Seleccione un proceso pendiente."}
            </p>
            {selectedProcess && (
              <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {getProcessNextAction(selectedProcess)}
              </p>
            )}

            {!selectedProcess ? (
              <div className="mt-4">
                <EmptyState title="Sin proceso seleccionado" message="Seleccione un proceso de la lista." />
              </div>
            ) : (
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
                <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Revision fisica de Bodega: {selectedProcess.output_weight_kg} kg, humedad {selectedProcess.physical_humidity_percent}%, factor {selectedProcess.physical_performance_factor}.
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
            )}
          </form>
          </div>
        ) : activePanel === "samples" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Muestras pendientes de analisis</h2>
              </div>
              {samples.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin muestras pendientes" message="Las muestras enviadas por el usuario de muestras apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {samples.map((sample) => (
                    <button
                      key={sample.id}
                      className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selectedSample?.id === sample.id ? "bg-emerald-50" : "bg-white"
                      }`}
                      onClick={() => selectSample(sample)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{sample.code}</p>
                          <p className="text-sm text-slate-500">
                            {sample.requester_name}
                            {sample.requester_company ? ` - ${sample.requester_company}` : ""}
                          </p>
                        </div>
                        <StatusBadge tone="warning">Pendiente analisis</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{sample.quantity_grams} g solicitados</p>
                      <p className="text-sm text-slate-500">Entrega tentativa: {formatDate(sample.tentative_delivery_date)}</p>
                      <div className="mt-3 space-y-1 text-sm text-slate-600">
                        {sample.items?.map((item) => (
                          <p key={item.id}>
                            {formatRequestedCoffee(item)} - {item.quantity_grams} g
                          </p>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="rounded border border-slate-200 bg-white p-4" onSubmit={submitSampleReview}>
              <div className="flex items-center gap-2">
                <FlaskConical size={17} className="text-leaf" />
                <h2 className="text-sm font-semibold text-slate-800">Analisis de muestra</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {selectedSample ? `Muestra seleccionada: ${selectedSample.code}` : "Seleccione una muestra pendiente."}
              </p>

              {!selectedSample ? (
                <div className="mt-4">
                  <EmptyState title="Sin muestra seleccionada" message="Seleccione una muestra de la lista." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-medium text-ink">Muestras solicitadas</p>
                    <div className="mt-2 space-y-1">
                      {selectedSample.items?.map((item) => (
                        <p key={item.id}>
                          {formatRequestedCoffee(item)} - {item.quantity_grams} g
                        </p>
                      ))}
                    </div>
                  </div>

                  {selectedSample.items?.some((item) => item.blend_items?.length > 0) && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase text-amber-800">Ensamble definido por muestras</p>
                      <div className="mt-2 space-y-3">
                        {selectedSample.items.map((item) => (
                          <div key={`sample-blend-${item.id}`}>
                            <p className="font-semibold text-ink">{formatRequestedCoffee(item)}</p>
                            {item.blend_items.map((blend) => (
                              <p key={blend.id} className="text-slate-700">
                                {blend.component_description || blend.lot_code || "Componente"}: {blend.percentage}% ({blend.calculated_grams} g)
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={sampleReview.decision}
                    onChange={(event) => setSampleReview({ ...sampleReview, decision: event.target.value })}
                  >
                    <option value="aprobada_laboratorio">Aprobar muestra</option>
                    <option value="en_preparacion">Rechazar y devolver a preparacion</option>
                  </select>

                  {sampleReview.decision === "aprobada_laboratorio" && (
                    <div className="space-y-3">
                      {sampleReview.itemReviews.map((itemReview, index) => {
                        const item = selectedSample.items?.find((sampleItem) => sampleItem.id === itemReview.sampleItemId);

                        return (
                          <div key={itemReview.sampleItemId} className="rounded border border-slate-200 p-3">
                            <p className="mb-3 text-sm font-semibold text-ink">
                              {formatRequestedCoffee(item)} - {item?.quantity_grams} g
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              <input
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Humedad"
                                type="text"
                                value={itemReview.humidityPercent}
                                onChange={(event) => updateSampleItemReview(index, "humidityPercent", event.target.value)}
                                required
                              />
                              {cuppingFields.map(([field, label]) => (
                                <input
                                  key={field}
                                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                                  placeholder={label}
                                  type="text"
                                  value={itemReview[field]}
                                  onChange={(event) => updateSampleItemReview(index, field, event.target.value)}
                                  required
                                />
                              ))}
                              <input
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Score"
                                type="text"
                                value={itemReview.score}
                                onChange={(event) => updateSampleItemReview(index, "score", event.target.value)}
                                required
                              />
                            </div>
                            <textarea
                              className="mt-3 min-h-16 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Notas de este cafe"
                              value={itemReview.notes}
                              onChange={(event) => updateSampleItemReview(index, "notes", event.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <textarea
                    className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder={sampleReview.decision === "en_preparacion" ? "Motivo del rechazo para que muestras corrija" : "Notas de laboratorio"}
                    value={sampleReview.notes}
                    onChange={(event) => setSampleReview({ ...sampleReview, notes: event.target.value })}
                    required={sampleReview.decision === "en_preparacion"}
                  />
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving || !selectedSample}
                  >
                    <Save size={16} />
                    Guardar analisis
                  </button>
                </div>
              )}
            </form>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Ventas para mezcla</h2>
              </div>
              {sales.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin ventas pendientes" message="Las ventas pendientes o alistadas apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sales.map((sale) => (
                    <button
                      key={sale.id}
                      className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selectedSale?.id === sale.id ? "bg-emerald-50" : "bg-white"
                      }`}
                      onClick={() => selectSaleForBlend(sale.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{sale.code}</p>
                          <p className="text-sm text-slate-500">
                            {sale.quote_code ? `${sale.quote_code} - ${sale.client_name}` : sale.client_name}
                          </p>
                        </div>
                        <StatusBadge tone={getSaleStatusTone(sale)}>{saleStatusLabels[sale.status] || sale.status}</StatusBadge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="rounded border border-slate-200 bg-white p-4" onSubmit={saveBlendOrder}>
              <h2 className="text-sm font-semibold text-slate-800">Orden final de mezcla</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedSale ? `Venta seleccionada: ${selectedSale.code}` : "Seleccione una venta pendiente."}
              </p>

              {selectedSale && (
                <div className="mt-4 space-y-4">
                  <div className="rounded bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-ink">Productos pedidos</p>
                    <div className="mt-2 space-y-1">
                      {selectedSale.items?.map((item) => (
                        <p key={item.id} className="text-slate-600">
                          {item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"} - {item.quantity_kg} kg
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {blendRows.map((row, index) => {
                      const filteredLots = availableLots.filter((lot) => {
                        if (!row.category) return true;
                        return lot.commercial_classification === row.category;
                      });

                      return (
                        <div key={`blend-${index}`} className="rounded border border-slate-200 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <select
                              className="rounded border border-slate-300 px-3 py-2 text-sm"
                              value={row.saleItemId}
                              onChange={(event) => updateBlendRow(index, "saleItemId", event.target.value)}
                              required
                            >
                              <option value="">Producto vendido</option>
                              {selectedSale.items?.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"} - {item.quantity_kg} kg
                                </option>
                              ))}
                            </select>
                            <select
                              className="rounded border border-slate-300 px-3 py-2 text-sm"
                              value={row.category}
                              onChange={(event) => updateBlendRow(index, "category", event.target.value)}
                              required
                            >
                              <option value="">Categoria</option>
                              {commercialCategories.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            <select
                              className="rounded border border-slate-300 px-3 py-2 text-sm"
                              value={row.lotId}
                              onChange={(event) => updateBlendRow(index, "lotId", event.target.value)}
                              required
                            >
                              <option value="">Lote de la categoria</option>
                              {filteredLots.map((lot) => (
                                <option key={lot.id} value={lot.id}>
                                  {formatCoffeeLotOption(lot)}
                                </option>
                              ))}
                            </select>
                            <input
                              className="rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Porcentaje %"
                              type="number"
                              min="0.01"
                              max="100"
                              step="0.01"
                              value={row.percentage}
                              onChange={(event) => updateBlendRow(index, "percentage", event.target.value)}
                              required
                            />
                          </div>
                          <textarea
                            className="mt-3 min-h-16 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Observacion opcional"
                            value={row.notes}
                            onChange={(event) => updateBlendRow(index, "notes", event.target.value)}
                          />
                          <button
                            className="mt-2 rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            type="button"
                            onClick={() => removeBlendRow(index)}
                            disabled={blendRows.length === 1}
                          >
                            Quitar linea
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedSale.status === "listo_para_ensamble" && (
                    <button
                      className="rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-60"
                      type="button"
                      disabled={saving}
                      onClick={releaseWithoutBlend}
                    >
                      No requiere mezcla
                    </button>
                    )}
                    <button
                      className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      type="button"
                      onClick={addBlendRow}
                    >
                      Agregar lote
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={saving}
                    >
                      <Save size={16} />
                      Guardar mezcla
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </section>
  );
};

export default LaboratoryPage;
