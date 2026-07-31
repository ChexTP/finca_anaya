import { Eye, ImagePlus, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

const today = new Date().toISOString().slice(0, 10);

const firstDayOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "-";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");
  return [day, month, year].filter(Boolean).join("/");
};

/*
  Precios de muestras desactivados por integracion con software contable externo.
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

const formatRequestedCoffee = (item) => {
  return [item.coffee_type_name, item.coffee_profile_name, item.description]
    .filter(Boolean)
    .join(" - ") || "Cafe sin especificar";
};

/* Historico financiero de muestras desactivado.
const getSampleTotal = (sample) => {
  return (sample.items || []).reduce((total, item) => total + Number(item.price || 0), 0);
};
*/

const buildItemLabLines = (item) => {
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

  return {
    summary: `Score ${formatLabValue(item.sample_lab_score)} · Humedad ${formatLabValue(item.sample_humidity_percent)}`,
    detail: `Aroma ${formatLabValue(item.sample_lab_aroma)} · Sabor ${formatLabValue(item.sample_lab_flavor)} · Dulzor ${formatLabValue(item.sample_lab_sweetness)} · Cuerpo ${formatLabValue(item.sample_lab_body)} · Residual ${formatLabValue(item.sample_lab_residual)} · Taza limpia ${formatLabValue(item.sample_lab_clean_cup)}`,
  };
};

const viewShippingGuide = (sample, setError) => {
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

const SamplesHistoryPage = () => {
  const { user } = useAuth();
  const [samples, setSamples] = useState([]);
  const [filters, setFilters] = useState({
    client: "",
    from: firstDayOfMonth(),
    to: today,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedSampleId, setExpandedSampleId] = useState(null);
  const [uploadingGuideId, setUploadingGuideId] = useState(null);
  const canUploadShippingGuide = ["admin", "samples"].includes(user?.role);

  const loadData = async () => {
    setError("");
    const data = await apiRequest("/samples?status=entregada");
    setSamples(data);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const filteredSamples = useMemo(() => {
    const client = filters.client.trim().toLowerCase();

    return samples.filter((sample) => {
      const text = [sample.requester_name, sample.requester_company, sample.requester_phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const date = String(sample.tentative_delivery_date || sample.requested_at || sample.created_at).slice(0, 10);
      const matchesClient = !client || text.includes(client);
      const matchesFrom = !filters.from || date >= filters.from;
      const matchesTo = !filters.to || date <= filters.to;

      return matchesClient && matchesFrom && matchesTo;
    });
  }, [samples, filters]);

  const totals = useMemo(() => {
    return filteredSamples.reduce(
      (summary, sample) => ({
        count: summary.count + 1,
        grams: summary.grams + (sample.items || []).reduce((total, item) => total + Number(item.quantity_grams || 0), 0),
        charged: summary.charged,
      }),
      { count: 0, grams: 0, charged: 0 }
    );
  }, [filteredSamples]);

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

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Historico de muestras</h1>
          <p className="text-sm text-slate-500">Muestras entregadas con filtros por fecha y cliente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            type="button"
            onClick={() => loadData().then(() => setMessage("Historico actualizado.")).catch((requestError) => setError(requestError.message))}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
          <button
            className="inline-flex items-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white"
            type="button"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid min-w-0 gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,170px)_minmax(0,170px)]">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Buscar por cliente, empresa o telefono"
          value={filters.client}
          onChange={(event) => setFilters({ ...filters, client: event.target.value })}
        />
        <label className="text-xs font-medium text-slate-600">
          Desde
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Hasta
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Muestras entregadas</p>
          <p className="mt-2 text-2xl font-bold text-ink">{totals.count}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Gramos enviados</p>
          <p className="mt-2 text-2xl font-bold text-ink">{totals.grams.toLocaleString("es-CO")} g</p>
        </div>
        {/* Resumen comercial desactivado.
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Valor cobrado registrado</p>
          <p className="mt-2 text-2xl font-bold text-ink">COP {totals.charged.toLocaleString("es-CO")}</p>
        </div>
        */}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Entregadas</h2>
        </div>
        {filteredSamples.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin resultados" message="No hay muestras entregadas con esos filtros." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSamples.map((sample) => {
              const isExpanded = expandedSampleId === sample.id;
              const itemCount = (sample.items || []).length;
              const grams = (sample.items || []).reduce((total, item) => total + Number(item.quantity_grams || 0), 0);

              return (
                <article key={sample.id} className="px-4 py-3">
                  <div className="grid gap-3 lg:grid-cols-[150px_minmax(180px,1.2fr)_130px_130px_130px_130px] lg:items-center">
                    <div>
                      <p className="font-semibold text-ink">{sample.code}</p>
                      <p className="text-xs text-slate-500">{itemCount} muestra{itemCount === 1 ? "" : "s"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{sample.requester_name}</p>
                      <p className="text-xs text-slate-500">{sample.requester_company || "-"} · {sample.requester_phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Solicitud</p>
                      <p>{formatDate(sample.requested_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Entrega</p>
                      <p>{formatDate(sample.tentative_delivery_date || sample.updated_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Cantidad</p>
                      <p>{grams.toLocaleString("es-CO")} g</p>
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setExpandedSampleId(isExpanded ? null : sample.id)}
                      type="button"
                    >
                      <Eye size={16} />
                      {isExpanded ? "Ocultar" : "Ver mas"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 grid gap-4 rounded border border-slate-200 bg-slate-50 p-4 xl:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">Muestras solicitadas</p>
                          <div className="mt-2 space-y-2">
                            {(sample.items || []).map((item) => (
                              <div key={item.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
                                <p className="font-medium text-ink">{formatRequestedCoffee(item)}</p>
                                <p className="text-slate-500">{Number(item.quantity_grams || 0).toLocaleString("es-CO")} g</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-sm text-slate-600">
                          <p><span className="font-semibold text-slate-800">Gestion:</span> {sample.handled_by_name || sample.created_by_name || "-"}</p>
                          {sample.notes && <p><span className="font-semibold text-slate-800">Notas:</span> {sample.notes}</p>}
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                          <p className="font-semibold text-slate-800">Guia de envio</p>
                          {sample.shipping_guide_image ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                className="inline-flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                type="button"
                                onClick={() => viewShippingGuide(sample, setError)}
                              >
                                <Eye size={15} />
                                Ver guia
                              </button>
                              {canUploadShippingGuide && (
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-leaf px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                                  <ImagePlus size={15} />
                                  {uploadingGuideId === sample.id ? "Subiendo..." : "Cambiar guia"}
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
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-slate-500">Sin guia cargada.</p>
                              {canUploadShippingGuide && (
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                                  <ImagePlus size={15} />
                                  {uploadingGuideId === sample.id ? "Subiendo..." : "Subir guia"}
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
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Analisis de laboratorio</p>
                        {hasCompleteSampleLabReview(sample) ? (
                          <div className="mt-2 space-y-2 text-sm text-slate-600">
                            {sample.items.map((item) => {
                              const lab = buildItemLabLines(item);
                              return (
                                <div key={`history-lab-${item.id}`} className="rounded border border-slate-200 bg-white p-3">
                                  <p className="font-semibold text-slate-800">{formatRequestedCoffee(item)}</p>
                                  <p>{lab?.summary}</p>
                                  <p>{lab?.detail}</p>
                                  {item.sample_lab_notes && <p>Notas: {item.sample_lab_notes}</p>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">Sin analisis completo registrado.</p>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default SamplesHistoryPage;
