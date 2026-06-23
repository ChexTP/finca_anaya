import { RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";

const initialPurchase = {
  purchasePricePerKg: "",
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
};

const InventoryPage = () => {
  const { user } = useAuth();
  const [lots, setLots] = useState([]);
  const [approvedLots, setApprovedLots] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(initialPurchase);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canRegisterPurchase = ["admin", "accounting"].includes(user?.role);

  const loadData = async () => {
    const requests = [
      apiRequest("/inventory/lots"),
      apiRequest("/lots?status=aprobado"),
    ];

    if (canRegisterPurchase) {
      requests.push(apiRequest("/catalogs"));
    }

    const [availableData, approvedData, catalogData] = await Promise.all(requests);
    setLots(availableData);
    setApprovedLots(approvedData);
    setCatalogs(catalogData || null);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const selectApprovedLot = (lot) => {
    setSelectedLot(lot);
    setPurchaseForm(initialPurchase);
    setMessage("");
    setError("");
  };

  const registerPurchase = async (event) => {
    event.preventDefault();

    if (!selectedLot) {
      setError("Seleccione un lote aprobado por laboratorio.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${selectedLot.id}/purchase`, {
        method: "PUT",
        body: JSON.stringify({
          purchasePricePerKg: Number(purchaseForm.purchasePricePerKg),
          paymentMethodId: Number(purchaseForm.paymentMethodId),
          paymentReference: purchaseForm.paymentReference,
          paidAt: purchaseForm.paidAt,
        }),
      });
      setSelectedLot(null);
      setPurchaseForm(initialPurchase);
      await loadData();
      setMessage("Compra registrada. El lote ya quedo disponible en inventario.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const purchaseTotal = selectedLot && purchaseForm.purchasePricePerKg
    ? Number(Number(selectedLot.net_weight_kg) * Number(purchaseForm.purchasePricePerKg)).toLocaleString("es-CO")
    : "0";

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Inventario</h1>
          <p className="text-sm text-slate-500">Lotes disponibles, pendientes de compra y control por antiguedad.</p>
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

      {canRegisterPurchase && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Aprobados por laboratorio</h2>
            </div>
            {approvedLots.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin compras pendientes" message="Los lotes aprobados por laboratorio apareceran aqui." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2">Peso neto</th>
                      <th className="px-3 py-2">Factor</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {approvedLots.map((lot) => (
                      <tr key={lot.id}>
                        <td className="px-3 py-2 font-medium">{lot.code}</td>
                        <td className="px-3 py-2">{lot.supplier_name || "-"}</td>
                        <td className="px-3 py-2">{lot.net_weight_kg} kg</td>
                        <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                        <td className="px-3 py-2">{lot.lab_score || "-"}</td>
                        <td className="px-3 py-2">
                          <button
                            className="rounded border border-leaf px-3 py-1 text-xs font-semibold text-leaf hover:bg-emerald-50"
                            onClick={() => selectApprovedLot(lot)}
                          >
                            Registrar compra
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={registerPurchase}>
            <h2 className="text-sm font-semibold text-slate-800">Pago de lote</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedLot ? `Lote seleccionado: ${selectedLot.code}` : "Seleccione un lote aprobado."}
            </p>

            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Precio por kg"
                type="number"
                step="0.01"
                value={purchaseForm.purchasePricePerKg}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, purchasePricePerKg: event.target.value })}
              />
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={purchaseForm.paymentMethodId}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, paymentMethodId: event.target.value })}
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
                placeholder="Referencia de pago"
                value={purchaseForm.paymentReference}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, paymentReference: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={purchaseForm.paidAt}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, paidAt: event.target.value })}
              />
              <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Total estimado: <span className="font-semibold text-ink">COP {purchaseTotal}</span>
              </div>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={saving || !selectedLot}
              >
                <Save size={16} />
                Registrar pago y activar lote
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Inventario disponible</h2>
        </div>
        {lots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin lotes disponibles" message="Cuando haya inventario disponible aparecera aqui." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Perfil</th>
                  <th className="px-3 py-2">Disponible</th>
                  <th className="px-3 py-2">Humedad</th>
                  <th className="px-3 py-2">Factor</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2 font-medium">{lot.code}</td>
                    <td className="px-3 py-2">{lot.coffee_type_name || "-"}</td>
                    <td className="px-3 py-2">{lot.coffee_profile_name || "-"}</td>
                    <td className="px-3 py-2">{lot.available_weight_kg} kg</td>
                    <td className="px-3 py-2">{lot.humidity_percent || "-"}%</td>
                    <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge>{lot.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default InventoryPage;
