import { AlertTriangle, Eye, PackageCheck, Printer, RefreshCw, Save, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { formatOperationalKg } from "../../utils/coffeeCalculations";
import { formatCoffeeLotOption, groupCoffeeLots } from "../../utils/coffeeLots";
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
  { key: "prepare", label: "Alistar" },
  { key: "dispatch", label: "Despachar" },
];

const buildInitialBlendRows = (sale) => {
  const existingRows = sale.items?.flatMap((item) =>
    item.blend_items?.map((blend) => ({
      saleItemId: String(item.id),
      lotId: String(blend.lot_id),
      percentage: String(blend.percentage),
      notes: blend.notes || "",
    })) || []
  );

  if (existingRows?.length) return existingRows;

  return (sale.items || [])
    .filter((item) => item.coffee_profile_category === "Exotico")
    .flatMap((item) => {
      const rows = [];

      if (item.process_percentage) {
        rows.push({
          saleItemId: String(item.id),
          lotId: "",
          percentage: String(item.process_percentage),
          notes: `Proceso: ${item.process_purchase_coffee_name || ""}`.trim(),
        });
      }

      if (item.base_percentage) {
        rows.push({
          saleItemId: String(item.id),
          lotId: "",
          percentage: String(item.base_percentage),
          notes: `Base: ${item.base_purchase_coffee_name || ""}`.trim(),
        });
      }

      return rows.length
        ? rows
        : [{
            saleItemId: String(item.id),
            lotId: "",
            percentage: "",
            notes: "",
          }];
    });
};

