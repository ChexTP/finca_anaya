import { Edit, Eye, FileDown, FlaskConical, Plus, RefreshCw, Save, Trash2, UserPlus, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import {
  calculateOperationalKg,
  formatOperationalKg,
  formatQuantityInputValue,
  formatRequestedKg,
} from "../../utils/coffeeCalculations";
import { openCommercialDocumentPrint } from "../../utils/commercialDocuments";
import { getQuoteNextAction, quoteStatusLabels } from "../../utils/workflow";

const defaultQuoteTerms = {
  advance: "30%",
  deliveryTime: "20 dias",
  standard: "3/20 UGQ o EP",
  deliveryTerms: "Contraentrega en Pitalito Huila",
  packaging: "Tula y bolsa tradicional",
  paymentTerms: "Consignacion nacional",
  bankDetails: "Bancolombia - Ahorros - 453 0000 6876",
  company: "Asociacion Huila Coffee Farmers",
  taxId: "901847571",
};

const quoteTermOptions = {
  advance: ["20%", "30%", "40%", "50%"],
  deliveryTime: ["8 dias", "20 dias"],
  standard: ["0/20 UGQ o EP", "3/20 UGQ o EP", "8/35 UGQ o EP", "12/60 UGQ o EP"],
  deliveryTerms: ["Contraentrega en Pitalito Huila"],
  packaging: [
    "Tula y bolsa tradicional",
    "Empaque al vacio 20kg o 24kg",
    "Sacos por 70kg mas bolsa",
    "Sacos por 35kg mas bolsa",
  ],
};

const initialQuote = {
  manualCodeNumber: "",
  manualCodeYear: String(new Date().getFullYear()),
  clientId: "",
  quoteType: "preventa",
  status: "enviada",
  currency: "COP",
  paymentTerms: "",
  deliveryTerms: "",
  terms: defaultQuoteTerms,
  shippingCost: "",
  estimatedDeliveryDate: "",
  notes: "",
};

const today = new Date().toISOString().slice(0, 10);

const initialSample = {
  manualCodeNumber: "",
  manualCodeYear: String(new Date().getFullYear()),
  requesterName: "",
  requesterPhone: "",
  requesterEmail: "",
  requesterCompany: "",
  requesterAddress: "",
  requesterCity: "",
  requesterCountry: "",
  coffeeTypeId: "",
  coffeeProfileId: "",
  description: "",
  quantityGrams: "",
  requestedAt: today,
  tentativeDeliveryDate: "",
  notes: "",
  status: "enviada",
};

const emptySampleItem = {
  coffeeTypeId: "",
  coffeeProfileId: "",
  description: "",
  quantityGrams: "",
};

const createInitialQuote = () => ({
  ...initialQuote,
  terms: { ...defaultQuoteTerms },
});

const initialItem = {
  itemType: "Exotico",
  lotId: "",
  coffeeTypeId: "",
  coffeeProfileId: "",
  purchaseCoffeeId: "",
  description: "",
  productForm: "Excelso",
  processType: "Lavado",
  variety: "",
  quantityKg: "",
  quantityUnit: "kg",
  unitPrice: "",
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
  { key: "enviada", label: "Enviadas" },
  { key: "aceptada", label: "Aceptadas" },
  { key: "anulada", label: "Anuladas" },
];

const formatMoney = (currency, value) => `${currency || "COP"} ${Number(value || 0).toLocaleString("es-CO")}`;
const poundsToKg = (value) => Number(value || 0) * 0.45359237;
const toItemQuantityKg = (item) => (
  item.quantityUnit === "lb" ? poundsToKg(item.quantityKg) : Number(item.quantityKg || 0)
);

const formatProfileOptionLabel = (profile) => {
  const code = profile?.internal_code || profile?.coffee_profile_code || profile?.code;
  return [code, profile?.name].filter(Boolean).join(" - ");
};

const getCodeFromForm = (form, prefix) => {
  if (!form.manualCodeNumber) return null;

  return `${prefix}-${form.manualCodeYear || new Date().getFullYear()}-${String(Number(form.manualCodeNumber) || 0).padStart(4, "0")}`;
};

const getQuoteCodeFromForm = (form) => {
  return getCodeFromForm(form, "COT");
};

const getCodeParts = (code, prefix = "COT") => {
  const match = String(code || "").match(new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`, "i"));

  return {
    manualCodeYear: match?.[1] || String(new Date().getFullYear()),
    manualCodeNumber: match?.[2] ? String(Number(match[2])) : "",
  };
};

const getItemLabel = (item, catalogs) => {
  if (item.description) return item.description;

  const profile = catalogs?.coffeeProfiles?.find((profileItem) => String(profileItem.id) === String(item.coffeeProfileId || item.coffee_profile_id));
  if (profile) return profile.name;

  if (item.coffee_profile_name) return item.coffee_profile_name;
  if (item.coffeeTypeName || item.coffee_type_name) return item.coffeeTypeName || item.coffee_type_name;

  return item.variety || "Cafe solicitado";
};

const itemFromQuoteItem = (item) => ({
  itemType: item.coffee_profile_category || (item.description ? "description" : "Exotico"),
  lotId: item.lot_id ? String(item.lot_id) : "",
  coffeeTypeId: item.coffee_type_id ? String(item.coffee_type_id) : "",
  coffeeProfileId: item.coffee_profile_id ? String(item.coffee_profile_id) : "",
  description: item.description || "",
  productForm: item.product_form || "Excelso",
  processType: item.process_type || "Lavado",
  variety: item.variety || "",
  quantityKg: formatQuantityInputValue(item.quantity_kg),
  unitPrice: item.unit_price || "",
});

const CommercialPage = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [samples, setSamples] = useState([]);
  const [clients, setClients] = useState([]);
  const [catalogs, setCatalogs] = useState(null);
  const [codeCounters, setCodeCounters] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [formMode, setFormMode] = useState("quote");
  const [quoteForm, setQuoteForm] = useState(createInitialQuote);
  const [itemForm, setItemForm] = useState(initialItem);
  const [quoteItems, setQuoteItems] = useState([]);
  const [sampleForm, setSampleForm] = useState(initialSample);
  const [sampleItems, setSampleItems] = useState([]);
  const [quickClientForm, setQuickClientForm] = useState(initialQuickClient);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quoteFilter, setQuoteFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formPanelRef = useRef(null);
  const detailPanelRef = useRef(null);

  const canConvertToSale = ["admin", "accounting"].includes(user?.role);
  const canDeleteRecords = user?.role === "admin";
  const termInputClass = "rounded border border-amber-200 bg-white px-3 py-2 text-sm font-normal normal-case text-ink";
  const termLabelClass = "grid gap-1 text-xs font-semibold uppercase text-amber-900";

  const scrollToPanel = (panelRef) => {
    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const showErrorAlert = (messageText) => {
    setError(messageText);
  };

  const updateQuoteTerm = (field, value) => {
    setQuoteForm((currentForm) => ({
      ...currentForm,
      terms: {
        ...(currentForm.terms || defaultQuoteTerms),
        [field]: value,
      },
    }));
  };

  const getNextCodeParts = (prefix, counters = codeCounters) => {
    const nextCode = counters.find((counter) => counter.prefix === prefix)?.nextCode;
    return getCodeParts(nextCode, prefix);
  };

  const getSampleCodeFromForm = (form) => {
    return getCodeFromForm(form, "MUE");
  };

  const itemOperationalKg = useMemo(() => calculateOperationalKg({
    quantityKg: toItemQuantityKg(itemForm),
    productForm: itemForm.productForm,
    processType: itemForm.processType,
  }), [itemForm.quantityKg, itemForm.quantityUnit, itemForm.productForm, itemForm.processType]);

  const subtotal = useMemo(() => {
    return quoteItems.reduce((total, item) => total + Number(item.quantityKg || 0) * Number(item.unitPrice || 0), 0);
  }, [quoteItems]);

  const total = useMemo(() => {
    return Number((subtotal + Number(quoteForm.shippingCost || 0)).toFixed(2));
  }, [quoteForm.shippingCost, subtotal]);

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

  const availableCoffeeOptions = useMemo(() => {
    if (itemForm.itemType === "description") return [];

    if (itemForm.itemType === "Exotico") {
      return [...(catalogs?.coffeeProfiles || [])]
        .filter((profile) => (
          profile.is_active !== false &&
          String(profile.category || "").toLowerCase() === "exotico"
        ))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "es"))
        .map((profile) => ({
          id: `profile-${profile.id}`,
          value: String(profile.id),
          label: formatProfileOptionLabel(profile),
          source: "profile",
          raw: profile,
        }));
    }

    const purchaseCoffees = [...(catalogs?.purchaseCoffees || [])]
      .filter((coffee) => (
        coffee.is_active !== false &&
        String(coffee.family || "").toLowerCase() === String(itemForm.itemType || "").toLowerCase()
      ))
      .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "es"));

    const processMatches = purchaseCoffees.filter((coffee) => (
      !itemForm.processType ||
      String(coffee.process_type || "").toLowerCase() === String(itemForm.processType || "").toLowerCase()
    ));
    const coffeesToShow = processMatches.length > 0 ? processMatches : purchaseCoffees;

    return coffeesToShow.map((coffee) => ({
      id: `purchase-${coffee.id}`,
      value: String(coffee.id),
      label: `${coffee.name}${coffee.process_type ? ` - ${coffee.process_type}` : ""}`,
      source: "purchase",
      raw: coffee,
    }));
  }, [catalogs, itemForm.itemType, itemForm.processType]);

  const loadData = async () => {
    const [quoteData, sampleData, clientData, catalogData, countersData] = await Promise.all([
      apiRequest("/quotes"),
      apiRequest("/samples"),
      apiRequest("/clients"),
      apiRequest("/catalogs"),
      apiRequest("/code-counters"),
    ]);
    setQuotes(quoteData);
    setSamples(sampleData.filter((sample) => sample.status !== "entregada"));
    setClients(clientData);
    setCatalogs(catalogData);
    setCodeCounters(countersData);
    setQuoteForm((currentForm) => (
      editingQuoteId || currentForm.clientId || quoteItems.length > 0 || itemForm.quantityKg
        ? currentForm
        : { ...currentForm, ...getCodeParts(countersData.find((counter) => counter.prefix === "COT")?.nextCode, "COT") }
    ));
    setSampleForm((currentForm) => (
      currentForm.requesterName || sampleItems.length > 0 || currentForm.quantityGrams
        ? currentForm
        : { ...currentForm, ...getCodeParts(countersData.find((counter) => counter.prefix === "MUE")?.nextCode, "MUE") }
    ));
    return { countersData };
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const resetForm = (freshCounters = codeCounters) => {
    setEditingQuoteId(null);
    setQuoteForm({ ...createInitialQuote(), ...getNextCodeParts("COT", freshCounters) });
    setItemForm(initialItem);
    setQuoteItems([]);
    setSampleForm({ ...initialSample, ...getNextCodeParts("MUE", freshCounters) });
    setSampleItems([]);
    setError("");
  };

  const updateItemType = (itemType) => {
    setItemForm({
      ...initialItem,
      itemType,
      productForm: itemForm.productForm,
      processType: itemForm.processType,
      quantityKg: itemForm.quantityKg,
      quantityUnit: itemForm.quantityUnit,
      unitPrice: itemForm.unitPrice,
    });
  };

  const getProfilePrice = (profile, currency = quoteForm.currency) => {
    const price = currency === "USD" ? profile?.base_price_usd : profile?.base_price_cop;
    return price && Number(price) > 0 ? String(price) : "";
  };

  const selectProfile = (profileId) => {
    const profile = catalogs?.coffeeProfiles?.find((profileItem) => String(profileItem.id) === String(profileId));
    const price = getProfilePrice(profile);

    setItemForm({
      ...itemForm,
      coffeeProfileId: profileId,
      purchaseCoffeeId: "",
      description: "",
      variety: profile?.name || itemForm.variety,
      unitPrice: price || itemForm.unitPrice,
    });
  };

  const selectPurchaseCoffee = (purchaseCoffeeId) => {
    const coffee = catalogs?.purchaseCoffees?.find((coffeeItem) => String(coffeeItem.id) === String(purchaseCoffeeId));
    const coffeeType = catalogs?.coffeeTypes?.find((type) => (
      String(type.name || "").toLowerCase() === String(coffee?.process_type || itemForm.processType || "").toLowerCase()
    ));

    setItemForm({
      ...itemForm,
      purchaseCoffeeId,
      coffeeProfileId: "",
      coffeeTypeId: coffeeType?.id ? String(coffeeType.id) : itemForm.coffeeTypeId,
      processType: coffee?.process_type || itemForm.processType,
      description: coffee?.name || "",
      variety: coffee?.name || "",
    });
  };

  const selectRequestedCoffee = (value) => {
    if (itemForm.itemType === "Exotico") {
      selectProfile(value);
      return;
    }

    selectPurchaseCoffee(value);
  };

  const updateRequestedProcessType = (processType) => {
    setItemForm({
      ...itemForm,
      processType,
      purchaseCoffeeId: ["Regional", "Varietal"].includes(itemForm.itemType) ? "" : itemForm.purchaseCoffeeId,
      description: ["Regional", "Varietal"].includes(itemForm.itemType) ? "" : itemForm.description,
      variety: ["Regional", "Varietal"].includes(itemForm.itemType) ? "" : itemForm.variety,
    });
  };

  const updateCurrency = (currency) => {
    const profile = catalogs?.coffeeProfiles?.find((profileItem) => String(profileItem.id) === String(itemForm.coffeeProfileId));
    const price = getProfilePrice(profile, currency);
    setQuoteForm({ ...quoteForm, currency });
    if (price) {
      setItemForm((currentItem) => ({ ...currentItem, unitPrice: price }));
    }
  };

  const buildItem = () => {
    if (!itemForm.quantityKg) throw new Error("Cada cafe debe tener cantidad.");
    if (itemForm.unitPrice === "" || itemForm.unitPrice === null || itemForm.unitPrice === undefined) {
      throw new Error("Cada cafe debe tener precio.");
    }
    if (itemForm.itemType === "Exotico" && !itemForm.coffeeProfileId) throw new Error("Seleccione el cafe solicitado.");
    if (["Regional", "Varietal"].includes(itemForm.itemType) && !itemForm.description.trim()) throw new Error("Seleccione el cafe solicitado.");
    if (itemForm.itemType === "description" && !itemForm.description.trim()) throw new Error("Ingrese la descripcion del cafe solicitado.");

    const quantityKg = toItemQuantityKg(itemForm);

    return {
      lotId: itemForm.lotId || null,
      coffeeTypeId: itemForm.coffeeTypeId || null,
      coffeeProfileId: itemForm.itemType === "Exotico" ? Number(itemForm.coffeeProfileId) : null,
      description: itemForm.description || null,
      productForm: itemForm.productForm,
      processType: itemForm.processType,
      variety: itemForm.variety || null,
      quantityKg,
      operationalWeightKg: calculateOperationalKg({
        quantityKg,
        productForm: itemForm.productForm,
        processType: itemForm.processType,
      }),
      unitPrice: Number(itemForm.unitPrice || 0),
      lineTotal: Number((quantityKg * Number(itemForm.unitPrice || 0)).toFixed(2)),
    };
  };

  const addAnotherCoffee = () => {
    try {
      const item = buildItem();
      setQuoteItems((currentItems) => [...currentItems, item]);
      setItemForm(initialItem);
      setError("");
    } catch (itemError) {
      setError(itemError.message);
    }
  };

  const removeItem = (index) => {
    setQuoteItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const editItem = (index) => {
    const item = quoteItems[index];
    setItemForm({
      ...initialItem,
      ...item,
      itemType: item.description ? "description" : item.itemType || "Exotico",
      coffeeProfileId: item.coffeeProfileId ? String(item.coffeeProfileId) : "",
      coffeeTypeId: item.coffeeTypeId ? String(item.coffeeTypeId) : "",
      lotId: item.lotId ? String(item.lotId) : "",
      quantityKg: formatQuantityInputValue(item.quantityKg),
      quantityUnit: "kg",
      unitPrice: String(item.unitPrice || ""),
    });
    removeItem(index);
  };

  const getSampleItemName = (item) => (
    [
      catalogs?.coffeeTypes?.find((type) => String(type.id) === String(item.coffeeTypeId))?.name,
      catalogs?.coffeeProfiles?.find((profile) => String(profile.id) === String(item.coffeeProfileId))?.name,
      item.description,
    ].filter(Boolean).join(" - ") || "Muestra"
  );

  const addSampleItem = () => {
    if ((!sampleForm.coffeeTypeId && !sampleForm.coffeeProfileId && !sampleForm.description.trim()) || !sampleForm.quantityGrams) {
      setError("Seleccione o describa el cafe e indique la cantidad en gramos.");
      return;
    }

    setSampleItems((currentItems) => [
      ...currentItems,
      {
        coffeeTypeId: sampleForm.coffeeTypeId ? Number(sampleForm.coffeeTypeId) : null,
        coffeeProfileId: sampleForm.coffeeProfileId ? Number(sampleForm.coffeeProfileId) : null,
        description: sampleForm.description || null,
        coffeeName: getSampleItemName(sampleForm),
        quantityGrams: Number(sampleForm.quantityGrams),
        price: null,
      },
    ]);
    setSampleForm((currentForm) => ({ ...currentForm, ...emptySampleItem }));
    setError("");
  };

  const removeSampleItem = (index) => {
    setSampleItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveSampleRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const currentItem = sampleForm.quantityGrams ? [{
        coffeeTypeId: sampleForm.coffeeTypeId ? Number(sampleForm.coffeeTypeId) : null,
        coffeeProfileId: sampleForm.coffeeProfileId ? Number(sampleForm.coffeeProfileId) : null,
        description: sampleForm.description || null,
        quantityGrams: Number(sampleForm.quantityGrams),
        price: null,
      }] : [];
      const items = [...sampleItems, ...currentItem];
      if (items.length === 0) throw new Error("Agregue al menos una muestra.");

      const response = await apiRequest("/samples", {
        method: "POST",
        body: JSON.stringify({
          ...sampleForm,
          code: getSampleCodeFromForm(sampleForm),
          requestedAt: sampleForm.requestedAt || today,
          status: "enviada",
          currency: "COP",
          items,
        }),
      });

      setSampleItems([]);
      const refreshedData = await loadData();
      setSampleForm({ ...initialSample, ...getNextCodeParts("MUE", refreshedData.countersData) });
      setMessage(`Solicitud de muestra ${response.data?.code || ""} creada y enviada para aprobacion.`);
    } catch (requestError) {
      showErrorAlert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveQuote = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const items = itemForm.quantityKg ? [...quoteItems, buildItem()] : quoteItems;
      if (items.length === 0) throw new Error("Agregue al menos un cafe a la cotizacion.");

      const payload = {
        code: getQuoteCodeFromForm(quoteForm),
        clientId: Number(quoteForm.clientId),
        quoteType: quoteForm.quoteType || "preventa",
        status: quoteForm.status || "enviada",
        currency: quoteForm.currency,
        paymentTerms: quoteForm.paymentTerms || null,
        deliveryTerms: quoteForm.deliveryTerms || null,
        terms: quoteForm.terms,
        shippingCost: Number(quoteForm.shippingCost || 0),
        estimatedDeliveryDate: quoteForm.estimatedDeliveryDate,
        notes: quoteForm.notes || null,
        items,
      };

      const response = await apiRequest(editingQuoteId ? `/quotes/${editingQuoteId}` : "/quotes", {
        method: editingQuoteId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      const wasEditing = Boolean(editingQuoteId);
      const refreshedData = await loadData();
      if (wasEditing) {
        resetForm(refreshedData.countersData);
      } else {
        setEditingQuoteId(null);
        setQuoteForm({ ...createInitialQuote(), ...getNextCodeParts("COT", refreshedData.countersData) });
        setItemForm(initialItem);
        setQuoteItems([]);
        setError("");
      }
      setSelectedQuote(response.data);
      setMessage(wasEditing ? "Cotizacion actualizada correctamente." : "Cotizacion creada correctamente.");
    } catch (requestError) {
      showErrorAlert(requestError.message);
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
      showErrorAlert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const loadQuoteDetail = async (quoteId) => {
    const quote = await apiRequest(`/quotes/${quoteId}`);
    setSelectedQuote(quote);
    setMessage("");
    setError("");
    scrollToPanel(detailPanelRef);
  };

  const loadQuoteForEdit = async (quoteId) => {
    const quote = await apiRequest(`/quotes/${quoteId}`);
    setEditingQuoteId(quote.id);
    setSelectedQuote(quote);
    setQuoteForm({
      ...getCodeParts(quote.code),
      clientId: String(quote.client_id || ""),
      quoteType: quote.quote_type || "preventa",
      status: quote.status || "enviada",
      currency: quote.currency || "COP",
      paymentTerms: quote.payment_terms || "",
      deliveryTerms: quote.delivery_terms || "",
      terms: { ...defaultQuoteTerms, ...(quote.quote_terms || {}) },
      shippingCost: quote.shipping_cost || "",
      estimatedDeliveryDate: quote.estimated_delivery_date ? String(quote.estimated_delivery_date).slice(0, 10) : "",
      notes: quote.notes || "",
    });
    setQuoteItems((quote.items || []).map(itemFromQuoteItem));
    setItemForm(initialItem);
    setMessage(`Editando cotizacion ${quote.code}.`);
    setError("");
    scrollToPanel(formPanelRef);
  };

  const updateQuoteStatus = async (quote, status) => {
    const confirmed = window.confirm(`Confirma cambiar la cotizacion ${quote.code} a ${status}?`);
    if (!confirmed) return;

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
      showErrorAlert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuote = async (quote) => {
    const confirmation = window.prompt(
      `Esto eliminara la cotizacion ${quote.code} y sus items de prueba. Escriba ELIMINAR para confirmar.`
    );

    if (confirmation !== "ELIMINAR") return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/quotes/${quote.id}`, { method: "DELETE" });
      if (selectedQuote?.id === quote.id) {
        setSelectedQuote(null);
      }
      if (editingQuoteId === quote.id) {
        setEditingQuoteId(null);
        setQuoteForm(createInitialQuote());
        setQuoteItems([]);
      }
      await loadData();
      setMessage(`Cotizacion ${quote.code} eliminada correctamente.`);
    } catch (requestError) {
      showErrorAlert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const printQuotePdf = async (quoteId, language = "es") => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const document = await apiRequest(`/documents/quotes/${quoteId}`);
      openCommercialDocumentPrint(document, { language });
      setMessage(`Cotizacion abierta en ${language === "en" ? "ingles" : "espanol"} para imprimir o guardar como PDF.`);
    } catch (requestError) {
      showErrorAlert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const convertQuoteToSale = async (quote = selectedQuote) => {
    if (!quote) {
      showErrorAlert("No se pudo crear la venta: seleccione una cotizacion.");
      return;
    }

    if (quote.status === "anulada") {
      showErrorAlert("No se pudo crear la venta: la cotizacion esta anulada.");
      return;
    }

    const confirmed = window.confirm(`Confirma aceptar ${quote.code} y crear la venta para enviarla a bodega?`);
    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiRequest(`/sales/from-quote/${quote.id}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadData();
      await loadQuoteDetail(quote.id);
      const saleCode = response?.data?.code || quote.code?.replace(/^COT/i, "VEN") || "la venta";
      setMessage(`Venta ${saleCode} creada correctamente.`);
      window.alert(`Venta creada exitosamente: ${saleCode}`);
    } catch (requestError) {
      showErrorAlert(`No se pudo crear la venta: ${requestError.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Cotizaciones</h1>
          <p className="text-sm text-slate-500">Cotizaciones editables con PDF en espanol o ingles antes de convertirse en venta.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadData()}
          type="button"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 space-y-5">
          <form ref={formPanelRef} className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4" onSubmit={formMode === "quote" ? saveQuote : saveSampleRequest}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {formMode === "quote" ? <Plus size={17} className="text-leaf" /> : <FlaskConical size={17} className="text-leaf" />}
                <h2 className="text-sm font-semibold text-slate-800">
                  {formMode === "quote" ? (editingQuoteId ? "Editar cotizacion" : "Nueva cotizacion") : "Nueva solicitud de muestra"}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded border px-3 py-1.5 text-xs font-semibold ${formMode === "quote" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                  type="button"
                  onClick={() => {
                    setFormMode("quote");
                    scrollToPanel(formPanelRef);
                  }}
                >
                  Cotizacion de venta
                </button>
                <button
                  className={`rounded border px-3 py-1.5 text-xs font-semibold ${formMode === "sample" ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                  type="button"
                  onClick={() => {
                    setFormMode("sample");
                    scrollToPanel(formPanelRef);
                  }}
                >
                  Solicitud de muestra
                </button>
              </div>
              {formMode === "quote" && editingQuoteId && (
                <button
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  type="button"
                  onClick={resetForm}
                >
                  <XCircle size={14} />
                  Cancelar edicion
                </button>
              )}
            </div>

            {formMode === "quote" ? (
              <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Codigo de cotizacion</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_160px]">
                  <div className="rounded bg-white px-3 py-2 text-sm font-semibold text-ink">
                    {getQuoteCodeFromForm(quoteForm) || "COT-automatico"}
                  </div>
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ano"
                    type="number"
                    value={quoteForm.manualCodeYear}
                    onChange={(event) => setQuoteForm({ ...quoteForm, manualCodeYear: event.target.value })}
                  />
                  <input
                    className="rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Numero final"
                    type="number"
                    value={quoteForm.manualCodeNumber}
                    onChange={(event) => setQuoteForm({ ...quoteForm, manualCodeNumber: event.target.value })}
                  />
                </div>
              </div>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                value={quoteForm.clientId}
                onChange={(event) => setQuoteForm({ ...quoteForm, clientId: event.target.value })}
                required
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
                value={quoteForm.currency}
                onChange={(event) => updateCurrency(event.target.value)}
              >
                <option value="COP">COP - Pesos colombianos</option>
                <option value="USD">USD - Dolares</option>
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Costo de envio"
                type="number"
                step="0.01"
                value={quoteForm.shippingCost}
                onChange={(event) => setQuoteForm({ ...quoteForm, shippingCost: event.target.value })}
              />
            </div>

            {showQuickClient && (
              <div className="mt-4 min-w-0 overflow-hidden rounded border border-emerald-100 bg-emerald-50 p-3">
                <h3 className="text-sm font-semibold text-slate-800">Cliente rapido</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Nombre" value={quickClientForm.name} onChange={(event) => setQuickClientForm({ ...quickClientForm, name: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Telefono" value={quickClientForm.phone} onChange={(event) => setQuickClientForm({ ...quickClientForm, phone: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Direccion" value={quickClientForm.address} onChange={(event) => setQuickClientForm({ ...quickClientForm, address: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Documento" value={quickClientForm.documentNumber} onChange={(event) => setQuickClientForm({ ...quickClientForm, documentNumber: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Correo opcional" value={quickClientForm.email} onChange={(event) => setQuickClientForm({ ...quickClientForm, email: event.target.value })} />
                </div>
                <button className="mt-3 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white" type="button" onClick={createQuickClient}>
                  Crear y seleccionar cliente
                </button>
              </div>
            )}

            <div className="mt-4 rounded border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">Cafe solicitado</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Presentacion
                  <select className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" value={itemForm.productForm} onChange={(event) => setItemForm({ ...itemForm, productForm: event.target.value })}>
                    <option value="Excelso">Excelso</option>
                    <option value="Pergamino">Pergamino</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Proceso
                  <select className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" value={itemForm.processType} onChange={(event) => updateRequestedProcessType(event.target.value)}>
                    {(catalogs?.coffeeTypes || []).map((type) => (
                      <option key={type.id} value={type.name}>{type.name}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Categoria del cafe
                  <select className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" value={itemForm.itemType} onChange={(event) => updateItemType(event.target.value)}>
                    <option value="Regional">Regional</option>
                    <option value="Varietal">Varietal</option>
                    <option value="Exotico">Exotico</option>
                    <option value="description">Descripcion libre</option>
                  </select>
                </label>
                {itemForm.itemType !== "description" ? (
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    Cafe exacto
                    <select
                      className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink"
                      value={itemForm.itemType === "Exotico" ? itemForm.coffeeProfileId : itemForm.purchaseCoffeeId}
                      onChange={(event) => selectRequestedCoffee(event.target.value)}
                    >
                      <option value="">Cafe {itemForm.itemType.toLowerCase()}</option>
                      {availableCoffeeOptions.map((option) => (
                        <option key={option.id} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    Descripcion del cafe
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" placeholder="Descripcion del cafe solicitado" value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} />
                  </label>
                )}
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Variedad o detalle
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" placeholder="Variedad o detalle opcional" value={itemForm.variety} onChange={(event) => setItemForm({ ...itemForm, variety: event.target.value })} />
                </label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    Cantidad
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink"
                      placeholder={itemForm.quantityUnit === "lb" ? "Cantidad lb" : "Cantidad kg"}
                      type="number"
                      step="0.01"
                      value={itemForm.quantityKg}
                      onChange={(event) => setItemForm({ ...itemForm, quantityKg: event.target.value })}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    Unidad
                    <select
                      className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink"
                      value={itemForm.quantityUnit}
                      onChange={(event) => setItemForm({ ...itemForm, quantityUnit: event.target.value })}
                    >
                      <option value="kg">Kg</option>
                      <option value="lb">Libra</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Precio por kg
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" placeholder={`Precio por kg en ${quoteForm.currency}`} type="number" step="0.01" value={itemForm.unitPrice} onChange={(event) => setItemForm({ ...itemForm, unitPrice: event.target.value })} />
                </label>
              </div>
              {Number(itemForm.quantityKg || 0) > 0 && (
                <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Operativo bodega: <span className="font-semibold">{formatOperationalKg(itemOperationalKg)}</span>
                </div>
              )}
              <button className="mt-3 inline-flex items-center gap-2 rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50" type="button" onClick={addAnotherCoffee}>
                <Plus size={16} />
                Agregar otro cafe
              </button>

              {quoteItems.length > 0 && (
                <div className="mt-3 divide-y divide-slate-200 rounded border border-slate-200">
                  {quoteItems.map((item, index) => (
                    <div key={`${item.productForm}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{getItemLabel(item, catalogs)}</p>
                        <p className="text-slate-500">
                          {item.productForm} · {item.processType} · {formatRequestedKg(item.quantityKg)} · {formatMoney(quoteForm.currency, item.unitPrice)}/kg · {formatMoney(quoteForm.currency, item.lineTotal)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-600" type="button" title="Editar cafe" onClick={() => editItem(index)}>
                          <Edit size={15} />
                        </button>
                        <button className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-600" type="button" title="Quitar cafe" onClick={() => removeItem(index)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Subtotal: <span className="font-semibold text-ink">{formatMoney(quoteForm.currency, subtotal)}</span> · Envio:{" "}
                <span className="font-semibold text-ink">{formatMoney(quoteForm.currency, quoteForm.shippingCost)}</span> · Total:{" "}
                <span className="font-semibold text-ink">{formatMoney(quoteForm.currency, total)}</span>
              </div>
            </div>

            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
              <div>
                <h3 className="text-sm font-semibold text-amber-900">Terminos de la cotizacion</h3>
                <p className="text-xs text-slate-600">Estos datos salen en el PDF y se pueden ajustar manualmente para cada cliente.</p>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className={termLabelClass}>
                  Anticipo
                  <select className={termInputClass} value={quoteForm.terms.advance} onChange={(event) => updateQuoteTerm("advance", event.target.value)}>
                    {quoteTermOptions.advance.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className={termLabelClass}>
                  Tiempo de entrega
                  <select className={termInputClass} value={quoteForm.terms.deliveryTime} onChange={(event) => updateQuoteTerm("deliveryTime", event.target.value)}>
                    {quoteTermOptions.deliveryTime.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className={termLabelClass}>
                  Norma
                  <select className={termInputClass} value={quoteForm.terms.standard} onChange={(event) => updateQuoteTerm("standard", event.target.value)}>
                    {quoteTermOptions.standard.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className={termLabelClass}>
                  Entrega
                  <select
                    className={termInputClass}
                    value={quoteTermOptions.deliveryTerms.includes(quoteForm.terms.deliveryTerms) ? quoteForm.terms.deliveryTerms : "otro"}
                    onChange={(event) => updateQuoteTerm("deliveryTerms", event.target.value === "otro" ? "" : event.target.value)}
                  >
                    {quoteTermOptions.deliveryTerms.map((option) => <option key={option} value={option}>{option}</option>)}
                    <option value="otro">Otro</option>
                  </select>
                </label>
                {!quoteTermOptions.deliveryTerms.includes(quoteForm.terms.deliveryTerms) && (
                  <label className={`${termLabelClass} md:col-span-2`}>
                    Entrega personalizada
                    <input
                      className={termInputClass}
                      placeholder="Escriba la entrega acordada"
                      value={quoteForm.terms.deliveryTerms}
                      onChange={(event) => updateQuoteTerm("deliveryTerms", event.target.value)}
                    />
                  </label>
                )}
                <label className={termLabelClass}>
                  Empaque
                  <select className={termInputClass} value={quoteForm.terms.packaging} onChange={(event) => updateQuoteTerm("packaging", event.target.value)}>
                    {quoteTermOptions.packaging.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className={termLabelClass}>
                  Pago
                  <input
                    className={termInputClass}
                    placeholder="Condicion de pago"
                    value={quoteForm.terms.paymentTerms}
                    onChange={(event) => updateQuoteTerm("paymentTerms", event.target.value)}
                  />
                </label>
                <label className={`${termLabelClass} md:col-span-2`}>
                  Datos bancarios
                  <input
                    className={termInputClass}
                    placeholder="Datos bancarios"
                    value={quoteForm.terms.bankDetails}
                    onChange={(event) => updateQuoteTerm("bankDetails", event.target.value)}
                  />
                </label>
                <label className={termLabelClass}>
                  Empresa
                  <input
                    className={termInputClass}
                    placeholder="Empresa"
                    value={quoteForm.terms.company}
                    onChange={(event) => updateQuoteTerm("company", event.target.value)}
                  />
                </label>
                <label className={termLabelClass}>
                  Nit
                  <input
                    className={termInputClass}
                    placeholder="Nit"
                    value={quoteForm.terms.taxId}
                    onChange={(event) => updateQuoteTerm("taxId", event.target.value)}
                  />
                </label>
              </div>
            </div>

            <textarea className="mt-3 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Notas" value={quoteForm.notes} onChange={(event) => setQuoteForm({ ...quoteForm, notes: event.target.value })} />
            <button className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
              <Save size={16} />
              {editingQuoteId ? "Actualizar cotizacion" : "Guardar cotizacion"}
            </button>
              </>
            ) : (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Codigo de muestra</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_160px]">
                      <div className="rounded bg-white px-3 py-2 text-sm font-semibold text-ink">
                        {getSampleCodeFromForm(sampleForm) || "MUE-automatico"}
                      </div>
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Ano"
                        type="number"
                        value={sampleForm.manualCodeYear}
                        onChange={(event) => setSampleForm({ ...sampleForm, manualCodeYear: event.target.value })}
                      />
                      <input
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Numero final"
                        type="number"
                        value={sampleForm.manualCodeNumber}
                        onChange={(event) => setSampleForm({ ...sampleForm, manualCodeNumber: event.target.value })}
                      />
                    </div>
                  </div>
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Nombre de quien solicita" value={sampleForm.requesterName} onChange={(event) => setSampleForm({ ...sampleForm, requesterName: event.target.value })} required />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Telefono" value={sampleForm.requesterPhone} onChange={(event) => setSampleForm({ ...sampleForm, requesterPhone: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Correo opcional" value={sampleForm.requesterEmail} onChange={(event) => setSampleForm({ ...sampleForm, requesterEmail: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Empresa opcional" value={sampleForm.requesterCompany} onChange={(event) => setSampleForm({ ...sampleForm, requesterCompany: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Direccion de envio" value={sampleForm.requesterAddress} onChange={(event) => setSampleForm({ ...sampleForm, requesterAddress: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Ciudad" value={sampleForm.requesterCity} onChange={(event) => setSampleForm({ ...sampleForm, requesterCity: event.target.value })} />
                  <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Pais" value={sampleForm.requesterCountry} onChange={(event) => setSampleForm({ ...sampleForm, requesterCountry: event.target.value })} />
                </div>

                <div className="mt-4 rounded border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Cafe solicitado para muestra</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                      Proceso
                      <select className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" value={sampleForm.coffeeTypeId} onChange={(event) => setSampleForm({ ...sampleForm, coffeeTypeId: event.target.value })}>
                        <option value="">Proceso del cafe</option>
                        {catalogs?.coffeeTypes?.map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                      Perfil o cafe comercial
                      <select className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" value={sampleForm.coffeeProfileId} onChange={(event) => setSampleForm({ ...sampleForm, coffeeProfileId: event.target.value })}>
                        <option value="">Perfil o cafe comercial</option>
                        {catalogs?.coffeeProfiles?.map((profile) => (
                          <option key={profile.id} value={profile.id}>{formatProfileOptionLabel(profile)}</option>
                        ))}
                      </select>
                    </label>
                    <textarea className="min-h-20 rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Descripcion si no aplica tipo o perfil exacto" value={sampleForm.description} onChange={(event) => setSampleForm({ ...sampleForm, description: event.target.value })} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Cantidad en gramos" type="number" step="1" value={sampleForm.quantityGrams} onChange={(event) => setSampleForm({ ...sampleForm, quantityGrams: event.target.value })} required={sampleItems.length === 0} />
                    <button className="inline-flex items-center justify-center gap-2 rounded border border-leaf px-3 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50" type="button" onClick={addSampleItem}>
                      <Plus size={16} />
                      Agregar otra muestra
                    </button>
                  </div>
                  {sampleItems.length > 0 && (
                    <div className="mt-3 divide-y divide-slate-100 rounded border border-slate-200">
                      {sampleItems.map((item, index) => (
                        <div key={`${item.coffeeName}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium text-ink">{item.coffeeName}</p>
                            <p className="text-slate-500">{item.quantityGrams} g</p>
                          </div>
                          <button className="rounded p-2 text-rose-600 hover:bg-rose-50" type="button" aria-label="Quitar muestra" onClick={() => removeSampleItem(index)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    Fecha solicitud
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" type="date" value={sampleForm.requestedAt} onChange={(event) => setSampleForm({ ...sampleForm, requestedAt: event.target.value })} required />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                    Entrega tentativa
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-ink" type="date" value={sampleForm.tentativeDeliveryDate} onChange={(event) => setSampleForm({ ...sampleForm, tentativeDeliveryDate: event.target.value })} />
                  </label>
                </div>
                <textarea className="mt-3 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Notas internas" value={sampleForm.notes} onChange={(event) => setSampleForm({ ...sampleForm, notes: event.target.value })} />
                <button className="mt-4 inline-flex items-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving}>
                  <Save size={16} />
                  Crear solicitud de muestra
                </button>
              </>
            )}
          </form>

          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Historial de cotizaciones</h2>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {quoteFilters.map((filter) => (
                  <button key={filter.key} className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold ${quoteFilter === filter.key ? "border-leaf bg-emerald-50 text-leaf" : "border-slate-200 bg-white text-slate-700"}`} type="button" onClick={() => setQuoteFilter(filter.key)}>
                    {filter.label} ({quoteCounts[filter.key] || 0})
                  </button>
                ))}
              </div>
            </div>
            {filteredQuotes.length === 0 ? (
              <div className="p-4"><EmptyState title="Sin cotizaciones" message="Las cotizaciones apareceran aqui." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotes.map((quote) => (
                      <tr key={quote.id}>
                        <td className="px-3 py-2 font-medium">{quote.code}</td>
                        <td className="px-3 py-2">{quote.client_name}</td>
                        <td className="px-3 py-2"><StatusBadge>{quoteStatusLabels[quote.status] || quote.status}</StatusBadge></td>
                        <td className="px-3 py-2">{formatMoney(quote.currency, quote.total)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => loadQuoteDetail(quote.id)} type="button">
                              <Eye size={14} /> Ver
                            </button>
                            <button className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => loadQuoteForEdit(quote.id)} type="button" disabled={quote.status === "anulada"}>
                              <Edit size={14} /> Editar
                            </button>
                            <button className="inline-flex items-center gap-1 rounded border border-leaf bg-emerald-50 px-2 py-1 text-xs font-semibold text-leaf hover:bg-emerald-100 disabled:opacity-60" disabled={saving} onClick={() => printQuotePdf(quote.id, "es")} type="button">
                              <FileDown size={14} /> PDF ES
                            </button>
                            <button className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={saving} onClick={() => printQuotePdf(quote.id, "en")} type="button">
                              <FileDown size={14} /> PDF EN
                            </button>
                            {canDeleteRecords && (
                              <button className="inline-flex items-center gap-1 rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" disabled={saving} onClick={() => deleteQuote(quote)} type="button">
                                <Trash2 size={14} /> Eliminar
                              </button>
                            )}
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

        <aside ref={detailPanelRef} className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Detalle</h2>
          {!selectedQuote ? (
            <div className="mt-3"><EmptyState title="Seleccione una cotizacion" message="Aqui vera productos, PDF y conversion a venta." /></div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold text-ink">{selectedQuote.code}</p>
                <p className="text-sm text-slate-500">{selectedQuote.client_name}</p>
                <p className="text-sm text-slate-500">{selectedQuote.client_phone || "Sin telefono"}</p>
                <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{getQuoteNextAction(selectedQuote)}</p>
              </div>
              <div className="rounded bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">Subtotal: {formatMoney(selectedQuote.currency, selectedQuote.subtotal)}</p>
                <p className="text-slate-500">Envio: {formatMoney(selectedQuote.currency, selectedQuote.shipping_cost)}</p>
                <p className="font-semibold text-ink">Total: {formatMoney(selectedQuote.currency, selectedQuote.total)}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60" disabled={saving} onClick={() => printQuotePdf(selectedQuote.id, "es")} type="button">
                  <FileDown size={17} /> PDF espanol
                </button>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60" disabled={saving} onClick={() => printQuotePdf(selectedQuote.id, "en")} type="button">
                  <FileDown size={17} /> PDF ingles
                </button>
              </div>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => loadQuoteForEdit(selectedQuote.id)}>
                <Edit size={17} /> Editar esta cotizacion
              </button>
              {canDeleteRecords && (
                <button className="inline-flex w-full items-center justify-center gap-2 rounded border border-rose-300 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60" disabled={saving} type="button" onClick={() => deleteQuote(selectedQuote)}>
                  <Trash2 size={17} /> Eliminar cotizacion de prueba
                </button>
              )}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
                {selectedQuote.items?.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-ink">{item.description || item.coffee_profile_name || item.coffee_type_name || item.lot_code}</p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">{item.product_form || "Sin presentacion"}</span> · {[item.process_type, item.variety].filter(Boolean).join(" · ") || "Sin detalle"} · {formatRequestedKg(item.quantity_kg)}
                    </p>
                    <p className="text-slate-500">{formatMoney(selectedQuote.currency, item.unit_price)}/kg · {formatMoney(selectedQuote.currency, item.line_total)}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <button className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={saving || selectedQuote.status === "enviada"} onClick={() => updateQuoteStatus(selectedQuote, "enviada")}>
                  Enviada
                </button>
                <button className="rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || !canConvertToSale || selectedQuote.status === "anulada"} onClick={() => convertQuoteToSale(selectedQuote)}>
                  Aceptar y crear venta
                </button>
                <button className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={saving || selectedQuote.status === "anulada"} onClick={() => updateQuoteStatus(selectedQuote, "anulada")}>
                  Anular
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default CommercialPage;
