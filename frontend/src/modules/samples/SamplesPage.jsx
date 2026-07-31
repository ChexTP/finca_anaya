import { Edit, Eye, FlaskConical, ImagePlus, Plus, Printer, RefreshCw, Save, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { companyBrand, getPrintableLogo } from "../../utils/brand";

const today = new Date().toISOString().slice(0, 10);

const initialSample = {
  requesterName: "",
  requesterPhone: "",
  requesterEmail: "",
  requesterCompany: "",
  requesterAddress: "",
  requesterCity: "",
  requesterCountry: "",
  coffeeTypeId: "",
  coffeeProfileId: "",
  description: "",
  quantityGrams: "",
  currency: "COP",
  price: "",
  requestedAt: today,
  tentativeDeliveryDate: "",
  notes: "",
  status: "borrador",
};

const emptySampleItem = {
  coffeeTypeId: "",
  coffeeProfileId: "",
  description: "",
  quantityGrams: "",
  price: "",
};

const statusLabels = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  solicitada: "Solicitada",
  en_preparacion: "En preparacion",
  pendiente_laboratorio: "Pendiente laboratorio",
  aprobada_laboratorio: "Aprobada laboratorio",
  lista: "Lista",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const statusTones = {
  borrador: "neutral",
  enviada: "warning",
  aprobada: "success",
  solicitada: "warning",
  en_preparacion: "warning",
  pendiente_laboratorio: "warning",
  aprobada_laboratorio: "success",
  lista: "success",
  entregada: "success",
  cancelada: "danger",
};

const sampleFilters = [
  { key: "all", label: "Todas" },
  { key: "borrador", label: "Borradores" },
  { key: "enviada", label: "Enviadas" },
  { key: "aprobada", label: "Aprobadas" },
  { key: "solicitada", label: "Solicitadas" },
  { key: "en_preparacion", label: "En preparacion" },
  { key: "pendiente_laboratorio", label: "Pendientes lab" },
  { key: "aprobada_laboratorio", label: "Aprobadas lab" },
  { key: "lista", label: "Listas" },
  { key: "cancelada", label: "Canceladas" },
];

const statusOrder = {
  borrador: 1,
  enviada: 2,
  aprobada: 3,
  solicitada: 4,
  en_preparacion: 5,
  pendiente_laboratorio: 6,
  aprobada_laboratorio: 7,
  lista: 8,
  entregada: 9,
  cancelada: 10,
};

const formatDate = (value) => {
  if (!value) return "-";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");

  return [day, month, year].filter(Boolean).join("/");
};

/*
  Precios de muestras desactivados. Se conserva la funcion para posible reactivacion comercial.
const formatMoney = (currency, value) => {
  if (value === null || value === undefined || value === "") return "Gratis";
  return `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;
};
*/

const formatLabValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const hasCompleteSampleLabReview = (sample) => {
  return (sample.items || []).length > 0 && (sample.items || []).every((item) => [
    item.sample_humidity_percent,
    item.sample_lab_aroma,
    item.sample_lab_flavor,
    item.sample_lab_sweetness,
    item.sample_lab_body,
    item.sample_lab_residual,
    item.sample_lab_clean_cup,
    item.sample_lab_score,
  ].every((value) => value !== null && value !== undefined));
};

const hasCompleteSampleBlend = (sample) => {
  return (sample.items || []).every((item) => {
    const total = (item.blend_items || []).reduce((sum, blend) => sum + Number(blend.percentage || 0), 0);
    return Number(total.toFixed(2)) === 100;
  });
};

const normalizePercentageInput = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return String(Math.min(Number(digits), 100));
};

const buildSampleLabSummary = (sample) => {
  if (!hasCompleteSampleLabReview(sample)) return null;

  return [
    ...sample.items.map((item) => (
      `${formatRequestedCoffee(item)}: Humedad ${formatLabValue(item.sample_humidity_percent)}, Score ${formatLabValue(item.sample_lab_score)}`
    )),
  ].join(" | ");
};

