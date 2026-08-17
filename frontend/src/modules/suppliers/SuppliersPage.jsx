import { RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialSupplier = {
  name: "",
  documentType: "",
  documentNumber: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  country: "",
  originZone: "",
  shippingNotes: "",
  billingNotes: "",
  notes: "",
  isActive: true,
};

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(initialSupplier);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSuppliers = async () => {
    setError("");
    const data = await apiRequest("/suppliers");
    setSuppliers(data);
  };

  useEffect(() => {
    loadSuppliers().catch((requestError) => setError(requestError.message));
  }, []);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && supplier.is_active) ||
        (statusFilter === "inactive" && !supplier.is_active);
      const matchesSearch = !term || [
        supplier.name,
        supplier.document_type,
        supplier.document_number,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.city,
        supplier.country,
        supplier.origin_zone,
        supplier.shipping_notes,
        supplier.billing_notes,
        supplier.notes,
        supplier.is_active ? "activo" : "inactivo",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [suppliers, search, statusFilter]);

  const startEdit = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || "",
      documentType: supplier.document_type || "",
      documentNumber: supplier.document_number || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "",
      originZone: supplier.origin_zone || "",
      shippingNotes: supplier.shipping_notes || "",
      billingNotes: supplier.billing_notes || "",
      notes: supplier.notes || "",
      isActive: supplier.is_active !== false,
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingSupplier(null);
    setForm(initialSupplier);
    setMessage("");
    setError("");
  };

  const saveSupplier = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Nombre, telefono y direccion son obligatorios.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(editingSupplier ? `/suppliers/${editingSupplier.id}` : "/suppliers", {
        method: editingSupplier ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      await loadSuppliers();
      setForm(initialSupplier);
      setEditingSupplier(null);
      setMessage(editingSupplier ? "Proveedor actualizado correctamente." : "Proveedor creado correctamente.");
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
          <h1 className="text-xl font-bold text-ink">Proveedores</h1>
          <p className="text-sm text-slate-500">Creacion y correccion rapida de proveedores usados en recepcion.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadSuppliers()}
          type="button"
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
            <h2 className="text-sm font-semibold text-slate-800">Listado de proveedores</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar por nombre, documento, telefono, correo, direccion o zona"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
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
            <p className="mt-2 text-xs text-slate-500">{filteredSuppliers.length} proveedor(es) encontrados</p>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin proveedores" message="Los proveedores registrados apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Telefono</th>
                    <th className="px-3 py-2">Correo</th>
                    <th className="px-3 py-2">Direccion</th>
                    <th className="px-3 py-2">Zona</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-ink">{supplier.name}</p>
                        <p className="text-xs text-slate-500">{supplier.notes || "-"}</p>
                      </td>
                      <td className="px-3 py-2">{[supplier.document_type, supplier.document_number].filter(Boolean).join(" ") || "-"}</td>
                      <td className="px-3 py-2">{supplier.phone}</td>
                      <td className="px-3 py-2">{supplier.email || "-"}</td>
                      <td className="px-3 py-2">{supplier.address || "-"}</td>
                      <td className="px-3 py-2">
                        <p>{supplier.origin_zone || "-"}</p>
                        <p className="text-xs text-slate-500">{[supplier.city, supplier.country].filter(Boolean).join(", ") || "-"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={supplier.is_active ? "success" : "neutral"}>
                          {supplier.is_active ? "activo" : "inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-60"
                          disabled={saving}
                          onClick={() => startEdit(supplier)}
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

        <form className="min-w-0 rounded border border-slate-200 bg-white p-4" onSubmit={saveSupplier}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">
              {editingSupplier ? `Editar ${editingSupplier.name}` : "Nuevo proveedor"}
            </h2>
            {editingSupplier && (
              <button
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={cancelEdit}
                type="button"
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre de finca o proveedor"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tipo documento opcional"
                value={form.documentType}
                onChange={(event) => setForm({ ...form, documentType: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Numero documento opcional"
                value={form.documentNumber}
                onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
              />
            </div>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Telefono"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Correo opcional"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Direccion"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ciudad opcional"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Pais opcional"
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
              />
            </div>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Zona de procedencia"
              value={form.originZone}
              onChange={(event) => setForm({ ...form, originZone: event.target.value })}
            />
            <textarea
              className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notas de envio opcionales"
              value={form.shippingNotes}
              onChange={(event) => setForm({ ...form, shippingNotes: event.target.value })}
            />
            <textarea
              className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notas de facturacion opcionales"
              value={form.billingNotes}
              onChange={(event) => setForm({ ...form, billingNotes: event.target.value })}
            />
            <textarea
              className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notas internas opcionales"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                type="checkbox"
              />
              Proveedor activo para recepcion
            </label>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              <Save size={16} />
              {editingSupplier ? "Guardar cambios" : "Guardar proveedor"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default SuppliersPage;
