import { findClientById } from "../models/clients.model.js";
import {
  findCoffeeProfileById,
  findCoffeeTypeById,
  findLotById,
} from "../models/lots.model.js";
import {
  getNextQuoteCode,
  listQuotes,
  findQuoteById,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  quoteHasSale,
  quoteHasProcess,
  deleteQuoteById,
} from "../models/quotes.model.js";
import { calculateOperationalKg } from "../utils/coffeeCalculations.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

const allowedStatuses = ["borrador", "enviada", "aceptada", "anulada"];

const cleanQuoteTerms = (terms = {}) => ({
  advance: terms.advance ? String(terms.advance).trim() : null,
  deliveryTime: terms.deliveryTime ? String(terms.deliveryTime).trim() : null,
  minimumOrder: terms.minimumOrder ? String(terms.minimumOrder).trim() : null,
  standard: terms.standard ? String(terms.standard).trim() : null,
  qualityRuleType: terms.qualityRuleType ? String(terms.qualityRuleType).trim() : null,
  qualityRule: terms.qualityRule ? String(terms.qualityRule).trim() : null,
  deliveryTerms: terms.deliveryTerms ? String(terms.deliveryTerms).trim() : null,
  packaging: terms.packaging ? String(terms.packaging).trim() : null,
  paymentTerms: terms.paymentTerms ? String(terms.paymentTerms).trim() : null,
  bankDetails: terms.bankDetails ? String(terms.bankDetails).trim() : null,
  company: terms.company ? String(terms.company).trim() : null,
  taxId: terms.taxId ? String(terms.taxId).trim() : null,
  bankCountry: terms.bankCountry ? String(terms.bankCountry).trim() : null,
  bankName: terms.bankName ? String(terms.bankName).trim() : null,
  swiftCode: terms.swiftCode ? String(terms.swiftCode).trim() : null,
  accountNumber: terms.accountNumber ? String(terms.accountNumber).trim() : null,
  beneficiaryName: terms.beneficiaryName ? String(terms.beneficiaryName).trim() : null,
  beneficiaryTaxId: terms.beneficiaryTaxId ? String(terms.beneficiaryTaxId).trim() : null,
  exchangeRate: terms.exchangeRate ? Number(terms.exchangeRate) : null,
  usdIncoterm: terms.usdIncoterm ? String(terms.usdIncoterm).trim() : null,
  millCostCop: terms.millCostCop !== undefined && terms.millCostCop !== "" ? Number(terms.millCostCop) : null,
  transportCostCop: terms.transportCostCop !== undefined && terms.transportCostCop !== "" ? Number(terms.transportCostCop) : null,
  vacuumCostCop: terms.vacuumCostCop !== undefined && terms.vacuumCostCop !== "" ? Number(terms.vacuumCostCop) : null,
  exportCostUsdLb: terms.exportCostUsdLb !== undefined && terms.exportCostUsdLb !== "" ? Number(terms.exportCostUsdLb) : null,
});

const cleanPricingSnapshot = (snapshot = {}) => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};

  return {
    priceLoadCop: snapshot.priceLoadCop !== undefined && snapshot.priceLoadCop !== "" ? Number(snapshot.priceLoadCop) : null,
    packaging: snapshot.packaging ? String(snapshot.packaging).trim() : null,
    kgCpsPriceCop: snapshot.kgCpsPriceCop !== undefined ? Number(snapshot.kgCpsPriceCop) : null,
    kgExcelsoPriceCop: snapshot.kgExcelsoPriceCop !== undefined ? Number(snapshot.kgExcelsoPriceCop) : null,
    kgBasePriceCop: snapshot.kgBasePriceCop !== undefined ? Number(snapshot.kgBasePriceCop) : null,
    kgVacuumPriceCop: snapshot.kgVacuumPriceCop !== undefined ? Number(snapshot.kgVacuumPriceCop) : null,
    usdLbExw: snapshot.usdLbExw !== undefined ? Number(snapshot.usdLbExw) : null,
    usdLbVacuumExw: snapshot.usdLbVacuumExw !== undefined ? Number(snapshot.usdLbVacuumExw) : null,
    usdLbFob: snapshot.usdLbFob !== undefined ? Number(snapshot.usdLbFob) : null,
    usdLbVacuumFob: snapshot.usdLbVacuumFob !== undefined ? Number(snapshot.usdLbVacuumFob) : null,
    currency: snapshot.currency ? String(snapshot.currency).trim() : null,
    exchangeRate: snapshot.exchangeRate !== undefined && snapshot.exchangeRate !== null && snapshot.exchangeRate !== "" ? Number(snapshot.exchangeRate) : null,
    usdIncoterm: snapshot.usdIncoterm ? String(snapshot.usdIncoterm).trim() : null,
    priceBasis: snapshot.priceBasis ? String(snapshot.priceBasis).trim() : null,
  };
};

