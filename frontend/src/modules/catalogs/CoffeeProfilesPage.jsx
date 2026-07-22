import { RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialProfile = {
  name: "",
  code: "",
  category: "",
  processPurchaseCoffeeId: "",
  basePurchaseCoffeeId: "",
  processPercentage: "",
  basePercentage: "",
  basePriceCop: "0",
  basePriceUsd: "0",
  isActive: true,
};

const CoffeeProfilesPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [form, setForm] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProfiles = async () => {
    const [data, catalogData] = await Promise.all([
      apiRequest("/catalogs/coffee-profiles"),
      apiRequest("/catalogs"),
    ]);
    setProfiles(data);
    setCatalogs(catalogData);
  };

  useEffect(() => {
    loadProfiles().catch((requestError) => setError(requestError.message));
  }, []);

  const selectProfile = (profile) => {
    setSelectedProfile(profile);
    setForm({
      name: profile.name || "",
      code: profile.internal_code || "",
      category: profile.category || "",
      processPurchaseCoffeeId: profile.process_purchase_coffee_id || "",
      basePurchaseCoffeeId: profile.base_purchase_coffee_id || "",
      processPercentage: profile.process_percentage || "",
      basePercentage: profile.base_percentage || "",
      basePriceCop: profile.base_price_cop || "0",
      basePriceUsd: profile.base_price_usd || "0",
      isActive: profile.is_active,
    });
    setMessage("");
    setError("");
  };

  const resetForm = () => {
    setSelectedProfile(null);
    setForm(initialProfile);
    setMessage("");
    setError("");
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,
        basePriceCop: Number(form.basePriceCop || 0),
        basePriceUsd: Number(form.basePriceUsd || 0),
      };

      if (selectedProfile) {
        await apiRequest(`/catalogs/coffee-profiles/${selectedProfile.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/catalogs/coffee-profiles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await loadProfiles();
      resetForm();
      setMessage(selectedProfile ? "Perfil actualizado correctamente." : "Perfil creado correctamente.");
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
          <h1 className="text-xl font-bold text-ink">Cafes comerciales</h1>
          <p className="text-sm text-slate-500">Administracion de cafes regionales, varietales y exoticos.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadProfiles()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Listado</h2>
          </div>

          {profiles.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin perfiles" message="Los perfiles comerciales apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Codigo</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Proceso/Base</th>
                    <th className="px-4 py-3">COP</th>
                    <th className="px-4 py-3">USD</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="px-4 py-3 font-medium text-ink">{profile.name}</td>
                      <td className="px-4 py-3 text-slate-600">{profile.internal_code || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{profile.category || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {profile.process_purchase_coffee_name || profile.base_purchase_coffee_name
                          ? `${profile.process_purchase_coffee_name || "-"} / ${profile.base_purchase_coffee_name || "-"}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{Number(profile.base_price_cop || 0).toLocaleString("es-CO")}</td>
                      <td className="px-4 py-3 text-slate-600">{Number(profile.base_price_usd || 0).toLocaleString("es-CO")}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={profile.is_active ? "success" : "danger"}>
                          {profile.is_active ? "activo" : "inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                          onClick={() => selectProfile(profile)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form className="rounded border border-slate-200 bg-white p-4" onSubmit={saveProfile}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-leaf" />
              <h2 className="text-sm font-semibold text-slate-800">
                {selectedProfile ? "Editar perfil" : "Nuevo perfil"}
              </h2>
            </div>
            {selectedProfile && (
              <button className="text-xs font-semibold text-slate-500 hover:text-ink" type="button" onClick={resetForm}>
                Nuevo
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre del perfil"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Codigo interno opcional"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              required
            >
              <option value="">Categoria</option>
              <option value="Regional">Regional</option>
              <option value="Varietal">Varietal</option>
              <option value="Exotico">Exotico</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Precio base COP"
                type="number"
                step="0.01"
                value={form.basePriceCop}
                onChange={(event) => setForm({ ...form, basePriceCop: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Precio base USD"
                type="number"
                step="0.01"
                value={form.basePriceUsd}
                onChange={(event) => setForm({ ...form, basePriceUsd: event.target.value })}
              />
            </div>
            {form.category === "Exotico" && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase text-amber-900">Receta sugerida para ensamble</p>
                <div className="mt-3 grid gap-3">
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={form.processPurchaseCoffeeId}
                    onChange={(event) => setForm({ ...form, processPurchaseCoffeeId: event.target.value })}
                  >
                    <option value="">Cafe usado para proceso</option>
                    {catalogs?.purchaseCoffees?.map((coffee) => (
                      <option key={coffee.id} value={coffee.id}>
                        {coffee.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={form.basePurchaseCoffeeId}
                    onChange={(event) => setForm({ ...form, basePurchaseCoffeeId: event.target.value })}
                  >
                    <option value="">Cafe usado como base</option>
                    {catalogs?.purchaseCoffees?.map((coffee) => (
                      <option key={coffee.id} value={coffee.id}>
                        {coffee.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="% Proceso"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.processPercentage}
                      onChange={(event) => setForm({ ...form, processPercentage: event.target.value })}
                    />
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="% Base"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.basePercentage}
                      onChange={(event) => setForm({ ...form, basePercentage: event.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Perfil activo
            </label>
          </div>

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
          >
            <Save size={16} />
            Guardar perfil
          </button>
        </form>
      </div>
    </section>
  );
};

export default CoffeeProfilesPage;
