import { Edit3, FileText, RefreshCw, Save, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatOperationalKg } from "../../utils/coffeeCalculations";
import { formatCoffeeLotCodeName, getCoffeeLotGroup, groupCoffeeLots } from "../../utils/coffeeLots";
import { openPurchaseOrderPrint } from "../../utils/purchaseOrderDocument";
import { lotStatusLabels, processStatusLabels } from "../../utils/workflow";
import { printHtmlDocument } from "../../utils/printHtml";

const initialLiquidation = {
  orderCode: "",
  orderDate: new Date().toISOString().slice(0, 10),
  supplierName: "",
  supplierDocument: "",
  supplierPhone: "",
  supplierOriginZone: "",
  supplierAddress: "",
  lotCode: "",
  lotPresentation: "",
  grossWeightKg: "",
  netWeightKg: "",
  performanceFactor: "",
  createdByName: "",
  coffeeDetail: "",
  purchaseBaseFactor: "90",
  purchasePriceFactor90: "",
  purchasePricePerKg: "",
  items: [],
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

const formatKg = formatOperationalKg;
const formatOptionalKg = (value) => (value === null || value === undefined || value === "" ? "-" : formatKg(value));
const formatMoneyValue = (value) => Number(value || 0).toLocaleString("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("es-CO") : "-");

const getShipmentCoffeeName = (shipment) => [
  shipment.lot_code,
  shipment.presentation,
  shipment.coffee_profile_name || shipment.coffee_variety || shipment.commercial_classification,
  shipment.coffee_type_name,
  shipment.supplier_name,
].filter(Boolean).join(" - ");

const buildFarmShipmentHtml = (shipment) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Envio a finca ${shipment.lot_code || ""}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
        h1 { font-size: 22px; margin: 0 0 6px; }
        h2 { font-size: 15px; margin: 22px 0 8px; }
        p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; }
        .muted { color: #475569; }
        .box { border: 1px solid #cbd5e1; padding: 12px; margin-top: 12px; }
      </style>
    </head>
    <body>
      <h1>Orden de envio a finca</h1>
      <p class="muted">Fecha de envio: ${formatDateTime(shipment.shipped_at)}</p>
      <div class="box">
        <p><strong>Lote:</strong> ${shipment.lot_code || "-"}</p>
        <p><strong>Cafe:</strong> ${getShipmentCoffeeName(shipment)}</p>
        <p><strong>Proveedor:</strong> ${shipment.supplier_name || "-"}</p>
        <p><strong>Cantidad enviada:</strong> ${formatKg(shipment.quantity_kg)}</p>
        <p><strong>Enviado por:</strong> ${shipment.shipped_by_name || "-"}</p>
      </div>
      <h2>Datos de calidad del lote enviado</h2>
      <table>
        <tbody>
          <tr><th>Humedad</th><td>${shipment.humidity_percent ?? "-"}%</td><th>Factor</th><td>${shipment.performance_factor ?? "-"}</td></tr>
          <tr><th>Aroma</th><td>${shipment.lab_aroma || "-"}</td><th>Sabor</th><td>${shipment.lab_flavor || "-"}</td></tr>
          <tr><th>Dulzor</th><td>${shipment.lab_sweetness || "-"}</td><th>Cuerpo</th><td>${shipment.lab_body || "-"}</td></tr>
          <tr><th>Residual</th><td>${shipment.lab_residual || "-"}</td><th>Taza limpia</th><td>${shipment.lab_clean_cup || "-"}</td></tr>
          <tr><th>Score</th><td>${shipment.lab_score ?? "-"}</td><th>Notas</th><td>${shipment.lab_notes || "-"}</td></tr>
        </tbody>
      </table>
    </body>
  </html>
`;
const formatMoney = (value) => `COP ${formatMoneyValue(value)}`;
const toInputNumber = (value) => (value === null || value === undefined ? "" : value);
const todayInputDate = () => new Date().toISOString().slice(0, 10);
const toInputDate = (value) => {
  if (!value) return todayInputDate();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};
const parseAmount = (value) => Number(String(value ?? "0").replace(",", ".")) || 0;
const getPurchaseOrderSnapshot = (order) => order?.purchase_order_snapshot && typeof order.purchase_order_snapshot === "object"
  ? order.purchase_order_snapshot
  : {};
const getPurchaseOrderItems = (order) => {
  const items = getPurchaseOrderSnapshot(order).items;
  return Array.isArray(items) ? items : [];
};
const getPurchaseOrderCoffeeName = (order) => {
  const snapshot = getPurchaseOrderSnapshot(order);
  const items = getPurchaseOrderItems(order);

  if (items.length > 1) return snapshot.coffeeDetail || `Liquidacion agrupada de ${items.length} lotes`;
  if (items.length === 1) return items[0].coffeeDetail || snapshot.coffeeDetail || "Cafe liquidado";

  return [
    order.lot_presentation,
    order.coffee_profile_name || order.coffee_variety || order.coffee_type_name || order.commercial_classification,
  ].filter(Boolean).join(" - ") || "Cafe liquidado";
};
const getPurchaseOrderLotLabel = (order) => {
  const items = getPurchaseOrderItems(order);
  if (items.length > 0) return items.map((item) => item.lotCode).filter(Boolean).join(", ");
  return order.lot_code || "-";
};
const getPurchaseOrderKg = (order) => {
  const items = getPurchaseOrderItems(order);
  if (items.length > 0) return items.reduce((sum, item) => sum + Number(item.netWeightKg || 0), 0);
  return Number(order.net_weight_kg || 0);
};
const payableStatusLabels = {
  pendiente: "Pendiente",
  pago_parcial: "Abono",
  pagada: "Pagada",
};
const payableStatusTone = (status) => (status === "pagada" ? "success" : "warning");
const getPaymentMethodDisplayName = (method) => {
  const name = method?.name || method?.payment_method_name || "";
  return String(name).toLowerCase() === "transferencia" ? "Consignacion" : name;
};
const isLiquidationPaymentMethod = (method) => ["efectivo", "transferencia", "consignacion"].includes(String(method?.name || "").toLowerCase());
const calculatePurchaseOrderEditItem = (item) => {
  const priceData = calculateLiquidationPrices(
    item.purchasePriceFactor90,
    item.performanceFactor,
    item.purchaseBaseFactor
  );
  const netWeightKg = parseAmount(item.netWeightKg);
  const purchaseTotal = Number((netWeightKg * Number(priceData.purchasePricePerKg || 0)).toFixed(2));

  return {
    ...item,
    adjustmentPercent: priceData.adjustmentPercent,
    adjustedPriceCarga: priceData.adjustedPriceCarga,
    purchasePricePerKg: priceData.purchasePricePerKg,
    purchaseTotal,
  };
};
const buildPurchaseOrderEditForm = (order) => {
  const snapshot = getPurchaseOrderSnapshot(order);
  const snapshotItems = getPurchaseOrderItems(order);
  const fallbackItems = snapshotItems.length > 0
    ? snapshotItems
    : [{
        id: order.lot_id || order.id,
        lotCode: snapshot.lotCode || order.lot_code || "",
        coffeeDetail: snapshot.coffeeDetail || getPurchaseOrderCoffeeName(order),
        grossWeightKg: snapshot.grossWeightKg || order.gross_weight_kg || "",
        netWeightKg: snapshot.netWeightKg || order.net_weight_kg || "",
        performanceFactor: snapshot.performanceFactor || order.performance_factor || "",
        purchaseBaseFactor: snapshot.purchaseBaseFactor || 90,
        purchasePriceFactor90: snapshot.purchasePriceFactor90 || "",
        adjustedPriceCarga: snapshot.adjustedPriceCarga || "",
        purchasePricePerKg: snapshot.purchasePricePerKg || order.purchase_price_per_kg || "",
        purchaseTotal: snapshot.purchaseTotal || order.purchase_total || order.total || "",
      }];

  return {
    id: order.id,
    originalSnapshot: snapshot,
    orderCode: snapshot.orderCode || order.code || "",
    orderDate: toInputDate(snapshot.orderDate || order.created_at),
    supplierName: snapshot.supplierName || order.supplier_name || order.third_party_name || "",
    supplierDocument: snapshot.supplierDocument || order.supplier_document || "",
    supplierPhone: snapshot.supplierPhone || order.supplier_phone || "",
    supplierOriginZone: snapshot.supplierOriginZone || order.supplier_origin_zone || "",
    supplierAddress: snapshot.supplierAddress || order.supplier_address || "",
    lotPresentation: snapshot.lotPresentation || order.lot_presentation || "",
    createdByName: snapshot.createdByName || order.created_by_name || "",
    notes: snapshot.notes || order.notes || "",
    items: fallbackItems.map((item, index) => calculatePurchaseOrderEditItem({
      id: item.id || `${item.lotCode || "item"}-${index}`,
      lotCode: item.lotCode || "",
      coffeeDetail: item.coffeeDetail || item.detail || "Cafe liquidado",
      grossWeightKg: item.grossWeightKg ?? item.grossKilos ?? "",
      netWeightKg: item.netWeightKg ?? item.kilos ?? "",
      performanceFactor: item.performanceFactor ?? "",
      purchaseBaseFactor: item.purchaseBaseFactor ?? 90,
      purchasePriceFactor90: item.purchasePriceFactor90 ?? item.priceFactor90 ?? "",
      adjustedPriceCarga: item.adjustedPriceCarga ?? item.priceCarga ?? "",
      purchasePricePerKg: item.purchasePricePerKg ?? item.priceKg ?? "",
      purchaseTotal: item.purchaseTotal ?? item.total ?? "",
      adjustmentPercent: item.adjustmentPercent ?? 0,
    })),
  };
};
const getPurchaseOrderEditTotal = (form) => (form?.items || []).reduce(
  (sum, item) => sum + Number(calculatePurchaseOrderEditItem(item).purchaseTotal || 0),
  0
);
const buildSnapshotFromPurchaseOrderEditForm = (form) => {
  const items = (form.items || []).map((rawItem) => {
    const item = calculatePurchaseOrderEditItem(rawItem);

    return {
      id: item.id,
      lotCode: item.lotCode,
      coffeeDetail: item.coffeeDetail,
      grossWeightKg: parseAmount(item.grossWeightKg),
      netWeightKg: parseAmount(item.netWeightKg),
      performanceFactor: item.performanceFactor,
      purchaseBaseFactor: parseAmount(item.purchaseBaseFactor) || 90,
      purchasePriceFactor90: parseAmount(item.purchasePriceFactor90),
      adjustedPriceCarga: Number(item.adjustedPriceCarga || 0),
      adjustmentPercent: Number(item.adjustmentPercent || 0),
      purchasePricePerKg: Number(item.purchasePricePerKg || 0),
      purchaseTotal: Number(item.purchaseTotal || 0),
    };
  });
  const total = items.reduce((sum, item) => sum + Number(item.purchaseTotal || 0), 0);

  return {
    ...form.originalSnapshot,
    orderCode: form.orderCode,
    orderDate: form.orderDate,
    supplierName: form.supplierName,
    supplierDocument: form.supplierDocument,
    supplierPhone: form.supplierPhone,
    supplierOriginZone: form.supplierOriginZone,
    supplierAddress: form.supplierAddress,
    lotCode: items.length > 1 ? items.map((item) => item.lotCode).filter(Boolean).join(", ") : items[0]?.lotCode || "",
    lotPresentation: form.lotPresentation,
    coffeeDetail: items.length > 1 ? `Liquidacion agrupada de ${items.length} lotes` : items[0]?.coffeeDetail || "",
    grossWeightKg: items.reduce((sum, item) => sum + Number(item.grossWeightKg || 0), 0),
    netWeightKg: items.reduce((sum, item) => sum + Number(item.netWeightKg || 0), 0),
    performanceFactor: items.length > 1 ? "" : items[0]?.performanceFactor || "",
    purchaseTotal: total,
    notes: form.notes,
    createdByName: form.createdByName,
    isGrouped: items.length > 1 || Boolean(form.originalSnapshot?.isGrouped),
    items,
  };
};
const formatProfileOptionLabel = (profile) => {
  const code = profile?.internal_code || profile?.coffee_profile_code || profile?.code;
  return [code, profile?.name].filter(Boolean).join(" - ");
};

const getProcessLocationGroup = (processType) => {
  if (processType === "Trilladora") return "En trilla";
  if (processType === "Seleccion electronica") return "En seleccionadora";
  return "En finca";
};
const calculateLiquidationPrices = (priceFactor90, performanceFactor, baseFactor = 90) => {
  const basePriceCarga = Number(priceFactor90 || 0);
  const negotiatedBaseFactor = baseFactor === "" || baseFactor === null || baseFactor === undefined
    ? 90
    : Number(baseFactor);
  const factor = performanceFactor === "" || performanceFactor === null || performanceFactor === undefined
    ? negotiatedBaseFactor
    : Number(performanceFactor);

  if (
    !Number.isFinite(basePriceCarga) ||
    basePriceCarga <= 0 ||
    !Number.isFinite(factor) ||
    !Number.isFinite(negotiatedBaseFactor)
  ) {
    return {
      adjustmentPercent: 0,
      adjustedPriceCarga: 0,
      purchasePricePerKg: 0,
    };
  }

  const adjustmentPercent = negotiatedBaseFactor - factor;
  const adjustedPriceCarga = Number((basePriceCarga * (1 + adjustmentPercent / 100)).toFixed(2));

  return {
    adjustmentPercent: Number(adjustmentPercent.toFixed(2)),
    adjustedPriceCarga,
    purchasePricePerKg: Number((adjustedPriceCarga / 125).toFixed(2)),
  };
};

const buildLiquidationItem = (lot) => {
  const basePrice = Number(lot.purchase_base_price_factor90_cop || 0);
  const basePriceValue = basePrice > 0 ? String(basePrice) : "0";
  const priceData = calculateLiquidationPrices(basePriceValue, lot.performance_factor, "90");

  return {
    id: lot.id,
    lotCode: lot.code || "",
    lotPresentation: lot.presentation || "Pergamino",
    grossWeightKg: toInputNumber(lot.gross_weight_kg),
    netWeightKg: toInputNumber(lot.net_weight_kg),
    performanceFactor: toInputNumber(lot.performance_factor),
    coffeeDetail: formatCoffeeLotCodeName(lot),
    purchaseBaseFactor: "90",
    purchasePriceFactor90: basePriceValue,
    purchasePricePerKg: priceData.purchasePricePerKg || "",
  };
};

const buildLiquidationForm = (lots, user) => {
  const selectedLots = Array.isArray(lots) ? lots : [lots];
  const firstLot = selectedLots[0] || {};
  const items = selectedLots.map(buildLiquidationItem);
  const totalGrossWeight = items.reduce((sum, item) => sum + Number(item.grossWeightKg || 0), 0);
  const totalNetWeight = items.reduce((sum, item) => sum + Number(item.netWeightKg || 0), 0);

  return {
  orderCode: "",
  orderDate: todayInputDate(),
  supplierName: firstLot.supplier_name || "",
  supplierDocument: firstLot.supplier_document || "",
  supplierPhone: firstLot.supplier_phone || "",
  supplierOriginZone: firstLot.supplier_origin_zone || firstLot.origin_zone || "",
  supplierAddress: firstLot.supplier_address || "",
  lotCode: items.map((item) => item.lotCode).filter(Boolean).join(", "),
  lotPresentation: firstLot.presentation || "Pergamino",
  grossWeightKg: totalGrossWeight ? Number(totalGrossWeight.toFixed(2)) : "",
  netWeightKg: totalNetWeight ? Number(totalNetWeight.toFixed(2)) : "",
  performanceFactor: items.length === 1 ? items[0]?.performanceFactor || "" : "",
  createdByName: user?.name || user?.username || "",
  coffeeDetail: items.length === 1 ? items[0]?.coffeeDetail || "" : `Liquidacion agrupada de ${items.length} lotes`,
  purchaseBaseFactor: "90",
  purchasePriceFactor90: items.length === 1 ? items[0]?.purchasePriceFactor90 || "" : "",
  purchasePricePerKg: items.length === 1 ? items[0]?.purchasePricePerKg || "" : "",
  items,
  notes: "",
  };
};

const buildPurchaseOrderSnapshot = (form) => {
  const items = (form.items || []).map((item) => {
    const netWeightKg = Number(item.netWeightKg || 0);
    const priceData = calculateLiquidationPrices(
      item.purchasePriceFactor90,
      item.performanceFactor,
      item.purchaseBaseFactor ?? form.purchaseBaseFactor
    );
    const purchasePricePerKg = Number(priceData.purchasePricePerKg || 0);

    return {
      ...item,
      grossWeightKg: item.grossWeightKg === "" ? null : Number(item.grossWeightKg),
      netWeightKg,
      purchaseBaseFactor: Number(item.purchaseBaseFactor || form.purchaseBaseFactor || 90),
      purchasePriceFactor90: Number(item.purchasePriceFactor90 || 0),
      adjustedPriceCarga: priceData.adjustedPriceCarga,
      adjustmentPercent: priceData.adjustmentPercent,
      purchasePricePerKg,
      purchaseTotal: Number((netWeightKg * purchasePricePerKg).toFixed(2)),
    };
  });
  const netWeightKg = items.reduce((sum, item) => sum + Number(item.netWeightKg || 0), 0);
  const grossWeightKg = items.reduce((sum, item) => sum + Number(item.grossWeightKg || 0), 0);
  const purchaseTotal = items.reduce((sum, item) => sum + Number(item.purchaseTotal || 0), 0);
  const purchasePriceFactor90 = items.length === 1 ? Number(items[0]?.purchasePriceFactor90 || 0) : null;
  const purchaseBaseFactor = items.length === 1 ? Number(items[0]?.purchaseBaseFactor || form.purchaseBaseFactor || 90) : Number(form.purchaseBaseFactor || 90);
  const purchasePricePerKg = items.length === 1 ? Number(items[0]?.purchasePricePerKg || 0) : null;

  return {
    isGrouped: items.length > 1,
    orderCode: form.orderCode,
    orderDate: form.orderDate,
    supplierName: form.supplierName,
    supplierDocument: form.supplierDocument,
    supplierPhone: form.supplierPhone,
    supplierOriginZone: form.supplierOriginZone,
    supplierAddress: form.supplierAddress,
    lotCode: form.lotCode,
    lotPresentation: form.lotPresentation,
    grossWeightKg,
    netWeightKg,
    performanceFactor: form.performanceFactor,
    createdByName: form.createdByName,
    coffeeDetail: form.coffeeDetail,
    purchaseBaseFactor,
    purchasePriceFactor90,
    purchasePricePerKg,
    purchaseTotal: Number(purchaseTotal.toFixed(2)),
    items,
    notes: form.notes,
  };
};

const InventoryPage = ({ mode = "inventory" }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [allLots, setAllLots] = useState([]);
  const [sampleOutputs, setSampleOutputs] = useState([]);
  const [farmShipments, setFarmShipments] = useState([]);
  const [inProcessInventory, setInProcessInventory] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [pendingLiquidationLots, setPendingLiquidationLots] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState("pendientes");
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState("");
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [purchaseOrderEditForm, setPurchaseOrderEditForm] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethodId: "",
    paymentReference: "",
    paidAt: todayInputDate(),
    notes: "",
  });
  const [catalogs, setCatalogs] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedLiquidationLot, setSelectedLiquidationLot] = useState(null);
  const [selectedLiquidationLotIds, setSelectedLiquidationLotIds] = useState([]);
  const [selectedAdminLot, setSelectedAdminLot] = useState(null);
  const [selectedAdminProcess, setSelectedAdminProcess] = useState(null);
  const [liquidationForm, setLiquidationForm] = useState(initialLiquidation);
  const [adminLotForm, setAdminLotForm] = useState(initialAdminLotEdit);
  const [adminProcessForm, setAdminProcessForm] = useState(initialAdminProcessEdit);
  const [selectedPresentation, setSelectedPresentation] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedProcessLocation, setSelectedProcessLocation] = useState("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [lotCodeSearch, setLotCodeSearch] = useState("");
  const [processCodeSearch, setProcessCodeSearch] = useState("");
  const [showInventoryEditModal, setShowInventoryEditModal] = useState(false);
  const [showLiquidationReviewModal, setShowLiquidationReviewModal] = useState(false);
  const [farmShipmentLot, setFarmShipmentLot] = useState(null);
  const [farmShipmentQuantity, setFarmShipmentQuantity] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canRegisterPurchase = ["admin", "accounting"].includes(user?.role);
  const canAdjustInventory = ["admin", "accounting", "warehouse"].includes(user?.role);
  const canEditCodes = ["admin", "accounting", "warehouse"].includes(user?.role);
  const canWithdrawInventory = user?.role === "admin";
  const isEditMode = mode === "edit";
  const isSampleOutputsMode = mode === "samples";
  const isFarmShipmentsMode = mode === "farm";
  const isLiquidationsMode = mode === "liquidations";

  const loadData = async () => {
    const requests = [
      apiRequest("/inventory/lots"),
      apiRequest("/lots"),
      apiRequest("/inventory/in-process"),
      canAdjustInventory ? apiRequest("/inventory/sample-outputs") : Promise.resolve([]),
      canAdjustInventory ? apiRequest("/inventory/farm-shipments") : Promise.resolve([]),
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

    if (canRegisterPurchase) {
      requests.push(apiRequest("/payables"));
    } else {
      requests.push(Promise.resolve([]));
    }

    const [
      availableData,
      allLots,
      inProcessData,
      sampleOutputData,
      farmShipmentData,
      catalogData,
      supplierData,
      processData,
      payableData,
    ] = await Promise.all(requests);
    setLots((availableData || []).filter((lot) => lot.status !== "retirado"));
    setAllLots(allLots);
    setInProcessInventory(inProcessData || []);
    setSampleOutputs(sampleOutputData || []);
    setFarmShipments(farmShipmentData || []);
    setPendingLiquidationLots(
      allLots.filter((lot) => lot.status === "pendiente_liquidacion")
    );
    setCatalogs(catalogData || null);
    setSuppliers(
      [...(supplierData || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"))
    );
    setProcesses(processData || []);
    setPurchaseOrders(payableData || []);
  };

  const selectLiquidationLot = (lot) => {
    setSelectedLiquidationLot(lot);
    setLiquidationForm(buildLiquidationForm(lot, user));
    setSelectedLiquidationLotIds([lot.id]);
    setShowLiquidationReviewModal(false);
    setMessage("");
    setError("");
  };

  const toggleLiquidationLotSelection = (lot) => {
    setSelectedLiquidationLotIds((currentIds) => {
      const exists = currentIds.includes(lot.id);
      const nextIds = exists
        ? currentIds.filter((id) => id !== lot.id)
        : [...currentIds, lot.id];
      const selectedLots = pendingLiquidationLots.filter((pendingLot) => nextIds.includes(pendingLot.id));

      if (selectedLots.length > 0) {
        setSelectedLiquidationLot(selectedLots[0]);
        setLiquidationForm(buildLiquidationForm(selectedLots, user));
      } else {
        setSelectedLiquidationLot(null);
        setLiquidationForm(initialLiquidation);
        setShowLiquidationReviewModal(false);
      }

      return nextIds;
    });
    setMessage("");
    setError("");
  };

  const selectSupplierLiquidationLots = (supplierName) => {
    const selectedLots = pendingLiquidationLots.filter((lot) => (lot.supplier_name || "") === supplierName);
    setSelectedLiquidationLotIds(selectedLots.map((lot) => lot.id));
    setSelectedLiquidationLot(selectedLots[0] || null);
    setLiquidationForm(selectedLots.length ? buildLiquidationForm(selectedLots, user) : initialLiquidation);
    setShowLiquidationReviewModal(false);
    setMessage("");
    setError("");
  };

  const updateLiquidationItem = (itemId, field, value) => {
    setLiquidationForm((currentForm) => {
      const nextItems = (currentForm.items || []).map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
              ...(field === "purchasePriceFactor90" || field === "performanceFactor"
                ? {
                    purchasePricePerKg: calculateLiquidationPrices(
                      field === "purchasePriceFactor90" ? value : item.purchasePriceFactor90,
                      field === "performanceFactor" ? value : item.performanceFactor,
                      item.purchaseBaseFactor ?? currentForm.purchaseBaseFactor
                    ).purchasePricePerKg || "",
                  }
                : {}),
            }
          : item
      );
      const totalGrossWeight = nextItems.reduce((sum, item) => sum + Number(item.grossWeightKg || 0), 0);
      const totalNetWeight = nextItems.reduce((sum, item) => sum + Number(item.netWeightKg || 0), 0);

      return {
        ...currentForm,
        items: nextItems,
        lotCode: nextItems.map((item) => item.lotCode).filter(Boolean).join(", "),
        grossWeightKg: totalGrossWeight ? Number(totalGrossWeight.toFixed(2)) : "",
        netWeightKg: totalNetWeight ? Number(totalNetWeight.toFixed(2)) : "",
        coffeeDetail: nextItems.length === 1 ? nextItems[0]?.coffeeDetail || "" : `Liquidacion agrupada de ${nextItems.length} lotes`,
        purchasePriceFactor90: nextItems.length === 1 ? nextItems[0]?.purchasePriceFactor90 || "" : "",
        purchasePricePerKg: nextItems.length === 1 ? nextItems[0]?.purchasePricePerKg || "" : "",
      };
    });
  };

  const openLiquidationReview = (event) => {
    event.preventDefault();

    if (!selectedLiquidationLot) {
      setError("Seleccione un lote pendiente de liquidacion.");
      return;
    }

    setShowLiquidationReviewModal(true);
    setMessage("");
    setError("");
  };

  const liquidateSelectedLot = async (event) => {
    event.preventDefault();

    if (!selectedLiquidationLot) {
      setError("Seleccione un lote pendiente de liquidacion.");
      return;
    }

    const invalidItem = (liquidationForm.items || []).find((item) => !item.purchasePriceFactor90 || Number(item.purchasePriceFactor90) <= 0);
    if (invalidItem) {
      setError("Ingrese el precio factor base por carga en cada lote antes de liquidar.");
      return;
    }

    const purchaseOrderSnapshot = buildPurchaseOrderSnapshot(liquidationForm);

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const selectedItems = purchaseOrderSnapshot.items || [];
      const isGrouped = selectedItems.length > 1;
      const response = isGrouped
        ? await apiRequest("/lots/liquidate-group", {
          method: "POST",
          body: JSON.stringify({
            items: selectedItems.map((item) => ({
              id: item.id,
              purchaseBaseFactor: item.purchaseBaseFactor,
              purchasePriceFactor90: item.purchasePriceFactor90,
              purchasePricePerKg: item.purchasePricePerKg,
            })),
            notes: liquidationForm.notes,
            purchaseOrderSnapshot,
          }),
        })
        : await apiRequest(`/lots/${selectedLiquidationLot.id}/liquidate`, {
          method: "PUT",
          body: JSON.stringify({
            purchasePricePerKg: selectedItems[0]?.purchasePricePerKg ?? null,
            purchaseBaseFactor: selectedItems[0]?.purchaseBaseFactor ?? liquidationForm.purchaseBaseFactor ?? 90,
            purchasePriceFactor90: selectedItems[0]?.purchasePriceFactor90 ?? null,
            notes: liquidationForm.notes,
            purchaseOrderSnapshot,
          }),
        });
      try {
        openPurchaseOrderPrint({
          ...(response?.purchase_order || response?.data?.purchase_order || {}),
          purchase_order_snapshot: purchaseOrderSnapshot,
          code: purchaseOrderSnapshot.orderCode || response?.purchase_order?.code || response?.data?.purchase_order?.code,
        });
      } catch (printError) {
        console.warn("No se pudo abrir la orden de compra automaticamente", printError);
      }
      setSelectedLiquidationLot(null);
      setSelectedLiquidationLotIds([]);
      setLiquidationForm(initialLiquidation);
      setShowLiquidationReviewModal(false);
      await loadData();
      setMessage("Liquidacion guardada. El cafe queda disponible y la orden de compra se puede descargar desde Orden de compra.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const openPurchaseOrderPayment = (order) => {
    const balanceDue = Number(order.balance_due ?? order.total ?? 0);
    const defaultMethod = (catalogs?.paymentMethods || []).find((method) => isLiquidationPaymentMethod(method));

    setPaymentOrder(order);
    setPaymentForm({
      amount: balanceDue > 0 ? String(balanceDue) : "",
      paymentMethodId: defaultMethod?.id ? String(defaultMethod.id) : "",
      paymentReference: "",
      paidAt: todayInputDate(),
      notes: "",
    });
    setMessage("");
    setError("");
  };

  const openPurchaseOrderEdit = async (order) => {
    try {
      const fullOrder = await apiRequest(`/payables/${order.id}`);
      setPurchaseOrderEditForm(buildPurchaseOrderEditForm(fullOrder));
      setMessage("");
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updatePurchaseOrderEditField = (field, value) => {
    setPurchaseOrderEditForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const updatePurchaseOrderEditItem = (itemId, field, value) => {
    setPurchaseOrderEditForm((currentForm) => ({
      ...currentForm,
      items: (currentForm.items || []).map((item) => (
        item.id === itemId ? calculatePurchaseOrderEditItem({ ...item, [field]: value }) : item
      )),
    }));
  };

  const savePurchaseOrderEdit = async ({ shouldPrint = false } = {}) => {
    if (!purchaseOrderEditForm?.orderCode?.trim()) {
      setError("El codigo de la orden es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const snapshot = buildSnapshotFromPurchaseOrderEditForm(purchaseOrderEditForm);
      const total = getPurchaseOrderEditTotal(purchaseOrderEditForm);
      const response = await apiRequest(`/payables/${purchaseOrderEditForm.id}/purchase-order`, {
        method: "PUT",
        body: JSON.stringify({
          code: purchaseOrderEditForm.orderCode,
          purchaseOrderSnapshot: snapshot,
          total,
          notes: purchaseOrderEditForm.notes,
        }),
      });
      const updatedOrder = response.data;
      setPurchaseOrderEditForm(null);
      await loadData();
      setMessage("Orden de compra actualizada. Ya puede confirmar el pago con los datos corregidos.");
      if (shouldPrint) {
        openPurchaseOrderPrint(updatedOrder);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const closePurchaseOrderPayment = () => {
    setPaymentOrder(null);
    setPaymentForm({
      amount: "",
      paymentMethodId: "",
      paymentReference: "",
      paidAt: todayInputDate(),
      notes: "",
    });
  };

  const registerPurchaseOrderPayment = async (event) => {
    event.preventDefault();

    if (!paymentOrder) return;

    const amount = Number(String(paymentForm.amount || "0").replace(",", "."));
    const balanceDue = Number(paymentOrder.balance_due || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingrese un valor de pago valido.");
      return;
    }

    if (amount > balanceDue) {
      setError("El pago no puede superar el saldo pendiente.");
      return;
    }

    if (!paymentForm.paymentMethodId) {
      setError("Seleccione si el pago fue en efectivo o consignacion.");
      return;
    }

    if (!paymentForm.paymentReference.trim()) {
      setError("Ingrese el numero de referencia o recibo del pago.");
      return;
    }

    if (!window.confirm(`Confirma registrar pago de ${formatMoney(amount)} para ${paymentOrder.code}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/payables/${paymentOrder.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          paymentMethodId: Number(paymentForm.paymentMethodId),
          paymentReference: paymentForm.paymentReference.trim(),
          paidAt: paymentForm.paidAt || todayInputDate(),
          notes: paymentForm.notes,
        }),
      });
      closePurchaseOrderPayment();
      await loadData();
      setMessage("Pago registrado correctamente. La orden se reclasifico segun el saldo pendiente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

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

  const withdrawInventoryLot = async (lot) => {
    if (!canWithdrawInventory) {
      setError("Solo el administrador puede retirar lotes del inventario.");
      return;
    }

    if (!lot || lot.status === "retirado") return;

    const notes = window.prompt(
      `Motivo para retirar ${formatCoffeeLotCodeName(lot)} del inventario`,
      "Salida directa de inventario"
    );
    const cleanNotes = String(notes || "").trim();

    if (!cleanNotes) {
      setError("Debe escribir una nota para retirar el lote del inventario.");
      return;
    }

    if (!window.confirm(`Confirma retirar ${formatCoffeeLotCodeName(lot)} del inventario? Esta accion dejara el lote sin disponibilidad.`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${lot.id}/withdraw`, {
        method: "PUT",
        body: JSON.stringify({ notes: cleanNotes }),
      });
      if (selectedAdminLot?.id === lot.id) {
        cancelAdminLotEdit();
      }
      await loadData();
      setMessage("Lote retirado del inventario. La nota quedo guardada en el historial del lote.");
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

  const openFarmShipmentModal = (lot) => {
    setFarmShipmentLot(lot);
    setFarmShipmentQuantity(lot.operational_available_kg ?? lot.available_weight_kg ?? "");
    setMessage("");
    setError("");
  };

  const closeFarmShipmentModal = () => {
    setFarmShipmentLot(null);
    setFarmShipmentQuantity("");
  };

  const registerFarmShipment = async (event) => {
    event.preventDefault();

    if (!farmShipmentLot) return;

    const quantity = Number(farmShipmentQuantity);
    const available = Number(farmShipmentLot.available_weight_kg || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("La cantidad para enviar a finca debe ser mayor a cero.");
      return;
    }

    if (quantity > available) {
      setError("La cantidad enviada a finca no puede superar el disponible fisico del lote.");
      return;
    }

    if (!window.confirm(`Confirma enviar ${formatKg(quantity)} de ${formatCoffeeLotCodeName(farmShipmentLot)} a finca?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/inventory/lots/${farmShipmentLot.id}/farm-shipment`, {
        method: "POST",
        body: JSON.stringify({ quantityKg: quantity }),
      });
      closeFarmShipmentModal();
      await loadData();
      setMessage("Envio a finca registrado. El cafe salio del inventario y queda en el historico de finca.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const printFarmShipment = (shipment) => {
    printHtmlDocument(buildFarmShipmentHtml(shipment), {
      title: `Envio a finca ${shipment.lot_code || ""}`,
    });
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
      const response = await apiRequest(`/lots/${lot.id}/code`, {
        method: "PUT",
        body: JSON.stringify({ code: cleanCode }),
      });
      const resetCount = response?.data?.liquidation_reset?.resetLotIds?.length || 0;
      await loadData();
      setMessage(resetCount > 0
        ? `Codigo de lote actualizado. Se reemplazo la liquidacion anterior y ${resetCount} lote(s) volvieron a pendientes de liquidacion.`
        : "Codigo de lote actualizado.");
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

      let resetCount = 0;
      if (cleanCode && cleanCode !== selectedAdminLot.code) {
        const codeResponse = await apiRequest(`/lots/${selectedAdminLot.id}/code`, {
          method: "PUT",
          body: JSON.stringify({ code: cleanCode }),
        });
        resetCount = codeResponse?.data?.liquidation_reset?.resetLotIds?.length || 0;
      }

      cancelAdminLotEdit();
      await loadData();
      setMessage(resetCount > 0
        ? `Datos del lote actualizados. Se reemplazo la liquidacion anterior y ${resetCount} lote(s) volvieron a pendientes de liquidacion.`
        : "Datos del lote actualizados correctamente.");
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

  const liquidationTotal = selectedLiquidationLot
    ? formatMoneyValue((liquidationForm.items || []).reduce(
      (sum, item) => sum + (Number(item.netWeightKg || 0) * Number(item.purchasePricePerKg || 0)),
      0
    ))
    : "0";
  const liquidationPaymentMethods = (catalogs?.paymentMethods || []).filter(isLiquidationPaymentMethod);
  const pendingPurchaseOrders = purchaseOrders.filter((order) => order.status === "pendiente");
  const partialPurchaseOrders = purchaseOrders.filter((order) => order.status === "pago_parcial");
  const paidPurchaseOrders = purchaseOrders.filter((order) => order.status === "pagada");
  const selectedPurchaseOrders = purchaseOrderStatusFilter === "pagadas"
    ? paidPurchaseOrders
    : purchaseOrderStatusFilter === "parciales"
    ? partialPurchaseOrders
    : pendingPurchaseOrders;
  const purchaseOrderSearchTerm = purchaseOrderSearch.trim().toLowerCase();
  const filteredPurchaseOrders = selectedPurchaseOrders.filter((order) => {
    if (!purchaseOrderSearchTerm) return true;

    return [
      order.code,
      getPurchaseOrderLotLabel(order),
      order.supplier_name,
      order.third_party_name,
      getPurchaseOrderCoffeeName(order),
      order.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(purchaseOrderSearchTerm);
  });
  const purchaseOrderTotals = {
    pending: pendingPurchaseOrders.reduce((sum, order) => sum + Number(order.balance_due || 0), 0),
    partial: partialPurchaseOrders.reduce((sum, order) => sum + Number(order.balance_due || 0), 0),
    paid: paidPurchaseOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
  };

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
  const groupedFilteredLots = selectedGroup === "all"
    ? presentationFilteredLots
    : presentationFilteredLots.filter((lot) => getCoffeeLotGroup(lot) === selectedGroup);
  const inventorySearchTerm = inventorySearch.trim().toLowerCase();
  const filteredLots = groupedFilteredLots.filter((lot) => {
    if (!inventorySearchTerm) return true;

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
      lot.origin_process_type,
      lot.origin_process_code,
      lot.performance_factor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(inventorySearchTerm);
  });
  const processLocationCards = ["En finca", "En trilla", "En seleccionadora"].map((location) => {
    const rows = inProcessInventory.filter((row) => getProcessLocationGroup(row.process_type) === location);

    return {
      location,
      count: rows.length,
      kg: rows.reduce((total, row) => total + Number(row.quantity_kg || 0), 0),
    };
  });
  const filteredInProcessInventory = inProcessInventory.filter((row) => {
    if (selectedProcessLocation !== "all" && getProcessLocationGroup(row.process_type) !== selectedProcessLocation) {
      return false;
    }

    if (!inventorySearchTerm) return true;

    return [
      row.lot_code,
      row.process_code,
      row.process_type,
      row.process_location,
      row.process_status,
      row.sale_code,
      row.client_name,
      row.supplier_name,
      row.presentation,
      row.coffee_type_name,
      row.commercial_classification,
      row.coffee_variety,
      row.coffee_profile_name,
      row.performance_factor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(inventorySearchTerm);
  });
  const totalInProcessKg = inProcessInventory.reduce((total, row) => total + Number(row.quantity_kg || 0), 0);
  const totalAvailableKg = presentationFilteredLots.reduce((total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0), 0);
  const allAvailableKg = lots.reduce((total, lot) => total + Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0), 0);
  const totalSampleOutputsKg = sampleOutputs.reduce((total, movement) => total + Number(movement.quantity_kg || 0), 0);
  const totalFarmShipmentsKg = farmShipments.reduce((total, shipment) => total + Number(shipment.quantity_kg || 0), 0);
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
          <h1 className="text-xl font-bold text-ink">
            {isSampleOutputsMode ? "Salidas a muestras" : isFarmShipmentsMode ? "Lotes en finca" : isEditMode ? "Editar inventario" : isLiquidationsMode ? "Liquidaciones" : "Inventario"}
          </h1>
          <p className="text-sm text-slate-500">
            {isSampleOutputsMode
              ? "Cafe descontado del inventario para preparar muestras."
              : isFarmShipmentsMode
              ? "Cafe enviado a finca para regresar como proceso."
              : isEditMode
              ? "Busqueda y correccion de lotes, procesos, codigos, pesos y datos de laboratorio."
              : isLiquidationsMode
              ? "Lotes aprobados por laboratorio pendientes de liquidar y generar orden de compra."
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

      {isSampleOutputsMode && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-amber-800">Total en muestras</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{formatKg(totalSampleOutputsKg)}</p>
              <p className="mt-1 text-xs text-amber-800">{sampleOutputs.length} salidas registradas</p>
            </div>
          </div>
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
        </div>
      )}

      {isFarmShipmentsMode && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-emerald-800">Total enviado a finca</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{formatKg(totalFarmShipmentsKg)}</p>
              <p className="mt-1 text-xs text-emerald-800">{farmShipments.length} envios registrados</p>
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Historico de lotes enviados a finca</h2>
              <p className="mt-1 text-xs text-slate-500">Cafe que salio de inventario y debe regresar como proceso.</p>
            </div>
            {farmShipments.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin envios a finca" message="Cuando bodega envie cafe a finca, el registro aparecera aqui." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Lote origen</th>
                      <th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2">Cafe enviado</th>
                      <th className="px-3 py-2">Cantidad</th>
                      <th className="px-3 py-2">Calidad</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {farmShipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td className="px-3 py-2">{formatDateTime(shipment.shipped_at)}</td>
                        <td className="px-3 py-2 font-semibold">{shipment.lot_code}</td>
                        <td className="px-3 py-2">{shipment.supplier_name || "-"}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{getShipmentCoffeeName(shipment)}</p>
                          <p className="text-xs text-slate-500">Registrado por {shipment.shipped_by_name || "-"}</p>
                        </td>
                        <td className="px-3 py-2 font-semibold">{formatKg(shipment.quantity_kg)}</td>
                        <td className="px-3 py-2">
                          H {shipment.humidity_percent ?? "-"}% · Factor {shipment.performance_factor ?? "-"} · Score {shipment.lab_score ?? "-"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            className="inline-flex items-center gap-2 rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                            type="button"
                            onClick={() => printFarmShipment(shipment)}
                          >
                            <FileText size={14} />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
                        {canWithdrawInventory && lot.status !== "retirado" && (
                          <button
                            className="rounded border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            type="button"
                            disabled={saving}
                            onClick={() => withdrawInventoryLot(lot)}
                          >
                            Retirar lote
                          </button>
                        )}
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
                      {formatProfileOptionLabel(profile)}
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

      {isLiquidationsMode && (
        <>
      {canRegisterPurchase && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="min-w-0 rounded border border-amber-200 bg-white">
            <div className="border-b border-amber-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-amber-900">Lotes pendientes de liquidacion</h2>
              <p className="mt-1 text-xs text-slate-500">Aprobados por laboratorio, pero aun no disponibles hasta acordar la compra.</p>
              {selectedLiquidationLotIds.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="font-semibold">{selectedLiquidationLotIds.length} lote(s) seleccionados</span>
                  <button
                    className="rounded border border-amber-400 bg-white px-3 py-1 font-semibold text-amber-700 hover:bg-amber-100"
                    type="button"
                    onClick={(event) => openLiquidationReview(event)}
                  >
                    Revisar liquidacion agrupada
                  </button>
                  <button
                    className="rounded border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                    type="button"
                    onClick={() => {
                      setSelectedLiquidationLotIds([]);
                      setSelectedLiquidationLot(null);
                      setLiquidationForm(initialLiquidation);
                      setShowLiquidationReviewModal(false);
                    }}
                  >
                    Limpiar seleccion
                  </button>
                </div>
              )}
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
                      <th className="px-3 py-2">Sel.</th>
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
                        <td className="px-3 py-2">
                          <input
                            checked={selectedLiquidationLotIds.includes(lot.id)}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600"
                            onChange={() => toggleLiquidationLotSelection(lot)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(lot)}</td>
                        <td className="px-3 py-2">
                          <div>{lot.supplier_name || "-"}</div>
                          {lot.supplier_name && (
                            <button
                              className="mt-1 text-xs font-semibold text-amber-700 underline-offset-2 hover:underline"
                              onClick={() => selectSupplierLiquidationLots(lot.supplier_name || "")}
                              type="button"
                            >
                              Seleccionar proveedor
                            </button>
                          )}
                        </td>
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

          <form className="min-w-0 overflow-hidden rounded border border-amber-200 bg-white p-4" onSubmit={openLiquidationReview}>
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
                placeholder="Precio por carga segun factor base"
                type="number"
                step="0.01"
                required
                value={liquidationForm.purchasePriceFactor90}
                onChange={(event) => {
                  const value = event.target.value;
                  setLiquidationForm({
                    ...liquidationForm,
                    purchasePriceFactor90: value,
                    items: (liquidationForm.items || []).map((item) => {
                      const priceData = calculateLiquidationPrices(value, item.performanceFactor, item.purchaseBaseFactor ?? liquidationForm.purchaseBaseFactor);
                      return {
                        ...item,
                        purchasePriceFactor90: value,
                        purchasePricePerKg: priceData.purchasePricePerKg || "",
                      };
                    }),
                  });
                }}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Factor base negociado"
                type="number"
                step="0.01"
                required
                value={liquidationForm.purchaseBaseFactor}
                onChange={(event) => {
                  const value = event.target.value;
                  setLiquidationForm({
                    ...liquidationForm,
                    purchaseBaseFactor: value,
                    items: (liquidationForm.items || []).map((item) => {
                      const priceData = calculateLiquidationPrices(item.purchasePriceFactor90, item.performanceFactor, value);
                      return {
                        ...item,
                        purchaseBaseFactor: value,
                        purchasePricePerKg: priceData.purchasePricePerKg || "",
                      };
                    }),
                  });
                }}
              />
              <p className="text-xs text-slate-500">
                Se toma como precio base el factor negociado. Si el factor real queda por encima, suma; si queda por debajo, resta.
              </p>
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
                Revisar orden de compra
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Historico de ordenes de compra</h2>
              <p className="mt-1 text-xs text-slate-500">
                Control de liquidaciones pendientes, abonos parciales y compras pagadas.
              </p>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                <span className="block font-semibold">Pendientes</span>
                <span>{pendingPurchaseOrders.length} · {formatMoney(purchaseOrderTotals.pending)}</span>
              </div>
              <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                <span className="block font-semibold">Parciales</span>
                <span>{partialPurchaseOrders.length} · {formatMoney(purchaseOrderTotals.partial)}</span>
              </div>
              <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                <span className="block font-semibold">Pagadas</span>
                <span>{paidPurchaseOrders.length} · {formatMoney(purchaseOrderTotals.paid)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["pendientes", `Pendientes (${pendingPurchaseOrders.length})`],
              ["parciales", `Pagos parciales (${partialPurchaseOrders.length})`],
              ["pagadas", `Pagadas / historico (${paidPurchaseOrders.length})`],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`rounded border px-3 py-2 text-sm font-semibold ${
                  purchaseOrderStatusFilter === value ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => setPurchaseOrderStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por proveedor, numero de lote, orden o cafe comprado"
            value={purchaseOrderSearch}
            onChange={(event) => setPurchaseOrderSearch(event.target.value)}
          />
        </div>

        {filteredPurchaseOrders.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin ordenes en esta categoria" message="Cambie el filtro o la busqueda para revisar otras liquidaciones." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Orden</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Lotes</th>
                  <th className="px-3 py-2">Cafe</th>
                  <th className="px-3 py-2">Kilos</th>
                  <th className="px-3 py-2">Pago</th>
                  <th className="px-3 py-2">Referencia</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchaseOrders.map((order) => {
                  const payments = Array.isArray(order.payments) ? order.payments : [];
                  const lastPayment = payments[payments.length - 1];
                  const balanceDue = Number(order.balance_due || 0);

                  return (
                    <tr key={order.id}>
                      <td className="px-3 py-2 font-semibold text-ink">{order.code}</td>
                      <td className="px-3 py-2">{order.supplier_name || order.third_party_name || "-"}</td>
                      <td className="px-3 py-2">{getPurchaseOrderLotLabel(order)}</td>
                      <td className="px-3 py-2">{getPurchaseOrderCoffeeName(order)}</td>
                      <td className="px-3 py-2">{formatKg(getPurchaseOrderKg(order))}</td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <StatusBadge tone={payableStatusTone(order.status)}>
                            {payableStatusLabels[order.status] || order.status}
                          </StatusBadge>
                          <p className="text-xs text-slate-600">Pagado: {formatMoney(order.amount_paid)}</p>
                          <p className="text-xs font-semibold text-amber-700">Saldo: {formatMoney(balanceDue)}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {lastPayment ? (
                          <div>
                            <p className="font-semibold text-slate-700">{getPaymentMethodDisplayName(lastPayment)} · {lastPayment.payment_reference}</p>
                            <p>{lastPayment.paid_at ? new Date(lastPayment.paid_at).toLocaleDateString("es-CO") : "-"}</p>
                            {payments.length > 1 && <p>{payments.length} pagos registrados</p>}
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {balanceDue > 0 && (
                            <>
                              <button
                                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                                type="button"
                                disabled={saving}
                                onClick={() => openPurchaseOrderEdit(order)}
                              >
                                <Edit3 size={14} />
                                Editar orden
                              </button>
                              <button
                                className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-60"
                                type="button"
                                disabled={saving}
                                onClick={() => openPurchaseOrderPayment(order)}
                              >
                                Registrar pago
                              </button>
                            </>
                          )}
                          <button
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            type="button"
                            onClick={() => openPurchaseOrderPrint(order)}
                          >
                            <FileText size={14} />
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {!isEditMode && !isSampleOutputsMode && !isFarmShipmentsMode && !isLiquidationsMode && (
        <>
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
            <button
              className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-100"
              type="button"
              onClick={() => navigate("/inventario/muestras")}
            >
              <span className="block font-semibold">Muestras</span>
              <span className="text-xs">{sampleOutputs.length} salidas - {formatKg(totalSampleOutputsKg)}</span>
            </button>
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
          <h2 className="text-sm font-semibold text-slate-800">Cafe fuera de bodega</h2>
          <p className="mt-1 text-xs text-slate-500">
            Lotes y cantidades que salieron a finca, trilladora o seleccionadora y aun no han regresado como inventario.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={`rounded border px-3 py-2 text-left text-sm ${
                selectedProcessLocation === "all" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
              }`}
              type="button"
              onClick={() => setSelectedProcessLocation("all")}
            >
              <span className="block font-semibold">Todo fuera de bodega</span>
              <span className="text-xs">{inProcessInventory.length} salidas - {formatKg(totalInProcessKg)}</span>
            </button>
            {processLocationCards.map((card) => (
              <button
                key={card.location}
                className={`rounded border px-3 py-2 text-left text-sm ${
                  selectedProcessLocation === card.location ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => setSelectedProcessLocation(card.location)}
              >
                <span className="block font-semibold">{card.location}</span>
                <span className="text-xs">{card.count} salidas - {formatKg(card.kg)}</span>
              </button>
            ))}
          </div>
        </div>
        {inProcessInventory.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin cafe fuera de bodega" message="Cuando un proceso, trilla o seleccionadora este activo, sus lotes apareceran aqui." />
          </div>
        ) : filteredInProcessInventory.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin salidas con estos filtros" message="Cambie la busqueda o la ubicacion para ver mas cafe fuera de bodega." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredInProcessInventory.map((row) => (
              <article key={row.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {row.lot_code} - {row.presentation || "Sin presentacion"} ({[row.commercial_classification, row.coffee_variety || row.coffee_profile_name || row.coffee_type_name].filter(Boolean).join(" / ") || "Cafe"})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-amber-50 px-2 py-1 font-semibold text-amber-700">{getProcessLocationGroup(row.process_type)}</span>
                      <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{row.process_type || "Proceso"}</span>
                      {row.process_location && (
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{row.process_location}</span>
                      )}
                      {row.supplier_name && (
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{row.supplier_name}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge>{processStatusLabels[row.process_status] || row.process_status}</StatusBadge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-amber-700">Cantidad fuera</p>
                    <p className="mt-1 font-bold text-amber-800">{formatKg(row.quantity_kg)}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Proceso</p>
                    <p className="mt-1 font-bold text-ink">{row.process_code}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Venta asociada</p>
                    <p className="mt-1 text-sm text-slate-700">{[row.sale_code, row.client_name].filter(Boolean).join(" - ") || "Sin venta asociada"}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Regreso estimado</p>
                    <p className="mt-1 text-sm text-slate-700">{row.estimated_return_date ? new Date(row.estimated_return_date).toLocaleDateString("es-CO") : "-"}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Calidad original</p>
                    <p className="mt-1 text-sm text-slate-700">Humedad {row.humidity_percent || "-"}% · Factor {row.performance_factor ?? "-"}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Inventario disponible</h2>
          <input
            className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por codigo, cafe, proveedor, estado o presentacion"
            value={inventorySearch}
            onChange={(event) => setInventorySearch(event.target.value)}
          />
        </div>
        {lots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin lotes disponibles" message="Cuando haya inventario disponible aparecera aqui." />
          </div>
        ) : filteredLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin lotes con estos filtros" message="Cambie la busqueda, presentacion o tipo para ver mas cafe disponible." />
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
                      <button
                        className="inline-flex items-center gap-1 rounded border border-emerald-300 px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-60"
                        type="button"
                        onClick={() => openFarmShipmentModal(lot)}
                        disabled={saving}
                      >
                        <Send size={14} />
                        Enviar a finca
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

      {purchaseOrderEditForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4">
          <div className="my-6 w-full max-w-5xl rounded border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink">Editar orden de compra</h2>
                <p className="text-sm text-slate-500">Corrija los datos antes de registrar el pago.</p>
              </div>
              <button
                className="rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                type="button"
                onClick={() => setPurchaseOrderEditForm(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Codigo de orden</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={purchaseOrderEditForm.orderCode}
                    onChange={(event) => updatePurchaseOrderEditField("orderCode", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Fecha del documento</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    type="date"
                    value={purchaseOrderEditForm.orderDate}
                    onChange={(event) => updatePurchaseOrderEditField("orderDate", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Presentacion</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={purchaseOrderEditForm.lotPresentation}
                    onChange={(event) => updatePurchaseOrderEditField("lotPresentation", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Proveedor</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={purchaseOrderEditForm.supplierName}
                    onChange={(event) => updatePurchaseOrderEditField("supplierName", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>NIT o C.C.</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={purchaseOrderEditForm.supplierDocument}
                    onChange={(event) => updatePurchaseOrderEditField("supplierDocument", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Telefono</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={purchaseOrderEditForm.supplierPhone}
                    onChange={(event) => updatePurchaseOrderEditField("supplierPhone", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Ciudad / zona</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={purchaseOrderEditForm.supplierOriginZone}
                    onChange={(event) => updatePurchaseOrderEditField("supplierOriginZone", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                  <span>Direccion</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={purchaseOrderEditForm.supplierAddress}
                    onChange={(event) => updatePurchaseOrderEditField("supplierAddress", event.target.value)}
                  />
                </label>
              </div>

              <div className="rounded border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-bold text-ink">Lotes incluidos en el documento</h3>
                  <p className="text-xs text-slate-500">Estos valores son los que salen impresos en la orden.</p>
                </div>
                <div className="space-y-3 p-4">
                  {(purchaseOrderEditForm.items || []).map((item) => (
                    <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Codigo de lote</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            value={item.lotCode}
                            onChange={(event) => updatePurchaseOrderEditItem(item.id, "lotCode", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                          <span>Detalle del cafe</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            value={item.coffeeDetail}
                            onChange={(event) => updatePurchaseOrderEditItem(item.id, "coffeeDetail", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Factor rendimiento</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.01"
                            value={item.performanceFactor}
                            onChange={(event) => updatePurchaseOrderEditItem(item.id, "performanceFactor", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Peso bruto kg</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.001"
                            value={item.grossWeightKg}
                            onChange={(event) => updatePurchaseOrderEditItem(item.id, "grossWeightKg", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Peso neto kg</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.001"
                            value={item.netWeightKg}
                            onChange={(event) => updatePurchaseOrderEditItem(item.id, "netWeightKg", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Factor base negociado</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.01"
                            value={item.purchaseBaseFactor}
                            onChange={(event) => updatePurchaseOrderEditItem(item.id, "purchaseBaseFactor", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Precio factor 90 por carga</span>
                          <input
                            className="w-full rounded border border-amber-300 bg-white px-3 py-2 font-semibold text-ink"
                            type="number"
                            step="0.01"
                            value={item.purchasePriceFactor90}
                            onChange={(event) => updatePurchaseOrderEditItem(item.id, "purchasePriceFactor90", event.target.value)}
                          />
                        </label>
                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <p className="text-xs font-semibold uppercase">Calculo automatico</p>
                          <p>Carga ajustada: <span className="font-bold">{formatMoney(item.adjustedPriceCarga)}</span></p>
                          <p>Precio kg: <span className="font-bold">{formatMoney(item.purchasePricePerKg)}</span></p>
                          <p>
                            Ajuste:{" "}
                            <span className="font-bold">
                              {Number(item.adjustmentPercent || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })}%
                            </span>
                          </p>
                        </div>
                        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                          <p className="text-xs font-semibold uppercase">Total lote</p>
                          <p className="text-base font-bold">{formatMoney(item.purchaseTotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                <span>Notas</span>
                <textarea
                  className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  value={purchaseOrderEditForm.notes}
                  onChange={(event) => updatePurchaseOrderEditField("notes", event.target.value)}
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-slate-50 p-3">
                <p className="text-sm text-slate-700">
                  Total del documento:{" "}
                  <span className="font-bold text-ink">{formatMoney(getPurchaseOrderEditTotal(purchaseOrderEditForm))}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                    type="button"
                    onClick={() => setPurchaseOrderEditForm(null)}
                  >
                    <X size={16} />
                    Cancelar
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded border border-leaf bg-white px-3 py-2 text-sm font-semibold text-leaf"
                    type="button"
                    disabled={saving}
                    onClick={() => savePurchaseOrderEdit()}
                  >
                    <Save size={16} />
                    Guardar
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    disabled={saving}
                    onClick={() => savePurchaseOrderEdit({ shouldPrint: true })}
                  >
                    <FileText size={16} />
                    Guardar e imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
          <form
            className="my-6 w-full max-w-xl rounded border border-slate-200 bg-white shadow-xl"
            onSubmit={registerPurchaseOrderPayment}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-ink">Registrar pago de orden</h2>
                <p className="text-sm text-slate-500">
                  {paymentOrder.code} · {paymentOrder.supplier_name || paymentOrder.third_party_name || "Proveedor"}
                </p>
              </div>
              <button
                className="rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                type="button"
                onClick={closePurchaseOrderPayment}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 rounded bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
                  <p className="font-bold text-ink">{formatMoney(paymentOrder.total)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Pagado</p>
                  <p className="font-bold text-leaf">{formatMoney(paymentOrder.amount_paid)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Saldo</p>
                  <p className="font-bold text-amber-700">{formatMoney(paymentOrder.balance_due)}</p>
                </div>
              </div>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                <span>Valor del pago o abono</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                  required
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-semibold text-slate-700">
                  <span>Metodo de pago</span>
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={paymentForm.paymentMethodId}
                    onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethodId: event.target.value })}
                    required
                  >
                    <option value="">Seleccione metodo</option>
                    {liquidationPaymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {getPaymentMethodDisplayName(method)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-sm font-semibold text-slate-700">
                  <span>Fecha de pago</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    type="date"
                    value={paymentForm.paidAt}
                    onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })}
                    required
                  />
                </label>
              </div>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                <span>Numero de referencia o recibo</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  value={paymentForm.paymentReference}
                  onChange={(event) => setPaymentForm({ ...paymentForm, paymentReference: event.target.value })}
                  required
                />
              </label>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                <span>Notas opcionales</span>
                <textarea
                  className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  value={paymentForm.notes}
                  onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={closePurchaseOrderPayment}
                >
                  Cancelar
                </button>
                <button
                  className="rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                >
                  Confirmar pago
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showLiquidationReviewModal && selectedLiquidationLot && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
          <form
            className="my-6 w-full max-w-5xl rounded border border-amber-200 bg-white shadow-xl"
            onSubmit={liquidateSelectedLot}
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-white px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-ink">Revisar orden de compra</h2>
                <p className="text-sm text-slate-500">
                  Verifique y corrija los datos antes de liquidar {(liquidationForm.items || []).length} lote(s).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setShowLiquidationReviewModal(false)}
                >
                  <X size={16} />
                  Cancelar
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                >
                  <FileText size={16} />
                  Liquidar y generar orden
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Estos datos son los que quedaran guardados en la orden de compra. Puede ajustar nombres, pesos,
                detalle o notas de ultimo minuto antes de confirmar.
              </div>

              <div className="rounded border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-bold text-ink">Cafes en liquidacion</h3>
                  <p className="text-xs text-slate-500">Revise cada lote y defina el precio factor base por carga de 125 kg.</p>
                </div>
                <div className="space-y-3 p-4">
                  {(liquidationForm.items || []).map((item, index) => {
                    const itemPrices = calculateLiquidationPrices(item.purchasePriceFactor90, item.performanceFactor, item.purchaseBaseFactor ?? liquidationForm.purchaseBaseFactor);
                    const itemTotal = Number(item.netWeightKg || 0) * Number(itemPrices.purchasePricePerKg || 0);

                    return (
                      <div key={item.id} className="rounded border border-amber-100 bg-amber-50/40 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-ink">Lote {index + 1}</p>
                            <p className="text-xs text-slate-600">{item.lotCode || "Sin codigo"} · {item.coffeeDetail || "Cafe"}</p>
                          </div>
                          <p className="rounded bg-white px-3 py-1 text-sm font-bold text-amber-800">
                            Total: COP {formatMoneyValue(itemTotal)}
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                            Codigo de lote
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                              value={item.lotCode}
                              onChange={(event) => updateLiquidationItem(item.id, "lotCode", event.target.value)}
                              required
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                            Presentacion
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                              value={item.lotPresentation}
                              onChange={(event) => updateLiquidationItem(item.id, "lotPresentation", event.target.value)}
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                            Peso bruto kg
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                              type="number"
                              step="0.001"
                              value={item.grossWeightKg}
                              onChange={(event) => updateLiquidationItem(item.id, "grossWeightKg", event.target.value)}
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                            Peso neto kg
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                              type="number"
                              step="0.001"
                              value={item.netWeightKg}
                              onChange={(event) => updateLiquidationItem(item.id, "netWeightKg", event.target.value)}
                              required
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                            Factor rendimiento
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                              value={item.performanceFactor}
                              onChange={(event) => updateLiquidationItem(item.id, "performanceFactor", event.target.value)}
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                            Factor base negociado
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                              type="number"
                              step="0.01"
                              value={item.purchaseBaseFactor}
                              onChange={(event) => {
                                const value = event.target.value;
                                setLiquidationForm((currentForm) => {
                                  const nextItems = (currentForm.items || []).map((currentItem) => {
                                    if (currentItem.id !== item.id) return currentItem;
                                    const priceData = calculateLiquidationPrices(currentItem.purchasePriceFactor90, currentItem.performanceFactor, value);
                                    return {
                                      ...currentItem,
                                      purchaseBaseFactor: value,
                                      purchasePricePerKg: priceData.purchasePricePerKg || "",
                                    };
                                  });

                                  return {
                                    ...currentForm,
                                    items: nextItems,
                                    purchaseBaseFactor: nextItems.length === 1 ? nextItems[0]?.purchaseBaseFactor || "90" : currentForm.purchaseBaseFactor,
                                  };
                                });
                              }}
                              required
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                            Precio factor base
                            <input
                              className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm font-semibold normal-case text-ink"
                              type="number"
                              step="0.01"
                              value={item.purchasePriceFactor90}
                              onChange={(event) => updateLiquidationItem(item.id, "purchasePriceFactor90", event.target.value)}
                              required
                            />
                          </label>
                          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                            <p className="text-xs font-semibold uppercase text-slate-500">Precio ajustado</p>
                            <p className="font-bold text-ink">Carga: COP {formatMoneyValue(itemPrices.adjustedPriceCarga)}</p>
                            <p className="text-xs">Kg: COP {formatMoneyValue(itemPrices.purchasePricePerKg)} · Ajuste {formatMoneyValue(itemPrices.adjustmentPercent)}%</p>
                          </div>
                          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500 md:col-span-2">
                            Detalle del cafe
                            <input
                              className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                              value={item.coffeeDetail}
                              onChange={(event) => updateLiquidationItem(item.id, "coffeeDetail", event.target.value)}
                              required
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Numero de orden opcional
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    placeholder="Automatico si se deja vacio"
                    value={liquidationForm.orderCode}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, orderCode: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Fecha
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    type="date"
                    value={liquidationForm.orderDate}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, orderDate: event.target.value })}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Codigo lote
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.lotCode}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, lotCode: event.target.value })}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Presentacion
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.lotPresentation}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, lotPresentation: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Proveedor
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.supplierName}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, supplierName: event.target.value })}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  NIT o C.C.
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.supplierDocument}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, supplierDocument: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Telefono
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.supplierPhone}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, supplierPhone: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Ciudad / zona
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.supplierOriginZone}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, supplierOriginZone: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500 md:col-span-2">
                  Direccion
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.supplierAddress}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, supplierAddress: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Peso bruto kg
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    type="number"
                    step="0.001"
                    value={liquidationForm.grossWeightKg}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, grossWeightKg: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Peso neto kg
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    type="number"
                    step="0.001"
                    value={liquidationForm.netWeightKg}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, netWeightKg: event.target.value })}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Factor rendimiento
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.performanceFactor}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, performanceFactor: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Factor base negociado
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    type="number"
                    step="0.01"
                    value={liquidationForm.purchaseBaseFactor}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLiquidationForm({
                        ...liquidationForm,
                        purchaseBaseFactor: value,
                        items: (liquidationForm.items || []).length <= 1
                          ? (liquidationForm.items || []).map((item) => {
                            const priceData = calculateLiquidationPrices(item.purchasePriceFactor90, item.performanceFactor, value);
                            return {
                              ...item,
                              purchaseBaseFactor: value,
                              purchasePricePerKg: priceData.purchasePricePerKg || "",
                            };
                          })
                          : liquidationForm.items,
                      });
                    }}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Precio factor base
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    type="number"
                    step="0.01"
                    value={liquidationForm.purchasePriceFactor90}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLiquidationForm({
                        ...liquidationForm,
                        purchasePriceFactor90: value,
                        items: (liquidationForm.items || []).length <= 1
                          ? (liquidationForm.items || []).map((item) => {
                            const priceData = calculateLiquidationPrices(value, item.performanceFactor, item.purchaseBaseFactor ?? liquidationForm.purchaseBaseFactor);
                            return {
                              ...item,
                              purchasePriceFactor90: value,
                              purchasePricePerKg: priceData.purchasePricePerKg || "",
                            };
                          })
                          : liquidationForm.items,
                      });
                    }}
                    required={(liquidationForm.items || []).length <= 1}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Registrado por
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={liquidationForm.createdByName}
                    onChange={(event) => setLiquidationForm({ ...liquidationForm, createdByName: event.target.value })}
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs font-semibold uppercase text-slate-500">
                Detalle del cafe
                <textarea
                  className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                  value={liquidationForm.coffeeDetail}
                  onChange={(event) => setLiquidationForm({ ...liquidationForm, coffeeDetail: event.target.value })}
                  required
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold uppercase text-slate-500">
                Notas de liquidacion
                <textarea
                  className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                  value={liquidationForm.notes}
                  onChange={(event) => setLiquidationForm({ ...liquidationForm, notes: event.target.value })}
                />
              </label>

              <div className="rounded bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Total pactado: <span className="font-bold text-ink">COP {liquidationTotal}</span>
              </div>
            </div>
          </form>
        </div>
      )}

      {farmShipmentLot && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
          <form
            className="my-6 w-full max-w-3xl rounded border border-emerald-200 bg-white shadow-xl"
            onSubmit={registerFarmShipment}
          >
            <div className="flex items-start justify-between gap-3 border-b border-emerald-200 px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-ink">Enviar lote a finca</h2>
                <p className="text-sm text-slate-500">{formatCoffeeLotCodeName(farmShipmentLot)}</p>
              </div>
              <button
                className="rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                type="button"
                onClick={closeFarmShipmentModal}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Disponible fisico</p>
                  <p className="mt-1 text-lg font-bold text-ink">{formatKg(farmShipmentLot.available_weight_kg)}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Libre operativo</p>
                  <p className="mt-1 text-lg font-bold text-leaf">{formatKg(farmShipmentLot.operational_available_kg ?? farmShipmentLot.available_weight_kg)}</p>
                </div>
                <div className="rounded border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Proveedor</p>
                  <p className="mt-1 font-semibold text-ink">{farmShipmentLot.supplier_name || "-"}</p>
                </div>
              </div>

              <div className="grid gap-3 rounded border border-slate-200 bg-white p-3 text-sm sm:grid-cols-2">
                <p><span className="font-semibold">Presentacion:</span> {farmShipmentLot.presentation || "-"}</p>
                <p><span className="font-semibold">Tipo:</span> {farmShipmentLot.coffee_type_name || "-"}</p>
                <p><span className="font-semibold">Categoria:</span> {farmShipmentLot.commercial_classification || "-"}</p>
                <p><span className="font-semibold">Cafe:</span> {farmShipmentLot.coffee_profile_name || farmShipmentLot.coffee_variety || "-"}</p>
                <p><span className="font-semibold">Humedad:</span> {farmShipmentLot.humidity_percent ?? "-"}%</p>
                <p><span className="font-semibold">Factor:</span> {farmShipmentLot.performance_factor ?? "-"}</p>
                <p><span className="font-semibold">Score:</span> {farmShipmentLot.lab_score ?? "-"}</p>
                <p><span className="font-semibold">Llegada:</span> {farmShipmentLot.received_at ? new Date(farmShipmentLot.received_at).toLocaleDateString("es-CO") : "-"}</p>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-bold">Analisis de laboratorio</p>
                <p className="mt-1">
                  Aroma {farmShipmentLot.lab_aroma || "-"} · Sabor {farmShipmentLot.lab_flavor || "-"} · Dulzor {farmShipmentLot.lab_sweetness || "-"} · Cuerpo {farmShipmentLot.lab_body || "-"}
                </p>
                <p>
                  Residual {farmShipmentLot.lab_residual || "-"} · Taza limpia {farmShipmentLot.lab_clean_cup || "-"}
                </p>
                {farmShipmentLot.lab_notes && <p className="mt-1">Notas: {farmShipmentLot.lab_notes}</p>}
              </div>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                <span>Peso que se envia a finca kg</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  min="0"
                  step="0.001"
                  type="number"
                  value={farmShipmentQuantity}
                  onChange={(event) => setFarmShipmentQuantity(event.target.value)}
                  required
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={closeFarmShipmentModal}
                >
                  Cancelar
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                >
                  <Send size={16} />
                  Confirmar envio
                </button>
              </div>
            </div>
          </form>
        </div>
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
                {canWithdrawInventory && selectedAdminLot.status !== "retirado" && (
                  <button
                    className="rounded border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    type="button"
                    disabled={saving}
                    onClick={() => withdrawInventoryLot(selectedAdminLot)}
                  >
                    Retirar lote
                  </button>
                )}
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
                        {formatProfileOptionLabel(profile)}
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
                    <label key={field} className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                      {label}
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                        value={adminLotForm[field]}
                        onChange={(event) => setAdminLotForm({ ...adminLotForm, [field]: event.target.value })}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Notas de laboratorio
                  <textarea
                    className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.labNotes}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, labNotes: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
                  Comentario interno del lote
                  <textarea
                    className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case text-ink"
                    value={adminLotForm.initialComment}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, initialComment: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase text-amber-700">
                  Nota obligatoria de correccion
                  <textarea
                    className="min-h-20 w-full rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm normal-case text-amber-900"
                    value={adminLotForm.changeNote}
                    onChange={(event) => setAdminLotForm({ ...adminLotForm, changeNote: event.target.value })}
                    required
                  />
                </label>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default InventoryPage;
