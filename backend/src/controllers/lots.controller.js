import { findSupplierById } from "../models/suppliers.model.js";
import {
  findCoffeeTypeById,
  findCoffeeProfileById,
  findPaymentMethodById,
  findPackagingTypeById,
  getNextLotCode,
  getNextProcessedLotCode,
  listLots,
  findLotById,
  createReceivedLot,
  updateLotLabReview,
  registerLotPurchase,
  createInitialInventoryLot,
} from "../models/lots.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

const roundKg = (value) => Number(value.toFixed(3));

const isValidNumber = (value) => Number.isFinite(value);

export const getLots = async (req, res) => {
  try {
    const lots = await listLots({
      status: req.query.status,
      supplierId: req.query.supplierId,
      coffeeTypeId: req.query.coffeeTypeId,
    });

    res.json(lots);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener lotes",
      error: error.message,
    });
  }
};

export const getLot = async (req, res) => {
  try {
    const lot = await findLotById(req.params.id);

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    res.json(lot);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener lote",
      error: error.message,
    });
  }
};

export const postReceivedLot = async (req, res) => {
  try {
    const {
      supplierId,
      coffeeTypeId,
      grossWeightKg,
      packagingTypeId,
      packagingQuantity = 0,
      hasInnerBag = false,
      innerBagQuantity,
      humidityPercent,
      performanceFactor,
      visualStatus,
      visualDefectPercent,
      visualNotes,
      originZone,
      initialComment,
    } = req.body;

    if (!supplierId || !coffeeTypeId || !grossWeightKg || !packagingTypeId || !visualStatus) {
      return res.status(400).json({
        message: "Proveedor, tipo de cafe, peso bruto, embalaje y examen visual son obligatorios",
      });
    }

    if (!["aprobado", "rechazado"].includes(visualStatus)) {
      return res.status(400).json({ message: "El examen visual debe ser aprobado o rechazado" });
    }

    const supplier = await findSupplierById(supplierId);

    if (!supplier || !supplier.is_active) {
      return res.status(404).json({ message: "Proveedor no encontrado o inactivo" });
    }

    const coffeeType = await findCoffeeTypeById(coffeeTypeId);

    if (!coffeeType || !coffeeType.is_active) {
      return res.status(404).json({ message: "Tipo de cafe no encontrado o inactivo" });
    }

    const packagingType = await findPackagingTypeById(packagingTypeId);

    if (!packagingType || !packagingType.is_active) {
      return res.status(404).json({ message: "Tipo de embalaje no encontrado o inactivo" });
    }

    const gross = toNumber(grossWeightKg);
    const packages = Number(packagingQuantity);
    const bags = innerBagQuantity !== undefined ? Number(innerBagQuantity) : hasInnerBag ? packages : 0;

    if (!isValidNumber(gross) || !isValidNumber(packages) || !isValidNumber(bags)) {
      return res.status(400).json({
        message: "Los pesos y cantidades de embalaje deben ser numeros validos",
      });
    }

    if (gross <= 0 || packages < 0 || bags < 0) {
      return res.status(400).json({
        message: "Los pesos y cantidades de embalaje deben ser valores validos",
      });
    }

    // La bolsa interna descuenta 50 gramos por unidad, segun la regla definida con el cliente.
    const tareWeightKg = roundKg(Number(packagingType.tare_kg) * packages + 0.05 * bags);
    const netWeightKg = roundKg(gross - tareWeightKg);

    if (netWeightKg <= 0) {
      return res.status(400).json({
        message: "El peso neto no puede ser menor o igual a cero",
      });
    }

    const code = visualStatus === "aprobado" ? await getNextLotCode() : null;
    const status = visualStatus === "aprobado" ? "pendiente_laboratorio" : "rechazado";
    const humidity = toNumber(humidityPercent);
    const performance = toNumber(performanceFactor);
    const visualDefect = toNumber(visualDefectPercent);

    if (
      (humidity !== null && !isValidNumber(humidity)) ||
      (performance !== null && !isValidNumber(performance)) ||
      (visualDefect !== null && !isValidNumber(visualDefect))
    ) {
      return res.status(400).json({
        message: "La humedad, el factor de rendimiento y el porcentaje de defectos deben ser numeros validos",
      });
    }

    if (
      (humidity !== null && (humidity < 0 || humidity > 100)) ||
      (performance !== null && performance < 0) ||
      (visualDefect !== null && (visualDefect < 0 || visualDefect > 100))
    ) {
      return res.status(400).json({
        message: "La humedad y defectos deben estar entre 0 y 100; el factor de rendimiento debe ser mayor o igual a cero",
      });
    }

    const lot = await createReceivedLot({
      code,
      supplierId,
      coffeeTypeId,
      status,
      grossWeightKg: gross,
      packagingTypeId,
      packagingQuantity: packages,
      innerBagQuantity: bags,
      tareWeightKg,
      netWeightKg,
      availableWeightKg: 0,
      humidityPercent: humidity,
      performanceFactor: performance,
      visualStatus,
      visualDefectPercent: visualDefect,
      visualNotes,
      originZone,
      initialComment,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message:
        visualStatus === "aprobado"
          ? "Lote recibido y enviado a laboratorio"
          : "Lote rechazado y guardado como historico",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar lote",
      error: error.message,
    });
  }
};

