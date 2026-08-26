import { Plus, RefreshCw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

const initialProfile = {
  name: "",
  code: "",
  category: "",
  processType: "",
  components: [{ componentType: "purchase", purchaseCoffeeId: "", componentProfileId: "", percentage: "" }],
  basePurchaseCoffeeId: "",
  basePercentage: "",
  basePriceCop: "",
  basePriceUsd: "",
  isActive: true,
};

const emptyComponent = { componentType: "purchase", purchaseCoffeeId: "", componentProfileId: "", percentage: "" };
const processTypeOptions = ["Lavado", "Natural", "Semilavado", "Honey"];

const buildLegacyComponents = (profile) => {
  const components = [];

  if (profile.process_purchase_coffee_id || profile.process_percentage) {
    components.push({
      componentType: "purchase",
      purchaseCoffeeId: profile.process_purchase_coffee_id || "",
      componentProfileId: "",
      percentage: profile.process_percentage || "",
    });
  }

  if (profile.base_purchase_coffee_id || profile.base_percentage) {
    components.push({
      componentType: "purchase",
      purchaseCoffeeId: profile.base_purchase_coffee_id || "",
      componentProfileId: "",
      percentage: profile.base_percentage || "",
    });
  }

  return components.length > 0 ? components : [{ ...emptyComponent }];
};

const getBasePurchaseCoffeeId = (profile) => {
  return profile.base_purchase_coffee_id || "";
};

const buildProfileComponents = (profile) => {
  if (Array.isArray(profile.components) && profile.components.length > 0) {
    return profile.components.map((component) => ({
      componentType: component.component_type || component.componentType || (component.component_profile_id ? "profile" : "purchase"),
      purchaseCoffeeId: component.purchase_coffee_id || component.purchaseCoffeeId || "",
      componentProfileId: component.component_profile_id || component.componentProfileId || "",
      percentage: component.percentage || "",
    }));
  }

  return buildLegacyComponents(profile);
};

const formatComponentSummary = (profile) => {
  const components = Array.isArray(profile.components) && profile.components.length > 0
    ? profile.components
    : [];

  if (components.length > 0) {
    return components
      .map((component) => {
        const name = component.purchase_coffee_name || component.component_profile_name || "Cafe";
        return component.percentage ? `${name} ${Number(component.percentage)}%` : name;
      })
      .join(" / ");
  }

  if (profile.process_purchase_coffee_name || profile.base_purchase_coffee_name) {
    return [
      profile.process_purchase_coffee_name,
      profile.base_purchase_coffee_name,
    ].filter(Boolean).join(" / ");
  }

  return "-";
};

const formatBaseSummary = (profile) => {
  return profile.base_purchase_coffee_name || "-";
};

const formatBaseWithPercentage = (profile) => {
  if (!profile.base_purchase_coffee_name) return "-";
  return profile.base_percentage ? `${profile.base_purchase_coffee_name} ${Number(profile.base_percentage)}%` : profile.base_purchase_coffee_name;
};

const getCodeSortValue = (profile) => {
  const code = String(profile.internal_code || "").trim();
  const numericPart = code.match(/\d+/g)?.join("");

  return numericPart ? Number(numericPart) : Number.NEGATIVE_INFINITY;
};

const sortProfilesByCodeDesc = (items) => {
  return [...items].sort((left, right) => {
    const rightCodeValue = getCodeSortValue(right);
    const leftCodeValue = getCodeSortValue(left);

    if (rightCodeValue !== leftCodeValue) return rightCodeValue - leftCodeValue;

    return String(right.internal_code || right.name || "").localeCompare(String(left.internal_code || left.name || ""), "es");
  });
};

const CoffeeProfilesPage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [form, setForm] = useState(initialProfile);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();

    return sortProfilesByCodeDesc(profiles.filter((profile) => {
      const matchesCategory = categoryFilter === "all" || profile.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && profile.is_active) ||
        (statusFilter === "inactive" && !profile.is_active);
      const matchesSearch = !term || [
        profile.name,
        profile.internal_code,
        profile.category,
        profile.process_type,
        formatComponentSummary(profile),
        formatBaseSummary(profile),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);

      return matchesCategory && matchesStatus && matchesSearch;
    }));
  }, [profiles, search, categoryFilter, statusFilter]);

  const selectProfile = (profile) => {
    setSelectedProfile(profile);
    setForm({
      name: profile.name || "",
      code: profile.internal_code || "",
      category: profile.category || "",
      processType: profile.process_type || "",
      components: buildProfileComponents(profile),
      basePurchaseCoffeeId: getBasePurchaseCoffeeId(profile),
      basePercentage: profile.base_percentage || "",
      basePriceCop: Number(profile.base_price_cop || 0) > 0 ? String(profile.base_price_cop) : "",
      basePriceUsd: Number(profile.base_price_usd || 0) > 0 ? String(profile.base_price_usd) : "",
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
        components: form.components
          .filter((component) => component.purchaseCoffeeId || component.componentProfileId)
          .map((component) => ({
            componentType: component.componentType || "purchase",
            purchaseCoffeeId: component.componentType === "profile" ? null : Number(component.purchaseCoffeeId),
            componentProfileId: component.componentType === "profile" ? Number(component.componentProfileId) : null,
            percentage: component.percentage === "" ? null : Number(component.percentage),
          })),
        basePurchaseCoffeeId: form.basePurchaseCoffeeId ? Number(form.basePurchaseCoffeeId) : null,
        basePercentage: form.basePercentage === "" ? null : Number(form.basePercentage),
        basePriceCop: form.basePriceCop === "" ? 0 : Number(form.basePriceCop),
        basePriceUsd: 0,
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

  const deleteProfile = async (profile) => {
    const confirmed = window.confirm(
      `Vas a eliminar de raiz el perfil de venta "${profile.name}". Si ya esta usado, el sistema lo bloqueara.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await apiRequest(`/catalogs/coffee-profiles/${profile.id}`, { method: "DELETE" });

      if (selectedProfile?.id === profile.id) {
        resetForm();
      }

      await loadProfiles();
      setMessage("Perfil de venta eliminado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateComponent = (index, field, value) => {
    setForm({
      ...form,
      components: form.components.map((component, componentIndex) => (
        componentIndex === index ? { ...component, [field]: value } : component
      )),
    });
  };

  const addComponent = () => {
    setForm({
      ...form,
      components: [...form.components, { ...emptyComponent }],
    });
  };

  const componentPercentageTotal = useMemo(() => {
    return form.components.reduce((total, component) => total + Number(component.percentage || 0), 0) + Number(form.basePercentage || 0);
  }, [form.components, form.basePercentage]);

  const componentProfileOptions = useMemo(() => {
    return sortProfilesByCodeDesc(profiles.filter((profile) => !selectedProfile || profile.id !== selectedProfile.id));
  }, [profiles, selectedProfile]);

  const removeComponent = (index) => {
    setForm({
      ...form,
      components: form.components.length === 1
        ? [{ ...emptyComponent }]
        : form.components.filter((_, componentIndex) => componentIndex !== index),
    });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Perfiles de venta</h1>
          <p className="text-sm text-slate-500">Administracion de cafes regionales, varietales y exoticos para cotizaciones.</p>
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Listado</h2>
            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar por perfil, codigo, categoria, proceso o componente"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">Todas</option>
                <option value="Regional">Regional</option>
                <option value="Varietal">Varietal</option>
                <option value="Exotico">Exotico</option>
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-500">{filteredProfiles.length} perfil(es) encontrados</p>
          </div>

          {filteredProfiles.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin perfiles" message="No hay perfiles para los filtros seleccionados." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Codigo</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Proceso</th>
                    <th className="px-4 py-3">Componentes</th>
                    <th className="px-4 py-3">Base principal</th>
                    <th className="px-4 py-3">Precio carga</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="px-4 py-3 font-medium text-ink">{profile.name}</td>
                      <td className="px-4 py-3 text-slate-600">{profile.internal_code || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{profile.category || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{profile.process_type || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatComponentSummary(profile)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatBaseWithPercentage(profile)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {Number(profile.base_price_cop || 0) > 0 ? `COP ${Number(profile.base_price_cop).toLocaleString("es-CO")}` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={profile.is_active ? "success" : "danger"}>
                          {profile.is_active ? "activo" : "inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                            onClick={() => selectProfile(profile)}
                            type="button"
                          >
                            Editar
                          </button>
                          {user?.role === "admin" && (
                            <button
                              className="inline-flex items-center gap-1 rounded border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              onClick={() => deleteProfile(profile)}
                              type="button"
                            >
                              <Trash2 size={14} />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4" onSubmit={saveProfile}>
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
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Proceso comercial
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink"
                  value={form.processType}
                  onChange={(event) => setForm({ ...form, processType: event.target.value })}
                >
                  <option value="">Sin proceso definido</option>
                  {processTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Precio carga COP
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink"
                  placeholder="Vacio si no esta definido"
                  type="number"
                  step="0.01"
                  value={form.basePriceCop}
                  onChange={(event) => setForm({ ...form, basePriceCop: event.target.value })}
                />
              </label>
            </div>
            <div className="min-w-0 overflow-hidden rounded border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-900">Componentes de proceso</p>
                  <p className="mt-1 text-xs text-amber-800">Pueden ser cafes de compra o perfiles/procesos ya creados.</p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${Math.abs(componentPercentageTotal - 100) <= 0.01 ? "bg-emerald-100 text-emerald-800" : "bg-white text-amber-900"}`}>
                  Total receta: {Number(componentPercentageTotal.toFixed(2))}%
                </span>
              </div>
              <div className="mt-3 grid gap-3">
                {form.components.map((component, index) => (
                  <div key={`component-${index}`} className="min-w-0 rounded border border-amber-200 bg-white p-2">
                    <div className="grid gap-2">
                      <select
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        value={component.componentType || "purchase"}
                        onChange={(event) => {
                          const componentType = event.target.value;
                          setForm({
                            ...form,
                            components: form.components.map((currentComponent, componentIndex) => (
                              componentIndex === index
                                ? {
                                    ...currentComponent,
                                    componentType,
                                    purchaseCoffeeId: "",
                                    componentProfileId: "",
                                  }
                                : currentComponent
                            )),
                          });
                        }}
                      >
                        <option value="purchase">Compra</option>
                        <option value="profile">Proceso</option>
                      </select>
                      <select
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        value={(component.componentType || "purchase") === "profile" ? component.componentProfileId : component.purchaseCoffeeId}
                        onChange={(event) => {
                          if ((component.componentType || "purchase") === "profile") {
                            updateComponent(index, "componentProfileId", event.target.value);
                          } else {
                            updateComponent(index, "purchaseCoffeeId", event.target.value);
                          }
                        }}
                      >
                        <option value="">{(component.componentType || "purchase") === "profile" ? "Perfil/proceso" : "Cafe comprado"}</option>
                        {(component.componentType || "purchase") === "profile"
                          ? componentProfileOptions.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.internal_code ? `${profile.internal_code} - ` : ""}{profile.name} - {profile.category} {profile.process_type || ""}
                              </option>
                            ))
                          : catalogs?.purchaseCoffees?.map((coffee) => (
                              <option key={coffee.id} value={coffee.id}>
                                {coffee.name} - {coffee.family} {coffee.process_type}
                              </option>
                            ))}
                      </select>
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="%"
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={component.percentage}
                        onChange={(event) => updateComponent(index, "percentage", event.target.value)}
                      />
                      <button
                        className="inline-flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                        type="button"
                        onClick={() => removeComponent(index)}
                        title="Quitar componente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="inline-flex items-center justify-center gap-2 rounded border border-leaf bg-white px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50"
                  type="button"
                  onClick={addComponent}
                >
                  <Plus size={16} />
                  Agregar otro componente
                </button>
              </div>
            </div>
            <div className="min-w-0 rounded border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase text-emerald-900">Base principal para deficit</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px]">
                <select
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.basePurchaseCoffeeId}
                  onChange={(event) => setForm({ ...form, basePurchaseCoffeeId: event.target.value })}
                >
                  <option value="">Sin base principal</option>
                  {catalogs?.purchaseCoffees?.map((coffee) => (
                    <option key={coffee.id} value={coffee.id}>
                      {coffee.name} - {coffee.family} {coffee.process_type}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="% base"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={form.basePercentage}
                  onChange={(event) => setForm({ ...form, basePercentage: event.target.value })}
                />
              </div>
            </div>
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
