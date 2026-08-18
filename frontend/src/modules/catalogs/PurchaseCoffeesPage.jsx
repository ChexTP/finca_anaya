import { RefreshCw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

const initialForm = {
  name: "",
  family: "",
  processType: "",
  isActive: true,
};

const PurchaseCoffeesPage = () => {
  const { user } = useAuth();
  const [coffees, setCoffees] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedCoffee, setSelectedCoffee] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCoffees = async () => {
    const [data, catalogData] = await Promise.all([
      apiRequest("/catalogs/purchase-coffees"),
      apiRequest("/catalogs"),
    ]);
    setCoffees(data);
    setCatalogs(catalogData);
  };

  useEffect(() => {
    loadCoffees().catch((requestError) => setError(requestError.message));
  }, []);

  const selectCoffee = (coffee) => {
    setSelectedCoffee(coffee);
    setForm({
      name: coffee.name || "",
      family: coffee.family || "",
      processType: coffee.process_type || "",
      isActive: coffee.is_active,
    });
    setMessage("");
    setError("");
  };

  const resetForm = () => {
    setSelectedCoffee(null);
    setForm(initialForm);
    setMessage("");
    setError("");
  };

  const saveCoffee = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        family: form.family,
        processType: form.processType,
        isActive: form.isActive,
      };

      if (selectedCoffee) {
        await apiRequest(`/catalogs/purchase-coffees/${selectedCoffee.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/catalogs/purchase-coffees", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await loadCoffees();
      resetForm();
      setMessage(selectedCoffee ? "Perfil de compra actualizado correctamente." : "Perfil de compra creado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCoffee = async (coffee) => {
    const confirmed = window.confirm(
      `Vas a eliminar de raiz el perfil de compra "${coffee.name}". Si ya esta usado, el sistema lo bloqueara.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await apiRequest(`/catalogs/purchase-coffees/${coffee.id}`, { method: "DELETE" });

      if (selectedCoffee?.id === coffee.id) {
        resetForm();
      }

      await loadCoffees();
      setMessage("Perfil de compra eliminado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Perfiles de compra</h1>
          <p className="text-sm text-slate-500">Cafes que se compran y aparecen en recepcion de bodega.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadCoffees()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Listado</h2>
          </div>

          {coffees.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin perfiles" message="Los cafes para compra apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Cafe</th>
                    <th className="px-4 py-3">Familia</th>
                    <th className="px-4 py-3">Proceso</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coffees.map((coffee) => (
                    <tr key={coffee.id}>
                      <td className="px-4 py-3 font-medium text-ink">{coffee.name}</td>
                      <td className="px-4 py-3 text-slate-600">{coffee.family}</td>
                      <td className="px-4 py-3 text-slate-600">{coffee.process_type}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={coffee.is_active ? "success" : "danger"}>
                          {coffee.is_active ? "activo" : "inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                            onClick={() => selectCoffee(coffee)}
                            type="button"
                          >
                            Editar
                          </button>
                          {user?.role === "admin" && (
                            <button
                              className="inline-flex items-center gap-1 rounded border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              onClick={() => deleteCoffee(coffee)}
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

        <form className="min-w-0 rounded border border-slate-200 bg-white p-4" onSubmit={saveCoffee}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-leaf" />
              <h2 className="text-sm font-semibold text-slate-800">
                {selectedCoffee ? "Editar perfil de compra" : "Nuevo perfil de compra"}
              </h2>
            </div>
            {selectedCoffee && (
              <button className="text-xs font-semibold text-slate-500 hover:text-ink" type="button" onClick={resetForm}>
                Nuevo
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre del cafe comprado"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.family}
              onChange={(event) => setForm({ ...form, family: event.target.value })}
              required
            >
              <option value="">Familia</option>
              <option value="Regional">Regional</option>
              <option value="Varietal">Varietal</option>
            </select>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.processType}
              onChange={(event) => setForm({ ...form, processType: event.target.value })}
              required
            >
              <option value="">Proceso</option>
              {catalogs?.coffeeTypes?.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Perfil activo para recepcion
            </label>
          </div>

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
          >
            <Save size={16} />
            Guardar perfil de compra
          </button>
        </form>
      </div>
    </section>
  );
};

export default PurchaseCoffeesPage;
