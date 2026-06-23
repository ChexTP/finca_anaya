import { RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";

const initialSupplier = {
  name: "",
  phone: "",
  address: "",
  originZone: "",
  notes: "",
};

const initialLot = {
  supplierId: "",
  coffeeTypeId: "",
  grossWeightKg: "",
  packagingTypeId: "",
  packagingQuantity: "",
  hasInnerBag: false,
  humidityPercent: "",
  performanceFactor: "",
  visualStatus: "aprobado",
  visualDefectPercent: "",
  visualNotes: "",
  originZone: "",
  initialComment: "",
};

const WarehousePage = () => {
  const [catalogs, setCatalogs] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [pendingLots, setPendingLots] = useState([]);
  const [rejectedLots, setRejectedLots] = useState([]);
  const [supplierForm, setSupplierForm] = useState(initialSupplier);
  const [lotForm, setLotForm] = useState(initialLot);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPackaging = useMemo(() => {
    return catalogs?.packagingTypes?.find((packaging) => String(packaging.id) === String(lotForm.packagingTypeId));
  }, [catalogs, lotForm.packagingTypeId]);

  const estimatedNetWeight = useMemo(() => {
    const gross = Number(lotForm.grossWeightKg || 0);
    const packages = Number(lotForm.packagingQuantity || 0);
    const tare = Number(selectedPackaging?.tare_kg || 0) * packages;
    const innerBag = lotForm.hasInnerBag ? 0.05 * packages : 0;
    const net = gross - tare - innerBag;
    return net > 0 ? net.toFixed(3) : "0.000";
  }, [lotForm, selectedPackaging]);

  const loadData = async () => {
    const [catalogData, supplierData, lotData, rejectedData] = await Promise.all([
      apiRequest("/catalogs"),
      apiRequest("/suppliers"),
      apiRequest("/lots?status=pendiente_laboratorio"),
      apiRequest("/lots?status=rechazado"),
    ]);
    setCatalogs(catalogData);
    setSuppliers(supplierData);
    setPendingLots(lotData);
    setRejectedLots(rejectedData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const createSupplier = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      await apiRequest("/suppliers", {
        method: "POST",
        body: JSON.stringify(supplierForm),
      });
      setSupplierForm(initialSupplier);
      await loadData();
      setMessage("Proveedor creado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const createLot = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      await apiRequest("/lots/received", {
        method: "POST",
        body: JSON.stringify({
          ...lotForm,
          supplierId: Number(lotForm.supplierId),
          coffeeTypeId: Number(lotForm.coffeeTypeId),
          grossWeightKg: Number(lotForm.grossWeightKg),
          packagingTypeId: Number(lotForm.packagingTypeId),
          packagingQuantity: Number(lotForm.packagingQuantity),
          humidityPercent: Number(lotForm.humidityPercent),
          performanceFactor: lotForm.performanceFactor === "" ? null : Number(lotForm.performanceFactor),
          visualDefectPercent: lotForm.visualDefectPercent === "" ? null : Number(lotForm.visualDefectPercent),
        }),
      });
      setLotForm(initialLot);
      await loadData();
      setMessage(
        lotForm.visualStatus === "aprobado"
          ? "Cafe recibido correctamente. Quedo pendiente de laboratorio."
          : "Cafe rechazado registrado correctamente con codigo de lote."
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const withdrawRejectedLot = async (lot) => {
    const notes = window.prompt(`Observacion de retiro para ${lot.code}`, "Retirado por proveedor");

    if (notes === null) return;

    const confirmed = window.confirm(`Confirmas marcar el lote ${lot.code} como retirado?`);

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/lots/${lot.id}/withdraw-rejected`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });
      await loadData();
      setMessage("Lote rechazado marcado como retirado.");
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
          <h1 className="text-xl font-bold text-ink">Bodega</h1>
          <p className="text-sm text-slate-500">Recepcion de cafe y lotes pendientes de laboratorio.</p>
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

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createSupplier}>
            <h2 className="text-sm font-semibold text-slate-800">Proveedor rapido</h2>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nombre de finca o proveedor"
                value={supplierForm.name}
                onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Telefono"
                value={supplierForm.phone}
                onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Direccion"
                value={supplierForm.address}
                onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Zona de procedencia"
                value={supplierForm.originZone}
                onChange={(event) => setSupplierForm({ ...supplierForm, originZone: event.target.value })}
              />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
                <Save size={16} />
                Guardar proveedor
              </button>
            </div>
          </form>

          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">Peso estimado</h2>
            <p className="mt-2 text-3xl font-bold text-ink">{estimatedNetWeight} kg</p>
            <p className="text-sm text-slate-500">Peso neto calculado con empaque y bolsa interna.</p>
          </div>
        </div>

        <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createLot}>
          <h2 className="text-sm font-semibold text-slate-800">Ingresar cafe recibido</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.supplierId}
              onChange={(event) => setLotForm({ ...lotForm, supplierId: event.target.value })}
            >
              <option value="">Proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.coffeeTypeId}
              onChange={(event) => setLotForm({ ...lotForm, coffeeTypeId: event.target.value })}
            >
              <option value="">Tipo de cafe</option>
              {catalogs?.coffeeTypes?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Peso bruto kg"
              type="number"
              step="0.001"
              value={lotForm.grossWeightKg}
              onChange={(event) => setLotForm({ ...lotForm, grossWeightKg: event.target.value })}
            />
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.packagingTypeId}
              onChange={(event) => setLotForm({ ...lotForm, packagingTypeId: event.target.value })}
            >
              <option value="">Empaque</option>
              {catalogs?.packagingTypes?.map((packaging) => (
                <option key={packaging.id} value={packaging.id}>
                  {packaging.name}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Cantidad de empaques"
              type="number"
              value={lotForm.packagingQuantity}
              onChange={(event) => setLotForm({ ...lotForm, packagingQuantity: event.target.value })}
            />
            <label className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={lotForm.hasInnerBag}
                onChange={(event) => setLotForm({ ...lotForm, hasInnerBag: event.target.checked })}
              />
              Tiene bolsa interna
            </label>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Humedad %"
              type="number"
              step="0.01"
              value={lotForm.humidityPercent}
              onChange={(event) => setLotForm({ ...lotForm, humidityPercent: event.target.value })}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Factor de rendimiento"
              type="number"
              step="0.01"
              value={lotForm.performanceFactor}
              onChange={(event) => setLotForm({ ...lotForm, performanceFactor: event.target.value })}
            />
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lotForm.visualStatus}
              onChange={(event) => setLotForm({ ...lotForm, visualStatus: event.target.value })}
            >
              <option value="aprobado">Visual aprobado</option>
              <option value="rechazado">Visual rechazado</option>
            </select>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Defecto visual %"
              type="number"
              step="0.01"
              value={lotForm.visualDefectPercent}
              onChange={(event) => setLotForm({ ...lotForm, visualDefectPercent: event.target.value })}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Zona de procedencia"
              value={lotForm.originZone}
              onChange={(event) => setLotForm({ ...lotForm, originZone: event.target.value })}
            />
            <textarea
              className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Observaciones visuales"
              value={lotForm.visualNotes}
              onChange={(event) => setLotForm({ ...lotForm, visualNotes: event.target.value })}
            />
            <textarea
              className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Comentario inicial del lote"
              value={lotForm.initialComment}
              onChange={(event) => setLotForm({ ...lotForm, initialComment: event.target.value })}
            />
          </div>
          <button className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
            <Save size={16} />
            Registrar cafe
          </button>
        </form>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Pendientes de laboratorio</h2>
        </div>
        {pendingLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin pendientes" message="Los lotes aprobados visualmente apareceran aqui." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Peso neto</th>
                  <th className="px-3 py-2">Humedad</th>
                  <th className="px-3 py-2">Factor rendimiento</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingLots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2 font-medium">{lot.code}</td>
                    <td className="px-3 py-2">{lot.supplier_name}</td>
                    <td className="px-3 py-2">{lot.net_weight_kg} kg</td>
                    <td className="px-3 py-2">{lot.humidity_percent}%</td>
                    <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone="warning">{lot.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Rechazados pendientes de retiro</h2>
        </div>
        {rejectedLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin rechazados en bodega" message="Los lotes rechazados que sigan ocupando espacio apareceran aqui." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Peso neto</th>
                  <th className="px-3 py-2">Humedad</th>
                  <th className="px-3 py-2">Factor</th>
                  <th className="px-3 py-2">Dias en bodega</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rejectedLots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2 font-medium">{lot.code}</td>
                    <td className="px-3 py-2">{lot.supplier_name || "-"}</td>
                    <td className="px-3 py-2">{lot.net_weight_kg} kg</td>
                    <td className="px-3 py-2">{lot.humidity_percent ?? "-"}%</td>
                    <td className="px-3 py-2">{lot.performance_factor ?? "-"}</td>
                    <td className="px-3 py-2">{lot.days_in_warehouse ?? 0}</td>
                    <td className="px-3 py-2">
                      <button
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        type="button"
                        onClick={() => withdrawRejectedLot(lot)}
                        disabled={saving}
                      >
                        Marcar retirado
                      </button>
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

export default WarehousePage;
