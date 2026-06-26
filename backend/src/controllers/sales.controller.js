import {
  getNextSaleCode,
  listSales,
  findSaleById,
  convertQuoteToSale,
  createDirectSale,
  updateSaleOperationalStatus,
  cancelSale,
  registerSalePayment,
  replaceSaleBlendOrder,
  updateSaleWarehousePriority,
  replaceSaleLotAssignments,
} from "../models/sales.model.js";
import { logControllerError } from "../utils/logger.js";
import { findQuoteById } from "../models/quotes.model.js";
import { findClientById } from "../models/clients.model.js";
import { findUserById } from "../models/users.model.js";
import {
  findCoffeeProfileById,
  findCoffeeTypeById,
  findLotById,
  findPaymentMethodById,
} from "../models/lots.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

const sanitizeSaleForSeller = (sale) => {
  if (!sale) {
    return sale;
  }

  const {
    amount_paid: _amountPaid,
    balance_due: _balanceDue,
    payments: _payments,
    deductedLots: _deductedLots,
    ...safeSale
  } = sale;

  return safeSale;
};

export const getSales = async (req, res) => {
  try {
    const sellerId = req.user.role === "seller" ? req.user.id : req.query.sellerId;
    const sales = await listSales({
      status: req.query.status,
      paymentStatus: req.query.paymentStatus,
      clientId: req.query.clientId,
      sellerId,
    });

    res.json(req.user.role === "seller" ? sales.map(sanitizeSaleForSeller) : sales);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener ventas",
      error: error.message,
    });
  }
};

export const getSale = async (req, res) => {
  try {
    const sale = await findSaleById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (req.user.role === "seller" && sale.seller_id !== req.user.id) {
      return res.status(403).json({ message: "No tiene permisos para ver esta venta" });
    }

    res.json(req.user.role === "seller" ? sanitizeSaleForSeller(sale) : sale);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener venta",
      error: error.message,
    });
  }
};

export const putSaleBlendOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Debe agregar al menos una linea de mezcla" });
    }

    const cleanItems = items.map((item) => ({
      saleItemId: Number(item.saleItemId),
      lotId: Number(item.lotId),
      percentage: toNumber(item.percentage),
      notes: item.notes || null,
    }));

    const invalidItem = cleanItems.find(
      (item) =>
        !Number.isInteger(item.saleItemId) ||
        !Number.isInteger(item.lotId) ||
        !Number.isFinite(item.percentage) ||
        item.percentage <= 0 ||
        item.percentage > 100
    );

    if (invalidItem) {
      return res.status(400).json({
        message: "Cada linea debe tener producto de venta, lote y porcentaje entre 0 y 100",
      });
    }

    const totalsBySaleItem = cleanItems.reduce((totals, item) => {
      totals[item.saleItemId] = Number(((totals[item.saleItemId] || 0) + item.percentage).toFixed(2));
      return totals;
    }, {});

    const invalidTotal = Object.values(totalsBySaleItem).find((total) => total !== 100);

    if (invalidTotal !== undefined) {
      return res.status(400).json({
        message: "La mezcla de cada producto debe sumar exactamente 100%",
      });
    }

    const sale = await replaceSaleBlendOrder({
      saleId: req.params.id,
      items: cleanItems,
      createdBy: req.user.id,
    });

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    const fullSale = await findSaleById(req.params.id);

    res.json({
      message: "Orden de mezcla guardada correctamente",
      data: fullSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al guardar orden de mezcla",
      error: error.message,
    });
  }
};

export const putSalePriority = async (req, res) => {
  try {
    const { priority } = req.body;

    if (!["alta", "media", "baja"].includes(priority)) {
      return res.status(400).json({ message: "La prioridad debe ser alta, media o baja" });
    }

    const sale = await updateSaleWarehousePriority({
      saleId: req.params.id,
      priority,
    });

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    const fullSale = await findSaleById(req.params.id);

    res.json({
      message: "Prioridad actualizada correctamente",
      data: fullSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar prioridad",
      error: error.message,
    });
  }
};

export const putSaleLotAssignments = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Debe agregar al menos un lote asignado" });
    }

    const cleanItems = items.map((item) => ({
      saleItemId: Number(item.saleItemId),
      lotId: Number(item.lotId),
      quantityKg: toNumber(item.quantityKg),
      notes: item.notes || null,
    }));

    const invalidItem = cleanItems.find(
      (item) =>
        !Number.isInteger(item.saleItemId) ||
        !Number.isInteger(item.lotId) ||
        !Number.isFinite(item.quantityKg) ||
        item.quantityKg <= 0
    );

    if (invalidItem) {
      return res.status(400).json({
        message: "Cada asignacion debe tener producto, lote y cantidad mayor a cero",
      });
    }

    const sale = await replaceSaleLotAssignments({
      saleId: req.params.id,
      items: cleanItems,
      createdBy: req.user.id,
    });

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (sale.invalidStatus) {
      return res.status(409).json({
        message: "No se puede cambiar la asignacion de una venta alistada, despachada o anulada",
        data: sale.sale,
      });
    }

    const fullSale = await findSaleById(req.params.id);

    res.json({
      message: "Lotes asignados correctamente",
      data: fullSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al asignar lotes",
      error: error.message,
    });
  }
};

