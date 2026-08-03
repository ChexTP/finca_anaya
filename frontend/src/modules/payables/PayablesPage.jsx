import { Edit3, Eye, FileDown, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { openPurchaseOrderPrint } from "../../utils/purchaseOrderDocument";

const formatMoney = (value) => `COP ${Number(value || 0).toLocaleString("es-CO")}`;
const formatKg = (value) => `${Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg`;
const getSnapshot = (order) => order?.purchase_order_snapshot && typeof order.purchase_order_snapshot === "object"
  ? order.purchase_order_snapshot
  : {};

const getSnapshotItems = (order) => {
  const items = getSnapshot(order).items;
  return Array.isArray(items) ? items : [];
};

const getCoffeeName = (payable) => {
  const snapshot = getSnapshot(payable);
  const items = getSnapshotItems(payable);

  if (items.length > 1) return snapshot.coffeeDetail || `Liquidacion agrupada de ${items.length} lotes`;
  if (items.length === 1) return items[0].coffeeDetail || snapshot.coffeeDetail || "Cafe liquidado";

  return [
    payable.lot_presentation,
    payable.coffee_profile_name || payable.coffee_variety || payable.coffee_type_name || payable.commercial_classification,
  ].filter(Boolean).join(" - ") || "Cafe liquidado";
};

const getOrderLotLabel = (order) => {
  const items = getSnapshotItems(order);
  if (items.length > 0) return items.map((item) => item.lotCode).filter(Boolean).join(", ");
  return order.lot_code || "-";
};

const getOrderKg = (order) => {
  const items = getSnapshotItems(order);
  if (items.length > 0) return items.reduce((sum, item) => sum + Number(item.netWeightKg || 0), 0);
  return Number(order.net_weight_kg || 0);
};

const toInputDate = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const parseAmount = (value) => Number(String(value ?? "0").replace(",", ".")) || 0;

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

const calculateEditItem = (item) => {
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

const buildEditForm = (order) => {
  const snapshot = getSnapshot(order);
  const snapshotItems = getSnapshotItems(order);
  const fallbackItems = snapshotItems.length > 0
    ? snapshotItems
    : [{
        id: order.lot_id || order.id,
        lotCode: snapshot.lotCode || order.lot_code || "",
        coffeeDetail: snapshot.coffeeDetail || getCoffeeName(order),
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
    items: fallbackItems.map((item, index) => calculateEditItem({
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

const getEditFormTotal = (form) => {
  const items = form?.items || [];
  return items.reduce((sum, item) => sum + Number(calculateEditItem(item).purchaseTotal || 0), 0);
};

const buildSnapshotFromEditForm = (form) => {
  const items = (form.items || []).map((rawItem) => {
    const item = calculateEditItem(rawItem);

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

const PayablesPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = async () => {
    const payableData = await apiRequest("/payables");
    setOrders(payableData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) => [
      order.code,
      order.lot_code,
      getOrderLotLabel(order),
      order.supplier_name,
      getCoffeeName(order),
      order.performance_factor,
    ].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [orders, search]);

  const loadOrderDetail = async (orderId) => {
    const data = await apiRequest(`/payables/${orderId}`);
    setSelectedOrder(data);
    setMessage("");
    setError("");
  };

  const printOrder = async (order) => {
    try {
      const fullOrder = order.payments ? order : await apiRequest(`/payables/${order.id}`);
      openPurchaseOrderPrint(fullOrder);
      setMessage("Orden de compra abierta para imprimir o guardar como PDF.");
      setSelectedOrder(fullOrder);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const openEditModal = async (order) => {
    try {
      const fullOrder = order.payments ? order : await apiRequest(`/payables/${order.id}`);
      setSelectedOrder(fullOrder);
      setEditForm(buildEditForm(fullOrder));
      setMessage("");
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateEditField = (field, value) => {
    setEditForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const updateEditItem = (itemId, field, value) => {
    setEditForm((currentForm) => ({
      ...currentForm,
      items: (currentForm.items || []).map((item) => (
        item.id === itemId ? calculateEditItem({ ...item, [field]: value }) : item
      )),
    }));
  };

  const saveEdit = async ({ shouldPrint = false } = {}) => {
    if (!editForm?.orderCode?.trim()) {
      setError("El codigo de la orden es obligatorio.");
      return;
    }

    try {
      setSavingEdit(true);
      setError("");
      const snapshot = buildSnapshotFromEditForm(editForm);
      const total = getEditFormTotal(editForm);
      const response = await apiRequest(`/payables/${editForm.id}/purchase-order`, {
        method: "PUT",
        body: JSON.stringify({
          code: editForm.orderCode,
          purchaseOrderSnapshot: snapshot,
          total,
          notes: editForm.notes,
        }),
      });
      const updatedOrder = response.data;
      setSelectedOrder(updatedOrder);
      setEditForm(null);
      await loadData();
      setMessage("Orden de compra actualizada. Ya puede volver a imprimirla con los datos corregidos.");
      if (shouldPrint) {
        openPurchaseOrderPrint(updatedOrder);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Ordenes de compra</h1>
          <p className="text-sm text-slate-500">Documentos generados automaticamente al liquidar cafe comprado.</p>
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Lotes liquidados</h2>
            <p className="mt-1 text-xs text-slate-500">Busque por orden, lote, proveedor, cafe o factor.</p>
            <input
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Buscar orden de compra"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {filteredOrders.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin ordenes" message="Cuando se liquide un lote de cafe, aparecera aqui su orden de compra." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Orden</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Cafe</th>
                    <th className="px-3 py-2">Kilos</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-3 py-2 font-medium">{order.code}</td>
                      <td className="px-3 py-2">{getOrderLotLabel(order)}</td>
                      <td className="px-3 py-2">{order.supplier_name || "-"}</td>
                      <td className="px-3 py-2">{getCoffeeName(order)}</td>
                      <td className="px-3 py-2">{formatKg(getOrderKg(order))}</td>
                      <td className="px-3 py-2">{formatMoney(order.total)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            onClick={() => loadOrderDetail(order.id)}
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded border border-leaf bg-emerald-50 px-2 py-1 text-xs font-semibold text-leaf hover:bg-emerald-100"
                            onClick={() => printOrder(order)}
                          >
                            <FileDown size={14} />
                            Reimprimir
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                            onClick={() => openEditModal(order)}
                          >
                            <Edit3 size={14} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4">
          {!selectedOrder ? (
            <EmptyState title="Seleccione una orden" message="Aqui vera el detalle y podra imprimir el formato de compra." />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Orden seleccionada</p>
                <h2 className="mt-1 text-lg font-bold text-ink">{selectedOrder.code}</h2>
                <p className="text-sm text-slate-500">{getOrderLotLabel(selectedOrder)} - {getCoffeeName(selectedOrder)}</p>
              </div>
              <div className="rounded bg-slate-50 p-3 text-sm">
                <p><span className="font-semibold">Proveedor:</span> {selectedOrder.supplier_name || "-"}</p>
                <p><span className="font-semibold">Telefono:</span> {selectedOrder.supplier_phone || "-"}</p>
                <p><span className="font-semibold">Direccion:</span> {selectedOrder.supplier_address || "-"}</p>
                <p><span className="font-semibold">Kilos:</span> {formatKg(getOrderKg(selectedOrder))}</p>
                <p><span className="font-semibold">Factor:</span> {selectedOrder.performance_factor || "-"}</p>
                <p><span className="font-semibold">Precio kg:</span> {formatMoney(selectedOrder.purchase_price_per_kg)}</p>
                <p><span className="font-semibold">Total:</span> {formatMoney(selectedOrder.total)}</p>
                {getSnapshotItems(selectedOrder).length > 1 && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Lotes incluidos</p>
                    <div className="space-y-1">
                      {getSnapshotItems(selectedOrder).map((item) => (
                        <p key={item.id || item.lotCode}>
                          {item.lotCode} · {formatKg(item.netWeightKg)} · {formatMoney(item.purchasePricePerKg)}/kg
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <StatusBadge tone={selectedOrder.status === "pagada" ? "success" : "warning"}>
                {selectedOrder.status}
              </StatusBadge>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white"
                onClick={() => printOrder(selectedOrder)}
              >
                <FileDown size={16} />
                Reimprimir / guardar PDF
              </button>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                onClick={() => openEditModal(selectedOrder)}
              >
                <Edit3 size={16} />
                Editar datos del documento
              </button>
            </div>
          )}
        </aside>
      </div>

      {editForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4">
          <div className="my-6 w-full max-w-5xl rounded border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink">Editar orden de compra</h2>
                <p className="text-sm text-slate-500">Corrija el codigo o los datos visibles del PDF sin volver a liquidar el cafe.</p>
              </div>
              <button
                className="rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                type="button"
                onClick={() => setEditForm(null)}
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
                    value={editForm.orderCode}
                    onChange={(event) => updateEditField("orderCode", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Fecha del documento</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    type="date"
                    value={editForm.orderDate}
                    onChange={(event) => updateEditField("orderDate", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Presentacion</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={editForm.lotPresentation}
                    onChange={(event) => updateEditField("lotPresentation", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Proveedor</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={editForm.supplierName}
                    onChange={(event) => updateEditField("supplierName", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>NIT o C.C.</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={editForm.supplierDocument}
                    onChange={(event) => updateEditField("supplierDocument", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Telefono</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={editForm.supplierPhone}
                    onChange={(event) => updateEditField("supplierPhone", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700">
                  <span>Ciudad / zona</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={editForm.supplierOriginZone}
                    onChange={(event) => updateEditField("supplierOriginZone", event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                  <span>Direccion</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                    value={editForm.supplierAddress}
                    onChange={(event) => updateEditField("supplierAddress", event.target.value)}
                  />
                </label>
              </div>

              <div className="rounded border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-bold text-ink">Lotes incluidos en el documento</h3>
                  <p className="text-xs text-slate-500">Estos valores son los que salen impresos en la orden.</p>
                </div>
                <div className="space-y-3 p-4">
                  {(editForm.items || []).map((item) => (
                    <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Codigo de lote</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            value={item.lotCode}
                            onChange={(event) => updateEditItem(item.id, "lotCode", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                          <span>Detalle del cafe</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            value={item.coffeeDetail}
                            onChange={(event) => updateEditItem(item.id, "coffeeDetail", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Factor rendimiento</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.01"
                            value={item.performanceFactor}
                            onChange={(event) => updateEditItem(item.id, "performanceFactor", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Peso bruto kg</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.001"
                            value={item.grossWeightKg}
                            onChange={(event) => updateEditItem(item.id, "grossWeightKg", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Peso neto kg</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.001"
                            value={item.netWeightKg}
                            onChange={(event) => updateEditItem(item.id, "netWeightKg", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Factor base negociado</span>
                          <input
                            className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                            type="number"
                            step="0.01"
                            value={item.purchaseBaseFactor}
                            onChange={(event) => updateEditItem(item.id, "purchaseBaseFactor", event.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Precio factor 90 por carga</span>
                          <input
                            className="w-full rounded border border-amber-300 bg-white px-3 py-2 font-semibold text-ink"
                            type="number"
                            step="0.01"
                            value={item.purchasePriceFactor90}
                            onChange={(event) => updateEditItem(item.id, "purchasePriceFactor90", event.target.value)}
                          />
                        </label>
                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <p className="text-xs font-semibold uppercase">Calculo automatico</p>
                          <p>Carga ajustada: <span className="font-bold">{formatMoney(item.adjustedPriceCarga)}</span></p>
                          <p>Precio kg: <span className="font-bold">{formatMoney(item.purchasePricePerKg)}</span></p>
                          <p>Ajuste: <span className="font-bold">{Number(item.adjustmentPercent || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })}%</span></p>
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
                  value={editForm.notes}
                  onChange={(event) => updateEditField("notes", event.target.value)}
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-slate-50 p-3">
                <p className="text-sm text-slate-700">
                  Total del documento: <span className="font-bold text-ink">{formatMoney(getEditFormTotal(editForm))}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                    type="button"
                    onClick={() => setEditForm(null)}
                  >
                    <X size={16} />
                    Cancelar
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded border border-leaf bg-white px-3 py-2 text-sm font-semibold text-leaf"
                    type="button"
                    disabled={savingEdit}
                    onClick={() => saveEdit()}
                  >
                    <Save size={16} />
                    Guardar
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    disabled={savingEdit}
                    onClick={() => saveEdit({ shouldPrint: true })}
                  >
                    <FileDown size={16} />
                    Guardar e imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PayablesPage;
