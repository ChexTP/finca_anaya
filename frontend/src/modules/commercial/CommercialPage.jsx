import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const CommercialPage = () => {
  const [quotes, setQuotes] = useState([]);

  useEffect(() => {
    apiRequest("/quotes").then(setQuotes).catch(() => setQuotes([]));
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Comercial</h1>
        <p className="text-sm text-slate-500">Cotizaciones y preventas registradas.</p>
      </div>
      {quotes.length === 0 ? (
        <EmptyState title="Sin cotizaciones" message="Las cotizaciones del vendedor apareceran aqui." />
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2">Codigo</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td className="px-3 py-2 font-medium">{quote.code}</td>
                  <td className="px-3 py-2">{quote.client_name}</td>
                  <td className="px-3 py-2">{quote.quote_type}</td>
                  <td className="px-3 py-2">
                    <StatusBadge>{quote.status}</StatusBadge>
                  </td>
                  <td className="px-3 py-2">
                    {quote.currency} {quote.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default CommercialPage;
