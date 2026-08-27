import { AlertTriangle, Eye, FlaskConical, ImagePlus, PackageCheck, Printer, RefreshCw, Search, Trash2, Truck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { calculateOperationalKg, formatOperationalKg, roundKgUpToHalf } from "../../utils/coffeeCalculations";
import { formatCoffeeLotCodeName, formatCoffeeLotOption, groupCoffeeLots } from "../../utils/coffeeLots";
import { readImageFileAsDataUrl } from "../../utils/files";
import { printHtmlDocument } from "../../utils/printHtml";
import {
  getSaleNextAction,
  getSaleStatusTone,
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

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const openLoadingDocumentTab = (title) => {
  const tab = window.open("", "_blank");

  if (!tab) return null;

  try {
    tab.opener = null;
  } catch {
    // Algunos navegadores no permiten modificar opener; no afecta la impresion.
  }

  tab.document.open();
  tab.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><meta charset="utf-8" /></head><body style="font-family: Arial, sans-serif; padding: 24px;"><strong>Cargando orden...</strong></body></html>`);
  tab.document.close();

  return tab;
};

const writeDocumentTab = (tab, html) => {
  tab.document.open();
  tab.document.write(html);
  tab.document.close();
};

const presentationFilterOptions = ["Todas", "Pergamino", "Excelso"];
const formatAssignmentKgInput = (value) => {
  const kg = Number(value);
  if (!Number.isFinite(kg) || kg <= 0) return "";
  return Number(kg.toFixed(1)).toString();
};

const formatSuggestedAssignmentKgInput = (value) => {
  const kg = Number(value);
  if (!Number.isFinite(kg) || kg <= 0) return "";
  return String(Math.ceil(kg - Number.EPSILON));
};

const taskFilters = [
  { key: "all", label: "Todos" },
  { key: "decision", label: "Por alistar" },
  { key: "shortage", label: "Con faltante" },
  { key: "lab", label: "Laboratorio" },
  { key: "ready", label: "Listos" },
  { key: "dispatch", label: "Despachar" },
];

const getSimpleWarehouseTaskKey = (sale) => {
  if (sale.items?.some((item) => item.shortage_marked)) return "shortage";
  if (["pendiente_laboratorio", "proceso_solicitado", "en_proceso"].includes(sale.status)) return "lab";
  if (["listo_para_ensamble", "ensamble_definido"].includes(sale.status)) return "decision";
  if (sale.status === "aprobada_laboratorio") return "ready";
  if (sale.status === "alistada") return "dispatch";
  return "decision";
};

const getAssignedLotSearchText = (sale) =>
  (sale.assigned_lots_summary || [])
    .flatMap((lot) => [
      lot.lot_code,
      lot.supplier_name,
      lot.presentation,
      lot.commercial_classification,
      lot.coffee_type_name,
      lot.coffee_profile_name,
      lot.sale_item_description,
      lot.sale_item_variety,
      lot.notes,
    ])
    .filter(Boolean)
    .join(" ");

const getAssignedLotSummary = (sale) => {
  const lots = sale.assigned_lots_summary || [];
  if (lots.length === 0) return "Sin lotes";

  const labels = lots.slice(0, 2).map((lot) => (
    `${formatCoffeeLotCodeName(lot)} (${formatOperationalKg(lot.quantity_kg)})`
  ));
  const remaining = lots.length - labels.length;

  return remaining > 0 ? `${labels.join(" / ")} / +${remaining} mas` : labels.join(" / ");
};

const itemAccentClasses = [
  "border-l-4 border-l-emerald-400 bg-emerald-50/30",
  "border-l-4 border-l-sky-400 bg-sky-50/30",
  "border-l-4 border-l-amber-400 bg-amber-50/30",
  "border-l-4 border-l-violet-400 bg-violet-50/30",
  "border-l-4 border-l-rose-400 bg-rose-50/30",
  "border-l-4 border-l-teal-400 bg-teal-50/30",
];

const itemNumberClasses = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
];

const WarehousePendingPage = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [itemAssignees, setItemAssignees] = useState({});
  const [directProcessModeByItem, setDirectProcessModeByItem] = useState({});
  const [lotPicker, setLotPicker] = useState(null);
  const [lotPickerSearch, setLotPickerSearch] = useState("");
  const [orderAssignee, setOrderAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [dispatchReceiptFile, setDispatchReceiptFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const canDeleteOrders = user?.role === "admin";

  useEffect(() => {
    setDispatchReceiptFile(null);
  }, [selectedSale?.id]);

  const taskCounts = useMemo(() => {
    return sales.reduce(
      (counts, sale) => {
        const key = getSimpleWarehouseTaskKey(sale);
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
    const searchTerm = search.trim().toLowerCase();

    return sales
      .filter((sale) => taskFilter === "all" || getSimpleWarehouseTaskKey(sale) === taskFilter)
      .filter((sale) => assigneeFilter === "all" || (sale.order_assignee || "Sin encargado") === assigneeFilter)
      .filter((sale) => {
        if (!searchTerm) return true;

        return [
          sale.code,
          sale.client_name,
          sale.order_assignee,
          sale.warehouse_priority,
          sale.status,
          getSaleNextAction(sale),
          getAssignedLotSearchText(sale),
          ...(sale.items || []).map((item) => getWarehouseItemLabel(item)),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);
      })
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
  }, [sales, taskFilter, assigneeFilter, search]);

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
      .filter((lot) => Number(lot.available_weight_kg || 0) > 0)
      .sort((left, right) => {
        const leftDate = new Date(left.received_at || left.created_at || 0).getTime();
        const rightDate = new Date(right.received_at || right.created_at || 0).getTime();
        return leftDate - rightDate;
      });

    return Object.values(groupCoffeeLots(assignableLots)).sort((left, right) => left.name.localeCompare(right.name));
  }, [availableLots]);

  const getAvailableLotGroupsForRow = (row) => {
    const presentationFilter = row.presentationFilter || "Todas";
    const item = selectedSale?.items?.find((saleItem) => String(saleItem.id) === String(row.saleItemId));
    const needsDirectProfileProcess = row.assignmentType === "proceso-directo" && item?.coffee_profile_id;
    const filterLots = (lots) => lots.filter((lot) => {
      const matchesPresentation = presentationFilter === "Todas" || (lot.presentation || "Pergamino") === presentationFilter;
      if (!matchesPresentation) return false;
      if (!needsDirectProfileProcess) return true;

      return lot.lot_kind === "PROC" && (
        String(lot.coffee_profile_id || "") === String(item.coffee_profile_id) ||
        String(lot.coffee_profile_name || "").toLowerCase() === String(item.coffee_profile_name || "").toLowerCase()
      );
    });

    if (presentationFilter === "Todas" && !needsDirectProfileProcess) return availableLotGroups;

    return availableLotGroups
      .map((group) => ({
        ...group,
        lots: filterLots(group.lots),
      }))
      .filter((group) => group.lots.length > 0)
      .map((group) => ({
        ...group,
        count: group.lots.length,
        kg: group.lots.reduce((total, lot) => total + Number(lot.available_weight_kg || 0), 0),
      }));
  };

  const getSavedSaleLotQuantity = (lotId) => {
    return 0;
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

  const getLotAvailableForAssignmentRowFromRows = (lotId, rowIndex, rows) => {
    const reservedKg = rows.reduce((total, row, index) => {
      if (rowIndex !== null && index === rowIndex) return total;
      if (String(row.lotId) !== String(lotId)) return total;
      return total + Number(row.quantityKg || 0);
    }, 0);
    const availableKg = getLotAssignableKg(lotId) - reservedKg;
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

  const getTakenLotsForItem = (item) =>
    (selectedSale?.deductedLots || []).filter((lot) => String(lot.sale_item_id) === String(item.id));

  const getTakenLotsByType = (item, assignmentType) =>
    getTakenLotsForItem(item).filter((lot) => getAssignmentTypeFromNotes(lot.notes) === assignmentType);

  const getTakenKgByType = (item, assignmentType) =>
    getTakenLotsByType(item, assignmentType)
      .reduce((total, lot) => total + Number(lot.quantity_kg || 0), 0);

  const normalizeAssignmentType = (assignmentType = "directo") => {
    if (assignmentType === "proceso-directo") return "proceso";
    if (String(assignmentType).startsWith("proceso")) return "proceso";
    if (String(assignmentType).startsWith("base")) return "base";
    return "directo";
  };

  const getAssignmentTypeKey = (assignmentType = "directo") => {
    const parts = String(assignmentType).split(":");
    return parts.length > 1 ? parts.slice(1).join(":") : "";
  };

  const getDirectProcessMissingKg = (item) => {
    const suggested = getSuggestedQuantities(item);
    if (!suggested || !shouldUseDirectProfileProcess(item)) return Number(suggested?.processInputKg || 0);

    const assignedDirectKg = getItemAssignmentRowsByType(item, "proceso-directo")
      .reduce((total, row) => total + Number(row.quantityKg || 0), 0);

    return Math.max(Number(suggested.processInputKg || 0) - assignedDirectKg, 0);
  };

  const getAssignmentBlockTargetKg = (item, assignmentType) => {
    const suggested = getSuggestedQuantities(item);
    const type = normalizeAssignmentType(assignmentType);

    if (assignmentType === "proceso-directo") return Number(suggested?.processInputKg || 0);

    if (type === "proceso") {
      const key = getAssignmentTypeKey(assignmentType);
      const component = suggested?.processComponents?.find((part) => String(part.key) === String(key));
      if (!component) return Number(suggested?.processInputKg || 0);

      if (shouldUseDirectProfileProcess(item)) {
        const missingKg = getDirectProcessMissingKg(item);
        const processInputKg = Number(suggested?.processInputKg || 0);
        const ratio = processInputKg > 0 ? Number(component.quantityKg || 0) / processInputKg : 0;
        return Math.ceil((missingKg * ratio) - Number.EPSILON);
      }

      return Number(component.quantityKg ?? suggested?.processInputKg ?? 0);
    }
    if (type === "base") return Number(suggested?.baseKg || 0);

    // En salidas directas el selector de presentacion decide si se usa el peso solicitado
    // en excelso o la conversion operativa a pergamino. Evita convertir dos veces.
    return Number(item.quantity_kg || 0);
  };

  const getAssignmentRowTargetKg = (row) => {
    const item = selectedSale?.items?.find((saleItem) => String(saleItem.id) === String(row.saleItemId));
    if (!item) return 0;

    const baseTargetKg = getAssignmentBlockTargetKg(item, row.assignmentType || "directo");
    return calculateSourceKgForItem(item, baseTargetKg, row.presentationFilter);
  };

  const getAssignmentBlockTotals = (item, assignmentType) => {
    const rows = getItemAssignmentRowsByType(item, assignmentType);
    const takenKg = getTakenKgByType(item, assignmentType);
    const assignedKg = rows.reduce((total, row) => total + Number(row.quantityKg || 0), takenKg);
    const targetKg = Math.max(
      getAssignmentBlockTargetKg(item, assignmentType),
      ...(rows.length > 0 ? rows.map((row) => getAssignmentRowTargetKg(row)) : [0])
    );

    return {
      assignedKg: Number(assignedKg.toFixed(3)),
      targetKg: Number(targetKg.toFixed(3)),
      missingKg: Number(Math.max(targetKg - assignedKg, 0).toFixed(3)),
    };
  };

  const getSuggestedQuantityForAssignmentRow = (row, lotId, rowIndex, rows = assignmentRows) => {
    if (!lotId) return "";

    const item = selectedSale?.items?.find((saleItem) => String(saleItem.id) === String(row.saleItemId));
    if (!item) return "";

    const assignmentType = row.assignmentType || "directo";
    const targetKg = getAssignmentRowTargetKg(row);
    const assignedByOtherRows = rows.reduce((total, currentRow, currentIndex) => {
      if (currentIndex === rowIndex) return total;
      if (String(currentRow.saleItemId) !== String(row.saleItemId)) return total;
      if ((currentRow.assignmentType || "directo") !== assignmentType) return total;
      return total + Number(currentRow.quantityKg || 0);
    }, getTakenKgByType(item, assignmentType));
    const missingKg = Math.max(targetKg - assignedByOtherRows, 0);
    const availableKg = getLotAvailableForAssignmentRowFromRows(lotId, rowIndex, rows);
    const suggestedKg = Math.min(missingKg || availableKg, availableKg);

    return formatSuggestedAssignmentKgInput(suggestedKg);
  };

  const getSelectedLotOption = (row) => {
    if (!row?.lotId) return null;

    const catalogLot = availableLots.find((lot) => String(lot.id) === String(row.lotId));
    const availableInSelector = availableLotGroups.some((group) => group.lots.some((lot) => String(lot.id) === String(row.lotId)));

    if (catalogLot && !availableInSelector) {
      return {
        value: row.lotId,
        label: `Lote seleccionado: ${formatCoffeeLotOption(catalogLot)}`,
      };
    }

    if (row.lotLabel) {
      return {
        value: row.lotId,
        label: row.lotLabel,
      };
    }

    return {
      value: row.lotId,
      label: `Lote seleccionado pendiente de recargar (${row.lotId})`,
    };
  };

  const getAssignmentTypeFromNotes = (notes = "") => {
    if (String(notes).startsWith("[Proceso directo]")) return "proceso-directo";
    const processMatch = String(notes).match(/^\[Proceso(?::([^\]]+))?\]/i);
    if (processMatch) return processMatch[1] ? `proceso:${processMatch[1]}` : "proceso";
    if (String(notes).startsWith("[Base]")) return "base";
    return "directo";
  };

  const cleanAssignmentNotes = (notes = "") =>
    String(notes).replace(/^\[(Proceso directo|Proceso(?::[^\]]+)?|Base|Directo)\]\s*/i, "");

  const buildAssignmentNotes = (row) => {
    const type = normalizeAssignmentType(row.assignmentType);
    const key = getAssignmentTypeKey(row.assignmentType);
    if (row.assignmentType === "proceso-directo") {
      return ["[Proceso directo]", row.notes].filter(Boolean).join(" ");
    }
    const prefixes = {
      proceso: key ? `[Proceso:${key}]` : "[Proceso]",
      base: "[Base]",
      directo: "[Directo]",
    };

    return [prefixes[type] || prefixes.directo, row.notes].filter(Boolean).join(" ");
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
    return shortageKind === "ambos" || shortageKind === normalizeAssignmentType(assignmentType);
  };

  const getNextShortageKind = (item, assignmentType) => {
    const type = normalizeAssignmentType(assignmentType);

    if (type === "directo") {
      return item.shortage_marked ? null : "ambos";
    }

    if (!item.shortage_marked) return type;

    const currentKind = getShortageKindFromNotes(item.shortage_notes);

    if (currentKind === "ambos") {
      return type === "base" ? "proceso" : "base";
    }

    if (currentKind === type) return null;

    return "ambos";
  };

  const getShortageButtonLabel = (assignmentType, active) => {
    if (active) return "Quitar faltante";
    const type = normalizeAssignmentType(assignmentType);
    if (type === "proceso") return "No hay proceso";
    if (type === "base") return "No hay base";
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
        assignmentType: row.assignmentType || "directo",
        notes: buildAssignmentNotes(row),
      }))
      .filter((row) => row.saleItemId && row.lotId && row.quantityKg > 0);

  const getItemOperationalKg = (item) => calculateOperationalKg({
    quantityKg: item.quantity_kg,
    productForm: item.product_form,
    processType: item.process_type,
  });

  const getLotCoverageForItem = (lot, item) => {
    const quantityKg = Number(lot.quantity_kg || 0);

    if (!Number.isFinite(quantityKg) || quantityKg <= 0) return 0;

    // Las salidas son manuales: lo registrado por bodega es lo que realmente se descuenta.
    return quantityKg;
  };

  const getItemTakenLots = (item) =>
    (selectedSale?.deductedLots || []).filter((lot) => String(lot.sale_item_id) === String(item.id));

  const getItemOutputCoverageKg = (item) =>
    getItemTakenLots(item).reduce((total, lot) => total + getLotCoverageForItem(lot, item), 0);

  const getItemOutputTargetKg = (item) =>
    Number(item.quantity_kg || 0);

  const getIncompleteOutputItems = () => {
    if (!selectedSale?.items?.length) return [];

    return selectedSale.items
      .map((item) => {
        const targetKg = getItemOutputTargetKg(item);
        const coverageKg = getItemOutputCoverageKg(item);

        return {
          ...item,
          targetKg,
          coverageKg,
          missingKg: Math.max(targetKg - coverageKg, 0),
        };
      })
      .filter((item) => item.missingKg > 0.001);
  };

  const hasDirectProfileProcessAvailable = (item) => {
    if (!item?.coffee_profile_id) return false;

    return availableLots.some((lot) => (
      lot.lot_kind === "PROC" &&
      Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0) > 0 &&
      (
        String(lot.coffee_profile_id || "") === String(item.coffee_profile_id) ||
        String(lot.coffee_profile_name || "").toLowerCase() === String(item.coffee_profile_name || "").toLowerCase()
      )
    ));
  };

  const getDirectProfileProcessAvailableKg = (item) => {
    if (!item?.coffee_profile_id) return 0;

    return availableLots
      .filter((lot) => (
        lot.lot_kind === "PROC" &&
        (
          String(lot.coffee_profile_id || "") === String(item.coffee_profile_id) ||
          String(lot.coffee_profile_name || "").toLowerCase() === String(item.coffee_profile_name || "").toLowerCase()
        )
      ))
      .reduce((total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0), 0);
  };

  const shouldUseDirectProfileProcess = (item) => (
    item?.coffee_profile_category === "Exotico" &&
    Boolean(directProcessModeByItem[item.id] ?? hasDirectProfileProcessAvailable(item))
  );

  const calculateSourceKgForItem = (item, quantityKg, presentation) => {
    const selectedPresentation = presentation === "Todas" ? item.product_form : presentation;
    const requestedPresentation = String(item.product_form || "").trim().toLowerCase();
    const sourcePresentation = String(selectedPresentation || "").trim().toLowerCase();

    if (requestedPresentation === "excelso" && sourcePresentation === "pergamino") {
      return calculateOperationalKg({
        quantityKg,
        productForm: "Excelso",
        processType: item.process_type,
      });
    }

    return Math.ceil(Number(quantityKg || 0) - Number.EPSILON);
  };

  const getSuggestedQuantities = (item) => {
    if (item.coffee_profile_category !== "Exotico") return null;

    const requestedKg = Math.ceil(Number(item.quantity_kg || 0) - Number.EPSILON);
    const configuredProfileComponents = Array.isArray(item.profile_components) && item.profile_components.length > 0
      ? item.profile_components
      : [{ purchase_coffee_id: item.process_purchase_coffee_id || "principal", purchase_coffee_name: item.process_purchase_coffee_name || "Cafe para proceso" }];
    const hasExplicitPercentages = configuredProfileComponents.some((component) => Number(component.percentage || 0) > 0);
    const explicitComponentPercentageTotal = configuredProfileComponents.reduce((total, component) => total + Number(component.percentage || 0), 0);
    const basePercentage = Number(item.base_percentage || 0);
    const processTotalKg = hasExplicitPercentages
      ? Math.ceil((requestedKg * explicitComponentPercentageTotal / 100) - Number.EPSILON)
      : Math.ceil((requestedKg * 0.4) - Number.EPSILON);
    const processComponents = configuredProfileComponents.map((component, index) => {
      const percentage = Number(component.percentage || 0);
      const quantityKg = hasExplicitPercentages
        ? Math.ceil((requestedKg * percentage / 100) - Number.EPSILON)
        : Math.ceil((processTotalKg / configuredProfileComponents.length) - Number.EPSILON);

      return {
        key: `${component.component_type || "purchase"}:${component.purchase_coffee_id || component.purchaseCoffeeId || component.component_profile_id || component.componentProfileId || index}`,
        name: component.purchase_coffee_name || item.process_purchase_coffee_name || "Cafe para proceso",
        percentage: hasExplicitPercentages ? percentage : null,
        quantityKg,
      };
    });
    const processInputKg = processComponents.reduce((total, component) => total + Number(component.quantityKg || 0), 0);
    const baseKg = hasExplicitPercentages && basePercentage > 0
      ? Math.ceil((requestedKg * basePercentage / 100) - Number.EPSILON)
      : Math.ceil((requestedKg * 0.6) - Number.EPSILON);
    const processName = processComponents.map((component) => component.name).join(" / ") || "Cafe para proceso";
    const baseName = item.base_purchase_coffee_name || "Cafe base";

    return {
      processName,
      baseName,
      processInputKg,
      baseKg,
      processComponents,
      directProcessName: item.coffee_profile_name || item.variety || "Proceso del perfil",
      directProcessAvailableKg: getDirectProfileProcessAvailableKg(item),
    };
  };

  const getDefaultAssignmentPresentation = () => "Pergamino";

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
      setItemAssignees(
        (sale.items || []).reduce((assignees, item) => ({
          ...assignees,
          [item.id]: item.item_assignee || "",
        }), {})
      );
      setDirectProcessModeByItem(
        (sale.items || []).reduce((modes, item) => ({
          ...modes,
          [item.id]: hasDirectProfileProcessAvailable(item),
        }), {})
      );
      setAssignmentRows(
        sale.items?.flatMap((item) => {
          const defaultPresentation = getDefaultAssignmentPresentation(item);

          return [{
            saleItemId: String(item.id),
            lotId: "",
            quantityKg: formatSuggestedAssignmentKgInput(calculateSourceKgForItem(item, item.quantity_kg, defaultPresentation)),
            presentationFilter: defaultPresentation,
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
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (field === "presentationFilter") {
          const updatedRow = { ...row, presentationFilter: value, lotId: "", lotLabel: "" };
          return {
            ...updatedRow,
            quantityKg: formatSuggestedAssignmentKgInput(getAssignmentRowTargetKg(updatedRow)),
          };
        }
        if (field === "lotId") {
          return {
            ...row,
            lotId: value,
            lotLabel: "",
            quantityKg: getSuggestedQuantityForAssignmentRow(row, value, rowIndex, currentRows),
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const updateItemAssignee = (itemId, value) => {
    setItemAssignees((currentAssignees) => ({
      ...currentAssignees,
      [itemId]: value,
    }));
  };

  const buildCleanItemAssignees = () =>
    Object.entries(itemAssignees).map(([saleItemId, assignee]) => ({
      saleItemId: Number(saleItemId),
      assignee: String(assignee || "").trim() || null,
    }));

  const addItemAssignmentRow = (item, assignmentType = "directo") => {
    setAssignmentRows((currentRows) => [
      ...currentRows,
      {
        saleItemId: String(item.id),
        lotId: "",
        quantityKg: formatSuggestedAssignmentKgInput(getAssignmentBlockTotals(item, assignmentType).missingKg),
        presentationFilter: getDefaultAssignmentPresentation(item),
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
    const assignmentsToSave = item
      ? cleanAssignments.filter((assignment) => String(assignment.saleItemId) === String(item.id))
      : cleanAssignments;
    const itemAssignments = item
      ? assignmentsToSave.filter((assignment) => String(assignment.saleItemId) === String(item.id))
      : cleanAssignments;

    if (itemAssignments.length === 0) {
      setError(item
        ? "Agregue al menos un lote y una cantidad para registrar la salida de este cafe."
        : "Agregue al menos un lote y una cantidad para registrar la salida."
      );
      return;
    }

    const confirmed = window.confirm(item
      ? `Confirmas registrar la salida de ${getWarehouseItemLabel(item)} y descontarla del inventario?`
      : "Confirmas registrar estas salidas y descontarlas del inventario?"
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/lot-assignments`, {
        method: "PUT",
        body: JSON.stringify({
          items: assignmentsToSave,
          itemAssignees: buildCleanItemAssignees(),
        }),
      });
      setSelectedSale(response.data);
      await loadData();
      await loadSaleDetail(selectedSale.id, false);
      setMessage(item ? "Salida de cafe registrada y descontada del inventario." : "Salidas registradas y descontadas del inventario.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const unassignTakenLot = async (lot) => {
    if (!selectedSale || !lot?.id) return;

    const confirmed = window.confirm(
      `Confirmas desasignar ${formatOperationalKg(lot.quantity_kg)} de ${formatCoffeeLotCodeName(lot)} y devolver ese cafe al inventario?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/lot-assignments/${lot.id}`, { method: "DELETE" });
      await loadData();
      await loadSaleDetail(selectedSale.id, false);
      setMessage(response.message || "Salida desasignada y cafe devuelto al inventario.");
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
      setMessage(nextMarked ? "Faltante marcado para seguimiento." : "Marca de faltante retirada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const openLotPicker = (rowIndex) => {
    setLotPicker({ rowIndex });
    setLotPickerSearch("");
  };

  const closeLotPicker = () => {
    setLotPicker(null);
    setLotPickerSearch("");
  };

  const selectLotForPicker = (lotId) => {
    if (!lotPicker) return;
    updateAssignmentRow(lotPicker.rowIndex, "lotId", String(lotId));
    closeLotPicker();
  };

  const getLotPickerGroups = () => {
    if (!lotPicker) return [];

    const row = assignmentRows[lotPicker.rowIndex];
    if (!row) return [];

    const searchTerm = lotPickerSearch.trim().toLowerCase();

    return getAvailableLotGroupsForRow(row)
      .map((group) => ({
        ...group,
        lots: group.lots.filter((lot) => {
          if (getLotAvailableForAssignmentRow(lot.id, lotPicker.rowIndex) <= 0) return false;
          if (!searchTerm) return true;

          return [
            lot.code,
            lot.supplier_name,
            lot.presentation,
            lot.commercial_classification,
            lot.coffee_type_name,
            lot.coffee_profile_name,
            lot.coffee_variety,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(searchTerm);
        }),
      }))
      .filter((group) => group.lots.length > 0);
  };

  const renderAssignmentBlock = (item, { assignmentType, title, description, addLabel }) => {
    const rows = getItemAssignmentRowsByType(item, assignmentType);
    const shortageActive = isShortageActiveForType(item, assignmentType);
    const totals = getAssignmentBlockTotals(item, assignmentType);

    return (
      <div className={`space-y-3 rounded border p-3 ${shortageActive ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-slate-700">{title}</p>
            <p className="mt-1 text-base text-slate-700">
              <span className="font-semibold">Sugerido:</span> {formatOperationalKg(totals.targetKg)}
              {" · "}
              <span className="font-semibold text-amber-700">Sacado:</span> {formatOperationalKg(totals.assignedKg)}
              {" · "}
              <span className={totals.missingKg > 0 ? "font-semibold text-rose-700" : "font-semibold text-leaf"}>
                Faltante:{" "}
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
          const selectedAvailableDisplayKg = roundKgUpToHalf(selectedAvailableKg);
          const quantityExceedsAvailable = row.lotId && Number(row.quantityKg || 0) > selectedAvailableDisplayKg;

          return (
            <div key={`assignment-${item.id}-${assignmentType}-${rowIndex}`} className="grid min-w-0 gap-3 rounded border border-slate-200 bg-white p-3">
              <div className="grid min-w-0 gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Presentacion
                  <select
                    className="min-w-0 max-w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-ink"
                    value={row.presentationFilter || "Todas"}
                    onChange={(event) => updateAssignmentRow(rowIndex, "presentationFilter", event.target.value)}
                  >
                    {presentationFilterOptions.map((presentation) => (
                      <option key={presentation} value={presentation}>
                        {presentation === "Todas" ? "Todas" : presentation}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase text-slate-500">
                  Lote del que se saco
                  <button
                    className="min-w-0 max-w-full truncate rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm font-normal normal-case text-ink hover:bg-slate-50"
                    type="button"
                    onClick={() => openLotPicker(rowIndex)}
                  >
                    {selectedLotOption?.label || "Buscar lote disponible"}
                  </button>
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Cantidad sugerida kg
                  <input
                    className="min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-ink"
                    placeholder="Seleccione un lote para calcular"
                    type="number"
                    min="0.1"
                    step="0.1"
                    max={row.lotId ? selectedAvailableDisplayKg : undefined}
                    value={row.quantityKg}
                    onChange={(event) => updateAssignmentRow(rowIndex, "quantityKg", event.target.value)}
                    onBlur={(event) => updateAssignmentRow(rowIndex, "quantityKg", formatAssignmentKgInput(event.target.value))}
                  />
                </label>
                <button
                  className="self-end rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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

    const incompleteOutputItems = ["prepare", "dispatch"].includes(action)
      ? getIncompleteOutputItems()
      : [];

    if (["prepare", "dispatch"].includes(action) && incompleteOutputItems.length > 0) {
      const missingText = incompleteOutputItems
        .slice(0, 3)
        .map((item) => `${getWarehouseItemLabel(item)}: faltan ${formatOperationalKg(item.missingKg)}`)
        .join(" / ");
      const validationMessage = action === "prepare"
        ? `Antes de marcar como alistada debe registrar las salidas completas. ${missingText}`
        : `Antes de despachar debe registrar las salidas completas. ${missingText}`;
      setError(validationMessage);
      alert(validationMessage);
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

    printHtmlDocument(buildWarehouseOrderHtml(selectedSale), { title: `Orden ${selectedSale.code}` });
    setMessage("Orden abierta para imprimir o guardar como PDF.");
  };

  const printWarehouseOrderFromList = async (sale) => {
    const title = `Orden ${sale.code}`;
    const documentTab = openLoadingDocumentTab(title);

    setMessage("");
    setError("");

    try {
      const saleDetail = await apiRequest(`/sales/${sale.id}`);
      const html = buildWarehouseOrderHtml(saleDetail);

      if (documentTab) {
        writeDocumentTab(documentTab, html);
      } else {
        printHtmlDocument(html, { title });
      }

      setMessage(`Orden ${saleDetail.code || sale.code} abierta para revisar, imprimir o guardar como PDF.`);
    } catch (requestError) {
      if (documentTab) {
        documentTab.close();
      }
      setError(`Error al abrir PDF de pedido: ${requestError.message}`);
    }
  };

  const deleteSaleOrder = async (sale) => {
    if (!sale?.id) return;

    const confirmed = window.confirm(
      `Confirma eliminar de raiz la orden ${sale.code}? Esta accion se usa solo para reiniciar pruebas y no se puede deshacer.`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${sale.id}`, { method: "DELETE" });
      if (selectedSale?.id === sale.id) {
        setSelectedSale(null);
        setLoadingDetail(false);
      }
      await loadData();
      window.alert(`Orden ${sale.code} eliminada correctamente.`);
    } catch (requestError) {
      window.alert(`No se pudo eliminar la orden ${sale.code}: ${requestError.message}`);
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const hasCompleteOutputsForSale = () => {
    if (!selectedSale?.items?.length) return false;

    return getIncompleteOutputItems().length === 0;
  };

  const pickerRow = lotPicker ? assignmentRows[lotPicker.rowIndex] : null;
  const pickerGroups = getLotPickerGroups();

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

      <div className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Buscar por venta, cliente, cafe, lote asignado, proveedor, encargado o estado"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Encargado
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink"
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
        </label>
      </div>

      <div className="grid min-w-0 gap-5">
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
                    <th className="px-3 py-2">Salidas registradas</th>
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
                      <td className="max-w-xs px-3 py-2 text-xs text-slate-600">
                        {getAssignedLotSummary(sale)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={getSaleStatusTone(sale)}>{saleStatusLabels[sale.status] || sale.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{getSaleNextAction(sale)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            type="button"
                            onClick={() => loadSaleDetail(sale.id)}
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded border border-leaf bg-emerald-50 px-2 py-1 text-xs font-semibold text-leaf hover:bg-emerald-100"
                            type="button"
                            onClick={() => printWarehouseOrderFromList(sale)}
                          >
                            <Printer size={14} />
                            PDF
                          </button>
                          {canDeleteOrders && (
                            <button
                              className="inline-flex items-center gap-1 rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              type="button"
                              onClick={() => deleteSaleOrder(sale)}
                              disabled={saving}
                            >
                              <Trash2 size={14} />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(selectedSale || loadingDetail) && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6">
            <aside className="my-4 w-full max-w-7xl overflow-hidden rounded border border-slate-200 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Detalle operativo</h2>
                  {selectedSale && (
                    <p className="text-sm text-slate-500">
                      {selectedSale.code} · {selectedSale.client_name}
                    </p>
                  )}
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => {
                    setSelectedSale(null);
                    setLoadingDetail(false);
                  }}
                >
                  <X size={16} />
                  Cerrar
                </button>
                {selectedSale && canDeleteOrders && (
                  <button
                    className="inline-flex items-center gap-2 rounded border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    type="button"
                    onClick={() => deleteSaleOrder(selectedSale)}
                    disabled={saving}
                  >
                    <Trash2 size={16} />
                    Eliminar orden
                  </button>
                )}
              </div>
              <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-4 sm:p-5">
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
                    <p>Hay cafe marcado como faltante. Revise el modulo Lotes asignados para ver cuanto comprar segun la receta del perfil.</p>
                  </div>
                )}
                {selectedSale.status === "ensamble_definido" && selectedSale.notes && (
                  <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <p className="font-semibold">Correccion solicitada por laboratorio</p>
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
                {selectedSale.items?.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className={`overflow-hidden rounded border border-slate-200 text-sm shadow-sm ${itemAccentClasses[itemIndex % itemAccentClasses.length]}`}
                  >
                    {(() => {
                      const suggested = getSuggestedQuantities(item);
                      const outputCoverageKg = getItemOutputCoverageKg(item);
                      const physicalTakenKg = Number(item.reserved_kg || 0);
                      const showPhysicalTaken = Math.abs(outputCoverageKg - physicalTakenKg) > 0.1;

                      return (
                        <div className="space-y-4 p-3">
                          <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
                            <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${itemNumberClasses[itemIndex % itemNumberClasses.length]}`}>
                              {itemIndex + 1}
                            </span>
                            <div>
                              <p className="font-medium text-ink">{getWarehouseItemLabel(item)}</p>
                              <p className="text-slate-500">
                                <span className="font-semibold text-slate-700">{item.product_form || "Sin presentacion"}</span>
                                {" · "}
                                Pedido: {formatOperationalKg(item.quantity_kg)}
                                {getItemOperationalKg(item) !== Number(item.quantity_kg) && (
                                  <> · Operativo bodega: {formatOperationalKg(getItemOperationalKg(item))}</>
                                )}
                              </p>
                              <p className="mt-1 text-xs">
                                <span className="text-amber-700">
                                  Sacado: {formatOperationalKg(outputCoverageKg)}
                                  {showPhysicalTaken && <> · Fisico: {formatOperationalKg(physicalTakenKg)}</>}
                                </span>
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

                          <div className="rounded border border-slate-200 bg-slate-50 p-3">
                            <label className="text-xs font-semibold uppercase text-slate-500">
                              Encargado de este cafe
                            </label>
                            <input
                              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                              placeholder="Nombre de la persona que alista este item"
                              value={itemAssignees[item.id] || ""}
                              maxLength={120}
                              onChange={(event) => updateItemAssignee(item.id, event.target.value)}
                              disabled={saving || ["alistada", "despachada"].includes(selectedSale.status)}
                            />
                          </div>

                          {item.shortage_marked && item.shortage_notes && (
                            <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              Motivo faltante: {cleanShortageNotes(item.shortage_notes)}
                            </p>
                          )}

                          {getTakenLotsForItem(item).length > 0 && (
                            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                              <p className="font-semibold uppercase">Salidas ya registradas</p>
                              <div className="mt-2 space-y-1">
                                {getTakenLotsForItem(item).map((lot) => (
                                  <div
                                    key={lot.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-200 bg-white px-3 py-2"
                                  >
                                    <p className="min-w-0">
                                      {formatCoffeeLotCodeName(lot)} - {formatOperationalKg(lot.quantity_kg)}
                                      {cleanAssignmentNotes(lot.notes) ? ` - ${cleanAssignmentNotes(lot.notes)}` : ""}
                                    </p>
                                    {!["alistada", "despachada", "anulada"].includes(selectedSale.status) && (
                                      <button
                                        className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                        type="button"
                                        onClick={() => unassignTakenLot(lot)}
                                        disabled={saving}
                                      >
                                        Desasignar
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "ensamble_definido"].includes(selectedSale.status) && (
                            <div className="space-y-3">
                              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-base text-emerald-900">
                                <span className="font-semibold">Sugerencia en pergamino:</span>{" "}
                                {formatOperationalKg(calculateSourceKgForItem(item, item.quantity_kg, "Pergamino"))}
                              </div>
                              {renderAssignmentBlock(item, {
                                assignmentType: "directo",
                                title: "Registrar salida de este cafe",
                                description: "Seleccione el lote usado y la cantidad retirada. Si uso mas de un lote, agregue otra linea.",
                                addLabel: "Agregar otro lote",
                              })}
                            </div>
                          )}

                          {["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "ensamble_definido"].includes(selectedSale.status) && (
                            <button
                              className="w-full rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              type="button"
                              onClick={() => saveAssignments(item)}
                              disabled={saving || ["alistada", "despachada"].includes(selectedSale.status)}
                            >
                              Confirmar salida de este cafe
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>

              {["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "ensamble_definido"].includes(selectedSale.status) && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    onClick={() => saveAssignments()}
                    disabled={saving || ["alistada", "despachada"].includes(selectedSale.status)}
                  >
                    Registrar todas las salidas
                  </button>
                </div>
              )}

              {["pendiente_alistamiento", "pendiente_bodega"].includes(selectedSale.status) && (
                <div className="grid gap-2">
                  <Link
                    className="inline-flex w-full items-center justify-center rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50"
                    to={`/procesos?saleId=${selectedSale.id}`}
                  >
                    Solicitar proceso para este pedido
                  </Link>
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
              </div>
            </aside>
          </div>
        )}
      </div>

      {pickerRow && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-6">
          <div className="my-4 w-full max-w-4xl overflow-hidden rounded border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h2 className="text-lg font-bold text-ink">Buscar lote</h2>
                <p className="text-sm text-slate-500">
                  Presentacion: {pickerRow.presentationFilter || "Todas"}
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={closeLotPicker}
              >
                <X size={16} />
                Cerrar
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  className="w-full rounded border border-slate-300 py-3 pl-10 pr-3 text-base"
                  placeholder="Buscar por codigo, proveedor, cafe, proceso o categoria"
                  value={lotPickerSearch}
                  onChange={(event) => setLotPickerSearch(event.target.value)}
                  autoFocus
                />
              </div>

              {pickerGroups.length === 0 ? (
                <EmptyState title="Sin lotes disponibles" message="Cambie la presentacion o revise si hay cafe disponible en inventario." />
              ) : (
                <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
                  {pickerGroups.map((group) => (
                    <div key={group.name} className="rounded border border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="font-semibold text-slate-800">{group.name}</p>
                        <p className="text-sm font-semibold text-leaf">{formatOperationalKg(group.kg)}</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.lots.map((lot) => (
                          <button
                            key={lot.id}
                            className="grid w-full gap-1 px-3 py-3 text-left hover:bg-emerald-50 sm:grid-cols-[minmax(0,1fr)_130px]"
                            type="button"
                            onClick={() => selectLotForPicker(lot.id)}
                          >
                            <span className="font-semibold text-ink">{formatCoffeeLotCodeName(lot)}</span>
                            <span className="font-semibold text-leaf sm:text-right">
                              {formatOperationalKg(getLotAvailableForAssignmentRow(lot.id, lotPicker.rowIndex))}
                            </span>
                            <span className="text-sm text-slate-500 sm:col-span-2">
                              {[lot.presentation, lot.commercial_classification, lot.coffee_type_name, lot.coffee_profile_name, lot.supplier_name]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default WarehousePendingPage;
