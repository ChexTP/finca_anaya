import { CreditCard, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialPayment = {
  amount: "",
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
  notes: "",
};

const formatMoney = (value) => `COP ${Number(value || 0).toLocaleString("es-CO")}`;

const PayablesPage = () => {
  const [payables, setPayables] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [paymentForm, setPaymentForm] = useState(initialPayment);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [payableData, catalogData] = await Promise.all([
      apiRequest("/payables"),
      apiRequest("/catalogs"),
    ]);
    setPayables(payableData);
    setCatalogs(catalogData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const loadPayableDetail = async (payableId) => {
    const data = await apiRequest(`/payables/${payableId}`);
    setSelectedPayable(data);
    setPaymentForm({
      ...initialPayment,
      amount: data.balance_due && Number(data.balance_due) > 0 ? String(data.balance_due) : "",
    });
    setMessage("");
    setError("");
  };

  const registerPayment = async (event) => {
    event.preventDefault();

    if (!selectedPayable) {
      setError("Seleccione un lote pendiente de pago.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/payables/${selectedPayable.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          ...paymentForm,
          amount: Number(paymentForm.amount),
          paymentMethodId: Number(paymentForm.paymentMethodId),
        }),
      });
      await loadData();
      await loadPayableDetail(selectedPayable.id);
      setMessage("Pago de lote registrado correctamente.");
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
          <h1 className="text-xl font-bold text-ink">Pagos de lotes</h1>
          <p className="text-sm text-slate-500">Cuentas generadas al liquidar cafe comprado. No incluye gastos operativos generales.</p>
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Lotes liquidados</h2>
            <p className="mt-1 text-xs text-slate-500">Estos registros nacen automaticamente cuando contabilidad liquida un lote de cafe.</p>
          </div>
          {payables.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin lotes pendientes" message="Cuando se liquide un lote de cafe, aparecera aqui para seguimiento de pago." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Saldo</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payables.map((payable) => (
                    <tr key={payable.id}>
                      <td className="px-3 py-2 font-medium">{payable.code}</td>
                      <td className="px-3 py-2">{payable.lot_code || "-"}</td>
                      <td className="px-3 py-2">{payable.supplier_name || "-"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={payable.status === "pagada" ? "success" : "warning"}>{payable.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2">{formatMoney(payable.total)}</td>
                      <td className="px-3 py-2 font-semibold text-ink">{formatMoney(payable.balance_due)}</td>
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => loadPayableDetail(payable.id)}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CreditCard size={17} className="text-leaf" />
            <h2 className="text-sm font-semibold text-slate-800">Pago del lote</h2>
          </div>
          {!selectedPayable ? (
            <div className="mt-3">
              <EmptyState title="Seleccione un lote" message="Aqui vera pagos y podra registrar abonos del cafe liquidado." />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-ink">{selectedPayable.code}</p>
                <p className="text-slate-600">{selectedPayable.description}</p>
                <p className="mt-2 text-slate-500">Lote: {selectedPayable.lot_code || "-"}</p>
                <p className="text-slate-500">Proveedor: {selectedPayable.supplier_name || "-"}</p>
                <p className="mt-2 text-slate-500">Total: {formatMoney(selectedPayable.total)}</p>
                <p className="text-slate-500">Pagado: {formatMoney(selectedPayable.amount_paid)}</p>
                <p className="font-semibold text-ink">Saldo: {formatMoney(selectedPayable.balance_due)}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Pagos registrados</p>
                {selectedPayable.payments?.length ? (
                  selectedPayable.payments.map((payment) => (
                    <div key={payment.id} className="rounded border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-ink">{formatMoney(payment.amount)}</p>
                      <p className="text-slate-500">{payment.payment_method_name} - {payment.payment_reference}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Sin pagos registrados.</p>
                )}
              </div>

              <form className="space-y-3" onSubmit={registerPayment}>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Valor a pagar"
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                />
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={paymentForm.paymentMethodId}
                  onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethodId: event.target.value })}
                >
                  <option value="">Metodo de pago</option>
                  {catalogs?.paymentMethods?.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Referencia"
                  value={paymentForm.paymentReference}
                  onChange={(event) => setPaymentForm({ ...paymentForm, paymentReference: event.target.value })}
                />
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })}
                />
                <textarea
                  className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Notas del pago"
                  value={paymentForm.notes}
                  onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                />
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving || selectedPayable.status === "pagada"}
                >
                  <Save size={16} />
                  Registrar pago
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default PayablesPage;