const buildSampleItemLabSummary = (item) => {
  if ([
    item.sample_humidity_percent,
    item.sample_lab_aroma,
    item.sample_lab_flavor,
    item.sample_lab_sweetness,
    item.sample_lab_body,
    item.sample_lab_residual,
    item.sample_lab_clean_cup,
    item.sample_lab_score,
  ].some((value) => value === null || value === undefined)) {
    return null;
  }

  return `Humedad ${formatLabValue(item.sample_humidity_percent)} · Aroma ${formatLabValue(item.sample_lab_aroma)} · Sabor ${formatLabValue(item.sample_lab_flavor)} · Dulzor ${formatLabValue(item.sample_lab_sweetness)} · Cuerpo ${formatLabValue(item.sample_lab_body)} · Residual ${formatLabValue(item.sample_lab_residual)} · Taza limpia ${formatLabValue(item.sample_lab_clean_cup)} · Score ${formatLabValue(item.sample_lab_score)}`;
};

const formatRequestedCoffee = (item) => {
  const details = [item.coffee_type_name, item.coffee_profile_name, item.description].filter(Boolean);
  return [...new Set(details)].join(" - ") || "Cafe sin especificar";
};

const getSampleActions = (sample) => {
  const actionsByStatus = {
    borrador: ["enviada", "cancelada"],
    enviada: ["aprobada", "cancelada"],
    aprobada: ["en_preparacion", "cancelada"],
    solicitada: ["en_preparacion", "cancelada"],
    en_preparacion: ["pendiente_laboratorio", "cancelada"],
    aprobada_laboratorio: ["lista", "cancelada"],
    lista: ["entregada", "cancelada"],
  };

  return actionsByStatus[sample.status] || [];
};

