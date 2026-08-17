import { RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialClient = {
  name: "",
  documentType: "",
  documentNumber: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  country: "",
  shippingNotes: "",
  billingNotes: "",
  isActive: true,
};

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState(initialClient);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadClients = async () => {
    const data = await apiRequest("/clients");
    setClients(data);
  };

  useEffect(() => {
    loadClients().catch((requestError) => setError(requestError.message));
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && client.is_active) ||
        (statusFilter === "inactive" && !client.is_active);
      const matchesSearch = !term || [
        client.name,
        client.document_type,
        client.document_number,
        client.phone,
        client.email,
        client.address,
        client.city,
        client.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [clients, search, statusFilter]);

  const selectClient = async (clientId) => {
    const client = await apiRequest(`/clients/${clientId}`);
    setSelectedClient(client);
    setForm({
      name: client.name || "",
      documentType: client.document_type || "",
      documentNumber: client.document_number || "",
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      city: client.city || "",
      country: client.country || "",
      shippingNotes: client.shipping_notes || "",
      billingNotes: client.billing_notes || "",
      isActive: client.is_active,
    });
    setMessage("");
    setError("");
  };

  const resetForm = () => {
    setSelectedClient(null);
    setForm(initialClient);
    setMessage("");
    setError("");
  };

  const saveClient = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const path = selectedClient ? `/clients/${selectedClient.id}` : "/clients";
      const method = selectedClient ? "PUT" : "POST";

      await apiRequest(path, {
        method,
        body: JSON.stringify(form),
      });
      await loadClients();
      resetForm();
      setMessage(selectedClient ? "Cliente actualizado correctamente." : "Cliente creado correctamente.");
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
          <h1 className="text-xl font-bold text-ink">Clientes</h1>
          <p className="text-sm text-slate-500">Clientes recurrentes y datos operativos para cotizacion y venta.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadClients()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Listado</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar por cliente, documento, telefono, correo o ciudad"
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
            <p className="mt-2 text-xs text-slate-500">{filteredClients.length} cliente(s) encontrados</p>
          </div>
          {filteredClients.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin clientes" message="No hay clientes para los filtros seleccionados." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Telefono</th>
                    <th className="px-3 py-2">Ubicacion</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className={selectedClient?.id === client.id ? "bg-emerald-50" : ""}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-ink">{client.name}</p>
                        <p className="text-xs text-slate-500">{client.email || "-"}</p>
                      </td>
                      <td className="px-3 py-2">{[client.document_type, client.document_number].filter(Boolean).join(" ") || "-"}</td>
                      <td className="px-3 py-2">{client.phone || "-"}</td>
                      <td className="px-3 py-2">
                        <p>{client.address || "-"}</p>
                        <p className="text-xs text-slate-500">{[client.city, client.country].filter(Boolean).join(", ") || "-"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={client.is_active ? "success" : "danger"}>
                          {client.is_active ? "activo" : "inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                          onClick={() => selectClient(client.id)}
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

        <form className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4" onSubmit={saveClient}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">
              {selectedClient ? "Editar cliente" : "Nuevo cliente"}
            </h2>
            {selectedClient && (
              <button className="text-xs font-semibold text-slate-500 hover:text-ink" type="button" onClick={resetForm}>
                Nuevo
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tipo documento"
                value={form.documentType}
                onChange={(event) => setForm({ ...form, documentType: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Numero documento"
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
                placeholder="Ciudad"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Pais"
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
              />
            </div>
            <textarea
              className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notas de envio"
              value={form.shippingNotes}
              onChange={(event) => setForm({ ...form, shippingNotes: event.target.value })}
            />
            <textarea
              className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notas de facturacion"
              value={form.billingNotes}
              onChange={(event) => setForm({ ...form, billingNotes: event.target.value })}
            />
            {selectedClient && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Cliente activo
              </label>
            )}
            <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
              <Save size={16} />
              Guardar cliente
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ClientsPage;
