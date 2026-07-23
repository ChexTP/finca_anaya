import { Eye, FileDown, Plus, RefreshCw, Save, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { calculateOperationalKg, formatOperationalKg } from "../../utils/coffeeCalculations";
import { openCommercialDocumentPrint } from "../../utils/commercialDocuments";
import { getQuoteNextAction, quoteStatusLabels } from "../../utils/workflow";

const initialQuote = {
  clientId: "",
  quoteType: "inventario_disponible",
  status: "borrador",
  currency: "COP",
  paymentTerms: "",
  deliveryTerms: "",
  shippingCost: "0",
  estimatedDeliveryDate: "",
  notes: "",
};

const initialItem = {
  itemType: "Exotico",
  lotId: "",
  coffeeTypeId: "",
  coffeeProfileId: "",
  description: "",
  productForm: "Excelso",
  processType: "Lavado",
  variety: "",
  quantityKg: "",
  unitPrice: "",
};

const initialSale = {
  paymentStatus: "pendiente_pago",
  amountPaid: "0",
  estimatedPaymentDate: new Date().toISOString().slice(0, 10),
  externalInvoiceReference: "",
  paymentMethodId: "",
  paymentReference: "",
  paidAt: new Date().toISOString().slice(0, 10),
  notes: "",
};

const initialQuickClient = {
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
};

const quoteFilters = [
  { key: "all", label: "Todas" },
  { key: "borrador", label: "Borradores" },
  { key: "enviada", label: "Enviadas" },
  { key: "aceptada", label: "Aceptadas" },
  { key: "anulada", label: "Anuladas" },
];

const formatMoney = (currency, value) => `${currency} ${Number(value || 0).toLocaleString("es-CO")}`;

const CommercialPage = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteForm, setQuoteForm] = useState(initialQuote);
  const [itemForm, setItemForm] = useState(initialItem);
  const [quoteItems, setQuoteItems] = useState([]);
  const [saleForm, setSaleForm] = useState(initialSale);
  const [quickClientForm, setQuickClientForm] = useState(initialQuickClient);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quoteFilter, setQuoteFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    const savedItemsTotal = quoteItems.reduce((sum, item) => sum + Number(item.quantityKg) * Number(item.unitPrice), 0);
    return savedItemsTotal + Number(itemForm.quantityKg || 0) * Number(itemForm.unitPrice || 0);
  }, [itemForm.quantityKg, itemForm.unitPrice, quoteItems]);

  const total = useMemo(() => {
    return subtotal + Number(quoteForm.shippingCost || 0);
  }, [subtotal, quoteForm.shippingCost]);

  const itemOperationalKg = useMemo(() => {
    return calculateOperationalKg({
      quantityKg: itemForm.quantityKg,
      productForm: itemForm.productForm,
      processType: itemForm.processType,
    });
  }, [itemForm.quantityKg, itemForm.productForm, itemForm.processType]);

  const canConvertToSale = ["admin", "accounting"].includes(user?.role);

  const quoteCounts = useMemo(() => {
    return quotes.reduce(
      (counts, quote) => ({
        ...counts,
        all: counts.all + 1,
        [quote.status]: (counts[quote.status] || 0) + 1,
      }),
      { all: 0 }
    );
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => quoteFilter === "all" || quote.status === quoteFilter);
  }, [quotes, quoteFilter]);

  const loadData = async () => {
    const [quoteData, clientData, catalogData] = await Promise.all([
      apiRequest("/quotes"),
      apiRequest("/clients"),
      apiRequest("/catalogs"),
    ]);
    setQuotes(quoteData);
    setClients(clientData);
    setCatalogs(catalogData);
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const updateItemType = (itemType) => {
    setItemForm({
      ...initialItem,
      itemType,
      productForm: itemForm.productForm,
      processType: itemForm.processType,
      variety: itemForm.variety,
      description: itemForm.description,
      unitPrice: itemForm.unitPrice,
      quantityKg: itemForm.quantityKg,
    });
  };

  const selectProfile = (profileId) => {
    const profile = catalogs?.coffeeProfiles?.find((currentProfile) => String(currentProfile.id) === String(profileId));
    const basePrice = quoteForm.currency === "USD" ? profile?.base_price_usd : profile?.base_price_cop;

    setItemForm({
      ...itemForm,
      coffeeProfileId: profileId,
      unitPrice: basePrice && Number(basePrice) > 0 ? String(basePrice) : itemForm.unitPrice,
    });
  };

  const buildItem = () => {
    if (!itemForm.quantityKg || itemForm.unitPrice === "") {
      throw new Error("Cada cafe debe tener cantidad y precio por kg.");
    }

    if (itemForm.itemType !== "description" && !itemForm.coffeeProfileId) {
      throw new Error("Seleccione el cafe solicitado.");
    }

    if (itemForm.itemType === "description" && !itemForm.description.trim()) {
      throw new Error("Ingrese la descripcion del cafe solicitado.");
    }

    const item = {
      quantityKg: Number(itemForm.quantityKg),
      operationalWeightKg: calculateOperationalKg({
        quantityKg: itemForm.quantityKg,
        productForm: itemForm.productForm,
        processType: itemForm.processType,
      }),
      unitPrice: Number(itemForm.unitPrice),
      description: itemForm.description || null,
      productForm: itemForm.productForm,
      processType: itemForm.processType,
      variety: itemForm.variety || null,
    };

    if (itemForm.itemType !== "description") item.coffeeProfileId = Number(itemForm.coffeeProfileId);
    return item;
  };

  const addAnotherCoffee = () => {
    try {
      setQuoteItems((currentItems) => [...currentItems, buildItem()]);
      setItemForm(initialItem);
      setError("");
    } catch (itemError) {
      setError(itemError.message);
    }
  };

  const createQuote = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const items = itemForm.quantityKg ? [...quoteItems, buildItem()] : quoteItems;
      if (items.length === 0) throw new Error("Agregue al menos un cafe a la cotizacion.");
      const response = await apiRequest("/quotes", {
        method: "POST",
        body: JSON.stringify({
          ...quoteForm,
          clientId: Number(quoteForm.clientId),
          shippingCost: Number(quoteForm.shippingCost || 0),
          items,
        }),
      });
      setQuoteForm(initialQuote);
      setItemForm(initialItem);
      setQuoteItems([]);
      await loadData();
      setSelectedQuote(response.data);
      setMessage("Cotizacion creada correctamente. Ya puede descargar el PDF desde el detalle.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const createQuickClient = async () => {
    if (!quickClientForm.name || !quickClientForm.phone || !quickClientForm.address) {
      setError("Nombre, telefono y direccion son obligatorios para crear el cliente.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest("/clients", {
        method: "POST",
        body: JSON.stringify(quickClientForm),
      });
      const createdClient = response.data;
      setQuickClientForm(initialQuickClient);
      setShowQuickClient(false);
      await loadData();
      setQuoteForm((currentForm) => ({ ...currentForm, clientId: String(createdClient.id) }));
      setMessage("Cliente creado y seleccionado para la cotizacion.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const loadQuoteDetail = async (quoteId) => {
    const quote = await apiRequest(`/quotes/${quoteId}`);
    setSelectedQuote(quote);
    setSaleForm({
      ...initialSale,
      amountPaid: quote.status === "aceptada" ? String(quote.total) : "0",
      paymentStatus: quote.status === "aceptada" ? "pagada" : "pendiente_pago",
    });
    setMessage("");
    setError("");
  };

  const updateQuoteStatus = async (quote, status) => {
    const confirmed = window.confirm(`Confirma cambiar la cotizacion ${quote.code} a ${status}?`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/quotes/${quote.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await loadData();
      await loadQuoteDetail(quote.id);
      setMessage("Estado de cotizacion actualizado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const printQuotePdf = async (quoteId) => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const document = await apiRequest(`/documents/quotes/${quoteId}`);
      openCommercialDocumentPrint(document);
      setMessage("Cotizacion abierta para imprimir o guardar como PDF.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const convertQuoteToSale = async (event) => {
    event.preventDefault();

    if (!selectedQuote) {
      setError("Seleccione una cotizacion aceptada.");
      return;
    }

    const confirmed = window.confirm(`Confirma convertir ${selectedQuote.code} en venta?`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/from-quote/${selectedQuote.id}`, {
        method: "POST",
        body: JSON.stringify({
          ...saleForm,
          amountPaid: Number(saleForm.amountPaid || 0),
          paymentMethodId: saleForm.paymentMethodId ? Number(saleForm.paymentMethodId) : null,
        }),
      });
      await loadData();
      await loadQuoteDetail(selectedQuote.id);
      setMessage("Cotizacion convertida en venta correctamente.");
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
          <h1 className="text-xl font-bold text-ink">Comercial</h1>
          <p className="text-sm text-slate-500">Cotizaciones, preventas y seguimiento comercial.</p>
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
          <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createQuote}>
            <div className="flex items-center gap-2">
              <Plus size={17} className="text-leaf" />
              <h2 className="text-sm font-semibold text-slate-800">Nueva cotizacion</h2>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={quoteForm.clientId}
                onChange={(event) => setQuoteForm({ ...quoteForm, clientId: event.target.value })}
              >
                <option value="">Cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => setShowQuickClient((currentValue) => !currentValue)}
              >
                <UserPlus size={16} />
                Crear cliente rapido
              </button>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={quoteForm.quoteType}
                onChange={(event) => setQuoteForm({ ...quoteForm, quoteType: event.target.value })}
              >
                <option value="inventario_disponible">Inventario disponible</option>
                <option value="preventa">Preventa</option>
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={quoteForm.status}
                onChange={(event) => setQuoteForm({ ...quoteForm, status: event.target.value })}
              >
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aceptada">Aceptada</option>
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={quoteForm.currency}
                onChange={(event) => setQuoteForm({ ...quoteForm, currency: event.target.value })}
              >
                <option value="COP">COP</option>
                <option value="USD">USD</option>
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Costo de envio"
                type="number"
                step="0.01"
                value={quoteForm.shippingCost}
                onChange={(event) => setQuoteForm({ ...quoteForm, shippingCost: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={quoteForm.estimatedDeliveryDate}
                onChange={(event) => setQuoteForm({ ...quoteForm, estimatedDeliveryDate: event.target.value })}
                required
                aria-label="Fecha de entrega"
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Condiciones de pago"
                value={quoteForm.paymentTerms}
                onChange={(event) => setQuoteForm({ ...quoteForm, paymentTerms: event.target.value })}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Condiciones de entrega"
                value={quoteForm.deliveryTerms}
                onChange={(event) => setQuoteForm({ ...quoteForm, deliveryTerms: event.target.value })}
              />
            </div>

            {showQuickClient && (
              <div className="mt-4 rounded border border-emerald-100 bg-emerald-50 p-3">
                <h3 className="text-sm font-semibold text-slate-800">Cliente rapido</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nombre"
                    value={quickClientForm.name}
                    onChange={(event) => setQuickClientForm({ ...quickClientForm, name: event.target.value })}
                    required
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Telefono"
                    value={quickClientForm.phone}
                    onChange={(event) => setQuickClientForm({ ...quickClientForm, phone: event.target.value })}
                    required
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Direccion"
                    value={quickClientForm.address}
                    onChange={(event) => setQuickClientForm({ ...quickClientForm, address: event.target.value })}
                    required
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Tipo documento"
                    value={quickClientForm.documentType}
                    onChange={(event) => setQuickClientForm({ ...quickClientForm, documentType: event.target.value })}
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Numero documento"
                    value={quickClientForm.documentNumber}
                    onChange={(event) => setQuickClientForm({ ...quickClientForm, documentNumber: event.target.value })}
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ciudad"
                    value={quickClientForm.city}
                    onChange={(event) => setQuickClientForm({ ...quickClientForm, city: event.target.value })}
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Pais"
                    value={quickClientForm.country}
                    onChange={(event) => setQuickClientForm({ ...quickClientForm, country: event.target.value })}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={saving}
                    type="button"
                    onClick={createQuickClient}
                  >
                    <Save size={16} />
                    Guardar cliente
                  </button>
                  <button
                    className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                    type="button"
                    onClick={() => setShowQuickClient(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 rounded border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">Cafe solicitado</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={itemForm.productForm}
                  onChange={(event) => setItemForm({ ...itemForm, productForm: event.target.value })}
                >
                  <option value="Excelso">Excelso</option>
                  <option value="Pergamino">Pergamino</option>
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={itemForm.processType}
                  onChange={(event) => setItemForm({ ...itemForm, processType: event.target.value })}
                >
                  <option value="Lavado">Lavado</option>
                  <option value="Natural">Natural</option>
                  <option value="Semilavado">Semilavado</option>
                </select>
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  value={itemForm.itemType}
                  onChange={(event) => updateItemType(event.target.value)}
                >
                  <option value="Regional">Regional</option>
                  <option value="Varietal">Varietal</option>
                  <option value="Exotico">Exotico</option>
                  <option value="description">Descripcion libre</option>
                </select>

                {itemForm.itemType !== "description" && (
                  <select
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    value={itemForm.coffeeProfileId}
                    onChange={(event) => selectProfile(event.target.value)}
                  >
                    <option value="">Cafe {itemForm.itemType.toLowerCase()}</option>
                    {catalogs?.coffeeProfiles
                      ?.filter((profile) => profile.category === itemForm.itemType)
                      .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                      ))}
                  </select>
                )}

                {itemForm.itemType === "description" && (
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Descripcion del cafe solicitado"
                  value={itemForm.description}
                  onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })}
                />
                )}
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Variedad (opcional)"
                  value={itemForm.variety}
                  onChange={(event) => setItemForm({ ...itemForm, variety: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Cantidad kg"
                  type="number"
                  step="0.001"
                  value={itemForm.quantityKg}
                  onChange={(event) => setItemForm({ ...itemForm, quantityKg: event.target.value })}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Precio por kg"
                  type="number"
                  step="0.01"
                  value={itemForm.unitPrice}
                  onChange={(event) => setItemForm({ ...itemForm, unitPrice: event.target.value })}
                />
              </div>
              {Number(itemForm.quantityKg || 0) > 0 && (
                <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Bodega vera como referencia operativa:{" "}
                  <span className="font-semibold">{formatOperationalKg(itemOperationalKg)}</span>
                  {itemForm.productForm === "Excelso" && itemForm.processType === "Semilavado" && (
                    <span className="ml-1 text-xs text-amber-700">
                      (semilavado sin factor confirmado; se mantiene igual por ahora)
                    </span>
                  )}
                </div>
              )}
              {quoteItems.length > 0 && (
                <div className="mt-3 divide-y divide-slate-200 rounded border border-slate-200">
                  {quoteItems.map((item, index) => (
                    <div key={`${item.productForm}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">
                          Cafe {index + 1}: {item.productForm} · {item.processType}
                        </p>
                        <p className="text-slate-500">
                          {item.description || item.variety || "Perfil seleccionado"} · {item.quantityKg} kg
                          {item.operationalWeightKg && item.operationalWeightKg !== item.quantityKg
                            ? ` · ${item.operationalWeightKg} kg operativos`
                            : ""}
                        </p>
                      </div>
                      <button
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-600"
                        type="button"
                        title="Quitar cafe"
                        onClick={() => setQuoteItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="mt-3 inline-flex items-center gap-2 rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50"
                type="button"
                onClick={addAnotherCoffee}
              >
                <Plus size={16} />
                Agregar otro cafe
              </button>
              <div className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Subtotal: <span className="font-semibold text-ink">{formatMoney(quoteForm.currency, subtotal)}</span> · Total:{" "}
                <span className="font-semibold text-ink">{formatMoney(quoteForm.currency, total)}</span>
              </div>
            </div>

            <textarea
              className="mt-3 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notas"
              value={quoteForm.notes}
              onChange={(event) => setQuoteForm({ ...quoteForm, notes: event.target.value })}
            />
            <button className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
              <Save size={16} />
              Guardar cotizacion
            </button>
          </form>

          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Historial</h2>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {quoteFilters.map((filter) => (
                  <button
                    key={filter.key}
                    className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold ${
                      quoteFilter === filter.key
                        ? "border-leaf bg-emerald-50 text-leaf"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    type="button"
                    onClick={() => setQuoteFilter(filter.key)}
                  >
                    {filter.label} ({quoteCounts[filter.key] || 0})
                  </button>
                ))}
              </div>
            </div>
            {filteredQuotes.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Sin cotizaciones" message="Las cotizaciones del vendedor apareceran aqui." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Siguiente paso</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotes.map((quote) => (
                      <tr key={quote.id}>
                        <td className="px-3 py-2 font-medium">{quote.code}</td>
                        <td className="px-3 py-2">{quote.client_name}</td>
                        <td className="px-3 py-2">{quote.quote_type}</td>
                        <td className="px-3 py-2">
                          <StatusBadge>{quoteStatusLabels[quote.status] || quote.status}</StatusBadge>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{getQuoteNextAction(quote)}</td>
                        <td className="px-3 py-2">{formatMoney(quote.currency, quote.total)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                              onClick={() => loadQuoteDetail(quote.id)}
                              type="button"
                            >
                              <Eye size={14} />
                              Ver
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded border border-leaf bg-emerald-50 px-2 py-1 text-xs font-semibold text-leaf hover:bg-emerald-100 disabled:opacity-60"
                              disabled={saving}
                              onClick={() => printQuotePdf(quote.id)}
                              type="button"
                            >
                              <FileDown size={14} />
                              PDF
                            </button>
                          </div>
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
          <h2 className="text-sm font-semibold text-slate-800">Detalle</h2>
          {!selectedQuote ? (
            <div className="mt-3">
              <EmptyState title="Seleccione una cotizacion" message="Aqui vera productos y cambios de estado." />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold text-ink">{selectedQuote.code}</p>
                <p className="text-sm text-slate-500">{selectedQuote.client_name}</p>
                <p className="text-sm text-slate-500">{selectedQuote.client_phone || "Sin telefono"}</p>
                <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  {getQuoteNextAction(selectedQuote)}
                </p>
              </div>
              <div className="rounded bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">Subtotal: {formatMoney(selectedQuote.currency, selectedQuote.subtotal)}</p>
                <p className="text-slate-500">Envio: {formatMoney(selectedQuote.currency, selectedQuote.shipping_cost)}</p>
                <p className="font-semibold text-ink">Total: {formatMoney(selectedQuote.currency, selectedQuote.total)}</p>
              </div>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                disabled={saving}
                onClick={() => printQuotePdf(selectedQuote.id)}
                type="button"
              >
                <FileDown size={17} />
                Imprimir / guardar PDF de cotizacion
              </button>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedQuote.items?.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-ink">
                      {item.description || item.coffee_profile_name || item.coffee_type_name || item.lot_code}
                    </p>
                    <p className="text-slate-500">
                      {[item.product_form, item.process_type, item.variety].filter(Boolean).join(" · ") || "Sin detalle"} · {item.quantity_kg} kg · {formatMoney(selectedQuote.currency, item.unit_price)}
                      {item.operational_weight_kg && Number(item.operational_weight_kg) !== Number(item.quantity_kg)
                        ? ` · ${item.operational_weight_kg} kg operativos`
                        : ""}
                    </p>
                    {item.coffee_profile_category === "Exotico" && (item.process_purchase_coffee_name || item.base_purchase_coffee_name) && (
                      <p className="mt-1 text-xs text-amber-700">
                        Ensamble sugerido: {item.process_purchase_coffee_name || "-"} {item.process_percentage || "-"}% / {item.base_purchase_coffee_name || "-"} {item.base_percentage || "-"}%
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={saving || selectedQuote.status === "enviada"}
                  onClick={() => updateQuoteStatus(selectedQuote, "enviada")}
                >
                  Enviada
                </button>
                <button
                  className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={saving || selectedQuote.status === "aceptada"}
                  onClick={() => updateQuoteStatus(selectedQuote, "aceptada")}
                >
                  Aceptada
                </button>
                <button
                  className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  disabled={saving || selectedQuote.status === "anulada"}
                  onClick={() => updateQuoteStatus(selectedQuote, "anulada")}
                >
                  Anular
                </button>
              </div>

              {canConvertToSale && selectedQuote.status === "aceptada" && (
                <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={convertQuoteToSale}>
                  <p className="text-xs font-semibold uppercase text-slate-500">Convertir en venta</p>
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={saleForm.paymentStatus}
                    onChange={(event) => setSaleForm({ ...saleForm, paymentStatus: event.target.value })}
                  >
                    <option value="pagada">Pagada</option>
                    <option value="pago_parcial">Pago parcial</option>
                    <option value="pendiente_pago">Pendiente de pago</option>
                  </select>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Valor pagado"
                    type="number"
                    step="0.01"
                    value={saleForm.amountPaid}
                    onChange={(event) => setSaleForm({ ...saleForm, amountPaid: event.target.value })}
                  />
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Fecha estimada de pago"
                    type="date"
                    value={saleForm.estimatedPaymentDate}
                    onChange={(event) => setSaleForm({ ...saleForm, estimatedPaymentDate: event.target.value })}
                  />
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Referencia factura externa opcional"
                    value={saleForm.externalInvoiceReference}
                    onChange={(event) => setSaleForm({ ...saleForm, externalInvoiceReference: event.target.value })}
                  />
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={saleForm.paymentMethodId}
                    onChange={(event) => setSaleForm({ ...saleForm, paymentMethodId: event.target.value })}
                  >
                    <option value="">Metodo si hay pago</option>
                    {catalogs?.paymentMethods?.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Referencia si hay pago"
                    value={saleForm.paymentReference}
                    onChange={(event) => setSaleForm({ ...saleForm, paymentReference: event.target.value })}
                  />
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    type="date"
                    value={saleForm.paidAt}
                    onChange={(event) => setSaleForm({ ...saleForm, paidAt: event.target.value })}
                  />
                  <textarea
                    className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notas de venta"
                    value={saleForm.notes}
                    onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })}
                  />
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
                    <Save size={16} />
                    Crear venta
                  </button>
                </form>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default CommercialPage;
