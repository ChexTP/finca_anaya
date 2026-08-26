import { Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatOperationalKg, roundKgUpToHalf } from "../../utils/coffeeCalculations";
import { formatCoffeeLotCodeName, getCoffeeLotGroup, groupCoffeeLots } from "../../utils/coffeeLots";
import { getProcessStatusTone, processStatusLabels } from "../../utils/workflow";

const initialProcess = {
  saleId: "",
  processType: "Proceso",
  processLocation: "",
  notes: "",
};

const initialStartForm = {
  processType: "Proceso",
  processLocation: "",
  estimatedReturnDate: "",
};

const processTypeOptions = ["Proceso", "Trilladora", "Seleccion electronica", "Otro proceso"];
const directInventoryProcessTypes = ["Trilladora", "Seleccion electronica"];
const HIGH_HUMIDITY_GROUP = "__humidity_gt_10";
const processStatusFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "pendiente", label: "Por enviar" },
  { value: "receiving", label: "Esperando recibir" },
  { value: "finalizado", label: "Finalizados" },
];

const initialPhysicalReviewForm = {
  outputs: [
    {
      lotKind: "PROC",
      profileSource: "sale",
      purchaseCoffeeId: "",
      coffeeProfileId: "",
      coffeeTypeId: "",
      presentation: "Excelso",
      processVariant: "normal",
      outputWeightKg: "",
      humidityPercent: "",
      performanceFactor: "",
      notes: "",
    },
  ],
};

const emptyProcessOutput = {
  lotKind: "PROC",
  profileSource: "sale",
  purchaseCoffeeId: "",
  coffeeProfileId: "",
  coffeeTypeId: "",
  presentation: "Excelso",
  processVariant: "normal",
  outputWeightKg: "",
  humidityPercent: "",
  performanceFactor: "",
  notes: "",
};

const createEmptyProcessOutput = (process) => ({
  ...emptyProcessOutput,
  lotKind: directInventoryProcessTypes.includes(process?.process_type) ? "LOT" : "PROC",
  profileSource: directInventoryProcessTypes.includes(process?.process_type) ? "purchase" : "sale",
  presentation: process?.process_type === "Trilladora" ? "Excelso" : "Pergamino",
});

const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const formatProfileLabel = (profile) => {
  const code = profile?.internal_code || profile?.coffee_profile_code || profile?.code;
  const name = profile?.name || profile?.coffee_profile_name || "Perfil";

  return [code, name].filter(Boolean).join(" - ");
};

const formatPurchaseCoffeeLabel = (coffee) => {
  const code = coffee?.internal_code || coffee?.code;
  const name = coffee?.name || "Cafe";
  const detail = [coffee?.family, coffee?.process_type].filter(Boolean).join(" / ");

  return [code, name, detail ? `(${detail})` : null].filter(Boolean).join(" ");
};

const formatDate = (value) => {
  if (!value) return "Sin fecha estimada";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");

  return [day, month, year].filter(Boolean).join("/");
};

const formatKg = formatOperationalKg;
const getAvailableLotKg = (lot) => Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0);
const formatQuantityInputValue = (value) => {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return "";

  return Number(quantity.toFixed(3)).toString();
};

const matchesProcessStatusFilter = (process, filter) => {
  if (filter === "all") return true;
  if (filter === "receiving") {
    return ["en_proceso", "pendiente_revision_fisica"].includes(process.status);
  }

  return process.status === filter;
};

