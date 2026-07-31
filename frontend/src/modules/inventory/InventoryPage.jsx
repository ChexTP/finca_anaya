import { RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotCodeName, getCoffeeLotGroup, groupCoffeeLots } from "../../utils/coffeeLots";
import { lotStatusLabels, processStatusLabels } from "../../utils/workflow";

const initialPurchase = {
  purchasePricePerKg: "",
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
};

const initialLiquidation = {
  purchasePricePerKg: "",
  notes: "",
};

const initialAdminLotEdit = {
  code: "",
  supplierId: "",
  coffeeTypeId: "",
  coffeeProfileId: "",
  presentation: "Pergamino",
  lotKind: "LOT",
  commercialClassification: "",
  coffeeVariety: "",
  grossWeightKg: "",
  netWeightKg: "",
  availableWeightKg: "",
  humidityPercent: "",
  performanceFactor: "",
  aroma: "",
  flavor: "",
  sweetness: "",
  body: "",
  residual: "",
  cleanCup: "",
  score: "",
  labNotes: "",
  receivedAt: new Date().toISOString().slice(0, 10),
  originZone: "",
  initialComment: "",
  changeNote: "",
};

const initialAdminProcessEdit = {
  code: "",
  status: "pendiente",
  processType: "Otro proceso",
  processLocation: "",
  estimatedReturnDate: "",
  totalInputKg: "",
  outputWeightKg: "",
  physicalHumidityPercent: "",
  physicalPerformanceFactor: "",
  changeNote: "",
};

const formatKg = (value) => `${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg`;
const formatOptionalKg = (value) => (value === null || value === undefined || value === "" ? "-" : formatKg(value));

