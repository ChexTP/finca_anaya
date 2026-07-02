import { FlaskConical, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

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

const statusLabels = {
  solicitada: "Solicitada",
  en_preparacion: "En preparacion",
  lista: "Lista",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const statusTones = {
  solicitada: "warning",
  en_preparacion: "warning",
  lista: "success",
  entregada: "success",
  cancelada: "danger",
};

const editableStatuses = ["solicitada", "en_preparacion", "lista", "entregada", "cancelada"];

const sampleFilters = [
  { key: "all", label: "Todas" },
  { key: "solicitada", label: "Solicitadas" },
  { key: "en_preparacion", label: "En preparacion" },
  { key: "lista", label: "Listas" },
  { key: "entregada", label: "Entregadas" },
  { key: "cancelada", label: "Canceladas" },
];

const statusOrder = {
  solicitada: 1,
  en_preparacion: 2,
  lista: 3,
  entregada: 4,
  cancelada: 5,
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

const SamplesPage = () => {
  const { user } = useAuth();
  const [samples, setSamples] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [form, setForm] = useState(initialSample);
  const [statusNotes, setStatusNotes] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sampleFilter, setSampleFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const canCreate = ["admin", "accounting", "seller"].includes(user?.role);
  const canUpdateStatus = ["admin", "accounting", "samples"].includes(user?.role);

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
    setSamples(sampleData);
    setCatalogs(catalogData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const updateCoffeeType = (coffeeTypeId) => {
    setForm({ ...form, coffeeTypeId, coffeeProfileId: "" });
  };

  const updateCoffeeProfile = (coffeeProfileId) => {
    setForm({ ...form, coffeeProfileId, coffeeTypeId: "" });
  };

  const createSample = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest("/samples", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          coffeeTypeId: form.coffeeTypeId ? Number(form.coffeeTypeId) : null,
          coffeeProfileId: form.coffeeProfileId ? Number(form.coffeeProfileId) : null,
          quantityGrams: Number(form.quantityGrams),
          price: form.price === "" ? null : Number(form.price),
        }),
      });
      setForm(initialSample);
      await loadData();
      setMessage("Solicitud de muestra creada correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (sample, status) => {
    const confirmed = window.confirm(`Confirmas cambiar ${sample.code} a ${statusLabels[status]}?`);

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/samples/${sample.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          notes: statusNotes[sample.id] || undefined,
        }),
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
                required
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
                  <option value="">Tipo de cafe</option>
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
                  <option value="">Perfil</option>
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
                required
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
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                    <p>
                      <span className="font-medium text-slate-800">Cafe:</span>{" "}
                      {sample.coffee_profile_name || sample.coffee_type_name || sample.description}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Solicitada:</span>{" "}
                      {formatDate(sample.requested_at)}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Entrega tentativa:</span>{" "}
                      {formatDate(sample.tentative_delivery_date)}
                    </p>
                  </div>

                  {sample.requester_address && (
                    <p className="mt-2 text-sm text-slate-500">Envio: {sample.requester_address}</p>
                  )}
                  {sample.notes && <p className="mt-2 text-sm text-slate-500">Notas: {sample.notes}</p>}
                  <p className="mt-2 text-xs text-slate-400">
                    Creada por {sample.created_by_name || "usuario"}.
                    {sample.handled_by_name ? ` Ultima gestion: ${sample.handled_by_name}.` : ""}
                  </p>

                  {canUpdateStatus && (
                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Nota opcional al cambiar estado"
                        value={statusNotes[sample.id] || ""}
                        onChange={(event) => setStatusNotes({ ...statusNotes, [sample.id]: event.target.value })}
                      />
                      <div className="flex flex-wrap gap-2">
                        {editableStatuses.map((status) => (
                          <button
                            key={status}
                            className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            type="button"
                            disabled={saving || sample.status === status}
                            onClick={() => updateStatus(sample, status)}
                          >
                            {statusLabels[status]}
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
