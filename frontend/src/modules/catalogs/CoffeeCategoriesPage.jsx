import { RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const catalogsConfig = {
  presentations: {
    title: "Presentaciones",
    description: "Ejemplo: Pergamino, Excelso, Cereza.",
    endpoint: "/catalogs/coffee-presentations",
    placeholder: "Nombre de la presentacion",
  },
  types: {
    title: "Procesos o beneficios",
    description: "Ejemplo: Lavado, Natural, Semilavado, Descafeinado.",
    endpoint: "/catalogs/coffee-types",
    placeholder: "Nombre del proceso o beneficio",
  },
};

const initialForm = {
  name: "",
  isActive: true,
};

const CoffeeCategoriesPage = () => {
  const [activeCatalog, setActiveCatalog] = useState("presentations");
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const config = catalogsConfig[activeCatalog];

  const loadItems = async () => {
    setError("");
    const data = await apiRequest(config.endpoint);
    setItems(data);
  };

  useEffect(() => {
    loadItems().catch((requestError) => setError(requestError.message));
  }, [activeCatalog]);

  const resetForm = () => {
    setSelectedItem(null);
    setForm(initialForm);
    setMessage("");
    setError("");
  };

  const selectItem = (item) => {
    setSelectedItem(item);
    setForm({
      name: item.name || "",
      isActive: item.is_active,
    });
    setMessage("");
    setError("");
  };

  const changeCatalog = (catalogKey) => {
    setActiveCatalog(catalogKey);
    setItems([]);
    resetForm();
  };

  const saveItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        isActive: form.isActive,
      };

      if (selectedItem) {
        await apiRequest(`${config.endpoint}/${selectedItem.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(config.endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await loadItems();
      resetForm();
      setMessage(selectedItem ? "Catalogo actualizado correctamente." : "Registro creado correctamente.");
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
          <h1 className="text-xl font-bold text-ink">Tipos de cafe</h1>
          <p className="text-sm text-slate-500">Catalogos usados en recepcion, inventario, pedidos y procesos.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadItems()}
          type="button"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {Object.entries(catalogsConfig).map(([key, catalog]) => (
          <button
            key={key}
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              activeCatalog === key
                ? "border-leaf bg-emerald-50 text-leaf"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            type="button"
            onClick={() => changeCatalog(key)}
          >
            {catalog.title}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">{config.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{config.description}</p>
          </div>

          {items.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin registros" message="Los registros de este catalogo apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={item.is_active ? "success" : "danger"}>
                          {item.is_active ? "activo" : "inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                          onClick={() => selectItem(item)}
                          type="button"
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

        <form className="min-w-0 rounded border border-slate-200 bg-white p-4" onSubmit={saveItem}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-leaf" />
              <h2 className="text-sm font-semibold text-slate-800">
                {selectedItem ? "Editar registro" : "Nuevo registro"}
              </h2>
            </div>
            {selectedItem && (
              <button className="text-xs font-semibold text-slate-500 hover:text-ink" type="button" onClick={resetForm}>
                Nuevo
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder={config.placeholder}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Activo para nuevos registros
            </label>
          </div>

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
          >
            <Save size={16} />
            Guardar
          </button>
        </form>
      </div>
    </section>
  );
};

export default CoffeeCategoriesPage;