const requiredCuppingFields = [
  "aroma",
  "fragrance",
  "flavor",
  "acidity",
  "sweetness",
  "body",
  "balance",
  "uniformity",
  "residual",
  "cleanCup",
];

export const putLabReview = async (req, res) => {
  try {
    const {
      decision,
      humidityPercent,
      aroma,
      fragrance,
      flavor,
      acidity,
      sweetness,
      body,
      balance,
      uniformity,
      residual,
      cleanCup,
      score,
      notes,
    } = req.body;

    if (!["aprobado", "rechazado"].includes(decision)) {
      return res.status(400).json({
        message: "La decision de laboratorio debe ser aprobado o rechazado",
      });
    }

    const humidity = toNumber(humidityPercent);
    const scoreValue = toNumber(score);

    if (!isValidNumber(humidity)) {
      return res.status(400).json({ message: "La humedad de laboratorio es obligatoria" });
    }

    if (humidity < 0 || humidity > 100) {
      return res.status(400).json({ message: "La humedad debe estar entre 0 y 100" });
    }

    if (decision === "aprobado") {
      const missingField = requiredCuppingFields.find((field) => !req.body[field]);

      if (missingField || !isValidNumber(scoreValue)) {
        return res.status(400).json({
          message: "Para aprobar, la catacion completa y el score son obligatorios",
        });
      }
    }

    if (scoreValue !== null && !isValidNumber(scoreValue)) {
      return res.status(400).json({ message: "El score debe ser un numero valido" });
    }

    // El rango ideal definido por el cliente es 10% a 12%; se alerta, pero no bloquea la decision.
    const humidityAlert = humidity < 10 || humidity > 12;

    const lot = await updateLotLabReview(req.params.id, {
      status: decision,
      humidityPercent: humidity,
      aroma,
      fragrance,
      flavor,
      acidity,
      sweetness,
      body,
      balance,
      uniformity,
      residual,
      cleanCup,
      score: scoreValue,
      notes,
      reviewedBy: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden revisar lotes pendientes de laboratorio",
        data: lot.lot,
      });
    }

    res.json({
      message:
        decision === "aprobado"
          ? "Lote aprobado por laboratorio"
          : "Lote rechazado por laboratorio",
      humidityAlert,
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar revision de laboratorio",
      error: error.message,
    });
  }
};

