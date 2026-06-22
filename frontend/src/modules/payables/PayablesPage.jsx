import { CreditCard, Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialPayable = {
  categoryId: "",
  supplierId: "",
  lotId: "",
  status: "pendiente",
  thirdPartyName: "",
  description: "",
  total: "",
  amountPaid: "0",
  dueDate: new Date().toISOString().slice(0, 10),
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
  notes: "",
};

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
  const [suppliers, setSuppliers] = useState([]);
  const [lots, setLots] = useState([]);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [payableForm, setPayableForm] = useState(initialPayable);
  const [paymentForm, setPaymentForm] = useState(initialPayment);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [payableData, catalogData, supplierData, lotData] = await Promise.all([
      apiRequest("/payables"),
      apiRequest("/catalogs"),
      apiRequest("/suppliers"),
      apiRequest("/lots"),
    ]);
    setPayables(payableData);
    setCatalogs(catalogData);
    setSuppliers(supplierData);
    setLots(lotData);
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

  const createPayable = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest("/payables", {
        method: "POST",
        body: JSON.stringify({
          ...payableForm,
          categoryId: Number(payableForm.categoryId),
          supplierId: payableForm.supplierId ? Number(payableForm.supplierId) : null,
          lotId: payableForm.lotId ? Number(payableForm.lotId) : null,
          total: Number(payableForm.total),
          amountPaid: Number(payableForm.amountPaid || 0),
          paymentMethodId: payableForm.paymentMethodId ? Number(payableForm.paymentMethodId) : null,
        }),
      });
      setPayableForm(initialPayable);
      await loadData();
      setMessage("Cuenta por pagar creada correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const registerPayment = async (event) => {
    event.preventDefault();

    if (!selectedPayable) {
      setError("Seleccione una cuenta por pagar.");
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
      setMessage("Pago registrado correctamente.");
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
          <h1 className="text-xl font-bold text-ink">Cuentas por pagar</h1>
          <p className="text-sm text-slate-500">Gastos, compras pendientes y pagos registrados.</p>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createPayable}>
            <div className="flex items-center gap-2">
              <Plus size={17} className="text-leaf" />
              <h2 className="text-sm font-semibold text-slate-800">Crear cuenta</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={payableForm.categoryId}
                onChange={(event) => setPayableForm({ ...payableForm, categoryId: event.target.value })}
              >
                <option value="">Categoria</option>
                {catalogs?.payableCategories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={payableForm.status}
                onChange={(event) => setPayableForm({ ...payableForm, status: event.target.value })}
              >
                <option value="pendiente">Pendiente</option>
                <option value="pago_parcial">Pago parcial</option>
                <option value="pagada">Pagada</option>
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={payableForm.supplierId}
                onChange={(event) => setPayableForm({ ...payableForm, supplierId: event.target.value })}
              >
                <option value="">Proveedor opcional</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={payableForm.lotId}
                onChange={(event) => setPayableForm({ ...payableForm, lotId: event.target.value })}
              >
                <option value="">Lote opcional</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.code || `Lote ${lot.id}`}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tercero externo opcional"
                value={payableForm.thirdPartyName}
                onChange={(event) => setPayableForm({ ...payableForm, thirdPartyName: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Total"
                type="number"
                step="0.01"
                value={payableForm.total}
                onChange={(event) => setPayableForm({ ...payableForm, total: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Valor pagado"
                type="number"
                step="0.01"
                value={payableForm.amountPaid}
                onChange={(event) => setPayableForm({ ...payableForm, amountPaid: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={payableForm.dueDate}
                onChange={(event) => setPayableForm({ ...payableForm, dueDate: event.target.value })}
              />
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={payableForm.paymentMethodId}
                onChange={(event) => setPayableForm({ ...payableForm, paymentMethodId: event.target.value })}
              >
                <option value="">Metodo si hay pago</option>
                {catalogs?.paymentMethods?.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Referencia si hay pago"
                value={payableForm.paymentReference}
                onChange={(event) => setPayableForm({ ...payableForm, paymentReference: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={payableForm.paidAt}
                onChange={(event) => setPayableForm({ ...payableForm, paidAt: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Descripcion"
                value={payableForm.description}
                onChange={(event) => setPayableForm({ ...payableForm, description: event.target.value })}
              />
              <textarea
                className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                placeholder="Notas"
                value={payableForm.notes}
                onChange={(event) => setPayableForm({ ...payableForm, notes: event.target.value })}
              />
            </div>
            <button className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
              <Save size={16} />
              Guardar cuenta
            </button>
          </form>

          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Listado</h2>
            </div>
            {payables.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin cuentas" message="Las cuentas por pagar apareceran aqui." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Saldo</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payables.map((payable) => (
                      <tr key={payable.id}>
                        <td className="px-3 py-2 font-medium">{payable.code}</td>
                        <td className="px-3 py-2">{payable.description}</td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={payable.status === "pagada" ? "success" : "warning"}>{payable.status}</StatusBadge>
                        </td>
                        <td className="px-3 py-2">{formatMoney(payable.balance_due)}</td>
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
        </div>

        <aside className="rounded border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CreditCard size={17} className="text-leaf" />
            <h2 className="text-sm font-semibold text-slate-800">Pago</h2>
          </div>
          {!selectedPayable ? (
            <div className="mt-3">
              <EmptyState title="Seleccione una cuenta" message="Aqui podra ver pagos y registrar abonos." />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-ink">{selectedPayable.code}</p>
                <p className="text-slate-600">{selectedPayable.description}</p>
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