export const postSaleFromQuote = async (req, res) => {
  try {
    const {
      paymentStatus,
      amountPaid = 0,
      estimatedPaymentDate,
      externalInvoiceReference,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
    } = req.body;

    if (!["pagada", "pago_parcial", "pendiente_pago"].includes(paymentStatus)) {
      return res.status(400).json({
        message: "Estado de pago invalido",
      });
    }

    const quote = await findQuoteById(req.params.quoteId);

    if (!quote) {
      return res.status(404).json({ message: "Cotizacion no encontrada" });
    }

    const paid = toNumber(amountPaid);

    if (!Number.isFinite(paid) || paid < 0 || paid > Number(quote.total)) {
      return res.status(400).json({
        message: "El valor pagado debe ser valido y no superar el total",
      });
    }

    if (paymentStatus === "pagada" && paid !== Number(quote.total)) {
      return res.status(400).json({
        message: "Una venta pagada debe tener pagado el total",
      });
    }

    if (["pago_parcial", "pendiente_pago"].includes(paymentStatus) && !estimatedPaymentDate) {
      return res.status(400).json({
        message: "La fecha estimada de pago es obligatoria si la venta no esta pagada",
      });
    }

    if (paid > 0 && (!paymentMethodId || !paymentReference)) {
      return res.status(400).json({
        message: "Metodo y referencia de pago son obligatorios si hay pago inicial",
      });
    }

    if (paymentMethodId) {
      const paymentMethod = await findPaymentMethodById(paymentMethodId);

      if (!paymentMethod || !paymentMethod.is_active) {
        return res.status(404).json({ message: "Metodo de pago no encontrado o inactivo" });
      }
    }

    const code = await getNextSaleCode();
    const sale = await convertQuoteToSale({
      quoteId: req.params.quoteId,
      code,
      paymentStatus,
      amountPaid: paid,
      estimatedPaymentDate,
      externalInvoiceReference,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
      createdBy: req.user.id,
    });

    if (!sale) {
      return res.status(404).json({ message: "Cotizacion no encontrada" });
    }

    if (sale.invalidQuoteStatus) {
      return res.status(409).json({
        message: "Solo se pueden convertir cotizaciones aceptadas",
        data: sale.quote,
      });
    }

    if (sale.alreadyConverted) {
      return res.status(409).json({
        message: "La cotizacion ya fue convertida en venta",
        saleId: sale.saleId,
      });
    }

    const fullSale = await findSaleById(sale.id);

    res.status(201).json({
      message: "Venta creada y enviada a bodega",
      data: fullSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear venta desde cotizacion",
      error: error.message,
    });
  }
};