const ProcessesPage = ({
  fixedProcessType = null,
  title = "Procesos",
  description = "Cafe enviado a procesamiento y procesos finalizados.",
}) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultProcessType = fixedProcessType || "Proceso";
  const [processes, setProcesses] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [sales, setSales] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [codeCounters, setCodeCounters] = useState([]);
  const [form, setForm] = useState({ ...initialProcess, processType: defaultProcessType });
  const [selectedLots, setSelectedLots] = useState({});
  const [startProcessId, setStartProcessId] = useState(null);
  const [startForm, setStartForm] = useState({ ...initialStartForm, processType: defaultProcessType });
  const [physicalReviewProcessId, setPhysicalReviewProcessId] = useState(null);
  const [physicalReviewForm, setPhysicalReviewForm] = useState(initialPhysicalReviewForm);
  const [processSearch, setProcessSearch] = useState("");
  const [processStatusFilter, setProcessStatusFilter] = useState("all");
  const [selectedPresentation, setSelectedPresentation] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canCreateProcess = ["admin", "accounting", "warehouse", "laboratory"].includes(user?.role);
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
      .map(([lotId, value]) => {
        const lot = availableLots.find((availableLot) => String(availableLot.id) === String(lotId));
        const typedKg = Number(value.quantityKg);
        const availableKg = lot ? getAvailableLotKg(lot) : typedKg;
        const displayedAvailableKg = roundKgUpToHalf(availableKg);
        const quantityKg = typedKg > availableKg && Math.abs(typedKg - displayedAvailableKg) < 0.001
          ? availableKg
          : typedKg;

        return {
          lotId: Number(lotId),
          quantityKg,
        };
      });
  }, [availableLots, selectedLots]);

  const totalSelectedKg = useMemo(() => {
    return selectedInputs.reduce((total, input) => total + input.quantityKg, 0);
  }, [selectedInputs]);

  const selectedSale = useMemo(() => {
    return sales.find((sale) => String(sale.id) === String(form.saleId));
  }, [form.saleId, sales]);

  const filteredProcesses = useMemo(() => {
    const search = processSearch.trim().toLowerCase();
    return processes.filter((process) => {
      if (!matchesProcessStatusFilter(process, processStatusFilter)) return false;
      if (!search) return true;

      const text = [
        process.code,
        process.sale_code,
        process.sale_client_name,
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
  }, [processes, processSearch, processStatusFilter]);

  const processStatusCounts = useMemo(() => {
    return processStatusFilterOptions.reduce((counts, option) => {
      counts[option.value] = option.value === "all"
        ? processes.length
        : processes.filter((process) => matchesProcessStatusFilter(process, option.value)).length;
      return counts;
    }, {});
  }, [processes]);

  const presentationNames = useMemo(() => {
    return [
      ...new Set([
        ...(catalogs?.coffeePresentations || []).map((presentation) => presentation.name),
        ...availableLots.map((lot) => lot.presentation || "Pergamino"),
      ].filter(Boolean)),
    ];
  }, [availableLots, catalogs]);

  const presentationOptions = useMemo(() => {
    return presentationNames.map((presentation) => {
      const presentationLots = availableLots.filter((lot) => (lot.presentation || "Pergamino") === presentation);
      return {
        presentation,
        count: presentationLots.length,
        kg: presentationLots.reduce((total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0), 0),
      };
    });
  }, [availableLots, presentationNames]);

  const presentationFilteredLots = useMemo(() => {
    return selectedPresentation === "all"
      ? availableLots
      : availableLots.filter((lot) => (lot.presentation || "Pergamino") === selectedPresentation);
  }, [availableLots, selectedPresentation]);

  const groupCards = useMemo(() => {
    const groups = groupCoffeeLots(
      presentationFilteredLots.map((lot) => ({
        ...lot,
        available_weight_kg: lot.operational_available_kg ?? lot.available_weight_kg,
      }))
    );

    return Object.values(groups).sort((left, right) => left.name.localeCompare(right.name));
  }, [presentationFilteredLots]);

  const highHumidityLots = useMemo(() => {
    return presentationFilteredLots.filter((lot) => (
      lot.lot_kind !== "PROC"
      && Number(lot.humidity_percent || 0) > 10
    ));
  }, [presentationFilteredLots]);

  const highHumidityKg = useMemo(() => {
    return highHumidityLots.reduce(
      (total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0),
      0
    );
  }, [highHumidityLots]);

  const filteredAvailableLots = useMemo(() => {
    const search = processSearch.trim().toLowerCase();
    const groupedLots = selectedGroup === HIGH_HUMIDITY_GROUP
      ? highHumidityLots
      : selectedGroup === "all"
        ? presentationFilteredLots
        : presentationFilteredLots.filter((lot) => getCoffeeLotGroup(lot) === selectedGroup);

    if (!search) return groupedLots;

    return groupedLots.filter((lot) => {
      const text = [
        lot.code,
        formatCoffeeLotCodeName(lot),
        lot.supplier_name,
        lot.presentation,
        lot.coffee_type_name,
        lot.coffee_profile_name,
        lot.commercial_classification,
        lot.coffee_variety,
        lot.status,
        lot.humidity_percent,
        lot.performance_factor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }, [highHumidityLots, presentationFilteredLots, processSearch, selectedGroup]);

  const totalAvailableKg = presentationFilteredLots.reduce(
    (total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0),
    0
  );
  const allAvailableKg = availableLots.reduce(
    (total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0),
    0
  );

  const loadData = async () => {
    const processQuery = fixedProcessType ? `?processType=${encodeURIComponent(fixedProcessType)}` : "";
    const requests = [apiRequest(`/processes${processQuery}`)];

    if (canCreateProcess) {
      requests.push(apiRequest("/inventory/lots"));
      requests.push(apiRequest("/sales"));
      requests.push(apiRequest("/catalogs"));
      requests.push(apiRequest("/code-counters"));
    }

    const [processData, lotData = [], saleData = [], catalogData = null, codeCounterData = []] = await Promise.all(requests);
    setProcesses(processData);
    setAvailableLots(lotData);
    setSales(saleData.filter((sale) => !["despachada", "anulada"].includes(sale.status)));
    setCatalogs(catalogData);
    setCodeCounters(codeCounterData);
  };

  const selectProcessStatusFilter = (status) => {
    setProcessStatusFilter(status);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    const saleId = searchParams.get("saleId");
    if (saleId) setForm((current) => ({ ...current, saleId }));
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

  const assignFullLotQuantity = (lot) => {
    setSelectedLots((current) => ({
      ...current,
      [lot.id]: {
        enabled: true,
        quantityKg: formatQuantityInputValue(getAvailableLotKg(lot)),
      },
    }));
  };

  const getCounterPreview = (prefix, offset = 0) => {
    const counter = codeCounters.find((item) => item.prefix === prefix);
    const year = counter?.year || new Date().getFullYear();
    const nextNumber = Number(counter?.nextNumber || 1) + offset;

    return `${prefix}-${year}-${String(nextNumber).padStart(4, "0")}`;
  };

  const getOutputCodePreview = (outputs, output, index) => {
    const prefix = output.lotKind === "LOT" ? "LOT" : "PROC";
    const sharedInventoryPrefixes = ["LOT", "PROC"];
    const offset = outputs
      .slice(0, index)
      .filter((previousOutput) => {
        const previousPrefix = previousOutput.lotKind === "LOT" ? "LOT" : "PROC";
        if (sharedInventoryPrefixes.includes(prefix)) {
          return sharedInventoryPrefixes.includes(previousPrefix);
        }

        return previousPrefix === prefix;
      })
      .length;

    return getCounterPreview(prefix, offset);
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
      processType: fixedProcessType || process.process_type || "Proceso",
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
            lotKind: output.lot_kind || "PROC",
            profileSource: output.profile_source || (output.purchase_coffee_id ? "purchase" : "sale"),
            purchaseCoffeeId: output.purchase_coffee_id || "",
            coffeeProfileId: output.coffee_profile_id || "",
            coffeeTypeId: output.coffee_type_id || "",
            presentation: output.presentation || "Excelso",
            processVariant: output.process_variant || "normal",
            outputWeightKg: output.output_weight_kg || "",
            humidityPercent: output.humidity_percent || "",
            performanceFactor: output.performance_factor || "",
            notes: output.notes || "",
          }))
        : [createEmptyProcessOutput(process)],
    });
    setStartProcessId(null);
    setError("");
    setMessage("");
  };

  const updatePhysicalOutput = (index, field, value) => {
    setPhysicalReviewForm((current) => ({
      ...current,
      outputs: current.outputs.map((output, outputIndex) => (
        outputIndex === index
          ? {
              ...output,
              [field]: value,
              ...(field === "lotKind" && value === "LOT" ? { profileSource: "purchase", coffeeProfileId: "", processVariant: "normal" } : {}),
              ...(field === "lotKind" && value === "PROC" ? { profileSource: "sale", purchaseCoffeeId: "" } : {}),
              ...(field === "profileSource" ? { purchaseCoffeeId: "", coffeeProfileId: "" } : {}),
            }
          : output
      )),
    }));
  };

  const addPhysicalOutput = (process) => {
    setPhysicalReviewForm((current) => ({
      ...current,
      outputs: [...current.outputs, createEmptyProcessOutput(process)],
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
      if (directInventory) {
        setPhysicalReviewProcessId(process.id);
        setPhysicalReviewForm({ outputs: [createEmptyProcessOutput(process)] });
        setStartProcessId(null);
        setProcessStatusFilter("receiving");
        setMessage("Cafe recibido. Registre el peso de regreso para llevarlo a inventario.");
      } else {
        setMessage("Cafe recibido. Bodega debe completar la revision fisica.");
      }
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

    const invalidOutput = physicalReviewForm.outputs.find((output) => {
      const needsPurchaseCoffee = createsInventoryDirectly(process) && output.profileSource === "purchase";
      const needsSaleProfile = !createsInventoryDirectly(process) || output.profileSource === "sale";

      return (
        (needsPurchaseCoffee && !output.purchaseCoffeeId) ||
        (needsSaleProfile && !output.coffeeProfileId) ||
        !output.presentation ||
        !output.outputWeightKg ||
        (requiresHumidity && !output.humidityPercent) ||
        (requiresPerformanceFactor && !output.performanceFactor)
      );
    });

    if (invalidOutput) {
      setError(createsInventoryDirectly(process)
        ? "Cada salida debe tener tipo de registro, origen, cafe, presentacion y cantidad final."
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
            lotKind: output.lotKind,
            profileSource: output.profileSource,
            purchaseCoffeeId: output.purchaseCoffeeId ? Number(output.purchaseCoffeeId) : null,
            coffeeProfileId: output.coffeeProfileId ? Number(output.coffeeProfileId) : null,
            coffeeTypeId: output.coffeeTypeId ? Number(output.coffeeTypeId) : null,
            presentation: output.presentation,
            processVariant: output.processVariant || "normal",
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
    <section className="flex flex-col gap-5">
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
          placeholder="Buscar por perfil, lote, proveedor, cliente, venta o ubicacion"
          value={processSearch}
          onChange={(event) => setProcessSearch(event.target.value)}
        />
      </div>

      {fixedProcessType && (
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Acceso rapido por estado</p>
              <p className="text-xs text-slate-500">
                Use estos botones para ver de una los cafes que estan esperando recibir.
              </p>
            </div>
            <button
              className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
              type="button"
              onClick={() => selectProcessStatusFilter("receiving")}
            >
              Ver pendientes por recibir
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {processStatusFilterOptions.map((option) => (
              <button
                key={option.value}
                className={`rounded border px-3 py-2 text-left text-sm ${
                  processStatusFilter === option.value
                    ? "border-leaf bg-emerald-50 text-leaf"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => selectProcessStatusFilter(option.value)}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="text-xs">{processStatusCounts[option.value] || 0} registros</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {canCreateProcess && (
        <form
          className={`rounded border border-slate-200 bg-white p-4 ${fixedProcessType ? "order-7" : ""}`}
          onSubmit={createProcess}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">{actionLabel}</h2>
              <p className="text-sm text-slate-500">{actionDescription}</p>
            </div>
            <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Total: <span className="font-semibold text-ink">{formatKg(totalSelectedKg)}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.saleId}
              onChange={(event) => setForm({ ...form, saleId: event.target.value })}
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

          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Filtrar cafe disponible</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={`rounded border px-3 py-2 text-left text-sm ${
                  selectedPresentation === "all" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => {
                  setSelectedPresentation("all");
                  setSelectedGroup("all");
                }}
              >
                <span className="block font-semibold">Todo</span>
                <span className="text-xs">{availableLots.length} lotes - {formatKg(allAvailableKg)}</span>
              </button>
              {presentationOptions.map((option) => (
                <button
                  key={option.presentation}
                  className={`rounded border px-3 py-2 text-left text-sm ${
                    selectedPresentation === option.presentation ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                  }`}
                  type="button"
                  onClick={() => {
                    setSelectedPresentation(option.presentation);
                    setSelectedGroup("all");
                  }}
                >
                  <span className="block font-semibold">{option.presentation}</span>
                  <span className="text-xs">{option.count} lotes - {formatKg(option.kg)}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className={`rounded border px-3 py-2 text-left text-sm ${
                  selectedGroup === "all" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => setSelectedGroup("all")}
              >
                <span className="block font-semibold">Todos los tipos</span>
                <span className="text-xs">{presentationFilteredLots.length} lotes - {formatKg(totalAvailableKg)}</span>
              </button>
              {groupCards.map((group) => (
                <button
                  key={group.name}
                  className={`rounded border px-3 py-2 text-left text-sm ${
                    selectedGroup === group.name ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                  }`}
                  type="button"
                  onClick={() => setSelectedGroup(group.name)}
                >
                  <span className="block font-semibold">{group.name}</span>
                  <span className="text-xs">{group.count} lotes - {formatKg(group.kg)}</span>
                </button>
              ))}
              <button
                className={`rounded border px-3 py-2 text-left text-sm ${
                  selectedGroup === HIGH_HUMIDITY_GROUP ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => setSelectedGroup(HIGH_HUMIDITY_GROUP)}
              >
                <span className="block font-semibold">Humedad mayor a 10%</span>
                <span className="text-xs">{highHumidityLots.length} lotes - {formatKg(highHumidityKg)}</span>
              </button>
            </div>
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
                  <th className="px-3 py-2">{fixedProcessType ? "Cantidad a enviar" : "Cantidad a procesar"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAvailableLots.map((lot) => (
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
                    <td className="px-3 py-2">{formatKg(getAvailableLotKg(lot))}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                          type="number"
                          min="0"
                          step="0.001"
                          value={selectedLots[lot.id]?.quantityKg || ""}
                          onChange={(event) => updateLotQuantity(lot.id, event.target.value)}
                        />
                        <button
                          className="rounded border border-leaf px-2 py-1 text-xs font-semibold text-leaf"
                          type="button"
                          onClick={() => assignFullLotQuantity(lot)}
                        >
                          Todo
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAvailableLots.length === 0 && (
              <div className="border-t border-slate-100 bg-white p-4">
                <EmptyState title="Sin lotes con estos filtros" message="Cambie la busqueda, presentacion o tipo para ver mas cafe disponible." />
              </div>
            )}
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

      <div className={fixedProcessType ? "order-6" : ""}>
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
                      : "Sin venta asociada"}
                  </p>
                </div>
                <StatusBadge tone={getProcessStatusTone(process)}>
                  {processStatusLabels[process.status] || process.status}
                </StatusBadge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                <p>{formatKg(process.total_input_kg)} de entrada</p>
                <p>{[process.process_type, process.process_location].filter(Boolean).join(" - ") || "Sin ubicacion"}</p>
                <p>{process.output_lot_code || "Sin lote final"}</p>
              </div>
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
                          {output.output_lot_code || "Sin lote"} - {output.profile_source === "purchase"
                            ? formatPurchaseCoffeeLabel({
                                name: output.purchase_coffee_name || output.coffee_variety,
                                family: output.commercial_classification,
                                process_type: output.coffee_type_name,
                              })
                            : formatProfileLabel(output)}
                        </p>
                        <p className="text-slate-600">
                          {output.presentation || "Excelso"} · {formatKg(output.output_weight_kg)}
                          {output.humidity_percent !== null && output.humidity_percent !== undefined ? ` · Humedad ${output.humidity_percent}%` : ""}
                          {output.performance_factor !== null && output.performance_factor !== undefined ? ` · Factor ${output.performance_factor}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {["admin", "warehouse", "laboratory"].includes(user?.role) && process.status === "pendiente" && (
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
              {["admin", "warehouse", "laboratory"].includes(user?.role) && process.status === "en_proceso" && (
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
              {["admin", "warehouse", "laboratory"].includes(user?.role) && process.status === "pendiente_revision_fisica" && (
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
                            ? "Registre si el regreso queda como lote o proceso, y si corresponde a cafe de compra o cafe de venta. Se creara un registro nuevo en inventario."
                            : "Divida el cafe recibido por perfil comercial, peso y humedad."}
                      </p>
                    </div>
                    <button
                      className="inline-flex items-center gap-1 rounded border border-leaf bg-white px-3 py-2 text-xs font-semibold text-leaf hover:bg-emerald-50"
                      type="button"
                      onClick={() => addPhysicalOutput(process)}
                    >
                      <Plus size={14} />
                      Agregar salida
                    </button>
                  </div>
                  {physicalReviewForm.outputs.map((output, index) => (
                    <div key={`process-output-${index}`} className="rounded border border-emerald-200 bg-white p-3">
                      {createsInventoryDirectly(process) && (
                        <div className="mb-3 grid gap-2 rounded border border-amber-200 bg-amber-50 p-3 sm:grid-cols-3">
                          <label className="text-xs font-medium uppercase text-amber-900">
                            Codigo que se asignara
                            <div className="mt-1 rounded border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-ink">
                              {getOutputCodePreview(physicalReviewForm.outputs, output, index)}
                            </div>
                          </label>
                          <label className="text-xs font-medium uppercase text-amber-900">
                            Tipo de registro
                            <select
                              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm normal-case text-ink"
                              value={output.lotKind}
                              onChange={(event) => updatePhysicalOutput(index, "lotKind", event.target.value)}
                            >
                              <option value="LOT">Lote</option>
                              <option value="PROC">Proceso</option>
                            </select>
                          </label>
                          <label className="text-xs font-medium uppercase text-amber-900">
                            Cafe
                            <select
                              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm normal-case text-ink"
                              value={output.profileSource}
                              onChange={(event) => updatePhysicalOutput(index, "profileSource", event.target.value)}
                            >
                              <option value="purchase">Cafe de compra</option>
                              <option value="sale">Cafe de venta</option>
                            </select>
                          </label>
                        </div>
                      )}
                      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
                        {createsInventoryDirectly(process) && output.profileSource === "purchase" ? (
                          <select
                            className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                            value={output.purchaseCoffeeId}
                            onChange={(event) => updatePhysicalOutput(index, "purchaseCoffeeId", event.target.value)}
                          >
                            <option value="">Cafe de compra</option>
                            {catalogs?.purchaseCoffees?.map((coffee) => (
                              <option key={coffee.id} value={coffee.id}>
                                {formatPurchaseCoffeeLabel(coffee)}
                              </option>
                            ))}
                          </select>
                        ) : (
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
                        )}
                        <select
                          className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                          value={output.presentation}
                          onChange={(event) => updatePhysicalOutput(index, "presentation", event.target.value)}
                        >
                          {catalogs?.coffeePresentations?.map((presentation) => (
                            <option key={presentation.id} value={presentation.name}>
                              {presentation.name}
                            </option>
                          ))}
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
                          {formatKg(input.quantity_kg)} - {input.input_percentage}%
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
      </div>
    </section>
  );
};

export default ProcessesPage;
