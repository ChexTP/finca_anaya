import { Eye, FlaskConical, PackageCheck, Printer, RefreshCw, Save, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { companyBrand, getPrintableLogo } from "../../utils/brand";
import { formatCoffeeLotCodeName } from "../../utils/coffeeLots";

const initialSupplier = {
  name: "",
  phone: "",
  address: "",
  originZone: "",
  notes: "",
};

const initialLot = {
  supplierId: "",
  purchaseCoffeeId: "",
  coffeeTypeId: "",
  presentation: "Pergamino",
  grossWeightKg: "",
  packagingTypeId: "",
  packagingQuantity: "",
  hasInnerBag: false,
  humidityPercent: "",
  performanceFactor: "",
  receivedAt: new Date().toISOString().slice(0, 10),
  commercialClassification: "",
  coffeeVariety: "",
  visualNotes: "",
  originZone: "",
  initialComment: "",
};

const initialStockEntry = {
  lotKind: "PASILLA",
  coffeeTypeId: "",
  commercialClassification: "Regional",
  presentation: "Pergamino",
  coffeeVariety: "",
  weightKg: "",
  humidityPercent: "",
  receivedAt: new Date().toISOString().slice(0, 10),
  originZone: "",
  initialComment: "",
};

export const activeWarehouseStatuses = [
  "pendiente_alistamiento",
  "pendiente_bodega",
  "lote_asignado",
  "proceso_solicitado",
  "en_proceso",
  "listo_para_ensamble",
  "ensamble_definido",
  "pendiente_laboratorio",
  "aprobada_laboratorio",
  "alistada",
];

export const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-CO");
};

export const formatInputLabel = (input) => {
  return input.coffee_profile_name || input.coffee_type_name || input.commercial_classification || "Cafe";
};

const getProfilePrimaryComponent = (item) => {
  return Array.isArray(item.profile_components)
    ? item.profile_components.find((component) => component?.purchase_coffee_name)?.purchase_coffee_name
    : null;
};

export const getWarehouseItemLabel = (item) => {
  const primaryComponent = getProfilePrimaryComponent(item);

  if (item.coffee_profile_category === "Exotico" && primaryComponent && item.coffee_profile_name) {
    return `${primaryComponent} para ${item.coffee_profile_name}`;
  }

  return item.description || item.coffee_profile_name || item.coffee_type_name || item.lot_code || "Producto";
};

export const getWarehouseItemComponentSummary = (item) => {
  const primaryComponent = getProfilePrimaryComponent(item);
  const parts = [];

  if (item.coffee_profile_category === "Exotico" && primaryComponent && item.coffee_profile_name) {
    parts.push(`Componente principal: ${primaryComponent} para ${item.coffee_profile_name}`);
  }

  if (item.base_purchase_coffee_name) {
    parts.push(`Base principal: ${item.base_purchase_coffee_name}`);
  }

  return parts.join("<br>");
};

