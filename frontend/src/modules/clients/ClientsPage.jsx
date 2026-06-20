import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import { apiRequest } from "../../utils/api";

const ClientsPage = () => {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    apiRequest("/clients").then(setClients).catch(() => setClients([]));
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Clientes</h1>
        <p className="text-sm text-slate-500">Clientes recurrentes y datos operativos.</p>
      </div>
      {clients.length === 0 ? (
        <EmptyState title="Sin clientes" message="Los clientes creados apareceran aqui." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <div key={client.id} className="rounded border border-slate-200 bg-white p-4">
              <p className="font-semibold text-ink">{client.name}</p>
              <p className="mt-1 text-sm text-slate-500">{client.phone}</p>
              <p className="mt-2 text-sm text-slate-600">{client.address}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ClientsPage;
