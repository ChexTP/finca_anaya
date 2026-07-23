import { FlaskConical, Plus, Printer, RefreshCw, Save, Trash2 } from "lucide-react";
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
};

const emptySampleItem = {
  coffeeTypeId: "",
  coffeeProfileId: "",
  description: "",
  quantityGrams: "",
  price: "",
};

const statusLabels = {
  solicitada: "Solicitada",
  en_preparacion: "En preparacion",
  pendiente_laboratorio: "Pendiente laboratorio",
  aprobada_laboratorio: "Aprobada laboratorio",
  lista: "Lista",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const statusTones = {
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
  { key: "solicitada", label: "Solicitadas" },
  { key: "en_preparacion", label: "En preparacion" },
  { key: "pendiente_laboratorio", label: "Pendientes lab" },
  { key: "aprobada_laboratorio", label: "Aprobadas lab" },
  { key: "lista", label: "Listas" },
  { key: "cancelada", label: "Canceladas" },
];

const statusOrder = {
  solicitada: 1,
  en_preparacion: 2,
  pendiente_laboratorio: 3,
  aprobada_laboratorio: 4,
  lista: 5,
  entregada: 6,
  cancelada: 7,
};

const formatDate = (value) => {
  if (!value) return "-";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");

  return [day, month, year].filter(Boolean).join("/");
};

const formatMoney = (currency, value) => {
  if (value === null || value === undefined || value === "") return "Gratis";
  return `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;
};

const formatHumidity = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
};

const hasCompleteSampleLabReview = (sample) => {
  return (sample.items || []).length > 0 && (sample.items || []).every((item) => [
    item.sample_humidity_percent,
    item.sample_lab_aroma,
    item.sample_lab_fragrance,
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

const buildSampleLabSummary = (sample) => {
  if (!hasCompleteSampleLabReview(sample)) return null;

  return [
    ...sample.items.map((item) => (
      `${formatRequestedCoffee(item)}: Humedad ${formatHumidity(item.sample_humidity_percent)}, Score ${item.sample_lab_score}`
    )),
  ].join(" | ");
};

const buildSampleItemLabSummary = (item) => {
  if ([
    item.sample_humidity_percent,
    item.sample_lab_aroma,
    item.sample_lab_fragrance,
    item.sample_lab_flavor,
    item.sample_lab_sweetness,
    item.sample_lab_body,
    item.sample_lab_residual,
    item.sample_lab_clean_cup,
    item.sample_lab_score,
  ].some((value) => value === null || value === undefined)) {
    return null;
  }

  return `Humedad ${formatHumidity(item.sample_humidity_percent)} · Aroma ${item.sample_lab_aroma} · Fragancia ${item.sample_lab_fragrance} · Sabor ${item.sample_lab_flavor} · Dulzor ${item.sample_lab_sweetness} · Cuerpo ${item.sample_lab_body} · Residual ${item.sample_lab_residual} · Taza limpia ${item.sample_lab_clean_cup} · Score ${item.sample_lab_score}`;
};

const formatRequestedCoffee = (item) => {
  const details = [item.coffee_type_name, item.coffee_profile_name, item.description].filter(Boolean);
  return [...new Set(details)].join(" - ") || "Cafe sin especificar";
};

const getSampleActions = (sample) => {
  const actionsByStatus = {
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
          .logo { border-radius: 3px; height: 54px; object-fit: cover; width: 92px; }
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
  const [statusNotes, setStatusNotes] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sampleFilter, setSampleFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [blendSampleId, setBlendSampleId] = useState(null);
  const [blendRows, setBlendRows] = useState([]);

  const canCreate = ["admin", "seller"].includes(user?.role);
  const canManageSamples = ["admin", "samples"].includes(user?.role);
  const canPrintSampleOrder = ["admin", "accounting", "samples"].includes(user?.role);

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

  const createSample = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const currentItem = {
        coffeeTypeId: form.coffeeTypeId ? Number(form.coffeeTypeId) : null,
        coffeeProfileId: form.coffeeProfileId ? Number(form.coffeeProfileId) : null,
        description: form.description || null,
        quantityGrams: Number(form.quantityGrams),
        price: form.price === "" ? null : Number(form.price),
      };
      const items = form.quantityGrams ? [...sampleItems, currentItem] : sampleItems;
      if (items.length === 0) throw new Error("Agregue al menos una muestra.");

      await apiRequest("/samples", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          items,
        }),
      });
      setForm(initialSample);
      setSampleItems([]);
      await loadData();
      setMessage("Solicitud de muestra creada correctamente.");
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
        price: form.price === "" ? null : Number(form.price),
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

  const saveBlend = async (sample) => {
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

      <div className={`grid gap-5 ${canCreate ? "xl:grid-cols-[420px_minmax(0,1fr)]" : ""}`}>
        {canCreate && (
          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createSample}>
            <div className="flex items-center gap-2">
              <FlaskConical size={18} className="text-leaf" />
              <h2 className="text-sm font-semibold text-slate-800">Nueva solicitud</h2>
            </div>

            <div className="mt-4 space-y-3">
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
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
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
                        <p className="text-slate-500">{item.quantityGrams} g - {formatMoney(form.currency, item.price)}</p>
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
              Crear solicitud
            </button>
          </form>
        )}

        <div className="rounded border border-slate-200 bg-white">
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
                      <p>{formatMoney(sample.currency, sample.price)}</p>
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

                  {(canManageSamples || canPrintSampleOrder) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canManageSamples && ["solicitada", "en_preparacion"].includes(sample.status) && (
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
                    </div>
                  )}

                  {canManageSamples && blendSampleId === sample.id && (
                    <div className="mt-3 space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">Formula por cafe</p>
                      {blendRows.map((row, index) => {
                        const sampleItem = sample.items.find((item) => String(item.id) === String(row.sampleItemId));
                        const calculatedGrams = sampleItem && row.percentage
                          ? Number((Number(sampleItem.quantity_grams) * Number(row.percentage) / 100).toFixed(2))
                          : 0;
                        return (
                          <div key={`blend-row-${index}`} className="rounded border border-slate-200 bg-white p-3">
                            <div className="grid gap-2 md:grid-cols-3">
                              <select
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                value={row.sampleItemId}
                                onChange={(event) => updateBlendRow(index, "sampleItemId", event.target.value)}
                              >
                                <option value="">Cafe de la solicitud</option>
                                {sample.items.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {formatRequestedCoffee(item)} - {item.quantity_grams} g
                                  </option>
                                ))}
                              </select>
                              <input
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Cafe usado, lote, proceso o referencia"
                                value={row.componentDescription}
                                onChange={(event) => updateBlendRow(index, "componentDescription", event.target.value)}
                              />
                              <input
                                className="rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Porcentaje %"
                                type="number"
                                min="0.01"
                                max="100"
                                step="0.01"
                                value={row.percentage}
                                onChange={(event) => updateBlendRow(index, "percentage", event.target.value)}
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="text-xs text-slate-500">Cantidad calculada: {calculatedGrams} g</p>
                              <button
                                className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                                type="button"
                                aria-label="Quitar linea de ensamble"
                                onClick={() => setBlendRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                          type="button"
                          onClick={() => setBlendRows((rows) => [...rows, { sampleItemId: String(sample.items[0]?.id || ""), componentDescription: "", percentage: "", notes: "" }])}
                        >
                          Agregar lote
                        </button>
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

                  {canManageSamples && (
                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Nota opcional al cambiar estado"
                        value={statusNotes[sample.id] || ""}
                        onChange={(event) => setStatusNotes({ ...statusNotes, [sample.id]: event.target.value })}
                      />
                      <div className="flex flex-wrap gap-2">
                        {getSampleActions(sample).map((status) => (
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