export const buildWarehouseOrderHtml = (sale) => {
  const productRows = sale.items
    ?.map(
      (item) => {
        const itemLabel = getWarehouseItemLabel(item);
        const componentSummary = getWarehouseItemComponentSummary(item);
        const processSummary = [item.process_type, item.variety].filter(Boolean).join(" - ");

        return `
        <tr>
          <td>${itemLabel}</td>
          <td>${[item.product_form ? `<strong>${item.product_form}</strong>` : "", processSummary, componentSummary].filter(Boolean).join("<br>") || "-"}</td>
          <td>${item.quantity_kg}${item.operational_weight_kg && Number(item.operational_weight_kg) !== Number(item.quantity_kg) ? `<br><span class="muted">Operativo: ${item.operational_weight_kg}</span>` : ""}</td>
          <td></td>
        </tr>
      `;
      }
    )
    .join("");

  const finalBlendOrder = sale.items
    ?.filter((item) => item.blend_items?.length > 0)
    .map(
      (item) => `
        <section class="lot-block">
          <div class="lot-head">
            <div>
              <h3>${getWarehouseItemLabel(item)}</h3>
              <p><strong>${item.product_form || "Presentacion no definida"}</strong> · ${item.quantity_kg} kg solicitados${item.operational_weight_kg && Number(item.operational_weight_kg) !== Number(item.quantity_kg) ? ` / ${item.operational_weight_kg} kg operativos` : ""}</p>
            </div>
            <strong>Mezcla final</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>DESCRIPCION</th>
                <th>PROCESO</th>
                <th>Kg estimados</th>
                <th>CHECK</th>
              </tr>
            </thead>
            <tbody>
              ${item.blend_items
                .map(
                  (blend) => `
                    <tr>
                      <td>${formatCoffeeLotCodeName(blend)} (${blend.percentage}%)</td>
                      <td>${blend.coffee_type_name || blend.coffee_profile_name || "-"}</td>
                      <td>${blend.calculated_operational_kg || blend.calculated_quantity_kg}</td>
                      <td></td>
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
          <table>
            <thead>
              <tr>
                <th>DESCRIPCION</th>
                <th>PROCESO</th>
                <th>KG</th>
                <th>CHECK</th>
              </tr>
            </thead>
            <tbody>
              ${lot.process_mix
                .map(
                  (input) => `
                    <tr>
                      <td>${formatCoffeeLotCodeName(input)} (${input.input_percentage}%)</td>
                      <td>${input.coffee_type_name || input.coffee_profile_name || "-"}</td>
                      <td>${input.quantity_kg}</td>
                      <td></td>
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
              <h3>${formatCoffeeLotCodeName(lot)}</h3>
              <p>${lot.coffee_profile_name || lot.coffee_type_name || lot.commercial_classification || lot.lot_kind || "-"}</p>
            </div>
            <strong>${lot.quantity_kg} kg</strong>
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
          body { color: #111827; font-family: Arial, sans-serif; margin: 26px; }
          header { align-items: flex-start; display: flex; justify-content: space-between; gap: 24px; }
          h1 { font-size: 16px; margin: 0 0 14px; text-transform: uppercase; }
          h2 { font-size: 13px; margin: 22px 0 8px; text-transform: uppercase; }
          h3 { font-size: 13px; margin: 0 0 3px; }
          p { font-size: 12px; margin: 4px 0; }
          table { border-collapse: collapse; margin-top: 10px; width: 100%; }
          th, td { border: 1px solid #111827; font-size: 12px; padding: 8px; text-align: left; vertical-align: middle; }
          th { background: #f2f2f2; font-weight: 700; text-align: center; }
          td:nth-child(3), td:nth-child(4) { text-align: center; width: 90px; }
          .logo { height: 72px; object-fit: contain; width: 150px; }
          .meta { margin-top: 10px; }
          .instructions { margin-top: 18px; }
          .instructions p { font-size: 12px; margin: 6px 0; }
          .lot-block { margin-top: 16px; page-break-inside: avoid; }
          .lot-head { align-items: flex-start; display: flex; justify-content: space-between; gap: 16px; }
          .muted { color: #667085; }
          .signature { display: grid; gap: 32px; grid-template-columns: 1fr 1fr; margin-top: 54px; }
          .line { border-top: 1px solid #111827; font-weight: 700; padding-top: 6px; text-align: center; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${sale.client_name || "Cliente"} - ORDEN DE PEDIDO - COTIZACION ${sale.quote_code || sale.code}</h1>
            <p><strong>Fecha de Inicio orden:</strong> ${formatDate(new Date())}</p>
            <p><strong>Presentaciones del pedido:</strong> ${[...new Set((sale.items || []).map((item) => item.product_form).filter(Boolean))].join(" / ") || "CAFE"}</p>
            <p><strong>Cliente:</strong> ${sale.client_name || "-"}</p>
            <p><strong>Encargado de pedido:</strong> ${sale.order_assignee || "-"}</p>
            <p><strong>Dia estimado de despacho:</strong> ${formatDate(sale.estimated_delivery_date)}</p>
          </div>
          <div>
            <img class="logo" src="${getPrintableLogo()}" alt="Anaya Coffee" />
            <p><strong>${companyBrand.legalName}</strong></p>
          </div>
        </header>

        <table>
          <thead>
            <tr>
              <th>DESCRIPCION</th>
              <th>PROCESO</th>
              <th>KG</th>
              <th>CHECK</th>
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

        <section class="instructions">
          <p>- Hacer registro fotografico.</p>
          <p>- Perfilar lotes.</p>
          <p>- Entregar con esta hoja el cafe al responsable de despacho.</p>
        </section>

        <section class="signature">
          <p class="line">${sale.order_assignee || "ENCARGADO DE PEDIDO"}</p>
          <p class="line">DESPACHA</p>
        </section>
      </body>
    </html>
  `;
};

const WarehousePage = () => {
  const { user } = useAuth();
  const [catalogs, setCatalogs] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [pendingLots, setPendingLots] = useState([]);
  const [physicalReviewLots, setPhysicalReviewLots] = useState([]);
  const [acceptedLabLots, setAcceptedLabLots] = useState([]);
  const [rejectedLots, setRejectedLots] = useState([]);
  const [pendingSales, setPendingSales] = useState([]);
  const [availableLots, setAvailableLots] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [notes, setNotes] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [supplierForm, setSupplierForm] = useState(initialSupplier);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [lotForm, setLotForm] = useState(initialLot);
  const [editingLot, setEditingLot] = useState(null);
  const [stockEntryForm, setStockEntryForm] = useState(initialStockEntry);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPackaging = useMemo(() => {
    return catalogs?.packagingTypes?.find((packaging) => String(packaging.id) === String(lotForm.packagingTypeId));
  }, [catalogs, lotForm.packagingTypeId]);

  const receivedPurchaseCoffeeOptions = useMemo(() => {
    return (catalogs?.purchaseCoffees || []).filter((coffee) => coffee.is_active !== false);
  }, [catalogs]);

  const selectedPurchaseCoffee = useMemo(() => {
    return receivedPurchaseCoffeeOptions.find((coffee) => String(coffee.id) === String(lotForm.purchaseCoffeeId));
  }, [lotForm.purchaseCoffeeId, receivedPurchaseCoffeeOptions]);

  const stockPurchaseCoffeeOptions = useMemo(() => {
    return (catalogs?.purchaseCoffees || []).filter((coffee) => {
      const familyMatches = coffee.family === stockEntryForm.commercialClassification;
      const processType = catalogs?.coffeeTypes?.find((type) => String(type.id) === String(stockEntryForm.coffeeTypeId));
      const processMatches = processType?.name ? coffee.process_type === processType.name : true;

      return familyMatches && processMatches && coffee.is_active !== false;
    });
  }, [catalogs, stockEntryForm.commercialClassification, stockEntryForm.coffeeTypeId]);

  const estimatedNetWeight = useMemo(() => {
    const gross = Number(lotForm.grossWeightKg || 0);
    const packages = Number(lotForm.packagingQuantity || 0);
    const tare = Number(selectedPackaging?.tare_kg || 0) * packages;
    const innerBag = lotForm.hasInnerBag ? 0.05 * packages : 0;
    const net = gross - tare - innerBag;
    return net > 0 ? net.toFixed(3) : "0.000";
  }, [lotForm, selectedPackaging]);

  const handleReceivedPurchaseCoffeeChange = (purchaseCoffeeId) => {
    const purchaseCoffee = receivedPurchaseCoffeeOptions.find((coffee) => String(coffee.id) === String(purchaseCoffeeId));
    const coffeeType = catalogs?.coffeeTypes?.find((type) => type.name === purchaseCoffee?.process_type);

    setLotForm({
      ...lotForm,
      purchaseCoffeeId,
      coffeeTypeId: coffeeType?.id ? String(coffeeType.id) : "",
      commercialClassification: purchaseCoffee?.family || "",
      coffeeVariety: purchaseCoffee?.name || "",
    });
  };

  const getPurchaseCoffeeIdFromLot = (lot) => {
    const match = receivedPurchaseCoffeeOptions.find((coffee) => (
      coffee.name === lot.coffee_variety &&
      coffee.family === lot.commercial_classification &&
      coffee.process_type === lot.coffee_type_name
    ));

    return match?.id ? String(match.id) : "";
  };

  const buildReceptionPayload = () => ({
    ...lotForm,
    supplierId: Number(lotForm.supplierId),
    coffeeTypeId: Number(lotForm.coffeeTypeId),
    grossWeightKg: Number(lotForm.grossWeightKg),
    packagingTypeId: Number(lotForm.packagingTypeId),
    packagingQuantity: Number(lotForm.packagingQuantity),
    humidityPercent: lotForm.humidityPercent === "" ? null : Number(lotForm.humidityPercent),
    performanceFactor: lotForm.performanceFactor === "" ? null : Number(lotForm.performanceFactor),
    commercialClassification: lotForm.commercialClassification || null,
  });

  const startReceptionEdit = (lot) => {
    setEditingLot(lot);
    setLotForm({
      supplierId: lot.supplier_id ? String(lot.supplier_id) : "",
      purchaseCoffeeId: getPurchaseCoffeeIdFromLot(lot),
      coffeeTypeId: lot.coffee_type_id ? String(lot.coffee_type_id) : "",
      presentation: lot.presentation || "Pergamino",
      grossWeightKg: lot.gross_weight_kg || "",
      packagingTypeId: lot.packaging_type_id ? String(lot.packaging_type_id) : "",
      packagingQuantity: lot.packaging_quantity ?? "",
      hasInnerBag: Number(lot.inner_bag_quantity || 0) > 0,
      humidityPercent: lot.humidity_percent ?? "",
      performanceFactor: lot.performance_factor ?? "",
      receivedAt: lot.received_at ? String(lot.received_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
      commercialClassification: lot.commercial_classification || "",
      coffeeVariety: lot.coffee_variety || "",
      visualNotes: lot.visual_notes || "",
      originZone: lot.origin_zone || "",
      initialComment: lot.initial_comment || "",
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelReceptionEdit = () => {
    setEditingLot(null);
    setLotForm(initialLot);
    setMessage("");
    setError("");
  };

  const startSupplierEdit = (supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      originZone: supplier.origin_zone || "",
      notes: supplier.notes || "",
    });
    setShowSupplierForm(true);
    setMessage("");
    setError("");
  };

  const cancelSupplierEdit = () => {
    setEditingSupplier(null);
    setSupplierForm(initialSupplier);
    setMessage("");
    setError("");
  };

  const loadData = async () => {
    const [catalogData, supplierData, lotData, physicalData, acceptedData, rejectedData, saleData, inventoryData] = await Promise.all([
      apiRequest("/catalogs"),
      apiRequest("/suppliers"),
      apiRequest("/lots?status=pendiente_laboratorio"),
      apiRequest("/lots?status=pendiente_revision_fisica"),
      apiRequest("/lots?status=pendiente_liquidacion"),
      apiRequest("/lots?status=rechazado"),
      apiRequest("/sales"),
      apiRequest("/inventory/lots"),
    ]);
    setCatalogs(catalogData);
    setSuppliers(supplierData);
    setPendingLots(lotData);
    setPhysicalReviewLots(physicalData);
    setAcceptedLabLots(acceptedData);
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
      await apiRequest(editingSupplier ? `/suppliers/${editingSupplier.id}` : "/suppliers", {
        method: editingSupplier ? "PUT" : "POST",
        body: JSON.stringify({
          ...supplierForm,
          isActive: editingSupplier?.is_active ?? true,
        }),
      });
      setSupplierForm(initialSupplier);
      setEditingSupplier(null);
      await loadData();
      setMessage(editingSupplier ? "Proveedor actualizado correctamente." : "Proveedor creado correctamente.");
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

    try {
      if (!editingLot && !selectedPurchaseCoffee) {
        throw new Error("Debe seleccionar uno de los cafes comprados por la empresa.");
      }
      if (editingLot && !lotForm.coffeeTypeId) {
        throw new Error("Debe indicar el cafe comprado antes de guardar la correccion.");
      }

      if (
        ["Regional", "Varietal", "Exotico"].includes(lotForm.commercialClassification) &&
        !lotForm.coffeeVariety.trim()
      ) {
        throw new Error("Debe indicar la clasificacion, variedad o codigo exacto del cafe.");
      }

      const actionLabel = editingLot ? `corregir el lote ${editingLot.code}` : "registrar este cafe";
      const confirmed = window.confirm(`Confirma ${actionLabel}? Revisa empaque, bolsa interna, peso y fecha antes de continuar.`);
      if (!confirmed) return;

      setSaving(true);
      const response = await apiRequest(editingLot ? `/lots/${editingLot.id}/reception` : "/lots/received", {
        method: editingLot ? "PUT" : "POST",
        body: JSON.stringify(buildReceptionPayload()),
      });
      setLotForm(initialLot);
      setEditingLot(null);
      await loadData();
      setMessage(
        editingLot
          ? "Datos de ingreso corregidos correctamente."
          : response.data.status === "pendiente_revision_fisica"
            ? "Cafe recibido. Quedo pendiente de revision fisica en bodega."
            : "Cafe recibido. Quedo pendiente de analisis sensorial en laboratorio."
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const createStockEntry = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      if (stockEntryForm.lotKind === "RECUPERACION" && !stockEntryForm.coffeeVariety.trim()) {
        throw new Error("La recuperacion necesita nombre, variedad o codigo exacto.");
      }

      const response = await apiRequest("/lots/stock-entry", {
        method: "POST",
        body: JSON.stringify({
          ...stockEntryForm,
          coffeeTypeId: Number(stockEntryForm.coffeeTypeId),
          weightKg: Number(stockEntryForm.weightKg),
          humidityPercent: stockEntryForm.humidityPercent === "" ? null : Number(stockEntryForm.humidityPercent),
          commercialClassification:
            stockEntryForm.lotKind === "PASILLA" ? "Pasilla" : stockEntryForm.commercialClassification,
        }),
      });

      setStockEntryForm(initialStockEntry);
      await loadData();
      setMessage(response.message || "Entrada agregada al inventario.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const completeLotPhysicalReview = async (lot) => {
    const humidityPercent = window.prompt("Humedad medida (%)", lot.humidity_percent ?? "");
    if (!humidityPercent) return;
    const performanceFactor = window.prompt("Factor de rendimiento", lot.performance_factor ?? "");
    if (!performanceFactor) return;
    if (!window.confirm(`Confirma la revision fisica de ${formatCoffeeLotCodeName(lot)}?`)) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiRequest(`/lots/${lot.id}/physical-review`, {
        method: "PUT",
        body: JSON.stringify({
          humidityPercent: Number(humidityPercent),
          performanceFactor: Number(performanceFactor),
        }),
      });
      await loadData();
      setMessage("Revision fisica guardada. El lote paso a Laboratorio.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const withdrawRejectedLot = async (lot) => {
    const notes = window.prompt(`Observacion de retiro para ${formatCoffeeLotCodeName(lot)}`, "Retirado por proveedor");

    if (notes === null) return;

    const confirmed = window.confirm(`Confirmas marcar el lote ${formatCoffeeLotCodeName(lot)} como retirado?`);

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

    const label =
      action === "send-lab"
        ? "enviar esta venta a laboratorio"
        : action === "prepare"
          ? "marcar esta venta como alistada"
          : "marcar esta venta como despachada";
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
          <h1 className="text-xl font-bold text-ink">Recepcion de cafe</h1>
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
      {(acceptedLabLots.length > 0 || rejectedLots.length > 0) && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Cafe revisado por laboratorio</p>
              <p>
                {acceptedLabLots.length} aceptados pendientes de liquidacion y {rejectedLots.length} rechazados pendientes de retiro.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800" to="/bodega/historico-aceptados">
                Ver aceptados
              </Link>
              <Link className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800" to="/bodega/historico-rechazados">
                Ver rechazados
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded border border-slate-200 bg-white p-4">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              type="button"
              onClick={() => {
                if (showSupplierForm && editingSupplier) {
                  cancelSupplierEdit();
                }
                setShowSupplierForm((current) => !current);
              }}
            >
              {showSupplierForm ? "Cerrar proveedor" : "Agregar nuevo proveedor"}
            </button>
          {showSupplierForm && (
          <form className="mt-4 border-t border-slate-200 pt-4" onSubmit={createSupplier}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800">
                {editingSupplier ? `Editar ${editingSupplier.name}` : "Nuevo proveedor"}
              </h2>
              {editingSupplier && (
                <button
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={cancelSupplierEdit}
                >
                  Cancelar
                </button>
              )}
            </div>
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
                {editingSupplier ? "Guardar cambios" : "Guardar proveedor"}
              </button>
            </div>
          </form>
          )}
          {user?.role === "admin" && suppliers.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h2 className="text-sm font-semibold text-slate-800">Proveedores registrados</h2>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {suppliers.map((supplier) => (
                  <div key={supplier.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-semibold text-ink">{supplier.name}</p>
                    <p className="text-xs text-slate-500">{supplier.phone} · {supplier.origin_zone || "Sin zona"}</p>
                    <button
                      className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      type="button"
                      onClick={() => startSupplierEdit(supplier)}
                    >
                      Editar proveedor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">Peso estimado</h2>
            <p className="mt-2 text-3xl font-bold text-ink">{estimatedNetWeight} kg</p>
            <p className="text-sm text-slate-500">Peso neto calculado con empaque y bolsa interna.</p>
          </div>

          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createStockEntry}>
            <h2 className="text-sm font-semibold text-slate-800">Entrada rapida de stock</h2>
            <p className="mt-1 text-xs text-slate-500">Para pasillas recurrentes y recuperaciones que ya deben quedar disponibles.</p>
            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={stockEntryForm.lotKind}
                onChange={(event) => setStockEntryForm({ ...initialStockEntry, lotKind: event.target.value })}
              >
                <option value="PASILLA">Pasilla</option>
                <option value="RECUPERACION">Recuperacion</option>
              </select>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={stockEntryForm.coffeeTypeId}
                onChange={(event) => setStockEntryForm({ ...stockEntryForm, coffeeTypeId: event.target.value })}
                required
              >
                <option value="">Proceso</option>
                {catalogs?.coffeeTypes
                  ?.filter((type) =>
                    stockEntryForm.lotKind === "PASILLA"
                      ? ["Lavado", "Natural"].includes(type.name)
                      : ["Lavado", "Natural", "Semilavado"].includes(type.name)
                  )
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
              </select>
              {stockEntryForm.lotKind === "RECUPERACION" && (
                <>
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={stockEntryForm.commercialClassification}
                    onChange={(event) =>
                      setStockEntryForm({ ...stockEntryForm, commercialClassification: event.target.value, coffeeVariety: "" })
                    }
                  >
                    <option value="Regional">Regional</option>
                    <option value="Varietal">Varietal</option>
                    <option value="Exotico">Exotico</option>
                  </select>
                  {stockPurchaseCoffeeOptions.length > 0 ? (
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={stockEntryForm.coffeeVariety}
                      onChange={(event) => setStockEntryForm({ ...stockEntryForm, coffeeVariety: event.target.value })}
                      required
                    >
                      <option value="">Nombre exacto</option>
                      {stockPurchaseCoffeeOptions.map((coffee) => (
                        <option key={coffee.id} value={coffee.name}>
                          {coffee.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Nombre, variedad o codigo exacto"
                      value={stockEntryForm.coffeeVariety}
                      onChange={(event) => setStockEntryForm({ ...stockEntryForm, coffeeVariety: event.target.value })}
                      required
                    />
                  )}
                </>
              )}
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={stockEntryForm.presentation}
                onChange={(event) => setStockEntryForm({ ...stockEntryForm, presentation: event.target.value })}
              >
                <option value="Pergamino">Pergamino</option>
                <option value="Excelso">Excelso</option>
              </select>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Cantidad kg"
                type="number"
                min="0.001"
                step="0.001"
                value={stockEntryForm.weightKg}
                onChange={(event) => setStockEntryForm({ ...stockEntryForm, weightKg: event.target.value })}
                required
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Humedad % opcional"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={stockEntryForm.humidityPercent}
                onChange={(event) => setStockEntryForm({ ...stockEntryForm, humidityPercent: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={stockEntryForm.receivedAt}
                onChange={(event) => setStockEntryForm({ ...stockEntryForm, receivedAt: event.target.value })}
                required
              />
              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Observacion"
                value={stockEntryForm.initialComment}
                onChange={(event) => setStockEntryForm({ ...stockEntryForm, initialComment: event.target.value })}
              />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
                <Save size={16} />
                Agregar a inventario
              </button>
            </div>
          </form>
        </div>

        <form
          className="rounded border border-slate-200 bg-white p-4"
          onSubmit={createLot}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
              event.preventDefault();
            }
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">
              {editingLot ? `Corregir ingreso ${editingLot.code}` : "Ingresar cafe recibido"}
            </h2>
            {editingLot && (
              <button
                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={cancelReceptionEdit}
              >
                Cancelar correccion
              </button>
            )}
          </div>
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
              value={lotForm.purchaseCoffeeId}
              onChange={(event) => handleReceivedPurchaseCoffeeChange(event.target.value)}
              required
            >
              <option value="">Cafe comprado</option>
              {receivedPurchaseCoffeeOptions.map((coffee) => (
                <option key={coffee.id} value={coffee.id}>
                  {coffee.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.presentation}
              onChange={(event) => setLotForm({ ...lotForm, presentation: event.target.value })}
            >
              <option value="Pergamino">Pergamino</option>
              <option value="Excelso">Excelso</option>
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Clasificacion o codigo"
              value={lotForm.coffeeVariety}
              onChange={(event) => setLotForm({ ...lotForm, coffeeVariety: event.target.value })}
              required
            />
            <label className="text-xs font-medium text-slate-600">
              Fecha de llegada a bodega
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={lotForm.receivedAt}
                onChange={(event) => setLotForm({ ...lotForm, receivedAt: event.target.value })}
                required
              />
            </label>
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
              placeholder="Humedad % (opcional)"
              type="number"
              step="0.01"
              value={lotForm.humidityPercent}
              onChange={(event) => setLotForm({ ...lotForm, humidityPercent: event.target.value })}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Factor de rendimiento (opcional)"
              type="number"
              step="0.01"
              value={lotForm.performanceFactor}
              onChange={(event) => setLotForm({ ...lotForm, performanceFactor: event.target.value })}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Zona de procedencia"
              value={lotForm.originZone}
              onChange={(event) => setLotForm({ ...lotForm, originZone: event.target.value })}
            />
          </div>
          <button className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
            <Save size={16} />
            {editingLot ? "Guardar correccion" : "Registrar cafe"}
          </button>
        </form>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Pendientes de revision fisica</h2>
        </div>
        {physicalReviewLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin revisiones pendientes" message="Los lotes recibidos sin humedad o factor apareceran aqui." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {physicalReviewLots.map((lot) => (
              <div key={lot.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-ink">{formatCoffeeLotCodeName(lot)}</p>
                  <p className="text-sm text-slate-500">{lot.supplier_name || "Sin proveedor"} - {lot.net_weight_kg} kg</p>
                  <p className="text-sm text-slate-500">
                    Humedad: {lot.humidity_percent ?? "pendiente"} - Factor: {lot.performance_factor ?? "pendiente"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user?.role === "admin" && (
                    <button
                      className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      type="button"
                      disabled={saving}
                      onClick={() => startReceptionEdit(lot)}
                    >
                      Corregir ingreso
                    </button>
                  )}
                  <button
                    className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    type="button"
                    disabled={saving}
                    onClick={() => completeLotPhysicalReview(lot)}
                  >
                    Registrar revision fisica
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                  <th className="px-3 py-2">Presentacion</th>
                  <th className="px-3 py-2">Peso neto</th>
                  <th className="px-3 py-2">Humedad</th>
                  <th className="px-3 py-2">Factor rendimiento</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Clasificacion</th>
                  <th className="px-3 py-2">Llegada</th>
                  <th className="px-3 py-2">Estado</th>
                  {user?.role === "admin" && <th className="px-3 py-2">Accion</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingLots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(lot)}</td>
                    <td className="px-3 py-2">{lot.supplier_name}</td>
                    <td className="px-3 py-2">{lot.presentation || "Pergamino"}</td>
                    <td className="px-3 py-2">{lot.net_weight_kg} kg</td>
                    <td className="px-3 py-2">{lot.humidity_percent}%</td>
                    <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                    <td className="px-3 py-2">{lot.commercial_classification || "-"}</td>
                    <td className="px-3 py-2">{lot.coffee_variety || "-"}</td>
                    <td className="px-3 py-2">{formatDate(lot.received_at)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone="warning">{lot.status}</StatusBadge>
                    </td>
                    {user?.role === "admin" && (
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          type="button"
                          disabled={saving}
                          onClick={() => startReceptionEdit(lot)}
                        >
                          Corregir ingreso
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
                    <td className="px-3 py-2 font-medium">{formatCoffeeLotCodeName(lot)}</td>
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