const buildCleanQuoteData = async ({
  code,
  clientId,
  quoteType,
  status = "borrador",
  currency,
  paymentTerms,
  deliveryTerms,
  shippingCost = 0,
  estimatedDeliveryDate,
  notes,
  terms,
  items,
}) => {
  if (!clientId || !quoteType || !currency || !Array.isArray(items) || items.length === 0) {
    const error = new Error("Cliente, moneda e items son obligatorios");
    error.statusCode = 400;
    throw error;
  }

  if (!["inventario_disponible", "preventa"].includes(quoteType)) {
    const error = new Error("El tipo de cotizacion debe ser inventario_disponible o preventa");
    error.statusCode = 400;
    throw error;
  }

  if (!allowedStatuses.includes(status)) {
    const error = new Error("Estado de cotizacion invalido");
    error.statusCode = 400;
    throw error;
  }

  if (!["COP", "USD"].includes(currency)) {
    const error = new Error("La moneda debe ser COP o USD");
    error.statusCode = 400;
    throw error;
  }

  const client = await findClientById(clientId);

  if (!client || !client.is_active) {
    const error = new Error("Cliente no encontrado o inactivo");
    error.statusCode = 404;
    throw error;
  }

  const cleanItems = [];

  for (const item of items) {
    if (item.productForm !== undefined && !item.productForm?.trim()) {
      const error = new Error("La presentacion del cafe es obligatoria");
      error.statusCode = 400;
      throw error;
    }

    if (item.processType !== undefined && !item.processType?.trim()) {
      const error = new Error("El proceso o beneficio del cafe es obligatorio");
      error.statusCode = 400;
      throw error;
    }

    const quantityKg = toNumber(item.quantityKg);
    const unitPrice = toNumber(item.unitPrice);

    if (!Number.isFinite(quantityKg) || quantityKg <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      const error = new Error("Cada item debe tener cantidad mayor a cero y precio valido");
      error.statusCode = 400;
      throw error;
    }

    if (item.lotId) {
      const lot = await findLotById(item.lotId);

      if (!lot || !["disponible", "vendido_parcial"].includes(lot.status)) {
        const error = new Error("Lote no encontrado o no disponible");
        error.statusCode = 404;
        throw error;
      }
    }

    if (item.coffeeTypeId) {
      const coffeeType = await findCoffeeTypeById(item.coffeeTypeId);

      if (!coffeeType || !coffeeType.is_active) {
        const error = new Error("Tipo de cafe no encontrado o inactivo");
        error.statusCode = 404;
        throw error;
      }
    }

    if (item.coffeeProfileId) {
      const profile = await findCoffeeProfileById(item.coffeeProfileId);

      if (!profile || !profile.is_active) {
        const error = new Error("Perfil comercial no encontrado o inactivo");
        error.statusCode = 404;
        throw error;
      }
    }

    if (!item.lotId && !item.coffeeTypeId && !item.coffeeProfileId && !item.description) {
      const error = new Error("Cada item debe indicar lote, tipo, perfil o descripcion");
      error.statusCode = 400;
      throw error;
    }

    cleanItems.push({
      lotId: item.lotId || null,
      coffeeTypeId: item.coffeeTypeId || null,
      coffeeProfileId: item.coffeeProfileId || null,
      description: item.description || null,
      productForm: item.productForm || null,
      processType: item.processType || null,
      variety: item.variety || null,
      quantityKg,
      operationalWeightKg: calculateOperationalKg({
        quantityKg,
        productForm: item.productForm,
        processType: item.processType,
      }),
      unitPrice,
      priceBasis: item.priceBasis || item.pricingSnapshot?.priceBasis || "kg",
      pricingSnapshot: cleanPricingSnapshot(item.pricingSnapshot),
      lineTotal: item.lineTotal !== undefined && Number.isFinite(toNumber(item.lineTotal))
        ? Number(toNumber(item.lineTotal).toFixed(2))
        : Number((quantityKg * unitPrice).toFixed(2)),
    });
  }

  const shipping = toNumber(shippingCost);

  if (!Number.isFinite(shipping) || shipping < 0) {
    const error = new Error("El costo de envio debe ser valido");
    error.statusCode = 400;
    throw error;
  }

  const subtotal = cleanItems.reduce((total, item) => total + item.lineTotal, 0);
  const total = Number((subtotal + shipping).toFixed(2));

  return {
    code: code ? String(code).trim().toUpperCase() : null,
    clientId,
    quoteType,
    status,
    currency,
    paymentTerms: paymentTerms || null,
    deliveryTerms: deliveryTerms || null,
    shippingCost: shipping,
    estimatedDeliveryDate: estimatedDeliveryDate || null,
    notes: notes || null,
    terms: cleanQuoteTerms(terms),
    subtotal,
    total,
    items: cleanItems,
  };
};