export const putPurchase = async (req, res) => {
  try {
    const {
      purchasePricePerKg,
      paymentMethodId,
      paymentReference,
      paidAt,
    } = req.body;

    if (purchasePricePerKg === undefined || purchasePricePerKg === null || !paymentMethodId || !paymentReference) {
      return res.status(400).json({
        message: "Precio por kg, metodo de pago y referencia de pago son obligatorios",
      });
    }

    const price = toNumber(purchasePricePerKg);

    if (!isValidNumber(price) || price <= 0) {
      return res.status(400).json({ message: "El precio por kg debe ser un numero mayor a cero" });
    }

    const paymentMethod = await findPaymentMethodById(paymentMethodId);

    if (!paymentMethod || !paymentMethod.is_active) {
      return res.status(404).json({ message: "Metodo de pago no encontrado o inactivo" });
    }

    const currentLot = await findLotById(req.params.id);

    if (!currentLot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    // El total se calcula desde el peso neto para evitar errores manuales en la compra.
    const purchaseTotal = Number((Number(currentLot.net_weight_kg) * price).toFixed(2));
    const lot = await registerLotPurchase(req.params.id, {
      purchasePricePerKg: price,
      purchaseTotal,
      paymentMethodId,
      paymentReference,
      paidAt: paidAt || new Date(),
      registeredBy: req.user.id,
    });

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden comprar/pagar lotes aprobados por laboratorio",
        data: lot.lot,
      });
    }

    res.json({
      message: "Compra registrada y lote disponible",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar compra del lote",
      error: error.message,
    });
  }
};

export const postInitialLoad = async (req, res) => {
  try {
    const {
      lotKind = "LOT",
      supplierId,
      coffeeTypeId,
      coffeeProfileId,
      weightKg,
      humidityPercent,
      score,
      originZone,
      initialComment,
      purchasePricePerKg,
      purchasePaid = false,
    } = req.body;

    if (!["LOT", "PROC"].includes(lotKind)) {
      return res.status(400).json({ message: "El tipo de lote debe ser LOT o PROC" });
    }

    const weight = toNumber(weightKg);

    if (!isValidNumber(weight) || weight <= 0) {
      return res.status(400).json({ message: "La cantidad en kg debe ser mayor a cero" });
    }

    if (lotKind === "LOT" && !coffeeTypeId) {
      return res.status(400).json({ message: "Los lotes LOT requieren tipo de cafe" });
    }

    if (lotKind === "PROC" && !coffeeProfileId) {
      return res.status(400).json({ message: "Los lotes PROC requieren perfil comercial" });
    }

    if (supplierId) {
      const supplier = await findSupplierById(supplierId);

      if (!supplier || !supplier.is_active) {
        return res.status(404).json({ message: "Proveedor no encontrado o inactivo" });
      }
    }

    if (coffeeTypeId) {
      const coffeeType = await findCoffeeTypeById(coffeeTypeId);

      if (!coffeeType || !coffeeType.is_active) {
        return res.status(404).json({ message: "Tipo de cafe no encontrado o inactivo" });
      }
    }

    if (coffeeProfileId) {
      const coffeeProfile = await findCoffeeProfileById(coffeeProfileId);

      if (!coffeeProfile || !coffeeProfile.is_active) {
        return res.status(404).json({ message: "Perfil comercial no encontrado o inactivo" });
      }
    }

    const humidity = toNumber(humidityPercent);
    const scoreValue = toNumber(score);
    const purchasePrice = toNumber(purchasePricePerKg);

    if (
      (humidity !== null && (!isValidNumber(humidity) || humidity < 0 || humidity > 100)) ||
      (scoreValue !== null && !isValidNumber(scoreValue)) ||
      (purchasePrice !== null && (!isValidNumber(purchasePrice) || purchasePrice < 0))
    ) {
      return res.status(400).json({
        message: "Humedad, score o precio de compra tienen valores invalidos",
      });
    }

    const code = lotKind === "PROC" ? await getNextProcessedLotCode() : await getNextLotCode();
    const purchaseTotal = purchasePrice !== null ? Number((weight * purchasePrice).toFixed(2)) : null;

    const lot = await createInitialInventoryLot({
      code,
      lotKind,
      supplierId: supplierId || null,
      coffeeTypeId: coffeeTypeId || null,
      coffeeProfileId: coffeeProfileId || null,
      weightKg: weight,
      humidityPercent: humidity,
      score: scoreValue,
      originZone,
      initialComment,
      purchasePricePerKg: purchasePrice,
      purchaseTotal,
      purchasePaid,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Lote creado desde carga inicial",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear carga inicial de inventario",
      error: error.message,
    });
  }
};
