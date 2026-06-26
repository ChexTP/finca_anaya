import { Eye, PackageCheck, Printer, RefreshCw, Save, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialSupplier = {
  name: "",
  phone: "",
  address: "",
  originZone: "",
  notes: "",
};

const initialLot = {
  supplierId: "",
  coffeeTypeId: "",
  grossWeightKg: "",
  packagingTypeId: "",
  packagingQuantity: "",
  hasInnerBag: false,
  humidityPercent: "",
  performanceFactor: "",
  commercialClassification: "",
  visualStatus: "aprobado",
  visualDefectPercent: "",
  visualNotes: "",
  originZone: "",
  initialComment: "",
};

const activeWarehouseStatuses = [
  "pendiente_alistamiento",
  "pendiente_bodega",
  "lote_asignado",
  "proceso_solicitado",
  "en_proceso",
  "listo_para_ensamble",
  "ensamble_definido",
  "alistada",
];

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO");
};

const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const buildWarehouseOrderHtml = (sale) => {
  const productRows = sale.items
    ?.map(
      (item) => `
        <tr>
          <td>${item.description || item.coffee_profile_name || item.coffee_type_name || item.lot_code || "-"}</td>
          <td>${item.quantity_kg} kg</td>
        </tr>
      `
    )
    .join("");

  const finalBlendOrder = sale.items
    ?.filter((item) => item.blend_items?.length > 0)
    .map(
      (item) => `
        <section class="lot-block">
          <div class="lot-head">
            <div>
              <h3>${item.description || item.coffee_profile_name || item.coffee_type_name || "Producto"}</h3>
              <p>${item.quantity_kg} kg solicitados</p>
            </div>
            <strong>Mezcla final</strong>
          </div>
          <table class="mix-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Lote</th>
                <th>Porcentaje</th>
                <th>Kg estimados</th>
              </tr>
            </thead>
            <tbody>
              ${item.blend_items
                .map(
                  (blend) => `
                    <tr>
                      <td>${blend.commercial_classification || "-"}</td>
                      <td>${blend.lot_code || "-"}</td>
                      <td>${blend.percentage}%</td>
                      <td>${blend.calculated_quantity_kg} kg</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `
    )
    .join("");

  const deductedLots = sale.deductedLots
    ?.map((lot) => {
      const mixRows = lot.process_mix?.length
        ? `
          <table class="mix-table">
            <thead>
              <tr>
                <th>Lote origen</th>
                <th>Tipo / perfil</th>
                <th>Porcentaje</th>
                <th>Kg usados</th>
              </tr>
            </thead>
            <tbody>
              ${lot.process_mix
                .map(
                  (input) => `
                    <tr>
                      <td>${input.lot_code || "-"}</td>
                      <td>${formatInputLabel(input)}</td>
                      <td>${input.input_percentage}%</td>
                      <td>${input.quantity_kg} kg</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        `
        : `<p class="muted">Este lote no tiene mezcla de proceso registrada.</p>`;

      return `
        <section class="lot-block">
          <div class="lot-head">
            <div>
              <h3>${lot.lot_code}</h3>
              <p>${lot.coffee_profile_name || lot.coffee_type_name || lot.commercial_classification || lot.lot_kind || "-"}</p>
            </div>
            <strong>${lot.quantity_kg} kg a sacar</strong>
          </div>
          ${mixRows}
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Orden ${sale.code}</title>
        <style>
          body { color: #17201a; font-family: Arial, sans-serif; margin: 28px; }
          header { align-items: flex-start; border-bottom: 1px solid #d8ded8; display: flex; justify-content: space-between; gap: 24px; padding-bottom: 14px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          h2 { font-size: 15px; margin: 22px 0 8px; }
          h3 { font-size: 14px; margin: 0 0 3px; }
          p { font-size: 12px; margin: 3px 0; }
          table { border-collapse: collapse; margin-top: 10px; width: 100%; }
          th, td { border: 1px solid #d8ded8; font-size: 12px; padding: 8px; text-align: left; }
          th { background: #f3f6f3; }
          .meta { display: grid; gap: 4px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
          .lot-block { border: 1px solid #d8ded8; margin-top: 12px; padding: 12px; page-break-inside: avoid; }
          .lot-head { align-items: flex-start; display: flex; justify-content: space-between; gap: 16px; }
          .mix-table th { background: #fff7d6; }
          .muted { color: #667085; }
          .signature { display: grid; gap: 32px; grid-template-columns: 1fr 1fr; margin-top: 42px; }
          .line { border-top: 1px solid #17201a; padding-top: 6px; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Orden de alistamiento y mezcla</h1>
            <p><strong>Venta:</strong> ${sale.code}</p>
            ${sale.quote_code ? `<p><strong>Preventa:</strong> ${sale.quote_code}</p>` : ""}
            <p><strong>Fecha:</strong> ${formatDate(new Date())}</p>
          </div>
          <div>
            <p><strong>Finca Anaya</strong></p>
            <p>Documento operativo para bodega</p>
          </div>
        </header>

        <section class="meta">
          <p><strong>Cliente:</strong> ${sale.client_name || "-"}</p>
          <p><strong>Telefono:</strong> ${sale.client_phone || "-"}</p>
          <p><strong>Direccion:</strong> ${sale.client_address || "-"}</p>
          <p><strong>Estado:</strong> ${sale.status || "-"}</p>
        </section>

        <h2>Pedido</h2>
        <table>
          <thead>
            <tr>
              <th>Producto solicitado</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>${productRows || ""}</tbody>
        </table>

        <h2>Lotes y porcentajes de mezcla</h2>
        ${
          finalBlendOrder ||
          deductedLots ||
          '<p class="muted">No hay orden de mezcla ni lotes descontados registrados.</p>'
        }

        <section class="signature">
          <p class="line">Entrega bodega</p>
          <p class="line">Recibe / realiza mezcla</p>
        </section>
      </body>
    </html>
  `;
};

const WarehousePage = () => {
  const [catalogs, setCatalogs] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [pendingLots, setPendingLots] = useState([]);
  const [rejectedLots, setRejectedLots] = useState([]);
  const [pendingSales, setPendingSales] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [notes, setNotes] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [supplierForm, setSupplierForm] = useState(initialSupplier);
  const [lotForm, setLotForm] = useState(initialLot);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPackaging = useMemo(() => {
    return catalogs?.packagingTypes?.find((packaging) => String(packaging.id) === String(lotForm.packagingTypeId));
  }, [catalogs, lotForm.packagingTypeId]);

  const estimatedNetWeight = useMemo(() => {
    const gross = Number(lotForm.grossWeightKg || 0);
    const packages = Number(lotForm.packagingQuantity || 0);
    const tare = Number(selectedPackaging?.tare_kg || 0) * packages;
    const innerBag = lotForm.hasInnerBag ? 0.05 * packages : 0;
    const net = gross - tare - innerBag;
    return net > 0 ? net.toFixed(3) : "0.000";
  }, [lotForm, selectedPackaging]);

  const loadData = async () => {
    const [catalogData, supplierData, lotData, rejectedData, saleData, inventoryData] = await Promise.all([
      apiRequest("/catalogs"),
      apiRequest("/suppliers"),
      apiRequest("/lots?status=pendiente_laboratorio"),
      apiRequest("/lots?status=rechazado"),
      apiRequest("/sales"),
      apiRequest("/inventory/lots"),
    ]);
    setCatalogs(catalogData);
    setSuppliers(supplierData);
    setPendingLots(lotData);
    setRejectedLots(rejectedData);
    setPendingSales(saleData.filter((sale) => activeWarehouseStatuses.includes(sale.status)));
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

  const createSupplier = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      await apiRequest("/suppliers", {
        method: "POST",
        body: JSON.stringify(supplierForm),
      });
      setSupplierForm(initialSupplier);
      await loadData();
      setMessage("Proveedor creado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const createLot = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      await apiRequest("/lots/received", {
        method: "POST",
        body: JSON.stringify({
          ...lotForm,
          supplierId: Number(lotForm.supplierId),
          coffeeTypeId: Number(lotForm.coffeeTypeId),
          grossWeightKg: Number(lotForm.grossWeightKg),
          packagingTypeId: Number(lotForm.packagingTypeId),
          packagingQuantity: Number(lotForm.packagingQuantity),
          humidityPercent: Number(lotForm.humidityPercent),
          performanceFactor: lotForm.performanceFactor === "" ? null : Number(lotForm.performanceFactor),
          commercialClassification: lotForm.commercialClassification || null,
          visualDefectPercent: lotForm.visualDefectPercent === "" ? null : Number(lotForm.visualDefectPercent),
        }),
      });
      setLotForm(initialLot);
      await loadData();
      setMessage(
        lotForm.visualStatus === "aprobado"
          ? "Cafe recibido correctamente. Quedo pendiente de laboratorio."
          : "Cafe rechazado registrado correctamente con codigo de lote."
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const withdrawRejectedLot = async (lot) => {
    const notes = window.prompt(`Observacion de retiro para ${lot.code}`, "Retirado por proveedor");

    if (notes === null) return;

    const confirmed = window.confirm(`Confirmas marcar el lote ${lot.code} como retirado?`);

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${lot.id}/withdraw-rejected`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      await loadData();
      setMessage("Lote rechazado marcado como retirado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const loadSaleDetail = async (saleId, withLoading = true) => {
    if (withLoading) {
      setLoadingDetail(true);
    }

    try {
      const sale = await apiRequest(`/sales/${saleId}`);
      setSelectedSale(sale);
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
      setMessage("Lotes asignados correctamente. Se descontaran cuando la venta se marque como alistada.");
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
          <h1 className="text-xl font-bold text-ink">Bodega</h1>
          <p className="text-sm text-slate-500">Recepcion de cafe y lotes pendientes de laboratorio.</p>
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

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createSupplier}>
            <h2 className="text-sm font-semibold text-slate-800">Proveedor rapido</h2>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nombre de finca o proveedor"
                value={supplierForm.name}
                onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Telefono"
                value={supplierForm.phone}
                onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Direccion"
                value={supplierForm.address}
                onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Zona de procedencia"
                value={supplierForm.originZone}
                onChange={(event) => setSupplierForm({ ...supplierForm, originZone: event.target.value })}
              />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
                <Save size={16} />
                Guardar proveedor
              </button>
            </div>
          </form>

          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">Peso estimado</h2>
            <p className="mt-2 text-3xl font-bold text-ink">{estimatedNetWeight} kg</p>
            <p className="text-sm text-slate-500">Peso neto calculado con empaque y bolsa interna.</p>
          </div>
        </div>

        <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createLot}>
          <h2 className="text-sm font-semibold text-slate-800">Ingresar cafe recibido</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.supplierId}
              onChange={(event) => setLotForm({ ...lotForm, supplierId: event.target.value })}
            >
              <option value="">Proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.coffeeTypeId}
              onChange={(event) => setLotForm({ ...lotForm, coffeeTypeId: event.target.value })}
            >
              <option value="">Tipo de cafe</option>
              {catalogs?.coffeeTypes?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Peso bruto kg"
              type="number"
              step="0.001"
              value={lotForm.grossWeightKg}
              onChange={(event) => setLotForm({ ...lotForm, grossWeightKg: event.target.value })}
            />
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.packagingTypeId}
              onChange={(event) => setLotForm({ ...lotForm, packagingTypeId: event.target.value })}
            >
              <option value="">Empaque</option>
              {catalogs?.packagingTypes?.map((packaging) => (
                <option key={packaging.id} value={packaging.id}>
                  {packaging.name}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Cantidad de empaques"
              type="number"
              value={lotForm.packagingQuantity}
              onChange={(event) => setLotForm({ ...lotForm, packagingQuantity: event.target.value })}
            />
            <label className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={lotForm.hasInnerBag}
                onChange={(event) => setLotForm({ ...lotForm, hasInnerBag: event.target.checked })}
              />
              Tiene bolsa interna
            </label>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Humedad %"
              type="number"
              step="0.01"
              value={lotForm.humidityPercent}
              onChange={(event) => setLotForm({ ...lotForm, humidityPercent: event.target.value })}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Factor de rendimiento"
              type="number"
              step="0.01"
              value={lotForm.performanceFactor}
              onChange={(event) => setLotForm({ ...lotForm, performanceFactor: event.target.value })}
            />
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.visualStatus}
              onChange={(event) => setLotForm({ ...lotForm, visualStatus: event.target.value })}
            >
              <option value="aprobado">Visual aprobado</option>
              <option value="rechazado">Visual rechazado</option>
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.commercialClassification}
              onChange={(event) => setLotForm({ ...lotForm, commercialClassification: event.target.value })}
            >
              <option value="">Clasificacion comercial</option>
              <option value="Base">Base</option>
              <option value="Regional">Regional</option>
              <option value="Varietal">Varietal</option>
              <option value="Exotico">Exotico</option>
              <option value="Procesado">Procesado</option>
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Defecto visual %"
              type="number"
              step="0.01"
              value={lotForm.visualDefectPercent}
              onChange={(event) => setLotForm({ ...lotForm, visualDefectPercent: event.target.value })}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Zona de procedencia"
              value={lotForm.originZone}
              onChange={(event) => setLotForm({ ...lotForm, originZone: event.target.value })}
            />
            <textarea
              className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Observaciones visuales"
              value={lotForm.visualNotes}
              onChange={(event) => setLotForm({ ...lotForm, visualNotes: event.target.value })}
            />
            <textarea
              className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Comentario inicial del lote"
              value={lotForm.initialComment}
              onChange={(event) => setLotForm({ ...lotForm, initialComment: event.target.value })}
            />
          </div>
          <button className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
            <Save size={16} />
            Registrar cafe
          </button>
        </form>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ordenes pendientes de bodega</h2>
          </div>
          {pendingSales.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin ordenes pendientes" message="Las ventas pendientes de alistamiento o despacho apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Entrega</th>
                    <th className="px-3 py-2">Prioridad</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-3 py-2 font-medium">{sale.code}</td>
                      <td className="px-3 py-2">{sale.client_name}</td>
                      <td className="px-3 py-2">{formatDate(sale.estimated_delivery_date)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={sale.warehouse_priority === "alta" ? "danger" : sale.warehouse_priority === "media" ? "warning" : "neutral"}>
                          {sale.warehouse_priority || "media"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={sale.status === "alistada" ? "success" : "warning"}>{sale.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          type="button"
                          onClick={() => loadSaleDetail(sale.id)}
                        >
                          <Eye size={14} />
                          Ver orden
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
          <h2 className="text-sm font-semibold text-slate-800">Orden seleccionada</h2>
          {loadingDetail ? (
            <p className="mt-3 text-sm text-slate-500">Cargando orden...</p>
          ) : !selectedSale ? (
            <div className="mt-3">
              <EmptyState title="Seleccione una orden" message="Aqui vera productos, mezcla y acciones de bodega." />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold text-ink">{selectedSale.code}</p>
                <p className="text-sm text-slate-500">{selectedSale.client_name}</p>
                <p className="text-sm text-slate-500">{selectedSale.client_address || "Sin direccion"}</p>
                <p className="text-sm text-slate-500">Entrega: {formatDate(selectedSale.estimated_delivery_date)}</p>
                <div className="mt-2">
                  <StatusBadge tone={selectedSale.status === "alistada" ? "success" : "warning"}>{selectedSale.status}</StatusBadge>
                </div>
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

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedSale.items?.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-ink">{item.description || item.coffee_profile_name || item.coffee_type_name}</p>
                    <p className="text-slate-500">{item.quantity_kg} kg</p>
                  </div>
                ))}
              </div>

              {selectedSale.items?.some((item) => item.blend_items?.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Mezcla indicada por laboratorio</p>
                  {selectedSale.items
                    .filter((item) => item.blend_items?.length > 0)
                    .map((item) => (
                      <div key={`warehouse-blend-${item.id}`} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
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
                                <span className="text-xs text-slate-500">{blend.calculated_quantity_kg} kg estimados</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className="space-y-3 rounded border border-slate-200 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Asignar lotes de bodega</p>
                  <p className="text-xs text-slate-500">Estos lotes se reservan operativamente y se descuentan al marcar la venta como alistada.</p>
                </div>
                {assignmentRows.map((row, index) => (
                  <div key={`assignment-${index}`} className="rounded border border-slate-200 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        value={row.saleItemId}
                        onChange={(event) => updateAssignmentRow(index, "saleItemId", event.target.value)}
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
                        value={row.lotId}
                        onChange={(event) => updateAssignmentRow(index, "lotId", event.target.value)}
                      >
                        <option value="">Lote disponible</option>
                        {availableLots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lot.code} - {lot.commercial_classification || lot.coffee_profile_name || lot.coffee_type_name || "Cafe"} - {lot.available_weight_kg} kg
                          </option>
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
                <button
                  className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={
                    saving ||
                    !["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "listo_para_ensamble", "ensamble_definido"].includes(selectedSale.status)
                  }
                  type="button"
                  onClick={() => updateSaleStatus("prepare")}
                >
                  <PackageCheck size={16} />
                  Alistada
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving || selectedSale.status !== "alistada"}
                  type="button"
                  onClick={() => updateSaleStatus("dispatch")}
                >
                  <Truck size={16} />
                  Despachada
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Pendientes de laboratorio</h2>
        </div>
        {pendingLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin pendientes" message="Los lotes aprobados visualmente apareceran aqui." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Peso neto</th>
                  <th className="px-3 py-2">Humedad</th>
                  <th className="px-3 py-2">Factor rendimiento</th>
                  <th className="px-3 py-2">Clasificacion</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingLots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2 font-medium">{lot.code}</td>
                    <td className="px-3 py-2">{lot.supplier_name}</td>
                    <td className="px-3 py-2">{lot.net_weight_kg} kg</td>
                    <td className="px-3 py-2">{lot.humidity_percent}%</td>
                    <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                    <td className="px-3 py-2">{lot.commercial_classification || "-"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone="warning">{lot.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Rechazados pendientes de retiro</h2>
        </div>
        {rejectedLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin rechazados en bodega" message="Los lotes rechazados que sigan ocupando espacio apareceran aqui." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Peso neto</th>
                  <th className="px-3 py-2">Humedad</th>
                  <th className="px-3 py-2">Factor</th>
                  <th className="px-3 py-2">Clasificacion</th>
                  <th className="px-3 py-2">Dias en bodega</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rejectedLots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2 font-medium">{lot.code}</td>
                    <td className="px-3 py-2">{lot.supplier_name || "-"}</td>
                    <td className="px-3 py-2">{lot.net_weight_kg} kg</td>
                    <td className="px-3 py-2">{lot.humidity_percent ?? "-"}%</td>
                    <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                    <td className="px-3 py-2">{lot.commercial_classification || "-"}</td>
                    <td className="px-3 py-2">{lot.days_in_warehouse ?? 0}</td>
                    <td className="px-3 py-2">
                      <button
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        type="button"
                        onClick={() => withdrawRejectedLot(lot)}
                        disabled={saving}
                      >
                        Marcar retirado
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default WarehousePage;