export const getQuotes = async (req, res) => {
  try {
    const sellerId = req.user.role === "seller" ? req.user.id : req.query.sellerId;
    const quotes = await listQuotes({
      status: req.query.status,
      sellerId,
      clientId: req.query.clientId,
    });

    res.json(quotes);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener cotizaciones",
      error: error.message,
    });
  }
};

export const getQuote = async (req, res) => {
  try {
    const quote = await findQuoteById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: "Cotizacion no encontrada" });
    }

    if (req.user.role === "seller" && quote.seller_id !== req.user.id) {
      return res.status(403).json({ message: "No tiene permisos para ver esta cotizacion" });
    }

    res.json(quote);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener cotizacion",
      error: error.message,
    });
  }
};

export const postQuote = async (req, res) => {
  try {
    const quoteData = await buildCleanQuoteData(req.body);
    const code = quoteData.code || await getNextQuoteCode();

    const quote = await createQuote({
      ...quoteData,
      code,
      sellerId: req.user.id,
    });

    const fullQuote = await findQuoteById(quote.id);

    res.status(201).json({
      message: "Cotizacion creada correctamente",
      data: fullQuote,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: "Error al crear cotizacion",
      error: error.message,
    });
  }
};

export const putQuote = async (req, res) => {
  try {
    const existingQuote = await findQuoteById(req.params.id);

    if (!existingQuote) {
      return res.status(404).json({ message: "Cotizacion no encontrada" });
    }

    if (req.user.role === "seller" && existingQuote.seller_id !== req.user.id) {
      return res.status(403).json({ message: "No tiene permisos para editar esta cotizacion" });
    }

    if (await quoteHasSale(req.params.id)) {
      return res.status(409).json({ message: "No se puede editar una cotizacion que ya fue convertida en venta" });
    }

    const quoteData = await buildCleanQuoteData({
      ...req.body,
      code: req.body.code || existingQuote.code,
    });
    const quote = await updateQuote(req.params.id, quoteData);
    const fullQuote = await findQuoteById(quote.id);

    res.json({
      message: "Cotizacion actualizada correctamente",
      data: fullQuote,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: "Error al actualizar cotizacion",
      error: error.message,
    });
  }
};

export const putQuoteStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado de cotizacion invalido" });
    }

    const quote = await findQuoteById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: "Cotizacion no encontrada" });
    }

    if (req.user.role === "seller" && quote.seller_id !== req.user.id) {
      return res.status(403).json({ message: "No tiene permisos para modificar esta cotizacion" });
    }

    if (status === "anulada" && await quoteHasSale(req.params.id)) {
      return res.status(409).json({
        message: "No se puede anular una cotizacion que ya fue convertida en venta",
      });
    }

    if (status === "anulada" && await quoteHasProcess(req.params.id)) {
      return res.status(409).json({
        message: "No se puede anular una preventa que ya tiene procesos asociados",
      });
    }

    const updatedQuote = await updateQuoteStatus(req.params.id, status);

    res.json({
      message: "Estado de cotizacion actualizado correctamente",
      data: updatedQuote,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar estado de cotizacion",
      error: error.message,
    });
  }
};

export const deleteQuote = async (req, res) => {
  try {
    const quote = await findQuoteById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: "Cotizacion no encontrada" });
    }

    if (await quoteHasSale(req.params.id)) {
      return res.status(409).json({
        message: "No se puede eliminar una cotizacion que ya fue convertida en venta. Elimine primero la venta asociada.",
      });
    }

    if (await quoteHasProcess(req.params.id)) {
      return res.status(409).json({
        message: "No se puede eliminar una cotizacion con procesos asociados.",
      });
    }

    await deleteQuoteById(req.params.id);

    res.json({
      message: "Cotizacion eliminada correctamente",
      data: quote,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar cotizacion",
      error: error.message,
    });
  }
};
