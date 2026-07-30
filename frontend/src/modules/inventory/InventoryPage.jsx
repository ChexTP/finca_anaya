import { RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatCoffeeLotCodeName, getCoffeeLotGroup, groupCoffeeLots } from "../../utils/coffeeLots";
import { lotStatusLabels } from "../../utils/workflow";

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

const formatKg = (value) => `${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg`;

const InventoryPage = () => {
  const { user } = useAuth();
  const [lots, setLots] = useState([]);
  const [allLots, setAllLots] = useState([]);
  const [sampleOutputs, setSampleOutputs] = useState([]);
  const [pendingLiquidationLots, setPendingLiquidationLots] = useState([]);
  const [unpaidLots, setUnpaidLots] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedLiquidationLot, setSelectedLiquidationLot] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(initialPurchase);
  const [liquidationForm, setLiquidationForm] = useState(initialLiquidation);
  const [selectedPresentation, setSelectedPresentation] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [lotCodeSearch, setLotCodeSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canRegisterPurchase = ["admin", "accounting"].includes(user?.role);
  const canAdjustInventory = ["admin", "accounting", "warehouse"].includes(user?.role);
  const canEditCodes = user?.role === "admin";

  const loadData = async () => {
    const requests = [
      apiRequest("/inventory/lots"),
      apiRequest("/lots"),
      canAdjustInventory ? apiRequest("/inventory/sample-outputs") : Promise.resolve([]),
    ];

    if (canRegisterPurchase) {
      requests.push(apiRequest("/catalogs"));
    }

    const [availableData, allLots, sampleOutputData, catalogData] = await Promise.all(requests);
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

  const purchaseTotal = selectedLot && purchaseForm.purchasePricePerKg
    ? Number(Number(selectedLot.net_weight_kg) * Number(purchaseForm.purchasePricePerKg)).toLocaleString("es-CO")
    : "0";
  const liquidationTotal = selectedLiquidationLot && liquidationForm.purchasePricePerKg
    ? Number(Number(selectedLiquidationLot.net_weight_kg) * Number(liquidationForm.purchasePricePerKg)).toLocaleString("es-CO")
    : "0";

  const presentationOptions = ["Pergamino", "Excelso"].map((presentation) => {
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

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Inventario</h1>
          <p className="text-sm text-slate-500">Lotes disponibles, pendientes de compra y control por antiguedad.</p>
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

      {canEditCodes && (
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Buscar y editar codigos de lotes</h2>
            <p className="mt-1 text-xs text-slate-500">Uso administrativo para igualar los codigos del sistema con talonarios o registros fisicos.</p>
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
                        <button
                          className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-60"
                          type="button"
                          disabled={saving}
                          onClick={() => editLotCode(lot)}
                        >
                          Editar codigo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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
                      <th className="px-3 py-2">Peso</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingLiquidationLots.map((lot) => (
                      <tr key={lot.id}>
                        <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(lot)}</td>
                        <td className="px-3 py-2">{lot.supplier_name || "-"}</td>
                        <td className="px-3 py-2">{formatKg(lot.net_weight_kg)}</td>
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
                        <td className="px-3 py-2">{formatKg(lot.net_weight_kg)}</td>
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
                      <p className="font-semibold text-ink">{formatCoffeeLotCodeName(lot)}</p>
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

                  {canAdjustInventory && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["admin", "warehouse"].includes(user?.role) && (
                        <button
                          className="rounded border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                          type="button"
                          onClick={() => registerSampleOutput(lot)}
                          disabled={saving}
                        >
                          Sacar muestra
                        </button>
                      )}
                      <button
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        type="button"
                        onClick={() => adjustInventory(lot)}
                        disabled={saving}
                      >
                        Ajustar
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
    </section>
  );
};

export default InventoryPage;