const InventoryPage = ({ mode = "inventory" }) => {
  const { user } = useAuth();
  const [lots, setLots] = useState([]);
  const [allLots, setAllLots] = useState([]);
  const [sampleOutputs, setSampleOutputs] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [pendingLiquidationLots, setPendingLiquidationLots] = useState([]);
  const [unpaidLots, setUnpaidLots] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedLiquidationLot, setSelectedLiquidationLot] = useState(null);
  const [selectedAdminLot, setSelectedAdminLot] = useState(null);
  const [selectedAdminProcess, setSelectedAdminProcess] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(initialPurchase);
  const [liquidationForm, setLiquidationForm] = useState(initialLiquidation);
  const [adminLotForm, setAdminLotForm] = useState(initialAdminLotEdit);
  const [adminProcessForm, setAdminProcessForm] = useState(initialAdminProcessEdit);
  const [selectedPresentation, setSelectedPresentation] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [lotCodeSearch, setLotCodeSearch] = useState("");
  const [processCodeSearch, setProcessCodeSearch] = useState("");
  const [showInventoryEditModal, setShowInventoryEditModal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canRegisterPurchase = ["admin", "accounting"].includes(user?.role);
  const canAdjustInventory = ["admin", "accounting", "warehouse"].includes(user?.role);
  const canEditCodes = ["admin", "accounting", "warehouse"].includes(user?.role);
  const isEditMode = mode === "edit";

  const loadData = async () => {
    const requests = [
      apiRequest("/inventory/lots"),
      apiRequest("/lots"),
      canAdjustInventory ? apiRequest("/inventory/sample-outputs") : Promise.resolve([]),
    ];

    if (canRegisterPurchase || canEditCodes) {
      requests.push(apiRequest("/catalogs"));
    } else {
      requests.push(Promise.resolve(null));
    }

    if (canEditCodes) {
      requests.push(apiRequest("/suppliers"));
    } else {
      requests.push(Promise.resolve([]));
    }

    if (canEditCodes) {
      requests.push(apiRequest("/processes"));
    } else {
      requests.push(Promise.resolve([]));
    }

    const [availableData, allLots, sampleOutputData, catalogData, supplierData, processData] = await Promise.all(requests);
    setLots(availableData);
    setAllLots(allLots);
    setSampleOutputs(sampleOutputData || []);
    setPendingLiquidationLots(
      allLots.filter((lot) => lot.status === "pendiente_liquidacion")
    );
    setUnpaidLots(
      allLots.filter(
        (lot) =>
          lot.lab_reviewed_at &&
          !lot.purchase_paid &&
          !["pendiente_laboratorio", "pendiente_liquidacion", "rechazado", "retirado"].includes(lot.status)
      )
    );
    setCatalogs(catalogData || null);
    setSuppliers(
      [...(supplierData || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"))
    );
    setProcesses(processData || []);
  };

  const selectLiquidationLot = (lot) => {
    setSelectedLiquidationLot(lot);
    setLiquidationForm({
      purchasePricePerKg: lot.purchase_price_per_kg || "",
      notes: "",
    });
    setMessage("");
    setError("");
  };

  const liquidateSelectedLot = async (event) => {
    event.preventDefault();

    if (!selectedLiquidationLot) {
      setError("Seleccione un lote pendiente de liquidacion.");
      return;
    }

    if (!window.confirm(`Confirma liquidar ${formatCoffeeLotCodeName(selectedLiquidationLot)} y dejarlo disponible para uso?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${selectedLiquidationLot.id}/liquidate`, {
        method: "PUT",
        body: JSON.stringify({
          purchasePricePerKg: liquidationForm.purchasePricePerKg === "" ? null : Number(liquidationForm.purchasePricePerKg),
          notes: liquidationForm.notes,
        }),
      });
      setSelectedLiquidationLot(null);
      setLiquidationForm(initialLiquidation);
      await loadData();
      setMessage("Lote liquidado. Ya queda disponible para asignar, procesar o vender.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const selectApprovedLot = (lot) => {
    setSelectedLot(lot);
    setPurchaseForm(initialPurchase);
    setMessage("");
    setError("");
  };

  const registerPurchase = async (event) => {
    event.preventDefault();

    if (!selectedLot) {
      setError("Seleccione un lote pendiente de pago.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${selectedLot.id}/purchase`, {
        method: "PUT",
        body: JSON.stringify({
          purchasePricePerKg: Number(purchaseForm.purchasePricePerKg),
          paymentMethodId: Number(purchaseForm.paymentMethodId),
          paymentReference: purchaseForm.paymentReference,
          paidAt: purchaseForm.paidAt,
        }),
      });
      setSelectedLot(null);
      setPurchaseForm(initialPurchase);
      await loadData();
      setMessage("Pago registrado sin modificar la disponibilidad del lote.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const adjustInventory = async (lot) => {
    const action = window.prompt(`Ajuste para ${formatCoffeeLotCodeName(lot)}: escriba + para sumar o - para restar`, "-");
    if (!["+", "-"].includes(action)) return;

    const quantity = window.prompt("Cantidad kg", "");
    if (!quantity) return;

    const reason = window.prompt("Razon del ajuste", action === "-" ? "Salida especial de inventario" : "Ingreso adicional de inventario");
    if (!reason) return;

    if (!window.confirm(`Confirma ajustar ${formatCoffeeLotCodeName(lot)} en ${action}${quantity} kg?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/inventory/lots/${lot.id}/adjustments`, {
        method: "POST",
        body: JSON.stringify({
          adjustmentType: action === "+" ? "increase" : "decrease",
          quantityKg: Number(quantity),
          reason,
        }),
      });
      await loadData();
      setMessage("Ajuste de inventario registrado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const registerSampleOutput = async (lot) => {
    const quantity = window.prompt(`Cantidad kg que sale a muestras desde ${formatCoffeeLotCodeName(lot)}`, "");
    if (!quantity) return;

    const sampleReference = window.prompt("Referencia de muestra o cliente", "Muestras");
    if (sampleReference === null) return;

    const notes = window.prompt("Observacion opcional", "");
    if (notes === null) return;

    if (!window.confirm(`Confirma sacar ${quantity} kg de ${formatCoffeeLotCodeName(lot)} para muestras?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/inventory/lots/${lot.id}/sample-output`, {
        method: "POST",
        body: JSON.stringify({
          quantityKg: Number(quantity),
          sampleReference,
          notes,
        }),
      });
      await loadData();
      setMessage("Salida a muestras registrada y descontada del inventario.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const editLotCode = async (lot) => {
    const newCode = window.prompt(`Nuevo codigo para ${formatCoffeeLotCodeName(lot)}`, lot.code || "");
    if (newCode === null) return;

    const cleanCode = newCode.trim();
    if (!cleanCode) {
      setError("El codigo del lote es obligatorio.");
      return;
    }

    if (!window.confirm(`Confirma cambiar el codigo ${lot.code} por ${cleanCode}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${lot.id}/code`, {
        method: "PUT",
        body: JSON.stringify({ code: cleanCode }),
      });
      await loadData();
      setMessage("Codigo de lote actualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const selectAdminLot = (lot) => {
    setSelectedAdminLot(lot);
    setAdminLotForm({
      code: lot.code || "",
      supplierId: lot.supplier_id ? String(lot.supplier_id) : "",
      coffeeTypeId: lot.coffee_type_id ? String(lot.coffee_type_id) : "",
      coffeeProfileId: lot.coffee_profile_id ? String(lot.coffee_profile_id) : "",
      presentation: lot.presentation || "Pergamino",
      lotKind: lot.lot_kind || "LOT",
      commercialClassification: lot.commercial_classification || "",
      coffeeVariety: lot.coffee_variety || "",
      grossWeightKg: lot.gross_weight_kg ?? "",
      netWeightKg: lot.net_weight_kg ?? "",
      availableWeightKg: lot.available_weight_kg ?? "",
      humidityPercent: lot.humidity_percent ?? "",
      performanceFactor: lot.performance_factor ?? "",
      aroma: lot.lab_aroma || "",
      flavor: lot.lab_flavor || "",
      sweetness: lot.lab_sweetness || "",
      body: lot.lab_body || "",
      residual: lot.lab_residual || "",
      cleanCup: lot.lab_clean_cup || "",
      score: lot.lab_score ?? "",
      labNotes: lot.lab_notes || "",
      receivedAt: lot.received_at ? String(lot.received_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
      originZone: lot.origin_zone || "",
      initialComment: lot.initial_comment || "",
      changeNote: "Correccion administrativa desde inventario",
    });
    setMessage("");
    setError("");
  };

  const openInventoryEditModal = (lot) => {
    selectAdminLot(lot);
    setShowInventoryEditModal(true);
  };

  const cancelAdminLotEdit = () => {
    setSelectedAdminLot(null);
    setAdminLotForm(initialAdminLotEdit);
    setShowInventoryEditModal(false);
    setMessage("");
    setError("");
  };

  const saveAdminLotData = async (event) => {
    event.preventDefault();

    if (!selectedAdminLot) {
      setError("Seleccione un lote para editar.");
      return;
    }

    if (!adminLotForm.changeNote.trim()) {
      setError("Escriba una nota para dejar trazabilidad de la correccion.");
      return;
    }

    if (!window.confirm(`Confirma guardar cambios administrativos en ${formatCoffeeLotCodeName(selectedAdminLot)}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const cleanCode = adminLotForm.code.trim();

      if (cleanCode && cleanCode !== selectedAdminLot.code) {
        await apiRequest(`/lots/${selectedAdminLot.id}/code`, {
          method: "PUT",
          body: JSON.stringify({ code: cleanCode }),
        });
      }

      await apiRequest(`/lots/${selectedAdminLot.id}/admin-data`, {
        method: "PUT",
        body: JSON.stringify({
          supplierId: adminLotForm.supplierId ? Number(adminLotForm.supplierId) : null,
          coffeeTypeId: adminLotForm.coffeeTypeId ? Number(adminLotForm.coffeeTypeId) : null,
          coffeeProfileId: adminLotForm.coffeeProfileId ? Number(adminLotForm.coffeeProfileId) : null,
          presentation: adminLotForm.presentation,
          lotKind: adminLotForm.lotKind,
          commercialClassification: adminLotForm.commercialClassification || null,
          coffeeVariety: adminLotForm.coffeeVariety || null,
          grossWeightKg: Number(adminLotForm.grossWeightKg),
          netWeightKg: Number(adminLotForm.netWeightKg),
          availableWeightKg: Number(adminLotForm.availableWeightKg),
          humidityPercent: adminLotForm.humidityPercent === "" ? null : Number(adminLotForm.humidityPercent),
          performanceFactor: adminLotForm.performanceFactor === "" ? null : Number(adminLotForm.performanceFactor),
          aroma: adminLotForm.aroma,
          flavor: adminLotForm.flavor,
          sweetness: adminLotForm.sweetness,
          body: adminLotForm.body,
          residual: adminLotForm.residual,
          cleanCup: adminLotForm.cleanCup,
          score: adminLotForm.score === "" ? null : Number(adminLotForm.score),
          labNotes: adminLotForm.labNotes,
          receivedAt: adminLotForm.receivedAt,
          originZone: adminLotForm.originZone,
          initialComment: adminLotForm.initialComment,
          changeNote: adminLotForm.changeNote,
        }),
      });

      cancelAdminLotEdit();
      await loadData();
      setMessage("Datos del lote actualizados correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const selectAdminProcess = (process) => {
    setSelectedAdminProcess(process);
    setAdminProcessForm({
      code: process.code || "",
      status: process.status || "pendiente",
      processType: process.process_type || "Otro proceso",
      processLocation: process.process_location || "",
      estimatedReturnDate: process.estimated_return_date ? String(process.estimated_return_date).slice(0, 10) : "",
      totalInputKg: process.total_input_kg ?? "",
      outputWeightKg: process.output_weight_kg ?? "",
      physicalHumidityPercent: process.physical_humidity_percent ?? "",
      physicalPerformanceFactor: process.physical_performance_factor ?? "",
      changeNote: "Correccion administrativa desde inventario",
    });
    setMessage("");
    setError("");
  };

  const cancelAdminProcessEdit = () => {
    setSelectedAdminProcess(null);
    setAdminProcessForm(initialAdminProcessEdit);
    setMessage("");
    setError("");
  };

  const saveAdminProcessData = async (event) => {
    event.preventDefault();

    if (!selectedAdminProcess) {
      setError("Seleccione un proceso para editar.");
      return;
    }

    if (!adminProcessForm.changeNote.trim()) {
      setError("Escriba una nota para dejar trazabilidad de la correccion.");
      return;
    }

    if (!window.confirm(`Confirma guardar cambios administrativos en ${selectedAdminProcess.code}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/processes/${selectedAdminProcess.id}/admin-data`, {
        method: "PUT",
        body: JSON.stringify({
          code: adminProcessForm.code.trim(),
          status: adminProcessForm.status,
          processType: adminProcessForm.processType,
          processLocation: adminProcessForm.processLocation,
          estimatedReturnDate: adminProcessForm.estimatedReturnDate || null,
          totalInputKg: adminProcessForm.totalInputKg === "" ? null : Number(adminProcessForm.totalInputKg),
          outputWeightKg: adminProcessForm.outputWeightKg === "" ? null : Number(adminProcessForm.outputWeightKg),
          physicalHumidityPercent: adminProcessForm.physicalHumidityPercent === "" ? null : Number(adminProcessForm.physicalHumidityPercent),
          physicalPerformanceFactor: adminProcessForm.physicalPerformanceFactor === "" ? null : Number(adminProcessForm.physicalPerformanceFactor),
          changeNote: adminProcessForm.changeNote,
        }),
      });

      cancelAdminProcessEdit();
      await loadData();
      setMessage("Datos del proceso actualizados correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const purchaseTotal = selectedLot && purchaseForm.purchasePricePerKg
    ? Number(Number(selectedLot.net_weight_kg) * Number(purchaseForm.purchasePricePerKg)).toLocaleString("es-CO")
    : "0";
  const liquidationTotal = selectedLiquidationLot && liquidationForm.purchasePricePerKg
    ? Number(Number(selectedLiquidationLot.net_weight_kg) * Number(liquidationForm.purchasePricePerKg)).toLocaleString("es-CO")
    : "0";

  const presentationNames = [
    ...new Set([
      ...(catalogs?.coffeePresentations || []).map((presentation) => presentation.name),
      ...lots.map((lot) => lot.presentation || "Pergamino"),
    ].filter(Boolean)),
  ];
  const presentationOptions = presentationNames.map((presentation) => {
    const presentationLots = lots.filter((lot) => (lot.presentation || "Pergamino") === presentation);
    return {
      presentation,
      count: presentationLots.length,
      kg: presentationLots.reduce((total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0), 0),
    };
  });
  const presentationFilteredLots = selectedPresentation === "all"
    ? lots
    : lots.filter((lot) => (lot.presentation || "Pergamino") === selectedPresentation);
  const inventoryGroups = groupCoffeeLots(
    presentationFilteredLots.map((lot) => ({
      ...lot,
      available_weight_kg: lot.operational_available_kg ?? lot.available_weight_kg,
    }))
  );
  const groupCards = Object.values(inventoryGroups).sort((left, right) => left.name.localeCompare(right.name));
  const filteredLots = selectedGroup === "all"
    ? presentationFilteredLots
    : presentationFilteredLots.filter((lot) => getCoffeeLotGroup(lot) === selectedGroup);
  const totalAvailableKg = presentationFilteredLots.reduce((total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0), 0);
  const allAvailableKg = lots.reduce((total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0), 0);
  const getLotOriginLabel = (lot) => {
    if (!lot.origin_process_type) return null;

    if (lot.origin_process_type === "Trilladora") return `Llego de trilla ${lot.origin_process_code || ""}`.trim();
    if (lot.origin_process_type === "Seleccion electronica") return `Llego de seleccionadora ${lot.origin_process_code || ""}`.trim();

    return `Llego de proceso ${lot.origin_process_code || ""}`.trim();
  };
  const lotCodeSearchTerm = lotCodeSearch.trim().toLowerCase();
  const lotCodeSearchResults = allLots
    .filter((lot) => {
      if (!lotCodeSearchTerm) return true;

      return [
        lot.code,
        formatCoffeeLotCodeName(lot),
        lot.supplier_name,
        lot.status,
        lot.presentation,
        lot.coffee_type_name,
        lot.commercial_classification,
        lot.coffee_variety,
        lot.coffee_profile_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(lotCodeSearchTerm);
    })
    .slice(0, 50);
  const processCodeSearchTerm = processCodeSearch.trim().toLowerCase();
  const processSearchResults = processes
    .filter((process) => {
      if (!processCodeSearchTerm) return true;

      return [
        process.code,
        process.status,
        process.process_type,
        process.process_location,
        process.sale_code,
        process.sale_client_name,
        process.quote_code,
        process.quote_client_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(processCodeSearchTerm);
    })
    .slice(0, 50);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">{isEditMode ? "Editar inventario" : "Inventario"}</h1>
          <p className="text-sm text-slate-500">
            {isEditMode
              ? "Busqueda y correccion de lotes, procesos, codigos, pesos y datos de laboratorio."
              : "Lotes disponibles, pendientes de compra y control por antiguedad."}
          </p>
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

      {canEditCodes && isEditMode && (
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Buscar y editar lotes</h2>
            <p className="mt-1 text-xs text-slate-500">Uso administrativo para corregir codigos, datos del cafe, pesos y laboratorio.</p>
            <input
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Buscar por codigo, cafe, proveedor, estado o presentacion"
              value={lotCodeSearch}
              onChange={(event) => setLotCodeSearch(event.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-auto">
            {allLots.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin lotes registrados" message="Cuando se registren lotes podras buscarlos y ajustar su codigo aqui." />
              </div>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Cafe</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Peso</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lotCodeSearchResults.map((lot) => (
                    <tr key={lot.id}>
                      <td className="px-3 py-2 font-semibold text-ink">{lot.code}</td>
                      <td className="px-3 py-2 text-slate-700">{formatCoffeeLotCodeName(lot)}</td>
                      <td className="px-3 py-2">{lotStatusLabels[lot.status] || lot.status}</td>
                      <td className="px-3 py-2">{formatKg(lot.available_weight_kg ?? lot.net_weight_kg)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-60"
                            type="button"
                            disabled={saving}
                            onClick={() => selectAdminLot(lot)}
                          >
                            Editar datos
                          </button>
                        <button
                          className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          type="button"
                          disabled={saving}
                          onClick={() => editLotCode(lot)}
                        >
                          Editar codigo
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {selectedAdminLot && (
            <form className="border-t border-slate-200 p-4" onSubmit={saveAdminLotData}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Editar {formatCoffeeLotCodeName(selectedAdminLot)}</h3>
                  <p className="mt-1 text-xs text-amber-700">
                    Correccion administrativa. Revise bien antes de guardar porque cambia datos visibles del inventario.
                  </p>
                </div>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={cancelAdminLotEdit}
                >
                  Cancelar
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                  placeholder="Codigo"
                  value={adminLotForm.code}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, code: event.target.value })}
                  required
                />
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={adminLotForm.supplierId}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, supplierId: event.target.value })}
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={adminLotForm.presentation}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, presentation: event.target.value })}
                >
                  {catalogs?.coffeePresentations?.map((presentation) => (
                    <option key={presentation.id} value={presentation.name}>
                      {presentation.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={adminLotForm.lotKind}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, lotKind: event.target.value })}
                >
                  <option value="LOT">Lote normal</option>
                  <option value="PROC">Proceso listo</option>
                  <option value="PASILLA">Pasilla</option>
                  <option value="RECUPERACION">Recuperacion</option>
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={adminLotForm.coffeeTypeId}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, coffeeTypeId: event.target.value })}
                >
                  <option value="">Tipo / proceso</option>
                  {catalogs?.coffeeTypes?.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={adminLotForm.coffeeProfileId}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, coffeeProfileId: event.target.value })}
                >
                  <option value="">Perfil comercial si aplica</option>
                  {catalogs?.coffeeProfiles?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={adminLotForm.commercialClassification}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, commercialClassification: event.target.value })}
                >
                  <option value="">Categoria</option>
                  <option value="Base">Base</option>
                  <option value="Regional">Regional</option>
                  <option value="Varietal">Varietal</option>
                  <option value="Exotico">Exotico</option>
                  <option value="Procesado">Procesado</option>
                  <option value="Pasilla">Pasilla</option>
                  <option value="Recuperacion">Recuperacion</option>
                </select>
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Clasificacion / nombre exacto"
                  value={adminLotForm.coffeeVariety}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, coffeeVariety: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Peso bruto kg"
                  type="number"
                  step="0.001"
                  value={adminLotForm.grossWeightKg}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, grossWeightKg: event.target.value })}
                  required
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Peso neto kg"
                  type="number"
                  step="0.001"
                  value={adminLotForm.netWeightKg}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, netWeightKg: event.target.value })}
                  required
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Disponible fisico kg"
                  type="number"
                  step="0.001"
                  value={adminLotForm.availableWeightKg}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, availableWeightKg: event.target.value })}
                  required
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Fecha llegada"
                  type="date"
                  value={adminLotForm.receivedAt}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, receivedAt: event.target.value })}
                  required
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Humedad %"
                  type="number"
                  step="0.01"
                  value={adminLotForm.humidityPercent}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, humidityPercent: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Factor rendimiento"
                  type="number"
                  step="0.01"
                  value={adminLotForm.performanceFactor}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, performanceFactor: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Score"
                  type="number"
                  step="0.01"
                  value={adminLotForm.score}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, score: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Zona procedencia"
                  value={adminLotForm.originZone}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, originZone: event.target.value })}
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["aroma", "Aroma"],
                  ["flavor", "Sabor"],
                  ["sweetness", "Dulzor"],
                  ["body", "Cuerpo"],
                  ["residual", "Residual"],
                  ["cleanCup", "Taza limpia"],
                ].map(([field, label]) => (
                  <input
                    key={field}
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder={label}
                    value={adminLotForm[field]}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, [field]: event.target.value })}
                  />
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <textarea
                  className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Notas de laboratorio"
                  value={adminLotForm.labNotes}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, labNotes: event.target.value })}
                />
                <textarea
                  className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Comentario interno del lote"
                  value={adminLotForm.initialComment}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, initialComment: event.target.value })}
                />
                <textarea
                  className="min-h-20 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
                  placeholder="Nota obligatoria de correccion"
                  value={adminLotForm.changeNote}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, changeNote: event.target.value })}
                  required
                />
              </div>

              <button
                className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving}
              >
                <Save size={16} />
                Guardar datos del lote
              </button>
            </form>
          )}

          <div className="border-t border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Buscar y editar procesos</h2>
            <p className="mt-1 text-xs text-slate-500">Uso administrativo para corregir codigo, estado, ubicacion, pesos y datos fisicos del proceso.</p>
            <input
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Buscar por codigo, venta, cliente, estado o ubicacion"
              value={processCodeSearch}
              onChange={(event) => setProcessCodeSearch(event.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-auto border-t border-slate-100">
            {processes.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin procesos registrados" message="Cuando existan procesos podras corregir sus datos aqui." />
              </div>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Venta</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Entrada</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processSearchResults.map((process) => (
                    <tr key={process.id}>
                      <td className="px-3 py-2 font-semibold text-ink">{process.code}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {process.sale_code ? `${process.sale_code} - ${process.sale_client_name || "Cliente"}` : "Sin venta asociada"}
                      </td>
                      <td className="px-3 py-2">{processStatusLabels[process.status] || process.status}</td>
                      <td className="px-3 py-2">{formatKg(process.total_input_kg)}</td>
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-60"
                          type="button"
                          disabled={saving}
                          onClick={() => selectAdminProcess(process)}
                        >
                          Editar proceso
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedAdminProcess && (
            <form className="border-t border-slate-200 p-4" onSubmit={saveAdminProcessData}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Editar proceso {selectedAdminProcess.code}</h3>
                  <p className="mt-1 text-xs text-amber-700">
                    Correccion administrativa. Esto cambia datos visibles del proceso, no recalcula inventario reservado automaticamente.
                  </p>
                </div>
                <button
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={cancelAdminProcessEdit}
                >
                  Cancelar
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                  placeholder="Codigo"
                  value={adminProcessForm.code}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, code: event.target.value })}
                  required
                />
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={adminProcessForm.status}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, status: event.target.value })}
                >
                  {Object.entries(processStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Tipo de proceso"
                  value={adminProcessForm.processType}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, processType: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ubicacion / encargado externo"
                  value={adminProcessForm.processLocation}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, processLocation: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Regreso estimado"
                  type="date"
                  value={adminProcessForm.estimatedReturnDate}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, estimatedReturnDate: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Entrada kg"
                  type="number"
                  step="0.001"
                  value={adminProcessForm.totalInputKg}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, totalInputKg: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Salida kg"
                  type="number"
                  step="0.001"
                  value={adminProcessForm.outputWeightKg}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, outputWeightKg: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Humedad fisica %"
                  type="number"
                  step="0.01"
                  value={adminProcessForm.physicalHumidityPercent}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, physicalHumidityPercent: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Factor fisico"
                  type="number"
                  step="0.01"
                  value={adminProcessForm.physicalPerformanceFactor}
                  onChange={(event) => setAdminProcessForm({ ...adminProcessForm, physicalPerformanceFactor: event.target.value })}
                />
              </div>

              <textarea
                className="mt-3 min-h-20 w-full rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
                placeholder="Nota obligatoria de correccion"
                value={adminProcessForm.changeNote}
                onChange={(event) => setAdminProcessForm({ ...adminProcessForm, changeNote: event.target.value })}
                required
              />

              <button
                className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving}
              >
                <Save size={16} />
                Guardar datos del proceso
              </button>
            </form>
          )}
        </div>
      )}

      {!isEditMode && (
        <>
      {canRegisterPurchase && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="min-w-0 rounded border border-amber-200 bg-white">
            <div className="border-b border-amber-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-amber-900">Lotes pendientes de liquidacion</h2>
              <p className="mt-1 text-xs text-slate-500">Aprobados por laboratorio, pero aun no disponibles hasta acordar la compra.</p>
            </div>
            {pendingLiquidationLots.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin liquidaciones pendientes" message="Los lotes aprobados que falten por negociar apareceran aqui." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-amber-50 text-amber-900">
                    <tr>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2">Peso bruto</th>
                      <th className="px-3 py-2">Peso neto</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingLiquidationLots.map((lot) => (
                      <tr key={lot.id}>
                        <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(lot)}</td>
                        <td className="px-3 py-2">{lot.supplier_name || "-"}</td>
                        <td className="px-3 py-2">{formatOptionalKg(lot.gross_weight_kg)}</td>
                        <td className="px-3 py-2">{formatOptionalKg(lot.net_weight_kg)}</td>
                        <td className="px-3 py-2">
                          <button
                            className="rounded border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                            type="button"
                            onClick={() => selectLiquidationLot(lot)}
                          >
                            Liquidar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form className="min-w-0 overflow-hidden rounded border border-amber-200 bg-white p-4" onSubmit={liquidateSelectedLot}>
            <h2 className="text-sm font-semibold text-amber-900">Liquidacion de lote</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedLiquidationLot ? `Lote seleccionado: ${formatCoffeeLotCodeName(selectedLiquidationLot)}` : "Seleccione un lote pendiente de liquidacion."}
            </p>
            <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Liquidar significa que la compra ya fue aceptada por ambas partes. Desde ese momento el cafe queda disponible, aunque el pago pueda quedar pendiente.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Precio pactado por kg opcional"
                type="number"
                step="0.01"
                value={liquidationForm.purchasePricePerKg}
                onChange={(event) => setLiquidationForm({ ...liquidationForm, purchasePricePerKg: event.target.value })}
              />
              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notas de liquidacion opcionales"
                value={liquidationForm.notes}
                onChange={(event) => setLiquidationForm({ ...liquidationForm, notes: event.target.value })}
              />
              <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Total pactado estimado: <span className="font-semibold text-ink">COP {liquidationTotal}</span>
              </div>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving || !selectedLiquidationLot}
              >
                <Save size={16} />
                Liquidar y liberar inventario
              </button>
            </div>
          </form>

          <div className="min-w-0 rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Lotes aprobados pendientes de pago</h2>
            </div>
            {unpaidLots.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin pagos pendientes" message="Los lotes aprobados que aun no se hayan pagado apareceran aqui." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2">Peso bruto</th>
                      <th className="px-3 py-2">Peso neto</th>
                      <th className="px-3 py-2">Clasificacion</th>
                      <th className="px-3 py-2">Factor</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unpaidLots.map((lot) => (
                      <tr key={lot.id}>
                        <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(lot)}</td>
                        <td className="px-3 py-2">{lot.supplier_name || "-"}</td>
                        <td className="px-3 py-2">{formatOptionalKg(lot.gross_weight_kg)}</td>
                        <td className="px-3 py-2">{formatOptionalKg(lot.net_weight_kg)}</td>
                        <td className="px-3 py-2">{lot.commercial_classification || "-"}</td>
                        <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                        <td className="px-3 py-2">{lot.lab_score || "-"}</td>
                        <td className="px-3 py-2">
                          <button
                            className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                            onClick={() => selectApprovedLot(lot)}
                          >
                            Registrar pago
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4" onSubmit={registerPurchase}>
            <h2 className="text-sm font-semibold text-slate-800">Pago de lote</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedLot ? `Lote seleccionado: ${formatCoffeeLotCodeName(selectedLot)}` : "Seleccione un lote pendiente de pago."}
            </p>
            <p className="mt-2 rounded bg-sky-50 px-3 py-2 text-xs text-sky-700">
              El lote liquidado ya esta disponible operativamente. Registrar el pago solo completa la informacion financiera.
            </p>

            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Precio por kg"
                type="number"
                step="0.01"
                value={purchaseForm.purchasePricePerKg}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, purchasePricePerKg: event.target.value })}
              />
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={purchaseForm.paymentMethodId}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, paymentMethodId: event.target.value })}
              >
                <option value="">Metodo de pago</option>
                {catalogs?.paymentMethods?.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Referencia de pago"
                value={purchaseForm.paymentReference}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, paymentReference: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={purchaseForm.paidAt}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, paidAt: event.target.value })}
              />
              <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Total estimado: <span className="font-semibold text-ink">COP {purchaseTotal}</span>
              </div>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving || !selectedLot}
              >
                <Save size={16} />
                Registrar pago
              </button>
            </div>
          </form>
        </div>
      )}

      {lots.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
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
              <span className="text-xs">{lots.length} lotes - {formatKg(allAvailableKg)}</span>
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
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Inventario disponible</h2>
        </div>
        {lots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin lotes disponibles" message="Cuando haya inventario disponible aparecera aqui." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLots.map((lot) => {
              const originLabel = getLotOriginLabel(lot);

              return (
                <article key={lot.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {formatCoffeeLotCodeName(lot)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">{lot.presentation || "Pergamino"}</span>
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{lot.coffee_type_name || "Sin tipo"}</span>
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{lot.commercial_classification || "Sin categoria"}</span>
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{lot.coffee_variety || lot.coffee_profile_name || "Sin clasificacion"}</span>
                        {originLabel && (
                          <span className="rounded bg-emerald-50 px-2 py-1 font-semibold text-leaf">{originLabel}</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge>{lotStatusLabels[lot.status] || lot.status}</StatusBadge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                    <div className="rounded border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">Peso bruto</p>
                      <p className="mt-1 font-bold text-ink">{formatOptionalKg(lot.gross_weight_kg)}</p>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">Peso neto</p>
                      <p className="mt-1 font-bold text-ink">{formatOptionalKg(lot.net_weight_kg)}</p>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">Fisico</p>
                      <p className="mt-1 font-bold text-ink">{formatKg(lot.available_weight_kg)}</p>
                    </div>
                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-amber-700">Reservado</p>
                      <p className="mt-1 font-bold text-amber-700">{formatKg(lot.reserved_kg)}</p>
                    </div>
                    <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-leaf">Libre operativo</p>
                      <p className="mt-1 font-bold text-leaf">{formatKg(lot.operational_available_kg ?? lot.available_weight_kg)}</p>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">Calidad</p>
                      <p className="mt-1 text-sm text-slate-700">Humedad {lot.humidity_percent || "-"}% · Factor {lot.performance_factor ?? "-"}</p>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">Llegada</p>
                      <p className="mt-1 text-sm text-slate-700">{lot.received_at ? new Date(lot.received_at).toLocaleDateString("es-CO") : "-"}</p>
                    </div>
                  </div>

                  {["admin", "warehouse"].includes(user?.role) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                        type="button"
                        onClick={() => registerSampleOutput(lot)}
                        disabled={saving}
                      >
                        Sacar muestra
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {canAdjustInventory && (
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Historico de cafe usado en muestras</h2>
            <p className="mt-1 text-xs text-slate-500">Salidas manuales descontadas desde bodega para preparacion de muestras.</p>
          </div>
          {sampleOutputs.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin salidas a muestras" message="Cuando bodega saque cafe para muestras, el registro aparecera aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Referencia / notas</th>
                    <th className="px-3 py-2">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sampleOutputs.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-3 py-2">{movement.created_at ? new Date(movement.created_at).toLocaleString("es-CO") : "-"}</td>
                      <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(movement)}</td>
                      <td className="px-3 py-2">{formatKg(movement.quantity_kg)}</td>
                      <td className="px-3 py-2">{movement.notes || "-"}</td>
                      <td className="px-3 py-2">{movement.created_by_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {showInventoryEditModal && selectedAdminLot && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
          <form
            className="my-6 w-full max-w-5xl rounded border border-slate-200 bg-white shadow-xl"
            onSubmit={saveAdminLotData}
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-ink">Ajustar datos de inventario</h2>
                <p className="text-sm text-slate-500">{formatCoffeeLotCodeName(selectedAdminLot)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={cancelAdminLotEdit}
                >
                  Cancelar
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                >
                  <Save size={16} />
                  Guardar cambios
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Edicion administrativa completa. Use este formulario para corregir datos cargados manualmente, codigos, pesos,
                clasificacion, proveedor y analisis de laboratorio.
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Codigo
                  <input
                    className="w-full rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold normal-case text-amber-900"
                    value={adminLotForm.code}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, code: event.target.value })}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Proveedor
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.supplierId}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, supplierId: event.target.value })}
                  >
                    <option value="">Sin proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Presentacion
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.presentation}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, presentation: event.target.value })}
                  >
                    {catalogs?.coffeePresentations?.map((presentation) => (
                      <option key={presentation.id} value={presentation.name}>
                        {presentation.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Tipo interno
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.lotKind}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, lotKind: event.target.value })}
                  >
                    <option value="LOT">Lote normal</option>
                    <option value="PROC">Proceso listo</option>
                    <option value="PASILLA">Pasilla</option>
                    <option value="RECUPERACION">Recuperacion</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Tipo / proceso
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.coffeeTypeId}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, coffeeTypeId: event.target.value })}
                  >
                    <option value="">Tipo / proceso</option>
                    {catalogs?.coffeeTypes?.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Perfil comercial
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.coffeeProfileId}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, coffeeProfileId: event.target.value })}
                  >
                    <option value="">Perfil comercial si aplica</option>
                    {catalogs?.coffeeProfiles?.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Categoria
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.commercialClassification}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, commercialClassification: event.target.value })}
                  >
                    <option value="">Categoria</option>
                    <option value="Base">Base</option>
                    <option value="Regional">Regional</option>
                    <option value="Varietal">Varietal</option>
                    <option value="Exotico">Exotico</option>
                    <option value="Procesado">Procesado</option>
                    <option value="Pasilla">Pasilla</option>
                    <option value="Recuperacion">Recuperacion</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Clasificacion exacta
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.coffeeVariety}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, coffeeVariety: event.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["grossWeightKg", "Peso bruto kg"],
                  ["netWeightKg", "Peso neto kg"],
                  ["availableWeightKg", "Disponible fisico kg"],
                  ["humidityPercent", "Humedad %"],
                  ["performanceFactor", "Factor rendimiento"],
                  ["score", "Score"],
                ].map(([field, label]) => (
                  <label key={field} className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                    {label}
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                      type="number"
                      step="0.001"
                      value={adminLotForm[field]}
                      onChange={(event) => setAdminLotForm({ ...adminLotForm, [field]: event.target.value })}
                      required={["grossWeightKg", "netWeightKg", "availableWeightKg"].includes(field)}
                    />
                  </label>
                ))}
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Fecha llegada
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    type="date"
                    value={adminLotForm.receivedAt}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, receivedAt: event.target.value })}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Zona procedencia
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.originZone}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, originZone: event.target.value })}
                  />
                </label>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Datos de laboratorio</h3>
                <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["aroma", "Aroma"],
                    ["flavor", "Sabor"],
                    ["sweetness", "Dulzor"],
                    ["body", "Cuerpo"],
                    ["residual", "Residual"],
                    ["cleanCup", "Taza limpia"],
                  ].map(([field, label]) => (
                    <input
                      key={field}
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder={label}
                      value={adminLotForm[field]}
                      onChange={(event) => setAdminLotForm({ ...adminLotForm, [field]: event.target.value })}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <textarea
                  className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Notas de laboratorio"
                  value={adminLotForm.labNotes}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, labNotes: event.target.value })}
                />
                <textarea
                  className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Comentario interno del lote"
                  value={adminLotForm.initialComment}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, initialComment: event.target.value })}
                />
                <textarea
                  className="min-h-20 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
                  placeholder="Nota obligatoria de correccion"
                  value={adminLotForm.changeNote}
                  onChange={(event) => setAdminLotForm({ ...adminLotForm, changeNote: event.target.value })}
                  required
                />
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default InventoryPage;