export const postDirectSale = async (req, res) => {
  try {
    const {
      clientId,
      sellerId,
      paymentStatus,
      currency,
      shippingCost = 0,
      amountPaid = 0,
      estimatedDeliveryDate,
      estimatedPaymentDate,
      externalInvoiceReference,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
      items,
    } = req.body;

    if (!clientId || !sellerId || !paymentStatus || !currency || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Cliente, vendedor, estado de pago, moneda e items son obligatorios",
      });
    }

    if (!["pagada", "pago_parcial", "pendiente_pago"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Estado de pago invalido" });
    }

    if (!["COP", "USD"].includes(currency)) {
      return res.status(400).json({ message: "La moneda debe ser COP o USD" });
    }

    const client = await findClientById(clientId);

    if (!client || !client.is_active) {
      return res.status(404).json({ message: "Cliente no encontrado o inactivo" });
    }

    const seller = await findUserById(sellerId);

    if (!seller || !seller.is_active) {
      return res.status(404).json({ message: "Vendedor no encontrado o inactivo" });
    }

    if (!["seller", "admin", "accounting"].includes(seller.role_name)) {
      return res.status(400).json({ message: "La venta debe asignarse a un usuario comercial valido" });
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

      if (!item.lotId && !item.coffeeTypeId && !item.coffeeProfileId) {
        return res.status(400).json({
          message: "Cada item de venta directa debe indicar lote, tipo o perfil",
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
    const paid = toNumber(amountPaid);

    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      return res.status(400).json({
        message: "El valor pagado debe ser valido y no superar el total",
      });
    }

    if (paymentStatus === "pagada" && paid !== total) {
      return res.status(400).json({ message: "Una venta pagada debe tener pagado el total" });
    }

    if (["pago_parcial", "pendiente_pago"].includes(paymentStatus) && !estimatedPaymentDate) {
      return res.status(400).json({
        message: "La fecha estimada de pago es obligatoria si la venta no esta pagada",
      });
    }

    if (paid > 0 && (!paymentMethodId || !paymentReference)) {
      return res.status(400).json({
        message: "Metodo y referencia de pago son obligatorios si hay pago inicial",
      });
    }

    if (paymentMethodId) {
      const paymentMethod = await findPaymentMethodById(paymentMethodId);

      if (!paymentMethod || !paymentMethod.is_active) {
        return res.status(404).json({ message: "Metodo de pago no encontrado o inactivo" });
      }
    }

    const code = await getNextSaleCode();
    const sale = await createDirectSale({
      code,
      clientId,
      sellerId,
      paymentStatus,
      currency,
      subtotal,
      shippingCost: shipping,
      total,
      amountPaid: paid,
      estimatedDeliveryDate,
      estimatedPaymentDate,
      externalInvoiceReference,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
      items: cleanItems,
      createdBy: req.user.id,
    });
    const fullSale = await findSaleById(sale.id);

    res.status(201).json({
      message: "Venta directa creada y enviada a bodega",
      data: fullSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear venta directa",
      error: error.message,
    });
  }
};

export const postSalePayment = async (req, res) => {
  try {
    const {
      amount,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
    } = req.body;

    const paymentAmount = toNumber(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: "El valor del pago debe ser mayor a cero" });
    }

    if (!paymentMethodId || !paymentReference) {
      return res.status(400).json({
        message: "Metodo de pago y referencia son obligatorios",
      });
    }

    const paymentMethod = await findPaymentMethodById(paymentMethodId);

    if (!paymentMethod || !paymentMethod.is_active) {
      return res.status(404).json({ message: "Metodo de pago no encontrado o inactivo" });
    }

    const sale = await registerSalePayment({
      saleId: req.params.id,
      amount: paymentAmount,
      paymentMethodId,
      paymentReference,
      paidAt: paidAt || new Date(),
      notes,
      registeredBy: req.user.id,
    });

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (sale.invalidStatus) {
      return res.status(409).json({
        message: "No se pueden registrar pagos sobre ventas anuladas",
        data: sale.sale,
      });
    }

    if (sale.amountTooHigh) {
      return res.status(409).json({
        message: "El pago no puede superar el saldo pendiente",
        data: sale.sale,
      });
    }

    const fullSale = await findSaleById(req.params.id);

    res.status(201).json({
      message: "Pago registrado correctamente",
      data: fullSale,
    });
  } catch (error) {
    logControllerError(req, error, {
      operation: "postSalePayment",
      saleId: req.params.id,
    });

    res.status(500).json({
      message: "Error al registrar pago",
      error: error.message,
    });
  }
};

export const putSalePrepared = async (req, res) => {
  try {
    const sale = await findSaleById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (!["pendiente_alistamiento", "pendiente_bodega", "lote_asignado", "listo_para_ensamble", "ensamble_definido"].includes(sale.status)) {
      return res.status(409).json({
        message: "Solo se pueden alistar ventas pendientes de bodega o con lotes asignados",
        data: sale,
      });
    }

    const updatedSale = await updateSaleOperationalStatus({
      saleId: req.params.id,
      status: "alistada",
      notes: req.body.notes,
      userId: req.user.id,
    });

    if (updatedSale.missingAssignments) {
      return res.status(409).json({
        message: "Antes de alistar se debe asignar al menos un lote a la venta",
        data: updatedSale.sale,
      });
    }

    res.json({
      message: "Venta marcada como alistada",
      data: updatedSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar venta como alistada",
      error: error.message,
    });
  }
};

export const putSaleDispatched = async (req, res) => {
  try {
    const sale = await findSaleById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (sale.status !== "alistada") {
      return res.status(409).json({
        message: "Solo se pueden despachar ventas alistadas",
        data: sale,
      });
    }

    const updatedSale = await updateSaleOperationalStatus({
      saleId: req.params.id,
      status: "despachada",
      notes: req.body.notes,
      userId: req.user.id,
    });

    res.json({
      message: "Venta marcada como despachada",
      data: updatedSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar venta como despachada",
      error: error.message,
    });
  }
};

export const putSaleCancelled = async (req, res) => {
  try {
    const sale = await cancelSale({
      saleId: req.params.id,
      notes: req.body.notes,
      cancelledBy: req.user.id,
    });

    if (!sale) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (sale.alreadyDispatched) {
      return res.status(409).json({
        message: "No se puede anular una venta despachada",
        data: sale.sale,
      });
    }

    if (sale.alreadyCancelled) {
      return res.status(409).json({
        message: "La venta ya estaba anulada",
        data: sale.sale,
      });
    }

    if (sale.invalidStatus) {
      return res.status(409).json({
        message: "La venta no se puede anular en su estado actual",
        data: sale.sale,
      });
    }

    const fullSale = await findSaleById(req.params.id);

    res.json({
      message: "Venta anulada e inventario devuelto correctamente",
      data: fullSale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al anular venta",
      error: error.message,
    });
  }
};
