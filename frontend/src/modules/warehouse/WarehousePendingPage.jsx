import { AlertTriangle, Eye, FlaskConical, ImagePlus, PackageCheck, Printer, RefreshCw, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { formatOperationalKg } from "../../utils/coffeeCalculations";
import { formatCoffeeLotCodeName, formatCoffeeLotOption, groupCoffeeLots } from "../../utils/coffeeLots";
import { readImageFileAsDataUrl } from "../../utils/files";
import {
  getSaleNextAction,
  getSaleStatusTone,
  getSaleTaskKey,
  isDeliveryDueSoon,
  saleStatusLabels,
} from "../../utils/workflow";
import {
  activeWarehouseStatuses,
  buildWarehouseOrderHtml,
  formatDate,
  formatInputLabel,
  getWarehouseItemComponentSummary,
  getWarehouseItemLabel,
} from "./WarehousePage";

const priorityOrder = {
  alta: 1,
  media: 2,
  baja: 3,
};

const taskFilters = [
  { key: "all", label: "Todo" },
  { key: "decision", label: "Por decidir" },
  { key: "process", label: "Procesos" },
  { key: "blend", label: "Ensamble" },
  { key: "lab", label: "Laboratorio" },
  { key: "prepare", label: "Alistar" },
  { key: "dispatch", label: "Despachar" },
];

const WarehousePendingPage = () => {
  const [sales, setSales] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [orderAssignee, setOrderAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [dispatchReceiptFile, setDispatchReceiptFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setDispatchReceiptFile(null);
  }, [selectedSale?.id]);

  const taskCounts = useMemo(() => {
    return sales.reduce(
      (counts, sale) => {
        const key = getSaleTaskKey(sale);
        return {
          ...counts,
          all: counts.all + 1,
          [key]: (counts[key] || 0) + 1,
        };
      },
      { all: 0 }
    );
  }, [sales]);

  const sortedSales = useMemo(() => {
    return sales
      .filter((sale) => taskFilter === "all" || getSaleTaskKey(sale) === taskFilter)
      .filter((sale) => assigneeFilter === "all" || (sale.order_assignee || "Sin encargado") === assigneeFilter)
      .sort((left, right) => {
        const leftDue = isDeliveryDueSoon(left.estimated_delivery_date) ? 0 : 1;
        const rightDue = isDeliveryDueSoon(right.estimated_delivery_date) ? 0 : 1;
        if (leftDue !== rightDue) return leftDue - rightDue;

        const priorityDiff = (priorityOrder[left.warehouse_priority] || 4) - (priorityOrder[right.warehouse_priority] || 4);
        if (priorityDiff !== 0) return priorityDiff;

        const leftDate = left.estimated_delivery_date ? new Date(left.estimated_delivery_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDate = right.estimated_delivery_date ? new Date(right.estimated_delivery_date).getTime() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      });
  }, [sales, taskFilter, assigneeFilter]);

  const assigneeOptions = useMemo(() => {
    return [...new Set(sales.map((sale) => sale.order_assignee || "Sin encargado"))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [sales]);

  const availableLotGroups = useMemo(() => {
    const assignableLots = availableLots
      .map((lot) => ({
        ...lot,
        available_weight_kg: Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0),
      }))
      .filter((lot) => Number(lot.available_weight_kg || 0) > 0);

    return Object.values(groupCoffeeLots(assignableLots)).sort((left, right) => left.name.localeCompare(right.name));
  }, [availableLots]);

  const getSavedSaleLotQuantity = (lotId) => {
    if (!selectedSale?.deductedLots?.length) return 0;

    return selectedSale.deductedLots
      .filter((lot) => String(lot.lot_id) === String(lotId))
      .reduce((total, lot) => total + Number(lot.quantity_kg || 0), 0);
  };

  const getCatalogLotAvailableKg = (lotId) => {
    const lot = availableLots.find((availableLot) => String(availableLot.id) === String(lotId));
    return Number(lot?.operational_available_kg ?? lot?.available_weight_kg ?? 0);
  };

  const getLotAssignableKg = (lotId) => {
    if (!lotId) return 0;

    return getCatalogLotAvailableKg(lotId) + getSavedSaleLotQuantity(lotId);
  };

  const getCurrentRowsReservedForLot = (lotId, excludedRowIndex = null) => {
    if (!lotId) return 0;

    return assignmentRows.reduce((total, row, index) => {
      if (excludedRowIndex !== null && index === excludedRowIndex) return total;
      if (String(row.lotId) !== String(lotId)) return total;

      return total + Number(row.quantityKg || 0);
    }, 0);
  };

  const getLotAvailableForAssignmentRow = (lotId, rowIndex) => {
    const availableKg = getLotAssignableKg(lotId) - getCurrentRowsReservedForLot(lotId, rowIndex);
    return Math.max(Number(availableKg.toFixed(3)), 0);
  };

  const getLotOptionForRow = (lot, rowIndex) => ({
    ...lot,
    available_weight_kg: getLotAvailableForAssignmentRow(lot.id, rowIndex),
  });

  const getItemAssignmentRows = (item) =>
    assignmentRows.filter((row) => String(row.saleItemId) === String(item.id));

  const getItemAssignmentRowsByType = (item, assignmentType) =>
    assignmentRows.filter((row) => (
      String(row.saleItemId) === String(item.id) &&
      (row.assignmentType || "directo") === assignmentType
    ));

  const getAssignmentBlockTargetKg = (item, assignmentType) => {
    const suggested = getSuggestedQuantities(item);

    if (assignmentType === "proceso") return Number(suggested?.processInputKg || 0);
    if (assignmentType === "base") return Number(suggested?.baseKg || 0);

    return Number(item.operational_weight_kg || item.quantity_kg || 0);
  };

  const getAssignmentBlockTotals = (item, assignmentType) => {
    const assignedKg = getItemAssignmentRowsByType(item, assignmentType)
      .reduce((total, row) => total + Number(row.quantityKg || 0), 0);
    const targetKg = getAssignmentBlockTargetKg(item, assignmentType);

    return {
      assignedKg: Number(assignedKg.toFixed(3)),
      targetKg: Number(targetKg.toFixed(3)),
      missingKg: Number(Math.max(targetKg - assignedKg, 0).toFixed(3)),
    };
  };

  const getSelectedLotOption = (row) => {
    if (!row?.lotId) return null;

    const assignedLot = (selectedSale?.deductedLots || []).find((lot) => String(lot.lot_id) === String(row.lotId));
    if (assignedLot) {
      return {
        value: row.lotId,
        label: `Asignado a este pedido: ${formatCoffeeLotCodeName(assignedLot)} - ${formatOperationalKg(assignedLot.quantity_kg)}`,
      };
    }

    const catalogLot = availableLots.find((lot) => String(lot.id) === String(row.lotId));
    const availableInSelector = availableLotGroups.some((group) => group.lots.some((lot) => String(lot.id) === String(row.lotId)));

    if (catalogLot && !availableInSelector) {
      return {
        value: row.lotId,
        label: `Lote seleccionado: ${formatCoffeeLotOption(catalogLot)}`,
      };
    }

    return {
      value: row.lotId,
      label: `Lote asignado ${row.lotId}`,
    };
  };

  const getAssignmentTypeFromNotes = (notes = "") => {
    if (String(notes).startsWith("[Proceso]")) return "proceso";
    if (String(notes).startsWith("[Base]")) return "base";
    return "directo";
  };

  const cleanAssignmentNotes = (notes = "") =>
    String(notes).replace(/^\[(Proceso|Base|Directo)\]\s*/i, "");

  const buildAssignmentNotes = (row) => {
    const prefixes = {
      proceso: "[Proceso]",
      base: "[Base]",
      directo: "[Directo]",
    };

    return [prefixes[row.assignmentType] || prefixes.directo, row.notes].filter(Boolean).join(" ");
  };

  const getShortageKindFromNotes = (notes = "") => {
    const text = String(notes || "").trim();
    if (text.startsWith("[Falta base]")) return "base";
    if (text.startsWith("[Falta proceso]")) return "proceso";
    if (text.startsWith("[Falta base y proceso]")) return "ambos";
    return "base";
  };

  const cleanShortageNotes = (notes = "") =>
    String(notes || "")
      .replace(/^\[Falta base y proceso\]\s*/i, "")
      .replace(/^\[Falta base\]\s*/i, "")
      .replace(/^\[Falta proceso\]\s*/i, "")
      .trim();

  const buildShortageNotes = ({ kind, notes }) => {
    const prefixes = {
      base: "[Falta base]",
      proceso: "[Falta proceso]",
      ambos: "[Falta base y proceso]",
    };

    return [prefixes[kind] || prefixes.ambos, notes].filter(Boolean).join(" ");
  };

  const isShortageActiveForType = (item, assignmentType) => {
    if (!item.shortage_marked) return false;
    if (assignmentType === "directo") return true;

    const shortageKind = getShortageKindFromNotes(item.shortage_notes);
    return shortageKind === "ambos" || shortageKind === assignmentType;
  };

  const getNextShortageKind = (item, assignmentType) => {
    if (assignmentType === "directo") {
      return item.shortage_marked ? null : "ambos";
    }

    if (!item.shortage_marked) return assignmentType;

    const currentKind = getShortageKindFromNotes(item.shortage_notes);

    if (currentKind === "ambos") {
      return assignmentType === "base" ? "proceso" : "base";
    }

    if (currentKind === assignmentType) return null;

    return "ambos";
  };

  const getShortageButtonLabel = (assignmentType, active) => {
    if (active) return "Quitar faltante";
    if (assignmentType === "proceso") return "No hay proceso";
    if (assignmentType === "base") return "No hay base";
    return "No hay cafe";
  };

  const getShortageStatusLabel = (item) => {
    if (!item.shortage_marked) return "No";

    const noteText = String(item.shortage_notes || "").trim();
    const hasShortagePrefix = noteText.startsWith("[Falta ");
    if (!hasShortagePrefix && item.coffee_profile_category !== "Exotico") return "Si";

    const shortageKind = getShortageKindFromNotes(item.shortage_notes);
    if (shortageKind === "base") return "Base";
    if (shortageKind === "proceso") return "Proceso";
    if (shortageKind === "ambos") return "Base y proceso";
    return "Si";
  };

  const buildCleanAssignments = ({ exclude } = {}) =>
    assignmentRows
      .filter((row) => !exclude || !(
        String(row.saleItemId) === String(exclude.saleItemId) &&
        (row.assignmentType || "directo") === exclude.assignmentType
      ))
      .map((row) => ({
        saleItemId: Number(row.saleItemId),
        lotId: Number(row.lotId),
        quantityKg: Number(row.quantityKg),
        notes: buildAssignmentNotes(row),
      }))
      .filter((row) => row.saleItemId && row.lotId && row.quantityKg > 0);

  const persistValidAssignments = async ({ exclude } = {}) => {
    if (!selectedSale) return null;

    const cleanAssignments = buildCleanAssignments({ exclude });
    if (cleanAssignments.length === 0) return null;

    return apiRequest(`/sales/${selectedSale.id}/lot-assignments`, {
      method: "PUT",
      body: JSON.stringify({
        items: cleanAssignments,
      }),
    });
  };

  const getSuggestedQuantities = (item) => {
    if (item.coffee_profile_category !== "Exotico") return null;

    const requiredKg = Number(item.operational_weight_kg || item.quantity_kg || 0);
    const processInputKg = requiredKg * 0.4;
    const baseKg = requiredKg * 0.6;
    const processName = item.profile_components?.[0]?.purchase_coffee_name || item.process_purchase_coffee_name || "Cafe para proceso";
    const baseName = item.base_purchase_coffee_name || "Cafe base";

    return {
      processName,
      baseName,
      processInputKg: Number(processInputKg.toFixed(3)),
      baseKg: Number(baseKg.toFixed(3)),
    };
  };

  const loadData = async () => {
    const [saleData, reservationData] = await Promise.all([
      apiRequest("/sales"),
      apiRequest("/sales/lot-reservations"),
    ]);

    setSales(saleData.filter((sale) => activeWarehouseStatuses.includes(sale.status)));
    setAvailableLots(reservationData.lots || []);

    if (selectedSale) {
      const stillExists = saleData.find((sale) => sale.id === selectedSale.id && activeWarehouseStatuses.includes(sale.status));
      if (stillExists) {
        await loadSaleDetail(selectedSale.id, false);
      } else {
        setSelectedSale(null);
      }
    }
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const loadSaleDetail = async (saleId, withLoading = true) => {
    if (withLoading) setLoadingDetail(true);

    try {
      const sale = await apiRequest(`/sales/${saleId}`);
      setSelectedSale(sale);
      setOrderAssignee(sale.order_assignee || "");
      setAssignmentRows(
        sale.items?.flatMap((item) => {
          const rows = (sale.deductedLots || []).filter((lot) => Number(lot.sale_item_id) === Number(item.id));

          if (rows.length) {
            return rows.map((lot) => ({
              saleItemId: String(lot.sale_item_id),
              lotId: String(lot.lot_id),
              quantityKg: String(lot.quantity_kg),
              assignmentType: getAssignmentTypeFromNotes(lot.notes),
              notes: cleanAssignmentNotes(lot.notes),
            }));
          }

          const suggested = getSuggestedQuantities(item);

          return suggested
            ? [
                {
                  saleItemId: String(item.id),
                  lotId: "",
                  quantityKg: String(suggested.processInputKg || ""),
                  assignmentType: "proceso",
                  notes: "",
                },
                {
                  saleItemId: String(item.id),
                  lotId: "",
                  quantityKg: String(suggested.baseKg || ""),
                  assignmentType: "base",
                  notes: "",
                },
              ]
            : [{
              saleItemId: String(item.id),
              lotId: "",
              quantityKg: "",
              assignmentType: "directo",
              notes: "",
            }];
        }) || []
      );
      setNotes("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateSalePriority = async (priority) => {
    if (!selectedSale) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/priority`, {
        method: "PUT",
        body: JSON.stringify({ priority }),
      });
      setSelectedSale(response.data);
      await loadData();
      setMessage("Prioridad actualizada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateOrderAssignee = async () => {
    if (!selectedSale) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/order-assignee`, {
        method: "PUT",
        body: JSON.stringify({ assignee: orderAssignee.trim() || null }),
      });
      setSelectedSale(response.data);
      setOrderAssignee(response.data.order_assignee || "");
      await loadData();
      setMessage("Encargado de pedido actualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateAssignmentRow = (index, field, value) => {
    setAssignmentRows((currentRows) =>
      currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const addItemAssignmentRow = (item, assignmentType = "directo") => {
    setAssignmentRows((currentRows) => [
      ...currentRows,
      {
        saleItemId: String(item.id),
        lotId: "",
        quantityKg: "",
        assignmentType,
        notes: "",
      },
    ]);
  };

  const removeAssignmentRow = (index) => {
    setAssignmentRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  };

  const saveAssignments = async (item = null) => {
    if (!selectedSale) return;

    const cleanAssignments = buildCleanAssignments();
    const itemAssignments = item
      ? cleanAssignments.filter((assignment) => String(assignment.saleItemId) === String(item.id))
      : cleanAssignments;

    if (itemAssignments.length === 0) {
      setError(item
        ? "Agregue al menos un lote y una cantidad para confirmar este cafe."
        : "Agregue al menos un lote y una cantidad para guardar la asignacion."
      );
      return;
    }

    const confirmed = window.confirm(item
      ? `Confirmas guardar la asignacion de ${getWarehouseItemLabel(item)}?`
      : "Confirmas guardar los lotes asignados a esta venta?"
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/lot-assignments`, {
        method: "PUT",
        body: JSON.stringify({
          items: cleanAssignments,
        }),
      });
      setSelectedSale(response.data);
      await loadData();
      await loadSaleDetail(selectedSale.id, false);
      setMessage(item ? "Asignacion de cafe confirmada correctamente." : "Lotes asignados correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const requestLaboratoryBlend = async () => {
    if (!selectedSale) return;
    if (!window.confirm("Confirma enviar esta venta a laboratorio para definir ensamble?")) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/request-blend`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      setSelectedSale(response.data);
      await loadData();
      setMessage("Venta enviada a laboratorio para definir ensamble.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleItemShortage = async (item, assignmentType = "directo") => {
    if (!selectedSale) return;

    const nextKind = getNextShortageKind(item, assignmentType);
    const nextMarked = Boolean(nextKind);
    const suggested = getSuggestedQuantities(item);

    const rawNotes = nextMarked
      ? window.prompt("Observacion para gerencia sobre este faltante", cleanShortageNotes(item.shortage_notes))
      : cleanShortageNotes(item.shortage_notes);

    if (rawNotes === null) return;
    if (!window.confirm(nextMarked ? "Confirmas marcar este faltante?" : "Confirmas quitar esta marca de faltante?")) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (nextMarked) {
        try {
          await persistValidAssignments();
        } catch {
          await persistValidAssignments({
            exclude: {
              saleItemId: item.id,
              assignmentType,
            },
          });
        }
      }

      const response = await apiRequest(`/sales/${selectedSale.id}/items/${item.id}/shortage`, {
        method: "PUT",
        body: JSON.stringify({
          shortageMarked: nextMarked,
          notes: nextMarked && suggested
            ? buildShortageNotes({ kind: nextKind, notes: rawNotes })
            : rawNotes,
        }),
      });
      setSelectedSale(response.data);
      await loadData();
      await loadSaleDetail(selectedSale.id, false);
      setMessage(nextMarked ? "Faltante marcado sin borrar asignaciones validas." : "Marca de faltante retirada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const renderAssignmentBlock = (item, { assignmentType, title, description, addLabel }) => {
    const rows = getItemAssignmentRowsByType(item, assignmentType);
    const shortageActive = isShortageActiveForType(item, assignmentType);
    const totals = getAssignmentBlockTotals(item, assignmentType);

    return (
      <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
            <p className="mt-1 text-xs text-slate-600">
              Sugerido: <span className="font-semibold">{formatOperationalKg(totals.targetKg)}</span>
              {" · "}
              Asignado: <span className="font-semibold text-amber-700">{formatOperationalKg(totals.assignedKg)}</span>
              {" · "}
              Faltante: <span className={totals.missingKg > 0 ? "font-semibold text-rose-700" : "font-semibold text-leaf"}>
                {formatOperationalKg(totals.missingKg)}
              </span>
            </p>
          </div>
          <button
            className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${
              shortageActive
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-rose-300 text-rose-700 hover:bg-rose-50"
            }`}
            type="button"
            onClick={() => toggleItemShortage(item, assignmentType)}
            disabled={saving}
          >
            <AlertTriangle size={13} />
            {getShortageButtonLabel(assignmentType, shortageActive)}
          </button>
        </div>
        {rows.map((row) => {
          const rowIndex = assignmentRows.indexOf(row);
          const selectedLotOption = getSelectedLotOption(row);
          const selectedAvailableKg = row.lotId ? getLotAvailableForAssignmentRow(row.lotId, rowIndex) : 0;
          const quantityExceedsAvailable = row.lotId && Number(row.quantityKg || 0) > selectedAvailableKg;

          return (
            <div key={`assignment-${item.id}-${assignmentType}-${rowIndex}`} className="grid min-w-0 gap-2">
              <select
                className="min-w-0 max-w-full truncate rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                value={row.lotId}
                onChange={(event) => updateAssignmentRow(rowIndex, "lotId", event.target.value)}
              >
                <option value="">Lote disponible</option>
                {selectedLotOption && (
                  <option value={selectedLotOption.value}>{selectedLotOption.label}</option>
                )}
                {availableLotGroups.map((group) => (
                  <optgroup key={group.name} label={`${group.name} (${formatOperationalKg(group.kg)})`}>
                    {group.lots
                      .filter((lot) => {
                        if (selectedLotOption && String(lot.id) === String(row.lotId)) return false;
                        return getLotAvailableForAssignmentRow(lot.id, rowIndex) > 0;
                      })
                      .map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {formatCoffeeLotOption(getLotOptionForRow(lot, rowIndex))}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  className="min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Cantidad kg"
                  type="number"
                  min="0.001"
                  step="0.001"
                  max={row.lotId ? selectedAvailableKg : undefined}
                  value={row.quantityKg}
                  onChange={(event) => updateAssignmentRow(rowIndex, "quantityKg", event.target.value)}
                />
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  type="button"
                  onClick={() => removeAssignmentRow(rowIndex)}
                  disabled={rows.length === 1}
                >
                  Quitar
                </button>
              </div>
              {row.lotId && (
                <p className={`text-xs ${quantityExceedsAvailable ? "font-semibold text-rose-700" : "text-slate-500"}`}>
                  Disponible para esta linea: {formatOperationalKg(selectedAvailableKg)}
                  {quantityExceedsAvailable ? " · La cantidad supera lo disponible para este lote." : ""}
                </p>
              )}
              <input
                className="min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Observacion opcional"
                value={row.notes}
                onChange={(event) => updateAssignmentRow(rowIndex, "notes", event.target.value)}
              />
            </div>
          );
        })}
        <button
          className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={() => addItemAssignmentRow(item, assignmentType)}
        >
          {addLabel}
        </button>
      </div>
    );
  };

  const updateSaleStatus = async (action) => {
    if (!selectedSale) return;

    const label =
      action === "send-lab"
        ? "enviar esta venta a laboratorio"
        : action === "prepare"
          ? "marcar esta venta como alistada"
          : "marcar esta venta como despachada";

    if (action === "dispatch" && !dispatchReceiptFile) {
      setError("Antes de despachar debe cargar la foto del recibo.");
      return;
    }

    const confirmed = window.confirm(`Confirmas ${label}?`);
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = { notes };

      if (action === "dispatch") {
        const image = await readImageFileAsDataUrl(
          dispatchReceiptFile,
          "No se pudo leer la foto del recibo"
        );
        payload.dispatchReceipt = {
          image,
          fileName: dispatchReceiptFile.name,
          mimeType: dispatchReceiptFile.type,
        };
      }

      await apiRequest(`/sales/${selectedSale.id}/${action}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await loadData();
      if (action === "dispatch") {
        setDispatchReceiptFile(null);
      }
      setMessage(
        action === "send-lab"
          ? "Venta enviada a laboratorio."
          : action === "prepare"
            ? "Venta marcada como alistada."
            : "Venta marcada como despachada."
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const printWarehouseOrder = () => {
    if (!selectedSale) {
      setError("Seleccione una orden para imprimir.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("El navegador bloqueo la ventana de impresion.");
      return;
    }

    printWindow.document.write(buildWarehouseOrderHtml(selectedSale));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setMessage("Orden abierta para imprimir o guardar como PDF.");
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Pedidos de bodega</h1>
          <p className="text-sm text-slate-500">Trabajo diario ordenado por urgencia, prioridad y fecha de entrega.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={loadData}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {taskFilters.map((filter) => (
          <button
            key={filter.key}
            className={`shrink-0 rounded border px-3 py-2 text-sm font-semibold ${
              taskFilter === filter.key ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
            }`}
            type="button"
            onClick={() => setTaskFilter(filter.key)}
          >
            {filter.label} ({taskCounts[filter.key] || 0})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-3">
        <label className="text-xs font-semibold uppercase text-slate-500">Encargado</label>
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
        >
          <option value="all">Todos</option>
          {assigneeOptions.map((assignee) => (
            <option key={assignee} value={assignee}>
              {assignee}
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ordenes por hacer</h2>
          </div>
          {sortedSales.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin pendientes" message="Las ventas activas de bodega apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Venta</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Entrega</th>
                    <th className="px-3 py-2">Prioridad</th>
                    <th className="px-3 py-2">Encargado</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Siguiente accion</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-3 py-2 font-medium">{sale.code}</td>
                      <td className="px-3 py-2">{sale.client_name}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <span>{formatDate(sale.estimated_delivery_date)}</span>
                          {isDeliveryDueSoon(sale.estimated_delivery_date) && (
                            <StatusBadge tone="danger">Urgente</StatusBadge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={sale.warehouse_priority === "alta" ? "danger" : sale.warehouse_priority === "media" ? "warning" : "neutral"}>
                          {sale.warehouse_priority || "media"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{sale.order_assignee || "-"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={getSaleStatusTone(sale)}>{saleStatusLabels[sale.status] || sale.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{getSaleNextAction(sale)}</td>
                      <td className="px-3 py-2">
                        <button
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          type="button"
                          onClick={() => loadSaleDetail(sale.id)}
                        >
                          <Eye size={14} />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Detalle operativo</h2>
          {loadingDetail ? (
            <p className="mt-3 text-sm text-slate-500">Cargando orden...</p>
          ) : !selectedSale ? (
            <div className="mt-3">
              <EmptyState title="Seleccione una venta" message="Aqui podra priorizar, asignar lotes, imprimir y cambiar estado." />
            </div>
          ) : (
            <div className="mt-4 min-w-0 space-y-4">
              <div>
                <p className="font-semibold text-ink">{selectedSale.code}</p>
                <p className="text-sm text-slate-500">{selectedSale.client_name}</p>
                <p className="text-sm text-slate-500">Entrega: {formatDate(selectedSale.estimated_delivery_date)}</p>
                <div className="mt-2">
                  <StatusBadge tone={getSaleStatusTone(selectedSale)}>
                    {saleStatusLabels[selectedSale.status] || selectedSale.status}
                  </StatusBadge>
                </div>
                <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  {getSaleNextAction(selectedSale)}
                </p>
                {selectedSale.items?.some((item) => item.shortage_marked) && (
                  <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    <p className="font-semibold">Alerta de deficit</p>
                    <p>Hay cafe marcado como faltante. Revise el modulo Lotes asignados para ver cuanto comprar con la estimacion 40/60.</p>
                  </div>
                )}
                {selectedSale.status === "ensamble_definido" && selectedSale.notes && (
                  <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <p className="font-semibold">Reajuste de ensamble solicitado por laboratorio</p>
                    <p>{selectedSale.notes}</p>
                  </div>
                )}
              </div>

              <div className="rounded border border-slate-200 p-3">
                <label className="text-xs font-semibold uppercase text-slate-500">Prioridad de entrega</label>
                <select
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={selectedSale.warehouse_priority || "media"}
                  onChange={(event) => updateSalePriority(event.target.value)}
                  disabled={saving}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              <div className="rounded border border-slate-200 p-3">
                <label className="text-xs font-semibold uppercase text-slate-500">Encargado de pedido</label>
                <div className="mt-2 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nombre de la persona"
                    value={orderAssignee}
                    maxLength={120}
                    onChange={(event) => setOrderAssignee(event.target.value)}
                    disabled={saving}
                  />
                  <button
                    className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    onClick={updateOrderAssignee}
                    disabled={saving}
                  >
                    Guardar
                  </button>
                </div>
                {selectedSale.assigneeHistory?.length > 0 && (
                  <details className="mt-3 text-xs text-slate-500">
                    <summary className="cursor-pointer text-leaf">Ver historial de encargado</summary>
                    <div className="mt-2 space-y-1">
                      {selectedSale.assigneeHistory.map((entry) => (
                        <p key={entry.id}>
                          {entry.previous_assignee || "Sin encargado"} a {entry.new_assignee || "Sin encargado"} · {entry.changed_by_name || "-"} · {formatDate(entry.created_at)}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedSale.items?.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                    {(() => {
                      const suggested = getSuggestedQuantities(item);

                      return (
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-ink">{getWarehouseItemLabel(item)}</p>
                              <p className="text-slate-500">
                                <span className="font-semibold text-slate-700">{item.product_form || "Sin presentacion"}</span>
                                {" · "}
                                Pedido: {formatOperationalKg(item.quantity_kg)}
                                {item.operational_weight_kg && Number(item.operational_weight_kg) !== Number(item.quantity_kg) && (
                                  <> · Operativo bodega: {formatOperationalKg(item.operational_weight_kg)}</>
                                )}
                              </p>
                              <p className="mt-1 text-xs">
                                <span className="text-amber-700">Reservado: {formatOperationalKg(item.reserved_kg)}</span>
                                {" · "}
                                <span className={item.shortage_marked ? "font-semibold text-rose-700" : "font-semibold text-slate-500"}>
                                  Marcado faltante: {getShortageStatusLabel(item)}
                                </span>
                              </p>
                            </div>
                          </div>

                          {!suggested && (
                            <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              Cafe directo: asigne el lote disponible que cumpla las caracteristicas del pedido.
                            </p>
                          )}

                          {item.shortage_marked && item.shortage_notes && (
                            <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              Motivo faltante: {cleanShortageNotes(item.shortage_notes)}
                            </p>
                          )}

                          {["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "ensamble_definido"].includes(selectedSale.status) && (
                            suggested ? (
                              <div className="space-y-3">
                                {renderAssignmentBlock(item, {
                                  assignmentType: "proceso",
                                  title: "Asignar lote para proceso",
                                  description: `Separe hasta ${formatOperationalKg(suggested.processInputKg)} de ${suggested.processName} para el proceso.`,
                                  addLabel: "Agregar otro lote para proceso",
                                })}
                                {renderAssignmentBlock(item, {
                                  assignmentType: "base",
                                  title: "Asignar lote para base",
                                  description: `Separe hasta ${formatOperationalKg(suggested.baseKg)} de ${suggested.baseName} como base.`,
                                  addLabel: "Agregar otro lote para base",
                                })}
                              </div>
                            ) : (
                              renderAssignmentBlock(item, {
                                assignmentType: "directo",
                                title: "Asignar lote a este cafe",
                                description: "Use uno o varios lotes hasta completar la cantidad solicitada.",
                                addLabel: "Agregar otro lote a este cafe",
                              })
                            )
                          )}

                          {["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "ensamble_definido"].includes(selectedSale.status) && (
                            <button
                              className="w-full rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              type="button"
                              onClick={() => saveAssignments(item)}
                              disabled={saving || ["alistada", "despachada"].includes(selectedSale.status)}
                            >
                              Confirmar asignacion de este cafe
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>

              {selectedSale.blend_required !== null && selectedSale.blend_required !== undefined && (
                <p className={`rounded px-3 py-2 text-sm font-semibold ${
                  selectedSale.blend_required ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                }`}>
                  Laboratorio: {selectedSale.blend_required ? "requiere mezcla" : "no requiere mezcla"}.
                </p>
              )}

              {selectedSale.items?.some((item) => item.blend_items?.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Mezcla indicada por laboratorio</p>
                  {selectedSale.items
                    .filter((item) => item.blend_items?.length > 0)
                    .map((item) => (
                      <div key={`blend-${item.id}`} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                        <p className="font-semibold text-ink">
                          {getWarehouseItemLabel(item)}
                        </p>
                        <div className="mt-2 space-y-2">
                          {item.blend_items.map((blend) => (
                            <div key={blend.id} className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-ink">{formatCoffeeLotCodeName(blend)}</p>
                                <p className="text-xs text-slate-600">{blend.commercial_classification || formatInputLabel(blend)}</p>
                              </div>
                              <p className="text-right text-slate-700">
                                {blend.percentage}%<br />
                                <span className="text-xs text-slate-500">
                                  {formatOperationalKg(blend.calculated_operational_kg || blend.calculated_quantity_kg)} estimados
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "ensamble_definido"].includes(selectedSale.status) && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    onClick={() => saveAssignments()}
                    disabled={saving || ["alistada", "despachada"].includes(selectedSale.status)}
                  >
                    Guardar todas las asignaciones
                  </button>
                </div>
              )}

              {["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "proceso_solicitado", "en_proceso"].includes(selectedSale.status) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {["pendiente_alistamiento", "pendiente_bodega"].includes(selectedSale.status) ? (
                    <Link
                      className="inline-flex w-full items-center justify-center rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50"
                      to={`/procesos?saleId=${selectedSale.id}`}
                    >
                      Solicitar proceso para este pedido
                    </Link>
                  ) : (
                    <span className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm text-slate-500">
                      Proceso o lote ya gestionado
                    </span>
                  )}
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                    type="button"
                    onClick={requestLaboratoryBlend}
                    disabled={saving}
                  >
                    <FlaskConical size={16} />
                    Enviar a ensamble de laboratorio
                  </button>
                </div>
              )}

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={printWarehouseOrder}
              >
                <Printer size={16} />
                Imprimir orden / guardar PDF
              </button>

              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Observaciones de bodega"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />

              {selectedSale.status === "alistada" && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-amber-900">Recibo obligatorio para despacho</p>
                      <p className="text-xs text-slate-600">
                        Cargue la foto del recibo generado antes de marcar la venta como despachada.
                      </p>
                      {dispatchReceiptFile && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          Archivo seleccionado: {dispatchReceiptFile.name}
                        </p>
                      )}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                      <ImagePlus size={15} />
                      {dispatchReceiptFile ? "Cambiar recibo" : "Subir recibo"}
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(event) => setDispatchReceiptFile(event.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {["lote_asignado", "listo_para_ensamble", "ensamble_definido"].includes(selectedSale.status) && (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded border border-leaf bg-emerald-50 px-3 py-2 text-sm font-semibold text-leaf disabled:opacity-60"
                  disabled={saving}
                  type="button"
                  onClick={() => updateSaleStatus("send-lab")}
                >
                  <FlaskConical size={16} />
                  Enviar prueba a laboratorio
                </button>
                )}
                {selectedSale.status === "aprobada_laboratorio" && (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                  type="button"
                  onClick={() => updateSaleStatus("prepare")}
                >
                  <PackageCheck size={16} />
                  Alistada
                </button>
                )}
                {selectedSale.status === "alistada" && (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving || !dispatchReceiptFile}
                  type="button"
                  onClick={() => updateSaleStatus("dispatch")}
                >
                  <Truck size={16} />
                  Despachada
                </button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default WarehousePendingPage;
