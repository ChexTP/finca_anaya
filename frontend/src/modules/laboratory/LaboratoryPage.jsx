import { ClipboardCheck, FileText, FlaskConical, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotCodeName } from "../../utils/coffeeLots";
import { getProcessNextAction, getProcessStatusTone, getSaleStatusTone, lotStatusLabels, processStatusLabels, saleStatusLabels } from "../../utils/workflow";

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
  outputReviews: [],
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

const buildEmptyProcessOutputReview = (output = {}) => ({
  processOutputId: output.id || "",
  aroma: "",
  flavor: "",
  sweetness: "",
  body: "",
  residual: "",
  cleanCup: "",
  score: "",
  notes: "",
  initialComment: "",
});

const initialSampleReview = {
  decision: "aprobada_laboratorio",
  itemReviews: [],
  notes: "",
};

const initialSaleReview = {
  decision: "aprobada_laboratorio",
  itemReviews: [],
  notes: "",
};

const initialInventoryLabEdit = {
  humidityPercent: "",
  performanceFactor: "",
  aroma: "",
  flavor: "",
  sweetness: "",
  body: "",
  residual: "",
  cleanCup: "",
  score: "",
  notes: "",
  changeNote: "Correccion de analisis desde laboratorio",
};

const cuppingFields = [
  ["aroma", "Aroma"],
  ["flavor", "Sabor"],
  ["sweetness", "Dulzor"],
  ["body", "Cuerpo"],
  ["residual", "Residual"],
  ["cleanCup", "Taza limpia"],
];

const formatProfileOptionLabel = (profile) => {
  const code = profile?.internal_code || profile?.coffee_profile_code || profile?.code;
  return [code, profile?.name].filter(Boolean).join(" - ");
};

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

const formatKg = (value) => {
  return `${Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} kg`;
};

const getAssignmentRole = (notes = "") => {
  const text = String(notes || "");
  if (text.startsWith("[Proceso]")) return "Proceso";
  if (text.startsWith("[Base]")) return "Base";
  if (text.startsWith("[Directo]")) return "Directo";
  return "Asignado";
};

const getAssignedLotsForSaleItem = (sale, saleItemId) => {
  return (sale?.deductedLots || []).filter(
    (lot) => Number(lot.sale_item_id) === Number(saleItemId) && !lot.deducted_at
  );
};

const saleHasItemsWithoutAssignedLots = (sale) => {
  return (sale?.items || []).some((item) => getAssignedLotsForSaleItem(sale, item.id).length === 0);
};

const formatAssignedLotOption = (lot) => {
  return `${getAssignmentRole(lot.notes)} - ${formatCoffeeLotCodeName(lot)} - ${formatKg(lot.quantity_kg)} asignados`;
};

const normalizePercentageInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return String(Math.min(Number(digits), 100));
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

const buildSampleBlendRows = (sample) => {
  const rows = (sample.items || []).flatMap((item) =>
    (item.blend_items || []).map((blend) => ({
      sampleItemId: String(item.id),
      componentDescription: blend.component_description || blend.lot_code || "",
      percentage: String(blend.percentage || ""),
      notes: blend.notes || "",
    }))
  );

  return rows.length > 0
    ? rows
    : (sample.items || []).map((item) => ({
        sampleItemId: String(item.id),
        componentDescription: "",
        percentage: "",
        notes: "",
      }));
};

const buildBlankSaleItemReviews = (sale) => {
  return (sale.items || []).map((item) => ({
    saleItemId: item.id,
    humidityPercent: item.sale_humidity_percent || "",
    aroma: item.sale_lab_aroma || "",
    flavor: item.sale_lab_flavor || "",
    sweetness: item.sale_lab_sweetness || "",
    body: item.sale_lab_body || "",
    residual: item.sale_lab_residual || "",
    cleanCup: item.sale_lab_clean_cup || "",
    score: item.sale_lab_score || "",
    notes: item.sale_lab_notes || "",
  }));
};

const formatDate = (value) => {
  if (!value) return "Sin fecha estimada";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");

  return [day, month, year].filter(Boolean).join("/");
};