const WarehousePendingPage = () => {
  const [sales, setSales] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [blendRows, setBlendRows] = useState([]);
  const [orderAssignee, setOrderAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
    return Object.values(groupCoffeeLots(availableLots)).sort((left, right) => left.name.localeCompare(right.name));
  }, [availableLots]);

  const loadData = async () => {
    const [saleData, inventoryData] = await Promise.all([
      apiRequest("/sales"),
      apiRequest("/inventory/lots"),
    ]);

    setSales(saleData.filter((sale) => activeWarehouseStatuses.includes(sale.status)));
    setAvailableLots(inventoryData);

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
        sale.deductedLots?.length
          ? sale.deductedLots.map((lot) => ({
              saleItemId: String(lot.sale_item_id),
              lotId: String(lot.lot_id),
              quantityKg: String(lot.quantity_kg),
              notes: lot.notes || "",
            }))
          : [
              {
                saleItemId: sale.items?.[0]?.id ? String(sale.items[0].id) : "",
                lotId: "",
                quantityKg: "",
                notes: "",
              },
            ]
      );
      setBlendRows(buildInitialBlendRows(sale));
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

  const addAssignmentRow = () => {
    setAssignmentRows((currentRows) => [
      ...currentRows,
      {
        saleItemId: selectedSale?.items?.[0]?.id ? String(selectedSale.items[0].id) : "",
        lotId: "",
        quantityKg: "",
        notes: "",
      },
    ]);
  };

  const removeAssignmentRow = (index) => {
    setAssignmentRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  };

  const saveAssignments = async () => {
    if (!selectedSale) return;

    const confirmed = window.confirm("Confirmas guardar los lotes asignados a esta venta?");
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/lot-assignments`, {
        method: "PUT",
        body: JSON.stringify({
          items: assignmentRows.map((row) => ({
            saleItemId: Number(row.saleItemId),
            lotId: Number(row.lotId),
            quantityKg: Number(row.quantityKg),
            notes: row.notes || null,
          })),
        }),
      });
      setSelectedSale(response.data);
      await loadData();
      setMessage("Lotes asignados correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateBlendRow = (index, field, value) => {
    setBlendRows((currentRows) =>
      currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const addBlendRow = (saleItemId) => {
    setBlendRows((currentRows) => [
      ...currentRows,
      {
        saleItemId: String(saleItemId),
        lotId: "",
        percentage: "",
        notes: "",
      },
    ]);
  };

  const removeBlendRow = (index) => {
    setBlendRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  };

  const saveBlendOrder = async () => {
    if (!selectedSale) return;

    const rowsToSave = blendRows.filter((row) => row.saleItemId && row.lotId && Number(row.percentage) > 0);

    if (rowsToSave.length === 0) {
      setError("Debe seleccionar al menos un lote con porcentaje para guardar el ensamble.");
      return;
    }

    if (!window.confirm("Confirmas guardar la orden de ensamble para esta venta?")) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/blend-order`, {
        method: "PUT",
        body: JSON.stringify({
          items: rowsToSave.map((row) => ({
            saleItemId: Number(row.saleItemId),
            lotId: Number(row.lotId),
            percentage: Number(row.percentage),
            notes: row.notes || null,
          })),
        }),
      });
      setSelectedSale(response.data);
      setBlendRows(buildInitialBlendRows(response.data));
      await loadData();
      setMessage("Orden de ensamble guardada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleItemShortage = async (item) => {
    if (!selectedSale) return;

    const nextMarked = !item.shortage_marked;
    const notes = nextMarked
      ? window.prompt("Observacion para gerencia sobre este faltante", item.shortage_notes || "")
      : item.shortage_notes || "";

    if (notes === null) return;
    if (!window.confirm(nextMarked ? "Confirmas marcar este producto como faltante?" : "Confirmas quitar la marca de faltante?")) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/${selectedSale.id}/items/${item.id}/shortage`, {
        method: "PUT",
        body: JSON.stringify({
          shortageMarked: nextMarked,
          notes,
        }),
      });
      setSelectedSale(response.data);
      await loadData();
      setMessage(nextMarked ? "Producto marcado como faltante." : "Marca de faltante retirada.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSaleStatus = async (action) => {
    if (!selectedSale) return;

    const label = action === "prepare" ? "marcar esta venta como alistada" : "marcar esta venta como despachada";
    const confirmed = window.confirm(`Confirmas ${label}?`);
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/${selectedSale.id}/${action}`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      await loadData();
      setMessage(action === "prepare" ? "Venta marcada como alistada." : "Venta marcada como despachada.");
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="rounded border border-slate-200 bg-white">
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

        <aside className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Detalle operativo</h2>
          {loadingDetail ? (
            <p className="mt-3 text-sm text-slate-500">Cargando orden...</p>
          ) : !selectedSale ? (
            <div className="mt-3">
              <EmptyState title="Seleccione una venta" message="Aqui podra priorizar, asignar lotes, imprimir y cambiar estado." />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
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
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ink">{item.description || item.coffee_profile_name || item.coffee_type_name}</p>
                      <button
                        className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${
                          item.shortage_marked
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                        type="button"
                        onClick={() => toggleItemShortage(item)}
                        disabled={saving}
                      >
                        <AlertTriangle size={13} />
                        {item.shortage_marked ? "Faltante" : "No hay"}
                      </button>
                    </div>
                    <p className="text-slate-500">
                      Pedido: {formatOperationalKg(item.quantity_kg)}
                      {item.operational_weight_kg && Number(item.operational_weight_kg) !== Number(item.quantity_kg) && (
                        <> · Operativo bodega: {formatOperationalKg(item.operational_weight_kg)}</>
                      )}
                    </p>
                    {item.shortage_marked && item.shortage_notes && (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                        Faltante: {item.shortage_notes}
                      </p>
                    )}
                    {item.coffee_profile_category === "Exotico" && (item.process_purchase_coffee_name || item.base_purchase_coffee_name) && (
                      <p className="mt-1 text-xs text-amber-700">
                        Ensamble sugerido: {item.process_purchase_coffee_name || "-"} {item.process_percentage || "-"}% / {item.base_purchase_coffee_name || "-"} {item.base_percentage || "-"}%
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {(selectedSale.items || []).some(
                (item) => item.coffee_profile_category === "Exotico" || blendRows.some((row) => String(row.saleItemId) === String(item.id))
              ) && (
                <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-amber-800">Ensamble del pedido</p>
                    <p className="mt-1 text-xs text-amber-700">
                      Seleccione los lotes y porcentajes que deben mezclarse para cada cafe exotico. Cada producto guardado debe sumar 100%.
                    </p>
                  </div>

                  {selectedSale.items
                    ?.filter(
                      (item) =>
                        item.coffee_profile_category === "Exotico" ||
                        blendRows.some((row) => String(row.saleItemId) === String(item.id))
                    )
                    .map((item) => {
                      const itemRows = blendRows
                        .map((row, index) => ({ ...row, index }))
                        .filter((row) => String(row.saleItemId) === String(item.id));
                      const rowTotal = itemRows.reduce((total, row) => total + Number(row.percentage || 0), 0);
                      const baseKg = Number(item.operational_weight_kg || item.quantity_kg || 0);

                      return (
                        <div key={`blend-form-${item.id}`} className="rounded border border-amber-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-ink">
                                {item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"}
                              </p>
                              <p className="text-xs text-slate-500">
                                Base calculo: {formatOperationalKg(baseKg)} · Total mezcla: {rowTotal.toFixed(2)}%
                              </p>
                            </div>
                            <button
                              className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                              type="button"
                              onClick={() => addBlendRow(item.id)}
                            >
                              Agregar componente
                            </button>
                          </div>

                          <div className="mt-3 space-y-2">
                            {itemRows.map((row) => {
                              const calculatedKg = baseKg * Number(row.percentage || 0) / 100;

                              return (
                                <div key={`blend-row-${row.index}`} className="grid gap-2 md:grid-cols-[1fr_90px_1fr_auto]">
                                  <select
                                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                                    value={row.lotId}
                                    onChange={(event) => updateBlendRow(row.index, "lotId", event.target.value)}
                                  >
                                    <option value="">Lote para ensamble</option>
                                    {availableLotGroups.map((group) => (
                                      <optgroup key={group.name} label={`${group.name} (${group.kg.toFixed(3)} kg)`}>
                                        {group.lots.map((lot) => (
                                          <option key={lot.id} value={lot.id}>
                                            {formatCoffeeLotOption(lot)}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </select>
                                  <input
                                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    placeholder="%"
                                    value={row.percentage}
                                    onChange={(event) => updateBlendRow(row.index, "percentage", event.target.value)}
                                  />
                                  <input
                                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                                    placeholder={`Kg aprox. ${formatOperationalKg(calculatedKg)}`}
                                    value={row.notes}
                                    onChange={(event) => updateBlendRow(row.index, "notes", event.target.value)}
                                  />
                                  <button
                                    className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                    type="button"
                                    onClick={() => removeBlendRow(row.index)}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    onClick={saveBlendOrder}
                    disabled={saving || blendRows.length === 0}
                  >
                    <Save size={16} />
                    Guardar ensamble
                  </button>
                </div>
              )}

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
                          {item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"}
                        </p>
                        <div className="mt-2 space-y-2">
                          {item.blend_items.map((blend) => (
                            <div key={blend.id} className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-ink">{blend.lot_code}</p>
                                <p className="text-xs text-slate-600">{blend.commercial_classification || formatInputLabel(blend)}</p>
                              </div>
                              <p className="text-right text-slate-700">
                                {blend.percentage}%<br />
                                <span className="text-xs text-slate-500">
                                  {blend.calculated_operational_kg || blend.calculated_quantity_kg} kg estimados
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
              <div className="space-y-3 rounded border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Asignar lotes</p>
                {assignmentRows.map((row, index) => (
                  <div key={`assignment-${index}`} className="rounded border border-slate-200 p-3">
                    <div className="grid gap-2">
                      <select
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        value={row.saleItemId}
                        onChange={(event) => updateAssignmentRow(index, "saleItemId", event.target.value)}
                      >
                        <option value="">Producto vendido</option>
                        {selectedSale.items?.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"} - {item.operational_weight_kg || item.quantity_kg} kg operativos
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        value={row.lotId}
                        onChange={(event) => updateAssignmentRow(index, "lotId", event.target.value)}
                      >
                        <option value="">Lote disponible</option>
                        {availableLotGroups.map((group) => (
                          <optgroup key={group.name} label={`${group.name} (${group.kg.toFixed(3)} kg)`}>
                            {group.lots.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {formatCoffeeLotOption(lot)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Cantidad kg"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={row.quantityKg}
                        onChange={(event) => updateAssignmentRow(index, "quantityKg", event.target.value)}
                      />
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Observacion opcional"
                        value={row.notes}
                        onChange={(event) => updateAssignmentRow(index, "notes", event.target.value)}
                      />
                    </div>
                    <button
                      className="mt-2 rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      type="button"
                      onClick={() => removeAssignmentRow(index)}
                      disabled={assignmentRows.length === 1}
                    >
                      Quitar linea
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                    onClick={addAssignmentRow}
                  >
                    Agregar lote
                  </button>
                  <button
                    className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    onClick={saveAssignments}
                    disabled={saving || ["alistada", "despachada"].includes(selectedSale.status)}
                  >
                    Guardar asignacion
                  </button>
                </div>
              </div>
              )}

              {["pendiente_alistamiento", "pendiente_bodega"].includes(selectedSale.status) && (
                <Link
                  className="inline-flex w-full items-center justify-center rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50"
                  to={`/procesos?saleId=${selectedSale.id}`}
                >
                  Solicitar proceso para este pedido
                </Link>
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

              <div className="grid gap-2 sm:grid-cols-2">
                {selectedSale.status === "lote_asignado" && (
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
                  disabled={saving}
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