const buildSampleOrderHtml = (sample) => {
  const rows = (sample.items || [])
    .map(
      (item) => `
        <tr>
          <td>${formatRequestedCoffee(item)}</td>
          <td>${item.coffee_type_name || "-"}</td>
          <td>${item.quantity_grams} g</td>
          <td></td>
        </tr>
      `
    )
    .join("");

  const blendRows = (sample.items || [])
    .filter((item) => item.blend_items?.length > 0)
    .map(
      (item) => `
        <section class="lot-block">
          <h2>${formatRequestedCoffee(item)}</h2>
          <table>
            <thead>
              <tr>
                <th>DESCRIPCION</th>
                <th>PROCESO PREPARACION</th>
                <th>G</th>
                <th>CHECK</th>
              </tr>
            </thead>
            <tbody>
              ${item.blend_items
                .map(
                  (blend) => `
                    <tr>
                      <td>${blend.component_description || blend.lot_code || "-"} (${blend.percentage}%)</td>
                      <td>${blend.notes || "-"}</td>
                      <td>${blend.calculated_grams}</td>
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

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Orden de muestra ${sample.code}</title>
        <style>
          body { color: #111827; font-family: Arial, sans-serif; margin: 26px; }
          header { align-items: flex-start; display: flex; justify-content: space-between; gap: 24px; }
          h1 { font-size: 16px; margin: 0 0 14px; text-transform: uppercase; }
          h2 { font-size: 13px; margin: 22px 0 8px; text-transform: uppercase; }
          p { font-size: 12px; margin: 4px 0; }
          table { border-collapse: collapse; margin-top: 10px; width: 100%; }
          th, td { border: 1px solid #111827; font-size: 12px; padding: 8px; text-align: left; vertical-align: middle; }
          th { background: #f2f2f2; font-weight: 700; text-align: center; }
          td:nth-child(3), td:nth-child(4) { text-align: center; width: 90px; }
          .logo { height: 72px; object-fit: contain; width: 150px; }
          .lot-block { margin-top: 16px; page-break-inside: avoid; }
          .instructions { margin-top: 18px; }
          .instructions p { font-size: 12px; margin: 6px 0; }
          .signature { display: grid; gap: 32px; grid-template-columns: 1fr 1fr; margin-top: 54px; }
          .line { border-top: 1px solid #111827; font-weight: 700; padding-top: 6px; text-align: center; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>ORDEN DE MUESTRA - ${sample.code}</h1>
            <p><strong>Fecha de Inicio orden:</strong> ${formatDate(sample.requested_at)}</p>
            <p><strong>Categoria:</strong> ${sample.items?.[0]?.coffee_type_name || sample.coffee_type_name || "CAFE"}</p>
            <p><strong>Cliente:</strong> ${sample.requester_company || sample.requester_name || "-"}</p>
            <p><strong>Datos laboratorio:</strong> ${buildSampleLabSummary(sample) || "-"}</p>
            <p><strong>Dia estimado de despacho:</strong> ${formatDate(sample.tentative_delivery_date)}</p>
            ${sample.sample_lab_notes ? `<p><strong>Notas laboratorio:</strong> ${sample.sample_lab_notes}</p>` : ""}
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
              <th>PROCESO PREPARACION</th>
              <th>G</th>
              <th>CHECK</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        ${blendRows}

        <section class="instructions">
          <p>- Hacer registro fotografico.</p>
          <p>- Perfilar lotes.</p>
          <p>- Entregar con esta hoja las muestras en una bolsa o caja.</p>
        </section>

        <section class="signature">
          <p class="line">RESPONSABLE</p>
          <p class="line">DESPACHA</p>
        </section>
      </body>
    </html>
  `;
};

const SamplesPage = () => {
  const { user } = useAuth();
  const [samples, setSamples] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [form, setForm] = useState(initialSample);
  const [sampleItems, setSampleItems] = useState([]);
  const [editingSampleId, setEditingSampleId] = useState(null);
  const [statusNotes, setStatusNotes] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sampleFilter, setSampleFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [uploadingGuideId, setUploadingGuideId] = useState(null);
  const [blendSampleId, setBlendSampleId] = useState(null);
  const [blendRows, setBlendRows] = useState([]);

  const canCreate = ["admin", "accounting", "seller"].includes(user?.role);
  const canManageSamples = ["admin", "samples"].includes(user?.role);
  const canApproveSampleOrders = ["admin", "accounting"].includes(user?.role);
  const canApproveSamples = canApproveSampleOrders;
  const canPrintSampleOrder = ["admin", "accounting", "seller", "samples"].includes(user?.role);
  const canUploadShippingGuide = ["admin", "samples"].includes(user?.role);
  const canDeleteSamples = user?.role === "admin";
  const canUseSampleStatusAction = (status) => {
    const commercialStatuses = ["borrador", "enviada", "aprobada", "cancelada"];
    if (canApproveSampleOrders && commercialStatuses.includes(status)) return true;
    if (canManageSamples && !commercialStatuses.includes(status)) return true;
    return false;
  };

  const sampleCounts = useMemo(() => {
    return samples.reduce(
      (counts, sample) => ({
        ...counts,
        all: counts.all + 1,
        [sample.status]: (counts[sample.status] || 0) + 1,
      }),
      { all: 0 }
    );
  }, [samples]);

  const filteredSamples = useMemo(() => {
    return samples
      .filter((sample) => sampleFilter === "all" || sample.status === sampleFilter)
      .sort((left, right) => {
        const statusDiff = (statusOrder[left.status] || 99) - (statusOrder[right.status] || 99);
        if (statusDiff !== 0) return statusDiff;

        const leftDate = left.tentative_delivery_date || left.requested_at || "";
        const rightDate = right.tentative_delivery_date || right.requested_at || "";
        return String(leftDate).localeCompare(String(rightDate));
      });
  }, [samples, sampleFilter]);

  const loadData = async () => {
    const [sampleData, catalogData] = await Promise.all([
      apiRequest("/samples"),
      apiRequest("/catalogs"),
    ]);
    setSamples(sampleData.filter((sample) => sample.status !== "entregada"));
    setCatalogs(catalogData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const updateCoffeeType = (coffeeTypeId) => {
    setForm({ ...form, coffeeTypeId });
  };

  const updateCoffeeProfile = (coffeeProfileId) => {
    setForm({ ...form, coffeeProfileId });
  };

  const resetForm = () => {
    setEditingSampleId(null);
    setForm(initialSample);
    setSampleItems([]);
    setError("");
  };

  const itemFromSampleItem = (item) => ({
    coffeeTypeId: item.coffee_type_id ? Number(item.coffee_type_id) : null,
    coffeeProfileId: item.coffee_profile_id ? Number(item.coffee_profile_id) : null,
    description: item.description || null,
    coffeeName: formatRequestedCoffee(item),
    quantityGrams: Number(item.quantity_grams || 0),
    price: null,
  });

  const loadSampleForEdit = (sample) => {
    if (!["borrador", "enviada", "aprobada"].includes(sample.status)) {
      setError("Solo se puede editar una solicitud antes de iniciar preparacion.");
      return;
    }

    setEditingSampleId(sample.id);
    setForm({
      requesterName: sample.requester_name || "",
      requesterPhone: sample.requester_phone || "",
      requesterEmail: sample.requester_email || "",
      requesterCompany: sample.requester_company || "",
      requesterAddress: sample.requester_address || "",
      requesterCity: sample.requester_city || "",
      requesterCountry: sample.requester_country || "",
      coffeeTypeId: "",
      coffeeProfileId: "",
      description: "",
      quantityGrams: "",
      currency: sample.currency || "COP",
      price: "",
      requestedAt: sample.requested_at ? String(sample.requested_at).slice(0, 10) : today,
      tentativeDeliveryDate: sample.tentative_delivery_date ? String(sample.tentative_delivery_date).slice(0, 10) : "",
      notes: sample.notes || "",
      status: sample.status || "borrador",
    });
    setSampleItems((sample.items || []).map(itemFromSampleItem));
    setMessage(`Editando solicitud ${sample.code}.`);
    setError("");
  };

  const saveSample = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const wasEditing = Boolean(editingSampleId);
      const currentItem = {
        coffeeTypeId: form.coffeeTypeId ? Number(form.coffeeTypeId) : null,
        coffeeProfileId: form.coffeeProfileId ? Number(form.coffeeProfileId) : null,
        description: form.description || null,
        quantityGrams: Number(form.quantityGrams),
        price: null,
      };
      const items = form.quantityGrams ? [...sampleItems, currentItem] : sampleItems;
      if (items.length === 0) throw new Error("Agregue al menos una muestra.");

      await apiRequest(editingSampleId ? `/samples/${editingSampleId}` : "/samples", {
        method: editingSampleId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          items,
        }),
      });
      resetForm();
      await loadData();
      setMessage(wasEditing ? "Solicitud de muestra actualizada correctamente." : "Solicitud de muestra creada correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const addSampleItem = () => {
    if ((!form.coffeeTypeId && !form.coffeeProfileId && !form.description.trim()) || !form.quantityGrams) {
      setError("Seleccione o describa el cafe e indique la cantidad en gramos.");
      return;
    }

    setSampleItems((current) => [
      ...current,
      {
        coffeeTypeId: form.coffeeTypeId ? Number(form.coffeeTypeId) : null,
        coffeeProfileId: form.coffeeProfileId ? Number(form.coffeeProfileId) : null,
        description: form.description || null,
        coffeeName: [
          catalogs?.coffeeTypes?.find((type) => String(type.id) === String(form.coffeeTypeId))?.name,
          catalogs?.coffeeProfiles?.find((profile) => String(profile.id) === String(form.coffeeProfileId))?.name,
          form.description,
        ].filter(Boolean).join(" - "),
        quantityGrams: Number(form.quantityGrams),
        price: null,
      },
    ]);
    setForm((current) => ({ ...current, ...emptySampleItem }));
    setError("");
  };

  const updateStatus = async (sample, status) => {
    if (status === "pendiente_laboratorio" && !hasCompleteSampleBlend(sample)) {
      setError("Antes de enviar a laboratorio cada cafe de la muestra debe tener ensamble completo al 100%.");
      return;
    }

    if (status === "lista" && sample.status !== "aprobada_laboratorio") {
      setError("Laboratorio debe aprobar la muestra antes de marcarla como lista.");
      return;
    }

    const confirmed = window.confirm(`Confirmas cambiar ${sample.code} a ${statusLabels[status]}?`);

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const requestBody = {
        status,
        notes: statusNotes[sample.id] || undefined,
      };

      await apiRequest(`/samples/${sample.id}/status`, {
        method: "PUT",
        body: JSON.stringify(requestBody),
      });
      setStatusNotes({ ...statusNotes, [sample.id]: "" });
      await loadData();
      setMessage("Estado de muestra actualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSample = async (sample) => {
    const confirmation = window.prompt(
      `Esto eliminara la solicitud de muestra ${sample.code} y sus datos de prueba. Escriba ELIMINAR para confirmar.`
    );

    if (confirmation !== "ELIMINAR") return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/samples/${sample.id}`, { method: "DELETE" });
      if (editingSampleId === sample.id) {
        resetForm();
      }
      if (blendSampleId === sample.id) {
        setBlendSampleId(null);
        setBlendRows([]);
      }
      await loadData();
      setMessage(`Solicitud de muestra ${sample.code} eliminada correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadShippingGuide = async (sample, file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("La guia de envio debe ser una imagen.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("La imagen de la guia no debe superar 4 MB.");
      return;
    }

    setUploadingGuideId(sample.id);
    setMessage("");
    setError("");

    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo leer la imagen de la guia"));
        reader.readAsDataURL(file);
      });

      await apiRequest(`/samples/${sample.id}/shipping-guide`, {
        method: "PUT",
        body: JSON.stringify({
          image,
          fileName: file.name,
          mimeType: file.type,
        }),
      });

      await loadData();
      setMessage("Guia de envio asociada a la muestra.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploadingGuideId(null);
    }
  };

  const viewShippingGuide = (sample) => {
    if (!sample.shipping_guide_image) return;

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      setError("El navegador bloqueo la ventana para ver la guia.");
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Guia de envio ${sample.code}</title>
          <style>
            body { margin: 0; background: #111827; display: grid; place-items: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100vh; object-fit: contain; background: white; }
          </style>
        </head>
        <body>
          <img src="${sample.shipping_guide_image}" alt="Guia de envio ${sample.code}" />
        </body>
      </html>
    `);
    win.document.close();
  };

  const openBlendEditor = (sample) => {
    const existingRows = sample.items.flatMap((item) =>
      item.blend_items.map((blend) => ({
        sampleItemId: String(item.id),
        componentDescription: blend.component_description || blend.lot_code || "",
        percentage: String(blend.percentage),
        notes: blend.notes || "",
      }))
    );
    setBlendSampleId(sample.id);
    setBlendRows(
      existingRows.length > 0
        ? existingRows
        : sample.items.map((item) => ({
            sampleItemId: String(item.id), componentDescription: "", percentage: "", notes: "",
          }))
    );
  };

  const updateBlendRow = (index, field, value) => {
    setBlendRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const addBlendRowForItem = (sampleItemId) => {
    setBlendRows((rows) => [...rows, { sampleItemId: String(sampleItemId), componentDescription: "", percentage: "", notes: "" }]);
  };

  const getBlendTotalForItem = (sampleItemId, rows = blendRows) => {
    const total = rows
      .filter((row) => String(row.sampleItemId) === String(sampleItemId))
      .reduce((sum, row) => sum + Number(row.percentage || 0), 0);
    return Number(total.toFixed(2));
  };

  const saveBlend = async (sample) => {
    const missingRows = sample.items.some((item) => !blendRows.some((row) => String(row.sampleItemId) === String(item.id)));
    if (missingRows) {
      setError("Cada cafe de la muestra debe tener al menos un componente de ensamble.");
      return;
    }

    const incompleteItem = sample.items.find((item) => getBlendTotalForItem(item.id) !== 100);
    if (incompleteItem) {
      setError(`El ensamble de ${formatRequestedCoffee(incompleteItem)} debe sumar 100%. Actualmente suma ${getBlendTotalForItem(incompleteItem.id)}%.`);
      return;
    }

    if (!window.confirm(`Confirma guardar el ensamble de ${sample.code}?`)) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiRequest(`/samples/${sample.id}/blend`, {
        method: "PUT",
        body: JSON.stringify({
          items: blendRows.map((row) => ({
            sampleItemId: Number(row.sampleItemId),
            componentDescription: row.componentDescription,
            percentage: Number(row.percentage),
            notes: row.notes || null,
          })),
        }),
      });
      setBlendSampleId(null);
      setBlendRows([]);
      await loadData();
      setMessage("Ensamble de muestras guardado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const printSampleOrder = (sample) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("El navegador bloqueo la ventana de impresion.");
      return;
    }

    printWindow.document.write(buildSampleOrderHtml(sample));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setMessage("Orden de muestra abierta para imprimir o guardar como PDF.");
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Muestras</h1>
          <p className="text-sm text-slate-500">Solicitudes de muestras para clientes y seguimiento operativo.</p>
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

      <div className={`grid min-w-0 gap-5 ${canCreate ? "xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]" : ""}`}>
        {canCreate && (
          <form className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4" onSubmit={saveSample}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FlaskConical size={18} className="text-leaf" />
                <h2 className="text-sm font-semibold text-slate-800">
                  {editingSampleId ? "Editar solicitud" : "Nueva solicitud"}
                </h2>
              </div>
              {editingSampleId && (
                <button
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  type="button"
                  onClick={resetForm}
                >
                  <XCircle size={14} />
                  Cancelar
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada para aprobacion</option>
                {canApproveSamples && <option value="aprobada">Aprobada para muestras</option>}
              </select>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nombre de quien solicita"
                value={form.requesterName}
                onChange={(event) => setForm({ ...form, requesterName: event.target.value })}
                required
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Telefono"
                value={form.requesterPhone}
                onChange={(event) => setForm({ ...form, requesterPhone: event.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Correo opcional"
                  value={form.requesterEmail}
                  onChange={(event) => setForm({ ...form, requesterEmail: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Empresa opcional"
                  value={form.requesterCompany}
                  onChange={(event) => setForm({ ...form, requesterCompany: event.target.value })}
                />
              </div>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Direccion de envio"
                value={form.requesterAddress}
                onChange={(event) => setForm({ ...form, requesterAddress: event.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ciudad"
                  value={form.requesterCity}
                  onChange={(event) => setForm({ ...form, requesterCity: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Pais"
                  value={form.requesterCountry}
                  onChange={(event) => setForm({ ...form, requesterCountry: event.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={form.coffeeTypeId}
                  onChange={(event) => updateCoffeeType(event.target.value)}
                >
                  <option value="">Proceso del cafe</option>
                  {catalogs?.coffeeTypes?.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={form.coffeeProfileId}
                  onChange={(event) => updateCoffeeProfile(event.target.value)}
                >
                  <option value="">Perfil o cafe comercial</option>
                  {catalogs?.coffeeProfiles?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Descripcion si no aplica tipo o perfil exacto"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Cantidad en gramos"
                type="number"
                step="1"
                value={form.quantityGrams}
                onChange={(event) => setForm({ ...form, quantityGrams: event.target.value })}
                required={sampleItems.length === 0}
              />
              {/* Precio de muestra desactivado: control comercial se hara en el software contable externo.
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Precio opcional. Vacio si es gratis"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                >
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              */}
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50"
                type="button"
                onClick={addSampleItem}
              >
                <Plus size={16} />
                Agregar otra muestra
              </button>
              {sampleItems.length > 0 && (
                <div className="divide-y divide-slate-100 rounded border border-slate-200">
                  {sampleItems.map((item, index) => (
                    <div key={`${item.coffeeName}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-ink">{item.coffeeName}</p>
                        <p className="text-slate-500">{item.quantityGrams} g</p>
                      </div>
                      <button
                        className="rounded p-2 text-rose-600 hover:bg-rose-50"
                        type="button"
                        aria-label="Quitar muestra"
                        onClick={() => setSampleItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  Fecha solicitud
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    type="date"
                    value={form.requestedAt}
                    onChange={(event) => setForm({ ...form, requestedAt: event.target.value })}
                    required
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Entrega tentativa
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    type="date"
                    value={form.tentativeDeliveryDate}
                    onChange={(event) => setForm({ ...form, tentativeDeliveryDate: event.target.value })}
                  />
                </label>
              </div>
              <textarea
                className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notas internas"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>

            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving}
            >
              <Save size={16} />
              {editingSampleId ? "Guardar cambios" : "Crear solicitud"}
            </button>
          </form>
        )}

        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Solicitudes registradas</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {sampleFilters.map((filter) => (
                <button
                  key={filter.key}
                  className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold ${
                    sampleFilter === filter.key ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"
                  }`}
                  type="button"
                  onClick={() => setSampleFilter(filter.key)}
                >
                  {filter.label} ({sampleCounts[filter.key] || 0})
                </button>
              ))}
            </div>
          </div>

          {filteredSamples.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin solicitudes" message="Las muestras solicitadas apareceran aqui." />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSamples.map((sample) => (
                <article key={sample.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{sample.code}</p>
                        <StatusBadge tone={statusTones[sample.status]}>{statusLabels[sample.status]}</StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {sample.requester_name} - {sample.requester_phone}
                      </p>
                      <p className="text-sm text-slate-500">
                        {sample.requester_company || "Sin empresa"} · {sample.requester_city || "Sin ciudad"}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <p>{sample.quantity_grams} g</p>
                      {/* Precio de muestra desactivado. */}
                      {hasCompleteSampleLabReview(sample) && (
                        <p>{sample.items.length} cafes analizados</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                    <div>
                      <span className="font-medium text-slate-800">Muestras:</span>
                      <div className="mt-1 space-y-1">
                        {(sample.items || []).map((item) => (
                          <p key={item.id}>
                            {formatRequestedCoffee(item)} - {item.quantity_grams} g
                          </p>
                        ))}
                      </div>
                    </div>
                    <p>
                      <span className="font-medium text-slate-800">Solicitada:</span>{" "}
                      {formatDate(sample.requested_at)}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Entrega tentativa:</span>{" "}
                      {formatDate(sample.tentative_delivery_date)}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Laboratorio:</span>{" "}
                      {hasCompleteSampleLabReview(sample) ? "Aprobado por cafe" : "-"}
                    </p>
                  </div>

                  {hasCompleteSampleLabReview(sample) && (
                    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase text-slate-500">Datos de laboratorio por cafe</p>
                      <div className="mt-2 space-y-2">
                        {sample.items.map((item) => (
                          <div key={`lab-${item.id}`}>
                            <p className="font-semibold text-ink">{formatRequestedCoffee(item)}</p>
                            <p>{buildSampleItemLabSummary(item)}</p>
                            {item.sample_lab_notes && <p className="text-slate-500">Notas: {item.sample_lab_notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sample.requester_address && (
                    <p className="mt-2 text-sm text-slate-500">Envio: {sample.requester_address}</p>
                  )}
                  {sample.notes && <p className="mt-2 text-sm text-slate-500">Notas: {sample.notes}</p>}
                  <p className="mt-2 text-xs text-slate-400">
                    Creada por {sample.created_by_name || "usuario"}.
                    {sample.handled_by_name ? ` Ultima gestion: ${sample.handled_by_name}.` : ""}
                  </p>

                  {sample.items?.some((item) => item.blend_items?.length > 0) && (
                    <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase text-amber-800">Ensamble registrado</p>
                      <div className="mt-2 space-y-3">
                        {sample.items.map((item) => (
                          <div key={`formula-${item.id}`}>
                            <p className="text-sm font-semibold text-ink">
                              {formatRequestedCoffee(item)}
                            </p>
                            {item.blend_items.map((blend) => (
                              <p key={blend.id} className="text-sm text-slate-700">
                                {blend.component_description || blend.lot_code || "Componente"}: {blend.percentage}% ({blend.calculated_grams} g)
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(canManageSamples || canPrintSampleOrder || canCreate || canDeleteSamples) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canCreate && (["borrador", "enviada"].includes(sample.status) || (user?.role === "admin" && sample.status === "aprobada")) && (
                        <button
                          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          type="button"
                          onClick={() => loadSampleForEdit(sample)}
                        >
                          <Edit size={16} />
                          Editar solicitud
                        </button>
                      )}
                      {canManageSamples && ["en_preparacion"].includes(sample.status) && (
                        <button
                          className="rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50"
                          type="button"
                          onClick={() => openBlendEditor(sample)}
                        >
                          Definir ensamble
                        </button>
                      )}
                      {canPrintSampleOrder && (
                        <button
                          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          type="button"
                          onClick={() => printSampleOrder(sample)}
                        >
                          <Printer size={16} />
                          Imprimir orden
                        </button>
                      )}
                      {canDeleteSamples && (
                        <button
                          className="inline-flex items-center gap-2 rounded border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          disabled={saving}
                          type="button"
                          onClick={() => deleteSample(sample)}
                        >
                          <Trash2 size={16} />
                          Eliminar muestra de prueba
                        </button>
                      )}
                    </div>
                  )}

                  {["lista", "entregada"].includes(sample.status) && (
                    <div className={`mt-3 rounded border p-3 ${
                      sample.shipping_guide_image
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-300 bg-amber-50"
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className={`text-sm font-semibold ${sample.shipping_guide_image ? "text-emerald-800" : "text-amber-900"}`}>
                            Guia de envio
                          </p>
                          <p className="text-xs text-slate-600">
                            {sample.shipping_guide_image
                              ? `Guia cargada${sample.shipping_guide_file_name ? `: ${sample.shipping_guide_file_name}` : ""}`
                              : "Aun no se ha cargado la foto de la guia."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sample.shipping_guide_image && (
                            <button
                              className="inline-flex items-center gap-2 rounded border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              type="button"
                              onClick={() => viewShippingGuide(sample)}
                            >
                              <Eye size={15} />
                              Ver guia
                            </button>
                          )}
                          {canUploadShippingGuide && (
                            <label className={`inline-flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-xs font-semibold text-white ${
                              sample.shipping_guide_image ? "bg-leaf hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                            }`}>
                              <ImagePlus size={15} />
                              {uploadingGuideId === sample.id
                                ? "Subiendo..."
                                : sample.shipping_guide_image
                                  ? "Cambiar guia"
                                  : "Subir guia"}
                              <input
                                className="hidden"
                                type="file"
                                accept="image/*"
                                disabled={uploadingGuideId === sample.id}
                                onChange={(event) => {
                                  uploadShippingGuide(sample, event.target.files?.[0]);
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {canManageSamples && blendSampleId === sample.id && (
                    <div className="mt-3 space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Formula por cafe</p>
                        <p className="text-xs text-slate-500">
                          Registre los componentes usados por muestras. Laboratorio lo vera como referencia antes de aprobar el analisis.
                        </p>
                      </div>
                      {sample.items.map((item) => {
                        const itemRows = blendRows
                          .map((row, index) => ({ ...row, index }))
                          .filter((row) => String(row.sampleItemId) === String(item.id));
                        const totalPercentage = getBlendTotalForItem(item.id);
                        const isComplete = totalPercentage === 100;

                        return (
                          <div key={`blend-item-${item.id}`} className="space-y-3 rounded border border-amber-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-ink">{formatRequestedCoffee(item)}</p>
                                <p className="text-sm text-slate-500">{item.quantity_grams} g solicitados</p>
                              </div>
                              <span className={`rounded px-2 py-1 text-xs font-semibold ${isComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                Total {totalPercentage}%
                              </span>
                            </div>

                            {itemRows.map((row) => {
                              const calculatedGrams = row.percentage
                                ? Number((Number(item.quantity_grams) * Number(row.percentage) / 100).toFixed(2))
                                : 0;

                              return (
                                <div key={`blend-row-${row.index}`} className="grid min-w-0 gap-2 rounded border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                                  <input
                                    className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Cafe usado, proceso, mezcla o referencia libre"
                                    value={row.componentDescription}
                                    onChange={(event) => updateBlendRow(row.index, "componentDescription", event.target.value)}
                                  />
                                  <input
                                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Porcentaje %"
                                    type="text"
                                    inputMode="numeric"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={row.percentage}
                                    onChange={(event) => updateBlendRow(row.index, "percentage", normalizePercentageInput(event.target.value))}
                                  />
                                  <button
                                    className="rounded p-2 text-rose-600 hover:bg-rose-50"
                                    type="button"
                                    aria-label="Quitar linea de ensamble"
                                    onClick={() => setBlendRows((rows) => rows.filter((_, rowIndex) => rowIndex !== row.index))}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                  <textarea
                                    className="min-w-0 rounded border border-slate-300 px-3 py-2 text-sm md:col-span-3"
                                    placeholder={`Cantidad calculada: ${calculatedGrams} g. Observacion opcional`}
                                    rows={2}
                                    value={row.notes}
                                    onChange={(event) => updateBlendRow(row.index, "notes", event.target.value)}
                                  />
                                </div>
                              );
                            })}

                            <button
                              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              type="button"
                              onClick={() => addBlendRowForItem(item.id)}
                            >
                              Agregar componente a este cafe
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          type="button"
                          disabled={saving || blendRows.length === 0}
                          onClick={() => saveBlend(sample)}
                        >
                          Guardar ensamble
                        </button>
                      </div>
                    </div>
                  )}

                  {getSampleActions(sample).some(canUseSampleStatusAction) && (
                    <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Nota opcional al cambiar estado"
                        value={statusNotes[sample.id] || ""}
                        onChange={(event) => setStatusNotes({ ...statusNotes, [sample.id]: event.target.value })}
                      />
                      <div className="flex flex-wrap gap-2">
                        {getSampleActions(sample)
                          .filter(canUseSampleStatusAction)
                          .map((status) => (
                          <button
                            key={status}
                            className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            type="button"
                            disabled={saving}
                            onClick={() => updateStatus(sample, status)}
                          >
                            {status === "pendiente_laboratorio" ? "Enviar a laboratorio" : statusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SamplesPage;