const LaboratoryPage = ({ initialPanel = "lots" }) => {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState(initialPanel === "blends" ? "sales" : initialPanel);
  const [processFilter, setProcessFilter] = useState("pendiente_laboratorio");
  const [lots, setLots] = useState([]);
  const [inventoryLots, setInventoryLots] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [samples, setSamples] = useState([]);
  const [sales, setSales] = useState([]);
  const [saleLabRequests, setSaleLabRequests] = useState([]);
  const [history, setHistory] = useState({ lots: [], processes: [] });
  const [historySearch, setHistorySearch] = useState("");
  const [catalogs, setCatalogs] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedInventoryLot, setSelectedInventoryLot] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedSaleReview, setSelectedSaleReview] = useState(null);
  const [blendRows, setBlendRows] = useState([]);
  const [review, setReview] = useState(initialReview);
  const [finishForm, setFinishForm] = useState(initialFinish);
  const [sampleReview, setSampleReview] = useState(initialSampleReview);
  const [saleReview, setSaleReview] = useState(initialSaleReview);
  const [sampleBlendRows, setSampleBlendRows] = useState([]);
  const [inventoryLabForm, setInventoryLabForm] = useState(initialInventoryLabEdit);
  const [lotReviewDrafts, setLotReviewDrafts] = useState({});
  const [inventoryLabDrafts, setInventoryLabDrafts] = useState({});
  const [processFinishDrafts, setProcessFinishDrafts] = useState({});
  const [sampleReviewDrafts, setSampleReviewDrafts] = useState({});
  const [saleReviewDrafts, setSaleReviewDrafts] = useState({});
  const [inventorySearch, setInventorySearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const results = await Promise.allSettled([
      apiRequest("/lots?status=pendiente_laboratorio"),
      apiRequest("/inventory/lots"),
      apiRequest("/processes"),
      apiRequest("/samples?status=pendiente_laboratorio"),
      apiRequest("/sales"),
      apiRequest("/catalogs"),
      apiRequest("/laboratory/history"),
    ]);
    const [lotData, inventoryLotData, processData, sampleData, saleData, catalogData, historyData] = results.map((result) => (
      result.status === "fulfilled" ? result.value : null
    ));
    const failedRequests = results.filter((result) => result.status === "rejected");

    setLots(lotData || []);
    setInventoryLots(inventoryLotData || []);
    setProcesses((processData || []).filter((process) => process.status === "pendiente_laboratorio"));
    setSamples(sampleData || []);
    setSales((saleData || []).filter((sale) => ["listo_para_ensamble", "ensamble_definido"].includes(sale.status)));
    setSaleLabRequests((saleData || []).filter((sale) => sale.status === "pendiente_laboratorio"));
    setCatalogs(catalogData || null);
    setHistory(historyData || { lots: [], processes: [] });

    if (failedRequests.length) {
      setError(`Algunas secciones no cargaron: ${failedRequests.map((result) => result.reason?.message).filter(Boolean).join(" | ")}`);
    }

    if (selectedLot) {
      const updatedSelectedLot = (lotData || []).find((lot) => lot.id === selectedLot.id);
      setSelectedLot(updatedSelectedLot || null);
    }

    if (selectedInventoryLot) {
      const updatedSelectedInventoryLot = (inventoryLotData || []).find((lot) => lot.id === selectedInventoryLot.id);
      setSelectedInventoryLot(updatedSelectedInventoryLot || null);
    }

    if (selectedProcess) {
      const updatedSelectedProcess = (processData || []).find((process) => process.id === selectedProcess.id);
      setSelectedProcess(updatedSelectedProcess || null);
    }

    if (selectedSample) {
      const updatedSelectedSample = (sampleData || []).find((sample) => sample.id === selectedSample.id);
      setSelectedSample(updatedSelectedSample || null);
    }

    if (selectedSaleReview) {
      const updatedSaleReview = (saleData || []).find((sale) => sale.id === selectedSaleReview.id);
      setSelectedSaleReview(updatedSaleReview || null);
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

  const filteredInventoryLots = useMemo(() => {
    const term = inventorySearch.trim().toLowerCase();

    return inventoryLots.filter((lot) => {
      const text = [
        lot.code,
        lot.presentation,
        lot.status,
        lotStatusLabels[lot.status],
        lot.coffee_type_name,
        lot.coffee_profile_name,
        lot.commercial_classification,
        lot.coffee_variety,
        lot.lab_score,
      ].filter(Boolean).join(" ").toLowerCase();

      return !term || text.includes(term);
    });
  }, [inventoryLots, inventorySearch]);

  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();

    const lots = (history.lots || []).filter((lot) => {
      const text = [
        lot.code,
        lot.coffee_type_name,
        lot.coffee_profile_name,
        lot.commercial_classification,
        lot.coffee_variety,
        lot.lab_score,
        lot.reviewed_by_name,
      ].filter(Boolean).join(" ").toLowerCase();

      return !term || text.includes(term);
    });

    const processes = (history.processes || []).filter((process) => {
      const text = [
        process.code,
        process.sale_code,
        process.client_name,
        ...(process.outputs || []).flatMap((output) => [
          output.output_lot_code,
          output.coffee_profile_name,
          output.lab_score,
          output.reviewed_by_name,
        ]),
      ].filter(Boolean).join(" ").toLowerCase();

      return !term || text.includes(term);
    });

    return { lots, processes };
  }, [history, historySearch]);

  const selectLot = (lot) => {
    setActivePanel("lots");
    setSelectedLot(lot);
    setReview(lotReviewDrafts[lot.id] || {
      ...initialReview,
      commercialClassification: lot.commercial_classification || "",
      coffeeVariety: lot.coffee_variety || "",
    });
    setMessage("");
    setError("");
  };

  const selectInventoryLot = (lot) => {
    setActivePanel("inventory");
    setSelectedInventoryLot(lot);
    setInventoryLabForm(inventoryLabDrafts[lot.id] || {
      humidityPercent: lot.humidity_percent ?? "",
      performanceFactor: lot.performance_factor ?? "",
      aroma: lot.lab_aroma || "",
      flavor: lot.lab_flavor || "",
      sweetness: lot.lab_sweetness || "",
      body: lot.lab_body || "",
      residual: lot.lab_residual || "",
      cleanCup: lot.lab_clean_cup || "",
      score: lot.lab_score ?? "",
      notes: lot.lab_notes || "",
      changeNote: "Correccion de analisis desde laboratorio",
    });
    setMessage("");
    setError("");
  };

  const saveInventoryLabData = async (event) => {
    event.preventDefault();

    if (!selectedInventoryLot) {
      setError("Seleccione un cafe de inventario para editar.");
      return;
    }

    if (!inventoryLabForm.changeNote.trim()) {
      setError("Escriba una nota para dejar trazabilidad de la correccion.");
      return;
    }

    if (!window.confirm(`Confirma guardar el analisis de ${formatCoffeeLotCodeName(selectedInventoryLot)}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${selectedInventoryLot.id}/lab-data`, {
        method: "PUT",
        body: JSON.stringify({
          humidityPercent: inventoryLabForm.humidityPercent === "" ? null : Number(inventoryLabForm.humidityPercent),
          performanceFactor: inventoryLabForm.performanceFactor === "" ? null : Number(inventoryLabForm.performanceFactor),
          aroma: inventoryLabForm.aroma,
          flavor: inventoryLabForm.flavor,
          sweetness: inventoryLabForm.sweetness,
          body: inventoryLabForm.body,
          residual: inventoryLabForm.residual,
          cleanCup: inventoryLabForm.cleanCup,
          score: inventoryLabForm.score === "" ? null : Number(inventoryLabForm.score),
          notes: inventoryLabForm.notes,
          changeNote: inventoryLabForm.changeNote,
        }),
      });
      setInventoryLabDrafts((drafts) => {
        const next = { ...drafts };
        delete next[selectedInventoryLot.id];
        return next;
      });
      await loadData();
      setMessage("Analisis de inventario actualizado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const editHistoryLotLabData = async (lot) => {
    const humidityPercent = window.prompt("Humedad (%)", lot.humidity_percent ?? "");
    if (humidityPercent === null) return;
    const performanceFactor = window.prompt("Factor de rendimiento", lot.performance_factor ?? "");
    if (performanceFactor === null) return;
    const aroma = window.prompt("Aroma", lot.lab_aroma || "");
    if (aroma === null) return;
    const flavor = window.prompt("Sabor", lot.lab_flavor || "");
    if (flavor === null) return;
    const sweetness = window.prompt("Dulzor", lot.lab_sweetness || "");
    if (sweetness === null) return;
    const body = window.prompt("Cuerpo", lot.lab_body || "");
    if (body === null) return;
    const residual = window.prompt("Residual", lot.lab_residual || "");
    if (residual === null) return;
    const cleanCup = window.prompt("Taza limpia", lot.lab_clean_cup || "");
    if (cleanCup === null) return;
    const score = window.prompt("Score", lot.lab_score ?? "");
    if (score === null) return;
    const notes = window.prompt("Notas de laboratorio", lot.lab_notes || "");
    if (notes === null) return;
    const changeNote = window.prompt("Motivo de la correccion", "Correccion de datos cargados en pruebas");
    if (changeNote === null) return;

    if (!window.confirm(`Confirma corregir los datos de laboratorio de ${formatCoffeeLotCodeName(lot)}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${lot.id}/lab-data`, {
        method: "PUT",
        body: JSON.stringify({
          humidityPercent: humidityPercent === "" ? null : Number(humidityPercent),
          performanceFactor: performanceFactor === "" ? null : Number(performanceFactor),
          aroma,
          flavor,
          sweetness,
          body,
          residual,
          cleanCup,
          score: score === "" ? null : Number(score),
          notes,
          changeNote,
        }),
      });
      await loadData();
      setMessage("Datos de laboratorio corregidos correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const editHistoryProcessOutputLabData = async (output) => {
    if (!output.output_lot_id) {
      setError("Esta salida de proceso no tiene lote PROC asociado para corregir.");
      return;
    }

    const humidityPercent = window.prompt("Humedad (%)", output.humidity_percent ?? "");
    if (humidityPercent === null) return;
    const performanceFactor = window.prompt("Factor de rendimiento", output.performance_factor ?? "");
    if (performanceFactor === null) return;
    const aroma = window.prompt("Aroma", output.lab_aroma || "");
    if (aroma === null) return;
    const flavor = window.prompt("Sabor", output.lab_flavor || "");
    if (flavor === null) return;
    const sweetness = window.prompt("Dulzor", output.lab_sweetness || "");
    if (sweetness === null) return;
    const body = window.prompt("Cuerpo", output.lab_body || "");
    if (body === null) return;
    const residual = window.prompt("Residual", output.lab_residual || "");
    if (residual === null) return;
    const cleanCup = window.prompt("Taza limpia", output.lab_clean_cup || "");
    if (cleanCup === null) return;
    const score = window.prompt("Score", output.lab_score ?? "");
    if (score === null) return;
    const notes = window.prompt("Notas de laboratorio", output.lab_notes || "");
    if (notes === null) return;
    const changeNote = window.prompt("Motivo de la correccion", "Correccion de analisis de proceso");
    if (changeNote === null) return;

    if (!window.confirm(`Confirma corregir el analisis de ${output.output_lot_code || "esta salida"}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${output.output_lot_id}/lab-data`, {
        method: "PUT",
        body: JSON.stringify({
          humidityPercent: humidityPercent === "" ? null : Number(humidityPercent),
          performanceFactor: performanceFactor === "" ? null : Number(performanceFactor),
          aroma,
          flavor,
          sweetness,
          body,
          residual,
          cleanCup,
          score: score === "" ? null : Number(score),
          notes,
          changeNote,
        }),
      });
      await loadData();
      setMessage("Analisis del proceso corregido correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const selectProcess = (process) => {
    setActivePanel("processes");
    setSelectedProcess(process);
    setFinishForm(processFinishDrafts[process.id] || {
      ...initialFinish,
      outputReviews: process.outputs?.length
        ? process.outputs.map((output) => buildEmptyProcessOutputReview(output))
        : [],
    });
    setMessage("");
    setError("");
  };

  const updateProcessOutputReview = (index, field, value) => {
    setFinishForm((current) => {
      const next = {
        ...current,
      outputReviews: (current.outputReviews || []).map((review, reviewIndex) => (
        reviewIndex === index ? { ...review, [field]: value } : review
      )),
      };

      if (selectedProcess) {
        setProcessFinishDrafts((drafts) => ({ ...drafts, [selectedProcess.id]: next }));
      }

      return next;
    });
  };

  const selectSample = (sample) => {
    setActivePanel("samples");
    setSelectedSample(sample);
    setSampleReview(sampleReviewDrafts[sample.id] || {
      ...initialSampleReview,
      itemReviews: buildBlankSampleItemReviews(sample),
    });
    setSampleBlendRows(buildSampleBlendRows(sample));
    setMessage("");
    setError("");
  };

  const updateSampleItemReview = (index, field, value) => {
    setSampleReview((currentReview) => {
      const next = {
        ...currentReview,
      itemReviews: currentReview.itemReviews.map((itemReview, itemIndex) =>
        itemIndex === index ? { ...itemReview, [field]: value } : itemReview
      ),
      };

      if (selectedSample) {
        setSampleReviewDrafts((drafts) => ({ ...drafts, [selectedSample.id]: next }));
      }

      return next;
    });
  };

  const updateLotReview = (field, value) => {
    setReview((current) => {
      const next = { ...current, [field]: value };

      if (selectedLot) {
        setLotReviewDrafts((drafts) => ({ ...drafts, [selectedLot.id]: next }));
      }

      return next;
    });
  };

  const updateInventoryLabForm = (field, value) => {
    setInventoryLabForm((current) => {
      const next = { ...current, [field]: value };

      if (selectedInventoryLot) {
        setInventoryLabDrafts((drafts) => ({ ...drafts, [selectedInventoryLot.id]: next }));
      }

      return next;
    });
  };

  const updateFinishForm = (field, value) => {
    setFinishForm((current) => {
      const next = { ...current, [field]: value };

      if (selectedProcess) {
        setProcessFinishDrafts((drafts) => ({ ...drafts, [selectedProcess.id]: next }));
      }

      return next;
    });
  };

  const updateSampleReviewForm = (field, value) => {
    setSampleReview((current) => {
      const next = { ...current, [field]: value };

      if (selectedSample) {
        setSampleReviewDrafts((drafts) => ({ ...drafts, [selectedSample.id]: next }));
      }

      return next;
    });
  };

  const updateSampleBlendRow = (index, field, value) => {
    setSampleBlendRows((rows) => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
  };

  const addSampleBlendRowForItem = (sampleItemId) => {
    setSampleBlendRows((rows) => [...rows, {
      sampleItemId: String(sampleItemId),
      componentDescription: "",
      percentage: "",
      notes: "",
    }]);
  };

  const getSampleBlendTotalForItem = (sampleItemId, rows = sampleBlendRows) => {
    const total = rows
      .filter((row) => String(row.sampleItemId) === String(sampleItemId))
      .reduce((sum, row) => sum + Number(row.percentage || 0), 0);
    return Number(total.toFixed(2));
  };

  const validateSampleBlendRows = (sample, rows = sampleBlendRows) => {
    const missingRows = (sample.items || []).some((item) => !rows.some((row) => String(row.sampleItemId) === String(item.id)));
    if (missingRows) {
      return "Cada cafe de la muestra debe tener al menos un componente de ensamble.";
    }

    const incompleteRow = rows.find((row) => !row.componentDescription?.trim() || !row.percentage);
    if (incompleteRow) {
      return "Cada componente de ensamble debe tener cafe usado y porcentaje.";
    }

    const incompleteItem = (sample.items || []).find((item) => getSampleBlendTotalForItem(item.id, rows) !== 100);
    if (incompleteItem) {
      return `El ensamble de ${formatRequestedCoffee(incompleteItem)} debe sumar 100%. Actualmente suma ${getSampleBlendTotalForItem(incompleteItem.id, rows)}%.`;
    }

    return null;
  };

  const saveSampleBlendAdjustment = async ({ skipConfirm = false } = {}) => {
    if (!selectedSample) {
      setError("Seleccione una muestra para ajustar el ensamble.");
      return false;
    }

    const validationError = validateSampleBlendRows(selectedSample);
    if (validationError) {
      setError(validationError);
      return false;
    }

    if (!skipConfirm && !window.confirm(`Confirma guardar el ajuste de ensamble de ${selectedSample.code}?`)) {
      return false;
    }

    const updatedSample = await apiRequest(`/samples/${selectedSample.id}/blend`, {
      method: "PUT",
      body: JSON.stringify({
        items: sampleBlendRows.map((row) => ({
          sampleItemId: Number(row.sampleItemId),
          componentDescription: row.componentDescription,
          percentage: Number(row.percentage),
          notes: row.notes || null,
        })),
      }),
    });

    const sampleData = updatedSample.data || updatedSample;
    setSelectedSample(sampleData);
    setSampleBlendRows(buildSampleBlendRows(sampleData));
    setSamples((currentSamples) => currentSamples.map((sample) => (
      sample.id === sampleData.id ? sampleData : sample
    )));
    return true;
  };

  const updateSaleReviewForm = (field, value) => {
    setSaleReview((current) => {
      const next = { ...current, [field]: value };

      if (selectedSaleReview) {
        setSaleReviewDrafts((drafts) => ({ ...drafts, [selectedSaleReview.id]: next }));
      }

      return next;
    });
  };

  const selectSaleReview = async (saleId) => {
    setActivePanel("sales");
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const sale = await apiRequest(`/sales/${saleId}`);
      setSelectedSaleReview(sale);
      setSaleReview(saleReviewDrafts[sale.id] || {
        ...initialSaleReview,
        itemReviews: buildBlankSaleItemReviews(sale),
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSaleItemReview = (index, field, value) => {
    setSaleReview((currentReview) => {
      const next = {
        ...currentReview,
      itemReviews: currentReview.itemReviews.map((itemReview, itemIndex) =>
        itemIndex === index ? { ...itemReview, [field]: value } : itemReview
      ),
      };

      if (selectedSaleReview) {
        setSaleReviewDrafts((drafts) => ({ ...drafts, [selectedSaleReview.id]: next }));
      }

      return next;
    });
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
        lotId: String(item.lot_id),
        percentage: String(item.percentage),
        notes: item.notes || "",
      }));
      const assignedRows = (sale.deductedLots || [])
        .filter((lot) => !lot.deducted_at)
        .map((lot) => ({
          saleItemId: String(lot.sale_item_id),
          lotId: String(lot.lot_id),
          percentage: "",
          notes: getAssignmentRole(lot.notes),
        }));

      setBlendRows(
        existingRows?.length
          ? existingRows
          : assignedRows.length
            ? assignedRows
            : [
                {
                  saleItemId: sale.items?.[0]?.id ? String(sale.items[0].id) : "",
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
          ...(field === "saleItemId" ? { lotId: "" } : {}),
        };
      })
    );
  };

  const addBlendRow = (saleItemId = null) => {
    setBlendRows((currentRows) => [
      ...currentRows,
      {
        saleItemId: saleItemId ? String(saleItemId) : selectedSale?.items?.[0]?.id ? String(selectedSale.items[0].id) : "",
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

    const confirmed = window.confirm("Confirma guardar esta orden de ensamble para bodega?");

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
      setMessage("Orden de ensamble guardada. Bodega ya puede imprimir el documento.");
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

  const returnSaleToWarehouse = async () => {
    if (!selectedSale) return;

    const notes = window.prompt(
      "Motivo para devolver esta venta a bodega",
      "Venta enviada a laboratorio sin lotes asignados para ensamble."
    );

    if (notes === null) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${selectedSale.id}/return-to-warehouse`, {
        method: "PUT",
        body: JSON.stringify({
          notes: notes.trim() || "Venta devuelta a bodega para asignar lotes.",
        }),
      });
      setSelectedSale(null);
      setBlendRows([]);
      await loadData();
      setMessage("Venta devuelta a bodega. Ahora se pueden asignar los lotes y enviarla nuevamente a ensamble.");
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
      setLotReviewDrafts((drafts) => {
        const next = { ...drafts };
        delete next[selectedLot.id];
        return next;
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

  const submitSampleReview = async (event, decision = sampleReview.decision) => {
    event.preventDefault();

    if (!selectedSample) {
      setError("Seleccione una muestra para revisar.");
      return;
    }

    if (decision === "en_preparacion" && !sampleReview.notes.trim()) {
      setError("Para devolver una muestra debe escribir que ensamble o dato debe corregir muestras.");
      return;
    }

    const confirmed = window.confirm(
      decision === "aprobada_laboratorio"
        ? `Confirma aprobar el analisis de ${selectedSample.code}?`
        : `Confirma devolver ${selectedSample.code} a muestras para corregir el ensamble?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (decision === "aprobada_laboratorio") {
        const blendSaved = await saveSampleBlendAdjustment({ skipConfirm: true });
        if (!blendSaved) {
          setSaving(false);
          return;
        }
      }

      const requestBody = {
        status: decision,
        notes: sampleReview.notes || undefined,
      };

      if (decision === "aprobada_laboratorio") {
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
      setSampleReviewDrafts((drafts) => {
        const next = { ...drafts };
        delete next[selectedSample.id];
        return next;
      });
      setSampleReview(initialSampleReview);
      setSelectedSample(null);
      await loadData();
      setMessage(
        decision === "aprobada_laboratorio"
          ? "Analisis de muestra aprobado. El usuario de muestras ya puede marcarla como lista."
          : "Muestra devuelta a muestras para corregir ensamble y reenviar a laboratorio."
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const submitSaleReview = async (event) => {
    event.preventDefault();

    if (!selectedSaleReview) {
      setError("Seleccione una venta para revisar.");
      return;
    }

    if (saleReview.decision === "ensamble_definido" && !saleReview.notes.trim()) {
      setError("Para rechazar una venta debe escribir una nota de laboratorio.");
      return;
    }

    const confirmed = window.confirm(
      saleReview.decision === "aprobada_laboratorio"
        ? `Confirma aprobar el analisis de ${selectedSaleReview.code}?`
        : `Confirma rechazar ${selectedSaleReview.code} y devolverla a bodega?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const requestBody = {
        status: saleReview.decision,
        notes: saleReview.notes || undefined,
      };

      if (saleReview.decision === "aprobada_laboratorio") {
        requestBody.itemReviews = saleReview.itemReviews.map((itemReview) => ({
          saleItemId: itemReview.saleItemId,
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

      await apiRequest(`/sales/${selectedSaleReview.id}/lab-review`, {
        method: "PUT",
        body: JSON.stringify(requestBody),
      });
      setSaleReviewDrafts((drafts) => {
        const next = { ...drafts };
        delete next[selectedSaleReview.id];
        return next;
      });
      setSaleReview(initialSaleReview);
      setSelectedSaleReview(null);
      await loadData();
      setMessage(
        saleReview.decision === "aprobada_laboratorio"
          ? "Analisis de venta aprobado. Bodega ya puede alistar."
          : "Venta rechazada y devuelta a bodega para corregir salidas."
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

    if (selectedProcess.outputs?.length > 0) {
      const invalidReview = (finishForm.outputReviews || []).find((review) => (
        cuppingFields.some(([field]) => !review[field]) ||
        !review.score
      ));

      if ((finishForm.outputReviews || []).length !== selectedProcess.outputs.length || invalidReview) {
        setError("Debe registrar analisis completo y score para cada salida del proceso.");
        return;
      }
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
          coffeeProfileId: finishForm.coffeeProfileId ? Number(finishForm.coffeeProfileId) : null,
          score: Number(finishForm.score),
          outputReviews: selectedProcess.outputs?.length
            ? finishForm.outputReviews.map((review) => ({
                ...review,
                processOutputId: Number(review.processOutputId),
                score: Number(review.score),
              }))
            : [],
        }),
      });
      setProcessFinishDrafts((drafts) => {
        const next = { ...drafts };
        delete next[selectedProcess.id];
        return next;
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
          <p className="text-sm text-slate-500">Lotes, procesos, muestras y ventas separados por trabajo pendiente.</p>
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,170px)_minmax(0,1fr)]">
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
              activePanel === "sales" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setActivePanel("sales")}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <FlaskConical size={16} />
              Ventas
            </span>
            <span className="text-xs">{saleLabRequests.length}</span>
          </button>
          <button
            className={`flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm ${
              activePanel === "history" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setActivePanel("history")}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <FileText size={16} />
              Historico
            </span>
            <span className="text-xs">{(history.lots?.length || 0) + (history.processes?.length || 0)}</span>
          </button>
        </aside>

        {activePanel === "lots" ? (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
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
                          <p className="font-semibold text-ink">{formatCoffeeLotCodeName(lot)}</p>
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
                onChange={(event) => updateLotReview("decision", event.target.value)}
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
                      onChange={(event) => updateLotReview("commercialClassification", event.target.value)}
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
                      onChange={(event) => updateLotReview("coffeeVariety", event.target.value)}
                    />
                  </div>
                  {((selectedLot.commercial_classification || "") !== (review.commercialClassification || "") ||
                    (selectedLot.coffee_variety || "") !== (review.coffeeVariety || "")) && (
                    <textarea
                      className="mt-3 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Nota interna del cambio, ej. Pasa a regional por no cumplir perfil varietal"
                      value={review.classificationChangeNote}
                      onChange={(event) => updateLotReview("classificationChangeNote", event.target.value)}
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
                      onChange={(event) => updateLotReview(field, event.target.value)}
                    />
                  ))}
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Score"
                    type="number"
                    step="0.01"
                    value={review.score}
                    onChange={(event) => updateLotReview("score", event.target.value)}
                  />
                </div>
              )}

              <textarea
                className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notas de laboratorio"
                value={review.notes}
                onChange={(event) => updateLotReview("notes", event.target.value)}
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
        ) : activePanel === "inventory" ? (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Inventario para laboratorio</h2>
                <p className="text-sm text-slate-500">Todos los cafes disponibles para consultar o corregir analisis.</p>
                <input
                  className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Buscar por codigo, cafe, categoria, estado o score"
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                />
              </div>
              {filteredInventoryLots.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin cafes en inventario" message="Los cafes disponibles apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredInventoryLots.map((lot) => (
                    <button
                      key={lot.id}
                      className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selectedInventoryLot?.id === lot.id ? "bg-emerald-50" : "bg-white"
                      }`}
                      onClick={() => selectInventoryLot(lot)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{formatCoffeeLotCodeName(lot)}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {[lot.presentation, lot.coffee_type_name, lot.commercial_classification, lot.coffee_variety || lot.coffee_profile_name]
                              .filter(Boolean)
                              .join(" / ") || "Cafe"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Fisico: {formatKg(lot.available_weight_kg)} · Libre operativo: {formatKg(lot.operational_available_kg ?? lot.available_weight_kg)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge>{lotStatusLabels[lot.status] || lot.status}</StatusBadge>
                          <span className="text-xs font-semibold text-slate-500">Score {lot.lab_score ?? "-"}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="rounded border border-slate-200 bg-white p-4" onSubmit={saveInventoryLabData}>
              <div className="flex items-center gap-2">
                <FlaskConical size={17} className="text-leaf" />
                <h2 className="text-sm font-semibold text-slate-800">Editar analisis</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {selectedInventoryLot ? formatCoffeeLotCodeName(selectedInventoryLot) : "Seleccione un cafe de inventario."}
              </p>

              {!selectedInventoryLot ? (
                <div className="mt-4">
                  <EmptyState title="Sin cafe seleccionado" message="Seleccione un cafe de la lista para editar sus datos de laboratorio." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Humedad %"
                      type="number"
                      step="0.01"
                      value={inventoryLabForm.humidityPercent}
                      onChange={(event) => updateInventoryLabForm("humidityPercent", event.target.value)}
                    />
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Factor de rendimiento"
                      type="number"
                      step="0.01"
                      value={inventoryLabForm.performanceFactor}
                      onChange={(event) => updateInventoryLabForm("performanceFactor", event.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {cuppingFields.map(([field, label]) => (
                      <input
                        key={`inventory-${field}`}
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder={label}
                        value={inventoryLabForm[field]}
                        onChange={(event) => updateInventoryLabForm(field, event.target.value)}
                      />
                    ))}
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Score"
                      type="number"
                      step="0.01"
                      value={inventoryLabForm.score}
                      onChange={(event) => updateInventoryLabForm("score", event.target.value)}
                    />
                  </div>

                  <textarea
                    className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notas de laboratorio"
                    value={inventoryLabForm.notes}
                    onChange={(event) => updateInventoryLabForm("notes", event.target.value)}
                  />
                  <textarea
                    className="min-h-20 w-full rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
                    placeholder="Nota obligatoria de correccion"
                    value={inventoryLabForm.changeNote}
                    onChange={(event) => updateInventoryLabForm("changeNote", event.target.value)}
                    required
                  />

                  <button
                    className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving}
                  >
                    <Save size={16} />
                    Guardar analisis
                  </button>
                </div>
              )}
            </form>
          </div>
        ) : activePanel === "processes" ? (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
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
                      <p className="text-sm text-slate-500">{[process.process_type, process.process_location].filter(Boolean).join(" - ") || "Sin ubicacion"}</p>
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
                              <p className="font-semibold text-ink">{formatCoffeeLotCodeName(input)}</p>
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
                {selectedProcess.outputs?.length === 0 && (
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={finishForm.coffeeProfileId}
                    onChange={(event) => updateFinishForm("coffeeProfileId", event.target.value)}
                  >
                    <option value="">Perfil comercial</option>
                    {catalogs?.coffeeProfiles?.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {formatProfileOptionLabel(profile)}
                      </option>
                    ))}
                  </select>
                )}
                <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Revision fisica de Bodega: {selectedProcess.output_weight_kg} kg, humedad {selectedProcess.physical_humidity_percent}%, factor {selectedProcess.physical_performance_factor}.
                </div>

                {selectedProcess.outputs?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProcess.outputs.map((output, index) => {
                      const outputReview = finishForm.outputReviews?.[index] || buildEmptyProcessOutputReview(output);

                      return (
                        <div key={output.id} className="rounded border border-emerald-200 bg-emerald-50 p-3">
                          <div className="rounded border border-emerald-100 bg-white px-3 py-2 text-sm">
                            <p className="font-semibold text-ink">{output.coffee_profile_name}</p>
                            <p className="text-slate-600">
                              {output.output_weight_kg} kg · Humedad {output.humidity_percent}% · Factor {output.performance_factor}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {cuppingFields.map(([field, label]) => (
                              <input
                                key={`${output.id}-${field}`}
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder={label}
                                value={outputReview[field]}
                                onChange={(event) => updateProcessOutputReview(index, field, event.target.value)}
                              />
                            ))}
                            <input
                              className="rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Score"
                              type="number"
                              step="0.01"
                              value={outputReview.score}
                              onChange={(event) => updateProcessOutputReview(index, "score", event.target.value)}
                            />
                          </div>
                          <textarea
                            className="mt-3 min-h-16 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Notas de laboratorio para esta salida"
                            value={outputReview.notes}
                            onChange={(event) => updateProcessOutputReview(index, "notes", event.target.value)}
                          />
                          <textarea
                            className="mt-3 min-h-16 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Comentario inicial del lote PROC"
                            value={outputReview.initialComment}
                            onChange={(event) => updateProcessOutputReview(index, "initialComment", event.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {cuppingFields.map(([field, label]) => (
                        <input
                          key={field}
                          className="rounded border border-slate-300 px-3 py-2 text-sm"
                          placeholder={label}
                          value={finishForm[field]}
                          onChange={(event) => updateFinishForm(field, event.target.value)}
                        />
                      ))}
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Score"
                        type="number"
                        step="0.01"
                        value={finishForm.score}
                        onChange={(event) => updateFinishForm("score", event.target.value)}
                      />
                    </div>

                    <textarea
                      className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Notas del proceso"
                      value={finishForm.notes}
                      onChange={(event) => updateFinishForm("notes", event.target.value)}
                    />
                    <textarea
                      className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Comentario inicial del lote PROC"
                      value={finishForm.initialComment}
                      onChange={(event) => updateFinishForm("initialComment", event.target.value)}
                    />
                  </>
                )}
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
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
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

                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-amber-800">Ensamble de referencia y ajuste final</p>
                        <p className="mt-1 text-xs text-amber-800">
                          Muestras propone el ensamble. Laboratorio puede corregir componentes o porcentajes antes de aprobar.
                        </p>
                      </div>
                      <button
                        className="rounded border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                        type="button"
                        disabled={saving || !selectedSample}
                        onClick={async () => {
                          setSaving(true);
                          setMessage("");
                          setError("");
                          try {
                            const saved = await saveSampleBlendAdjustment();
                            if (saved) setMessage("Ajuste de ensamble de muestra guardado correctamente.");
                          } catch (requestError) {
                            setError(requestError.message);
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        Guardar ajuste
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {selectedSample.items?.map((item) => {
                        const itemRows = sampleBlendRows
                          .map((row, index) => ({ ...row, index }))
                          .filter((row) => String(row.sampleItemId) === String(item.id));
                        const totalPercentage = getSampleBlendTotalForItem(item.id);
                        const isComplete = totalPercentage === 100;

                        return (
                          <div key={`sample-blend-edit-${item.id}`} className="space-y-2 rounded border border-amber-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-ink">{formatRequestedCoffee(item)}</p>
                                <p className="text-xs text-slate-500">{item.quantity_grams} g solicitados</p>
                              </div>
                              <span className={`rounded px-2 py-1 text-xs font-semibold ${isComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                Total {totalPercentage}%
                              </span>
                            </div>

                            {itemRows.map((row) => {
                              const calculatedGrams = row.percentage
                                ? Number((Number(item.quantity_grams) * Number(row.percentage) / 100).toFixed(2))
                                : 0;

                              return (
                                <div key={`sample-blend-row-${row.index}`} className="grid min-w-0 gap-2 rounded border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_130px_auto]">
                                  <input
                                    className="min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                                    placeholder="Cafe usado, proceso, mezcla o referencia libre"
                                    value={row.componentDescription}
                                    onChange={(event) => updateSampleBlendRow(row.index, "componentDescription", event.target.value)}
                                  />
                                  <input
                                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                                    placeholder="Porcentaje %"
                                    type="text"
                                    inputMode="numeric"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={row.percentage}
                                    onChange={(event) => updateSampleBlendRow(row.index, "percentage", normalizePercentageInput(event.target.value))}
                                  />
                                  <button
                                    className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                    type="button"
                                    onClick={() => setSampleBlendRows((rows) => rows.filter((_, rowIndex) => rowIndex !== row.index))}
                                    disabled={itemRows.length === 1}
                                  >
                                    Quitar
                                  </button>
                                  <textarea
                                    className="min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-3"
                                    placeholder={`Cantidad calculada: ${calculatedGrams} g. Observacion opcional`}
                                    rows={2}
                                    value={row.notes}
                                    onChange={(event) => updateSampleBlendRow(row.index, "notes", event.target.value)}
                                  />
                                </div>
                              );
                            })}

                            <button
                              className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              type="button"
                              onClick={() => addSampleBlendRowForItem(item.id)}
                            >
                              Agregar componente a este cafe
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-800">Datos para aprobar la muestra</p>
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
                            />
                            {cuppingFields.map(([field, label]) => (
                              <input
                                key={field}
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder={label}
                                type="text"
                                value={itemReview[field]}
                                onChange={(event) => updateSampleItemReview(index, field, event.target.value)}
                              />
                            ))}
                            <input
                              className="rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Score"
                              type="text"
                              value={itemReview.score}
                              onChange={(event) => updateSampleItemReview(index, "score", event.target.value)}
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

                  <textarea
                    className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notas de laboratorio o instrucciones para que muestras corrija el ensamble"
                    value={sampleReview.notes}
                    onChange={(event) => updateSampleReviewForm("notes", event.target.value)}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                      type="button"
                      disabled={saving || !selectedSample}
                      onClick={(event) => submitSampleReview(event, "en_preparacion")}
                    >
                      Devolver a muestras
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      type="button"
                      disabled={saving || !selectedSample}
                      onClick={(event) => submitSampleReview(event, "aprobada_laboratorio")}
                    >
                      <Save size={16} />
                      Aprobar analisis
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        ) : activePanel === "sales" ? (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Ventas pendientes de analisis</h2>
              </div>
              {saleLabRequests.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin ventas pendientes" message="Las ventas enviadas por bodega apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {saleLabRequests.map((sale) => (
                    <button
                      key={sale.id}
                      className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selectedSaleReview?.id === sale.id ? "bg-emerald-50" : "bg-white"
                      }`}
                      onClick={() => selectSaleReview(sale.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{sale.code}</p>
                          <p className="text-sm text-slate-500">{sale.client_name}</p>
                        </div>
                        <StatusBadge tone="warning">Pendiente analisis</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Entrega estimada: {formatDate(sale.estimated_delivery_date)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="rounded border border-slate-200 bg-white p-4" onSubmit={submitSaleReview}>
              <div className="flex items-center gap-2">
                <FlaskConical size={17} className="text-leaf" />
                <h2 className="text-sm font-semibold text-slate-800">Analisis de venta</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {selectedSaleReview ? `Venta seleccionada: ${selectedSaleReview.code}` : "Seleccione una venta pendiente."}
              </p>

              {!selectedSaleReview ? (
                <div className="mt-4">
                  <EmptyState title="Sin venta seleccionada" message="Seleccione una venta de la lista." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-medium text-ink">Productos vendidos</p>
                    <div className="mt-2 space-y-1">
                      {selectedSaleReview.items?.map((item) => (
                        <p key={item.id}>
                          {formatRequestedCoffee(item)} - {item.quantity_kg} kg
                        </p>
                      ))}
                    </div>
                  </div>

                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={saleReview.decision}
                    onChange={(event) => updateSaleReviewForm("decision", event.target.value)}
                  >
                    <option value="aprobada_laboratorio">Aprobar venta</option>
                    <option value="ensamble_definido">Rechazar y devolver a bodega</option>
                  </select>

                  {saleReview.decision === "aprobada_laboratorio" && (
                    <div className="space-y-3">
                      {saleReview.itemReviews.map((itemReview, index) => {
                        const item = selectedSaleReview.items?.find((saleItem) => saleItem.id === itemReview.saleItemId);

                        return (
                          <div key={itemReview.saleItemId} className="rounded border border-slate-200 p-3">
                            <p className="mb-3 text-sm font-semibold text-ink">
                              {formatRequestedCoffee(item)} - {item?.quantity_kg} kg
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              <input
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Humedad"
                                type="text"
                                value={itemReview.humidityPercent}
                                onChange={(event) => updateSaleItemReview(index, "humidityPercent", event.target.value)}
                                required
                              />
                              {cuppingFields.map(([field, label]) => (
                                <input
                                  key={field}
                                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                                  placeholder={label}
                                  type="text"
                                  value={itemReview[field]}
                                  onChange={(event) => updateSaleItemReview(index, field, event.target.value)}
                                  required
                                />
                              ))}
                              <input
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Score"
                                type="text"
                                value={itemReview.score}
                                onChange={(event) => updateSaleItemReview(index, "score", event.target.value)}
                                required
                              />
                            </div>
                            <textarea
                              className="mt-3 min-h-16 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Notas de este producto"
                              value={itemReview.notes}
                              onChange={(event) => updateSaleItemReview(index, "notes", event.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <textarea
                    className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder={saleReview.decision === "ensamble_definido" ? "Motivo del rechazo para corregir en bodega" : "Notas de laboratorio"}
                    value={saleReview.notes}
                    onChange={(event) => updateSaleReviewForm("notes", event.target.value)}
                    required={saleReview.decision === "ensamble_definido"}
                  />
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving || !selectedSaleReview}
                  >
                    <Save size={16} />
                    Guardar analisis
                  </button>
                </div>
              )}
            </form>
          </div>
        ) : activePanel === "history" ? (
          <div className="min-w-0 space-y-4">
            <div className="rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Historico de laboratorio</h2>
                  <p className="text-sm text-slate-500">Analisis guardados de lotes y procesos finalizados.</p>
                </div>
                <div className="text-xs text-slate-500">
                  Lotes: {filteredHistory.lots.length} · Procesos: {filteredHistory.processes.length}
                </div>
              </div>
              <input
                className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar por codigo, perfil, cliente, score o analista"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
            </div>

            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Lotes analizados</h3>
              </div>
              {filteredHistory.lots.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin lotes en historico" message="Los lotes analizados apareceran aqui." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Codigo</th>
                        <th className="px-3 py-2">Cafe</th>
                        <th className="px-3 py-2">Humedad</th>
                        <th className="px-3 py-2">Score</th>
                        <th className="px-3 py-2">Analisis</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Analista</th>
                        {["admin", "laboratory"].includes(user?.role) && <th className="px-3 py-2">Accion</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.lots.map((lot) => (
                        <tr key={lot.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold text-ink">{formatCoffeeLotCodeName(lot)}</td>
                          <td className="px-3 py-2">
                            {[lot.coffee_type_name, lot.commercial_classification, lot.coffee_variety, lot.coffee_profile_name]
                              .filter(Boolean)
                              .join(" - ") || "Cafe"}
                          </td>
                          <td className="px-3 py-2">{lot.humidity_percent ?? "-"}%</td>
                          <td className="px-3 py-2 font-semibold">{lot.lab_score ?? "-"}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            Aroma {lot.lab_aroma || "-"} · Sabor {lot.lab_flavor || "-"} · Dulzor {lot.lab_sweetness || "-"} · Cuerpo {lot.lab_body || "-"} · Residual {lot.lab_residual || "-"} · Taza limpia {lot.lab_clean_cup || "-"}
                          </td>
                          <td className="px-3 py-2">{formatDate(lot.lab_reviewed_at)}</td>
                          <td className="px-3 py-2">{lot.reviewed_by_name || "-"}</td>
                          {["admin", "laboratory"].includes(user?.role) && (
                            <td className="px-3 py-2">
                              <button
                                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                disabled={saving}
                                type="button"
                                onClick={() => editHistoryLotLabData(lot)}
                              >
                                Editar analisis
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Procesos analizados</h3>
              </div>
              {filteredHistory.processes.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Sin procesos en historico" message="Los procesos finalizados apareceran aqui." />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredHistory.processes.map((process) => (
                    <div key={process.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{process.code}</p>
                          <p className="text-sm text-slate-500">
                            {process.sale_code ? `${process.sale_code} - ${process.client_name || "Cliente"}` : "Sin venta asociada"}
                          </p>
                        </div>
                        <p className="text-sm text-slate-500">Finalizado: {formatDate(process.finalized_at)}</p>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {(process.outputs || []).map((output, index) => (
                          <div key={`${process.id}-${output.output_lot_id || index}`} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                            <p className="font-semibold text-ink">
                              {output.output_lot_code || "Sin lote PROC"} - {output.coffee_profile_name || "Cafe procesado"}
                            </p>
                            <p className="text-slate-600">
                              {output.output_weight_kg} kg · Humedad {output.humidity_percent}% · Factor {output.performance_factor}
                            </p>
                            <p className="mt-2 text-xs text-slate-600">
                              Aroma {output.lab_aroma || "-"} · Sabor {output.lab_flavor || "-"} · Dulzor {output.lab_sweetness || "-"} · Cuerpo {output.lab_body || "-"} · Residual {output.lab_residual || "-"} · Taza limpia {output.lab_clean_cup || "-"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-ink">Score: {output.lab_score || "-"}</p>
                            {output.lab_notes && <p className="mt-1 text-xs text-slate-500">Notas: {output.lab_notes}</p>}
                            {["admin", "laboratory"].includes(user?.role) && (
                              <button
                                className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                disabled={saving}
                                type="button"
                                onClick={() => editHistoryProcessOutputLabData(output)}
                              >
                                Editar analisis
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default LaboratoryPage;
