import { RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Listado</h2>
          </div>
          {clients.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin clientes" message="Los clientes creados apareceran aqui." />
            </div>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <button
                  key={client.id}
                  className={`rounded border bg-white p-4 text-left hover:bg-slate-50 ${
                    selectedClient?.id === client.id ? "border-leaf" : "border-slate-200"
                  }`}
                  onClick={() => selectClient(client.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink">{client.name}</p>
                    <StatusBadge tone={client.is_active ? "success" : "danger"}>
                      {client.is_active ? "activo" : "inactivo"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{client.phone}</p>
                  <p className="mt-2 text-sm text-slate-600">{client.address}</p>
                  <p className="text-sm text-slate-500">{[client.city, client.country].filter(Boolean).join(", ")}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="rounded border border-slate-200 bg-white p-4" onSubmit={saveClient}>
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
