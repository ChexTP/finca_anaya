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
  updateQuoteStatus,
  quoteHasSale,
  quoteHasProcess,
} from "../models/quotes.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

const allowedStatuses = ["borrador", "enviada", "aceptada", "anulada"];

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
    const {
      clientId,
      quoteType,
      status = "borrador",
      currency,
      paymentTerms,
      deliveryTerms,
      shippingCost = 0,
      estimatedDeliveryDate,
      notes,
      items,
    } = req.body;

    if (!clientId || !quoteType || !currency || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Cliente, tipo de cotizacion, moneda e items son obligatorios",
      });
    }

    if (!["inventario_disponible", "preventa"].includes(quoteType)) {
      return res.status(400).json({
        message: "El tipo de cotizacion debe ser inventario_disponible o preventa",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado de cotizacion invalido" });
    }

    if (!["COP", "USD"].includes(currency)) {
      return res.status(400).json({ message: "La moneda debe ser COP o USD" });
    }

    const client = await findClientById(clientId);

    if (!client || !client.is_active) {
      return res.status(404).json({ message: "Cliente no encontrado o inactivo" });
    }

    const cleanItems = [];

    for (const item of items) {
      const quantityKg = toNumber(item.quantityKg);
      const unitPrice = toNumber(item.unitPrice);

      if (!Number.isFinite(quantityKg) || quantityKg <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          message: "Cada item debe tener cantidad mayor a cero y precio valido",
        });
      }

      if (item.lotId) {
        const lot = await findLotById(item.lotId);

        if (!lot || lot.status !== "disponible") {
          return res.status(404).json({ message: "Lote no encontrado o no disponible" });
        }
      }

      if (item.coffeeTypeId) {
        const coffeeType = await findCoffeeTypeById(item.coffeeTypeId);

        if (!coffeeType || !coffeeType.is_active) {
          return res.status(404).json({ message: "Tipo de cafe no encontrado o inactivo" });
        }
      }

      if (item.coffeeProfileId) {
        const profile = await findCoffeeProfileById(item.coffeeProfileId);

        if (!profile || !profile.is_active) {
          return res.status(404).json({ message: "Perfil comercial no encontrado o inactivo" });
        }
      }

      if (!item.lotId && !item.coffeeTypeId && !item.coffeeProfileId && !item.description) {
        return res.status(400).json({
          message: "Cada item debe indicar lote, tipo, perfil o descripcion",
        });
      }

      cleanItems.push({
        lotId: item.lotId || null,
        coffeeTypeId: item.coffeeTypeId || null,
        coffeeProfileId: item.coffeeProfileId || null,
        description: item.description || null,
        quantityKg,
        unitPrice,
        lineTotal: Number((quantityKg * unitPrice).toFixed(2)),
      });
    }

    const shipping = toNumber(shippingCost);

    if (!Number.isFinite(shipping) || shipping < 0) {
      return res.status(400).json({ message: "El costo de envio debe ser valido" });
    }

    const subtotal = cleanItems.reduce((total, item) => total + item.lineTotal, 0);
    const total = Number((subtotal + shipping).toFixed(2));
    const code = await getNextQuoteCode();

    const quote = await createQuote({
      code,
      clientId,
      sellerId: req.user.id,
      quoteType,
      status,
      currency,
      paymentTerms: paymentTerms || null,
      deliveryTerms: deliveryTerms || null,
      shippingCost: shipping,
      estimatedDeliveryDate: estimatedDeliveryDate || null,
      notes: notes || null,
      subtotal,
      total,
      items: cleanItems,
    });

    const fullQuote = await findQuoteById(quote.id);

    res.status(201).json({
      message: "Cotizacion creada correctamente",
      data: fullQuote,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear cotizacion",
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
