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
  updateLotCode,
  updateLotAdminData,
  createReceivedLot,
  updateLotReceptionData,
  markRejectedLotAsWithdrawn,
  markLotAsAdministrativelyWithdrawn,
  updateLotLabData,
  updateLotLabReview,
  updateLotPhysicalReview,
  deletePendingPhysicalReviewLot,
  liquidateLot,
  liquidateLotsGroup,
  registerLotPurchase,
  createInitialInventoryLot,
} from "../models/lots.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(String(value).trim().replace(",", "."));
};

const roundKg = (value) => Number(value.toFixed(3));

const isValidNumber = (value) => Number.isFinite(value);

const buildManualCode = ({ prefix, year, number }) => {
  const codeYear = String(year || new Date().getFullYear()).trim();
  const codeNumber = Number(number);

  if (!/^\d{4}$/.test(codeYear) || !Number.isInteger(codeNumber) || codeNumber <= 0) {
    return null;
  }

  return `${prefix}-${codeYear}-${String(codeNumber).padStart(4, "0")}`;
};

const commercialClassifications = ["Base", "Regional", "Varietal", "Exotico", "Procesado", "Pasilla", "Recuperacion"];
const regularCategoriesThatNeedExactName = ["Regional", "Varietal", "Exotico"];
const normalizeProcessVariant = (lotKind, value) => (lotKind === "PROC" && value === "ensamblado" ? "ensamblado" : "normal");

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

export const putLotCode = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim();

    if (!code) {
      return res.status(400).json({ message: "El codigo del lote es obligatorio" });
    }

    const result = await updateLotCode({ id: req.params.id, code, updatedBy: req.user.id });

    if (!result) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (result.duplicate) {
      return res.status(409).json({ message: "Ya existe un lote con ese codigo", data: result.lot });
    }

    const lot = await findLotById(req.params.id);
    res.json({ message: "Codigo de lote actualizado", data: lot });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar codigo de lote",
      error: error.message,
    });
  }
};

export const putLotAdminData = async (req, res) => {
  try {
    const {
      supplierId,
      coffeeTypeId,
      coffeeProfileId,
      presentation,
      lotKind,
      processVariant = "normal",
      commercialClassification,
      coffeeVariety,
      grossWeightKg,
      netWeightKg,
      availableWeightKg,
      humidityPercent,
      performanceFactor,
      aroma,
      flavor,
      sweetness,
      body,
      residual,
      cleanCup,
      score,
      labNotes,
      receivedAt,
      originZone,
      initialComment,
      changeNote,
    } = req.body;

    if (!presentation?.trim()) {
      return res.status(400).json({ message: "La presentacion del cafe es obligatoria" });
    }

    if (!["LOT", "PROC", "PASILLA", "RECUPERACION"].includes(lotKind)) {
      return res.status(400).json({ message: "El tipo interno debe ser LOT, PROC, PASILLA o RECUPERACION" });
    }

    if (commercialClassification && !commercialClassifications.includes(commercialClassification)) {
      return res.status(400).json({ message: "La categoria comercial no es valida" });
    }

    const gross = toNumber(grossWeightKg);
    const net = toNumber(netWeightKg);
    const available = toNumber(availableWeightKg);
    const humidity = toNumber(humidityPercent);
    const performance = toNumber(performanceFactor);
    const scoreValue = toNumber(score);

    if (
      !isValidNumber(gross) ||
      !isValidNumber(net) ||
      !isValidNumber(available) ||
      gross < 0 ||
      net < 0 ||
      available < 0 ||
      (humidity !== null && (!isValidNumber(humidity) || humidity < 0 || humidity > 100)) ||
      (performance !== null && (!isValidNumber(performance) || performance < 0)) ||
      (scoreValue !== null && !isValidNumber(scoreValue))
    ) {
      return res.status(400).json({
        message: "Pesos, humedad, factor o score tienen valores invalidos",
      });
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

    const lot = await updateLotAdminData(req.params.id, {
      supplierId: supplierId || null,
      coffeeTypeId: coffeeTypeId || null,
      coffeeProfileId: coffeeProfileId || null,
      presentation,
      lotKind,
      processVariant: normalizeProcessVariant(lotKind, processVariant),
      commercialClassification: commercialClassification || null,
      coffeeVariety: coffeeVariety || null,
      grossWeightKg: gross,
      netWeightKg: net,
      availableWeightKg: available,
      humidityPercent: humidity,
      performanceFactor: performance,
      aroma,
      flavor,
      sweetness,
      body,
      residual,
      cleanCup,
      score: scoreValue,
      labNotes,
      receivedAt: receivedAt || new Date(),
      originZone,
      initialComment,
      changeNote,
      updatedBy: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    res.json({
      message: "Datos administrativos del lote actualizados",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar datos administrativos del lote",
      error: error.message,
    });
  }
};

export const postReceivedLot = async (req, res) => {
  try {
    const {
      supplierId,
      coffeeTypeId,
      coffeeProfileId,
      lotKind = "LOT",
      processVariant = "normal",
      grossWeightKg,
      packagingTypeId,
      packagingQuantity = 0,
      hasInnerBag = false,
      innerBagQuantity,
      humidityPercent,
      performanceFactor,
      presentation = "Pergamino",
      receivedAt,
      coffeeVariety,
      visualDefectPercent,
      visualNotes,
      commercialClassification,
      originZone,
      initialComment,
    } = req.body;

    const normalizedLotKind = lotKind === "PROC" ? "PROC" : "LOT";

    if (!supplierId || !grossWeightKg || !packagingTypeId || !receivedAt) {
      return res.status(400).json({
        message: "Proveedor, fecha de llegada, peso y embalaje son obligatorios",
      });
    }

    if (normalizedLotKind === "LOT" && !coffeeTypeId) {
      return res.status(400).json({ message: "Debe seleccionar el cafe comprado" });
    }

    if (normalizedLotKind === "PROC" && !coffeeProfileId) {
      return res.status(400).json({ message: "Debe seleccionar el perfil de venta del proceso" });
    }

    if (normalizedLotKind === "PROC" && !coffeeTypeId) {
      return res.status(400).json({ message: "Debe seleccionar si el proceso es lavado, natural, honey u otro" });
    }

    if (commercialClassification && !commercialClassifications.includes(commercialClassification)) {
      return res.status(400).json({ message: "La clasificacion comercial no es valida" });
    }

    if (!presentation?.trim()) {
      return res.status(400).json({ message: "La presentacion del cafe es obligatoria" });
    }

    if (
      normalizedLotKind === "LOT" &&
      regularCategoriesThatNeedExactName.includes(commercialClassification) &&
      !String(coffeeVariety || "").trim()
    ) {
      return res.status(400).json({
        message: "La clasificacion o codigo exacto del cafe es obligatorio para Regional, Varietal y Exotico",
      });
    }

    const supplier = await findSupplierById(supplierId);

    if (!supplier || !supplier.is_active) {
      return res.status(404).json({ message: "Proveedor no encontrado o inactivo" });
    }

    let coffeeType = null;
    if (coffeeTypeId) {
      coffeeType = await findCoffeeTypeById(coffeeTypeId);

      if (!coffeeType || !coffeeType.is_active) {
        return res.status(404).json({ message: "Tipo de cafe no encontrado o inactivo" });
      }
    }

    let coffeeProfile = null;
    if (coffeeProfileId) {
      coffeeProfile = await findCoffeeProfileById(coffeeProfileId);

      if (!coffeeProfile || !coffeeProfile.is_active) {
        return res.status(404).json({ message: "Perfil comercial no encontrado o inactivo" });
      }
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

    const code = normalizedLotKind === "PROC" ? await getNextProcessedLotCode() : await getNextLotCode();
    const humidity = toNumber(humidityPercent);
    const performance = toNumber(performanceFactor);
    const status = humidity === null || performance === null
      ? "pendiente_revision_fisica"
      : "pendiente_laboratorio";
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
      coffeeTypeId: coffeeTypeId || null,
      coffeeProfileId: coffeeProfileId || null,
      lotKind: normalizedLotKind,
      processVariant: normalizeProcessVariant(normalizedLotKind, processVariant),
      status,
      presentation,
      grossWeightKg: gross,
      packagingTypeId,
      packagingQuantity: packages,
      innerBagQuantity: bags,
      tareWeightKg,
      netWeightKg,
      availableWeightKg: 0,
      humidityPercent: humidity,
      performanceFactor: performance,
      receivedAt,
      coffeeVariety: normalizedLotKind === "PROC" ? coffeeProfile?.name || coffeeVariety || null : coffeeVariety || null,
      visualStatus: null,
      visualDefectPercent: visualDefect,
      visualNotes,
      commercialClassification: normalizedLotKind === "PROC" ? "Procesado" : commercialClassification || null,
      originZone,
      initialComment,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Lote recibido y enviado a laboratorio para evaluacion",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar lote",
      error: error.message,
    });
  }
};

export const putReceptionData = async (req, res) => {
  try {
    const {
      supplierId,
      coffeeTypeId,
      coffeeProfileId,
      lotKind = "LOT",
      processVariant = "normal",
      grossWeightKg,
      packagingTypeId,
      packagingQuantity = 0,
      hasInnerBag = false,
      innerBagQuantity,
      humidityPercent,
      performanceFactor,
      presentation = "Pergamino",
      receivedAt,
      coffeeVariety,
      commercialClassification,
      originZone,
    } = req.body;

    const normalizedLotKind = lotKind === "PROC" ? "PROC" : "LOT";

    if (!supplierId || !grossWeightKg || !packagingTypeId || !receivedAt) {
      return res.status(400).json({
        message: "Proveedor, fecha de llegada, peso y embalaje son obligatorios",
      });
    }

    if (normalizedLotKind === "LOT" && !coffeeTypeId) {
      return res.status(400).json({ message: "Debe seleccionar el cafe comprado" });
    }

    if (normalizedLotKind === "PROC" && !coffeeProfileId) {
      return res.status(400).json({ message: "Debe seleccionar el perfil de venta del proceso" });
    }

    if (normalizedLotKind === "PROC" && !coffeeTypeId) {
      return res.status(400).json({ message: "Debe seleccionar si el proceso es lavado, natural, honey u otro" });
    }

    if (!presentation?.trim()) {
      return res.status(400).json({ message: "La presentacion del cafe es obligatoria" });
    }

    if (commercialClassification && !commercialClassifications.includes(commercialClassification)) {
      return res.status(400).json({ message: "La clasificacion comercial no es valida" });
    }

    if (
      normalizedLotKind === "LOT" &&
      regularCategoriesThatNeedExactName.includes(commercialClassification) &&
      !String(coffeeVariety || "").trim()
    ) {
      return res.status(400).json({
        message: "La clasificacion o codigo exacto del cafe es obligatorio para Regional, Varietal y Exotico",
      });
    }

    const supplier = await findSupplierById(supplierId);
    if (!supplier || !supplier.is_active) {
      return res.status(404).json({ message: "Proveedor no encontrado o inactivo" });
    }

    let coffeeType = null;
    if (coffeeTypeId) {
      coffeeType = await findCoffeeTypeById(coffeeTypeId);
      if (!coffeeType || !coffeeType.is_active) {
        return res.status(404).json({ message: "Tipo de cafe no encontrado o inactivo" });
      }
    }

    let coffeeProfile = null;
    if (coffeeProfileId) {
      coffeeProfile = await findCoffeeProfileById(coffeeProfileId);
      if (!coffeeProfile || !coffeeProfile.is_active) {
        return res.status(404).json({ message: "Perfil comercial no encontrado o inactivo" });
      }
    }

    const packagingType = await findPackagingTypeById(packagingTypeId);
    if (!packagingType || !packagingType.is_active) {
      return res.status(404).json({ message: "Tipo de embalaje no encontrado o inactivo" });
    }

    const gross = toNumber(grossWeightKg);
    const packages = Number(packagingQuantity);
    const bags = innerBagQuantity !== undefined ? Number(innerBagQuantity) : hasInnerBag ? packages : 0;
    const humidity = toNumber(humidityPercent);
    const performance = toNumber(performanceFactor);

    if (
      !isValidNumber(gross) ||
      !isValidNumber(packages) ||
      !isValidNumber(bags) ||
      (humidity !== null && !isValidNumber(humidity)) ||
      (performance !== null && !isValidNumber(performance))
    ) {
      return res.status(400).json({
        message: "Los pesos, cantidades, humedad y factor deben ser numeros validos",
      });
    }

    if (
      gross <= 0 ||
      packages < 0 ||
      bags < 0 ||
      (humidity !== null && (humidity < 0 || humidity > 100)) ||
      (performance !== null && performance < 0)
    ) {
      return res.status(400).json({
        message: "Los valores ingresados no son validos",
      });
    }

    const tareWeightKg = roundKg(Number(packagingType.tare_kg) * packages + 0.05 * bags);
    const netWeightKg = roundKg(gross - tareWeightKg);

    if (netWeightKg <= 0) {
      return res.status(400).json({ message: "El peso neto no puede ser menor o igual a cero" });
    }

    const lot = await updateLotReceptionData(req.params.id, {
      supplierId,
      coffeeTypeId: coffeeTypeId || null,
      coffeeProfileId: coffeeProfileId || null,
      lotKind: normalizedLotKind,
      processVariant: normalizeProcessVariant(normalizedLotKind, processVariant),
      presentation,
      grossWeightKg: gross,
      packagingTypeId,
      packagingQuantity: packages,
      innerBagQuantity: bags,
      tareWeightKg,
      netWeightKg,
      humidityPercent: humidity,
      performanceFactor: performance,
      receivedAt,
      coffeeVariety: normalizedLotKind === "PROC" ? coffeeProfile?.name || coffeeVariety || null : coffeeVariety || null,
      commercialClassification: normalizedLotKind === "PROC" ? "Procesado" : commercialClassification || null,
      originZone,
      updatedBy: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden corregir datos de recepcion antes de aprobacion de laboratorio",
        data: lot.lot,
      });
    }

    res.json({
      message: "Datos de recepcion corregidos correctamente",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al corregir datos de recepcion",
      error: error.message,
    });
  }
};

export const putPhysicalReview = async (req, res) => {
  try {
    const humidity = toNumber(req.body.humidityPercent);
    const performance = toNumber(req.body.performanceFactor);

    if (!isValidNumber(humidity) || humidity < 0 || humidity > 100) {
      return res.status(400).json({ message: "La humedad debe estar entre 0 y 100" });
    }

    if (!isValidNumber(performance) || performance < 0) {
      return res.status(400).json({ message: "El factor de rendimiento debe ser mayor o igual a cero" });
    }

    const lot = await updateLotPhysicalReview(req.params.id, {
      humidityPercent: humidity,
      performanceFactor: performance,
    });

    if (!lot) {
      return res.status(409).json({ message: "El lote no esta pendiente de revision fisica" });
    }

    res.json({
      message: "Revision fisica guardada. El lote paso a laboratorio",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar revision fisica", error: error.message });
  }
};

export const deletePendingPhysicalReview = async (req, res) => {
  try {
    const result = await deletePendingPhysicalReviewLot({ id: req.params.id });

    if (!result) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (result.invalidStatus) {
      return res.status(409).json({
        message: "Solo se puede borrar completamente un lote pendiente de revision fisica",
        data: result.lot,
      });
    }

    res.json({
      message: "Ingreso de cafe borrado completamente",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al borrar ingreso de cafe", error: error.message });
  }
};

export const putRejectedLotWithdrawal = async (req, res) => {
  try {
    const { notes } = req.body;
    const lot = await markRejectedLotAsWithdrawn({
      id: req.params.id,
      notes,
      withdrawnBy: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden retirar lotes que esten rechazados",
        data: lot.lot,
      });
    }

    res.json({
      message: "Lote rechazado marcado como retirado",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar lote rechazado como retirado",
      error: error.message,
    });
  }
};

export const putLotAdministrativeWithdrawal = async (req, res) => {
  try {
    const notes = String(req.body.notes || "").trim();

    if (!notes) {
      return res.status(400).json({ message: "La nota del retiro es obligatoria" });
    }

    const lot = await markLotAsAdministrativelyWithdrawn({
      id: req.params.id,
      notes,
      withdrawnBy: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Este lote ya esta retirado del inventario",
        data: lot.lot,
      });
    }

    res.json({
      message: "Lote retirado del inventario",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al retirar lote del inventario",
      error: error.message,
    });
  }
};

const requiredCuppingFields = [
  "aroma",
  "flavor",
  "sweetness",
  "body",
  "residual",
  "cleanCup",
];

export const putLabReview = async (req, res) => {
  try {
    const {
      decision,
      aroma,
      flavor,
      sweetness,
      body,
      residual,
      cleanCup,
      score,
      notes,
      commercialClassification,
      coffeeVariety,
      classificationChangeNote,
    } = req.body;

    if (!["aprobado", "rechazado"].includes(decision)) {
      return res.status(400).json({
        message: "La decision de laboratorio debe ser aprobado o rechazado",
      });
    }

    const currentLot = await findLotById(req.params.id);
    if (!currentLot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    const humidity = toNumber(currentLot.humidity_percent);
    const performance = toNumber(currentLot.performance_factor);
    const scoreValue = toNumber(score);

    if (decision === "aprobado" && (!isValidNumber(humidity) || !isValidNumber(performance))) {
      return res.status(400).json({
        message: "La humedad y el factor de rendimiento son obligatorios para aprobar",
      });
    }

    if (humidity !== null && (!isValidNumber(humidity) || humidity < 0 || humidity > 100)) {
      return res.status(400).json({ message: "La humedad debe estar entre 0 y 100" });
    }

    if (performance !== null && (!isValidNumber(performance) || performance < 0)) {
      return res.status(400).json({ message: "El factor de rendimiento debe ser mayor o igual a cero" });
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

    if (commercialClassification && !commercialClassifications.includes(commercialClassification)) {
      return res.status(400).json({ message: "La clasificacion comercial no es valida" });
    }

    const finalClassification = commercialClassification || currentLot.commercial_classification;
    const finalVariety = coffeeVariety !== undefined ? String(coffeeVariety || "").trim() : currentLot.coffee_variety;
    const classificationChanged =
      (currentLot.commercial_classification || "") !== (finalClassification || "") ||
      (currentLot.coffee_variety || "") !== (finalVariety || "");

    if (
      decision === "aprobado" &&
      regularCategoriesThatNeedExactName.includes(finalClassification) &&
      !String(finalVariety || "").trim()
    ) {
      return res.status(400).json({
        message: "La clasificacion o codigo exacto del cafe es obligatorio para Regional, Varietal y Exotico",
      });
    }

    if (classificationChanged && !String(classificationChangeNote || "").trim()) {
      return res.status(400).json({
        message: "Debe escribir una nota interna explicando el cambio de clasificacion",
      });
    }

    // El rango ideal definido por el cliente es 10% a 12%; se alerta, pero no bloquea la decision.
    const humidityAlert = humidity !== null && (humidity < 10 || humidity > 12);

    const lot = await updateLotLabReview(req.params.id, {
      status: decision,
      humidityPercent: humidity,
      performanceFactor: performance,
      aroma,
      fragrance: null,
      flavor,
      acidity: null,
      sweetness,
      body,
      balance: null,
      uniformity: null,
      residual,
      cleanCup,
      score: scoreValue,
      notes,
      commercialClassification: finalClassification || null,
      coffeeVariety: finalVariety || null,
      classificationChangeNote,
      classificationChanged,
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
          ? "Lote aprobado y pendiente de liquidacion"
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

export const putLabData = async (req, res) => {
  try {
    const {
      humidityPercent,
      performanceFactor,
      aroma,
      flavor,
      sweetness,
      body,
      residual,
      cleanCup,
      score,
      notes,
      changeNote,
    } = req.body;

    const humidity = toNumber(humidityPercent);
    const performance = toNumber(performanceFactor);
    const scoreValue = toNumber(score);

    if (
      (humidity !== null && (!isValidNumber(humidity) || humidity < 0 || humidity > 100)) ||
      (performance !== null && (!isValidNumber(performance) || performance < 0)) ||
      (scoreValue !== null && !isValidNumber(scoreValue))
    ) {
      return res.status(400).json({
        message: "Humedad, factor o score tienen valores invalidos",
      });
    }

    const lot = await updateLotLabData(req.params.id, {
      humidityPercent: humidity,
      performanceFactor: performance,
      aroma,
      fragrance: null,
      flavor,
      acidity: null,
      sweetness,
      body,
      balance: null,
      uniformity: null,
      residual,
      cleanCup,
      score: scoreValue,
      notes,
      changeNote,
      reviewedBy: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    res.json({
      message: "Datos de laboratorio corregidos correctamente",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al corregir datos de laboratorio",
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
        message: "Solo se puede registrar el pago de lotes aprobados y pendientes de pago",
        data: lot.lot,
      });
    }

    res.json({
      message: "Pago de compra registrado sin modificar el inventario",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar compra del lote",
      error: error.message,
    });
  }
};

export const putLiquidation = async (req, res) => {
  try {
    const { purchaseBaseFactor, purchasePriceFactor90, purchasePricePerKg, notes, purchaseOrderSnapshot } = req.body;
    const factor90Price = toNumber(purchasePriceFactor90);
    const price = toNumber(purchasePricePerKg);
    const cleanPurchaseOrderSnapshot = purchaseOrderSnapshot &&
      typeof purchaseOrderSnapshot === "object" &&
      !Array.isArray(purchaseOrderSnapshot)
      ? purchaseOrderSnapshot
      : {};

    if ((!isValidNumber(factor90Price) || factor90Price <= 0) && (!isValidNumber(price) || price <= 0)) {
      return res.status(400).json({
        message: "El precio factor base es obligatorio y debe ser mayor a cero",
      });
    }

    const lot = await liquidateLot({
      id: req.params.id,
      purchaseBaseFactor: toNumber(purchaseBaseFactor),
      purchasePriceFactor90: factor90Price,
      purchasePricePerKg: price,
      notes,
      purchaseOrderSnapshot: cleanPurchaseOrderSnapshot,
      liquidatedBy: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden liquidar lotes pendientes de liquidacion",
        data: lot.lot,
      });
    }

    res.json({
      message: "Lote liquidado correctamente. Ya queda disponible para uso operativo.",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al liquidar lote",
      error: error.message,
    });
  }
};

export const postGroupedLiquidation = async (req, res) => {
  try {
    const { items, notes, purchaseOrderSnapshot } = req.body;
    const cleanItems = Array.isArray(items) ? items : [];
    const cleanPurchaseOrderSnapshot = purchaseOrderSnapshot &&
      typeof purchaseOrderSnapshot === "object" &&
      !Array.isArray(purchaseOrderSnapshot)
      ? purchaseOrderSnapshot
      : {};

    if (cleanItems.length === 0) {
      return res.status(400).json({ message: "Seleccione al menos un lote para liquidar" });
    }

    for (const item of cleanItems) {
      const id = Number(item.id);
      const factor90Price = toNumber(item.purchasePriceFactor90);
      const price = toNumber(item.purchasePricePerKg);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Cada lote de la liquidacion debe tener un id valido" });
      }

      if ((!isValidNumber(factor90Price) || factor90Price <= 0) && (!isValidNumber(price) || price <= 0)) {
        return res.status(400).json({
          message: "Cada lote de la liquidacion debe tener un precio factor base mayor a cero",
        });
      }
    }

    const result = await liquidateLotsGroup({
      items: cleanItems.map((item) => ({
        id: Number(item.id),
        purchaseBaseFactor: toNumber(item.purchaseBaseFactor),
        purchasePriceFactor90: Number(item.purchasePriceFactor90),
        purchasePricePerKg: Number(item.purchasePricePerKg),
      })),
      notes,
      purchaseOrderSnapshot: cleanPurchaseOrderSnapshot,
      liquidatedBy: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "Uno o mas lotes no fueron encontrados" });
    }

    if (result.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden liquidar lotes pendientes de liquidacion",
        data: result.lot,
      });
    }

    res.json({
      message: "Lotes liquidados correctamente en una orden de compra agrupada.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al liquidar lotes agrupados",
      error: error.message,
    });
  }
};

export const postStockEntry = async (req, res) => {
  try {
    const {
      lotKind,
      profileSource = "purchase",
      processVariant = "normal",
      coffeeTypeId,
      coffeeProfileId,
      commercialClassification,
      coffeeVariety,
      weightKg,
      humidityPercent,
      presentation,
      receivedAt,
      originZone,
      initialComment,
      manualCodeNumber,
      manualCodeYear,
    } = req.body;

    if (!["LOT", "PASILLA", "RECUPERACION", "PROC"].includes(lotKind)) {
      return res.status(400).json({ message: "La entrada rapida debe ser LOT, PASILLA, RECUPERACION o PROC" });
    }

    if (presentation !== undefined && !presentation?.trim()) {
      return res.status(400).json({ message: "La presentacion del cafe es obligatoria" });
    }

    const usesCommercialProfile =
      lotKind === "PROC" ||
      (["PASILLA", "RECUPERACION"].includes(lotKind) && profileSource === "sale");
    const weight = toNumber(weightKg);
    const humidity = toNumber(humidityPercent);

    if (!usesCommercialProfile && !coffeeTypeId) {
      return res.status(400).json({ message: "Tipo de cafe es obligatorio" });
    }

    if (lotKind === "PROC" && !coffeeTypeId) {
      return res.status(400).json({ message: "Debe seleccionar si el proceso listo es lavado, natural, honey u otro" });
    }

    if (!isValidNumber(weight) || weight <= 0) {
      return res.status(400).json({ message: "Tipo de cafe y cantidad en kg son obligatorios" });
    }

    if (humidity !== null && (!isValidNumber(humidity) || humidity < 0 || humidity > 100)) {
      return res.status(400).json({ message: "La humedad debe estar entre 0 y 100" });
    }

    let coffeeType = null;
    if (coffeeTypeId) {
      coffeeType = await findCoffeeTypeById(coffeeTypeId);

      if (!coffeeType || !coffeeType.is_active) {
        return res.status(404).json({ message: "Tipo de cafe no encontrado o inactivo" });
      }
    }

    if (lotKind === "PASILLA" && !usesCommercialProfile && !["Lavado", "Natural"].includes(coffeeType?.name)) {
      return res.status(400).json({ message: "Las pasillas solo se registran como Lavado o Natural" });
    }

    let coffeeProfile = null;
    if (usesCommercialProfile) {
      if (!coffeeProfileId) {
        return res.status(400).json({
          message: lotKind === "PASILLA"
            ? "La pasilla necesita el perfil comercial al que pertenece"
            : lotKind === "RECUPERACION"
            ? "La recuperacion necesita el perfil comercial al que pertenece"
            : "El proceso listo necesita un perfil comercial",
        });
      }

      coffeeProfile = await findCoffeeProfileById(coffeeProfileId);

      if (!coffeeProfile || !coffeeProfile.is_active) {
        return res.status(404).json({ message: "Perfil comercial no encontrado o inactivo" });
      }
    }

    if (lotKind === "LOT" || (lotKind === "RECUPERACION" && !usesCommercialProfile)) {
      if (!regularCategoriesThatNeedExactName.includes(commercialClassification)) {
        return res.status(400).json({ message: "El cafe debe ser Regional, Varietal o Exotico" });
      }

      if (!String(coffeeVariety || "").trim()) {
        return res.status(400).json({ message: "El cafe necesita nombre, variedad o codigo exacto" });
      }
    }

    const manualCode = manualCodeNumber
      ? buildManualCode({
          prefix: lotKind === "PROC" ? "PROC" : lotKind === "PASILLA" ? "PAS" : lotKind === "RECUPERACION" ? "REC" : "LOT",
          year: manualCodeYear,
          number: manualCodeNumber,
        })
      : null;

    if (manualCodeNumber && !manualCode) {
      return res.status(400).json({ message: "El consecutivo manual debe ser un numero entero valido" });
    }

    const code = manualCode || (lotKind === "PROC" ? await getNextProcessedLotCode() : await getNextLotCode(lotKind));
    const lot = await createInitialInventoryLot({
      code,
      lotKind,
      processVariant: normalizeProcessVariant(lotKind, processVariant),
      supplierId: null,
      coffeeTypeId: usesCommercialProfile && lotKind !== "PROC" ? null : coffeeTypeId || null,
      coffeeProfileId: usesCommercialProfile ? coffeeProfileId || null : null,
      weightKg: weight,
      humidityPercent: humidity,
      score: null,
      receivedAt: receivedAt || new Date(),
      coffeeVariety: usesCommercialProfile ? coffeeProfile?.name || null : coffeeVariety || null,
      originZone,
      initialComment,
      commercialClassification:
        lotKind === "PROC"
          ? "Procesado"
          : lotKind === "PASILLA"
            ? "Pasilla"
            : lotKind === "RECUPERACION" && usesCommercialProfile
              ? "Recuperacion"
              : commercialClassification,
      purchasePricePerKg: null,
      purchaseTotal: null,
      purchasePaid: false,
      createdBy: req.user.id,
      presentation: presentation || "Pergamino",
    });

    res.status(201).json({
      message:
        lotKind === "PROC"
          ? "Proceso listo agregado al inventario"
          : lotKind === "PASILLA"
            ? "Pasilla agregada al inventario"
            : lotKind === "RECUPERACION"
              ? "Recuperacion agregada al inventario"
              : "Cafe disponible agregado al inventario",
      data: lot,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Ya existe un lote con ese codigo. Cambia el consecutivo manual.",
      });
    }

    res.status(500).json({
      message: "Error al crear entrada rapida de inventario",
      error: error.message,
    });
  }
};

export const postInitialLoad = async (req, res) => {
  try {
    const {
      lotKind = "LOT",
      processVariant = "normal",
      supplierId,
      coffeeTypeId,
      coffeeProfileId,
      weightKg,
      humidityPercent,
      score,
      originZone,
      initialComment,
      commercialClassification,
      purchasePricePerKg,
      purchasePaid = false,
    } = req.body;
    const presentation = req.body.presentation || "Pergamino";

    if (!["LOT", "PROC", "PASILLA", "RECUPERACION"].includes(lotKind)) {
      return res.status(400).json({ message: "El tipo de lote debe ser LOT, PROC, PASILLA o RECUPERACION" });
    }

    if (commercialClassification && !commercialClassifications.includes(commercialClassification)) {
      return res.status(400).json({ message: "La clasificacion comercial no es valida" });
    }

    if (!presentation?.trim()) {
      return res.status(400).json({ message: "La presentacion del cafe es obligatoria" });
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

    if (lotKind === "PROC" && !coffeeTypeId) {
      return res.status(400).json({ message: "Los lotes PROC requieren tipo de proceso" });
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

    const code = lotKind === "PROC" ? await getNextProcessedLotCode() : await getNextLotCode(lotKind);
    const purchaseTotal = purchasePrice !== null ? Number((weight * purchasePrice).toFixed(2)) : null;

    const lot = await createInitialInventoryLot({
      code,
      lotKind,
      processVariant: normalizeProcessVariant(lotKind, processVariant),
      supplierId: supplierId || null,
      coffeeTypeId: coffeeTypeId || null,
      coffeeProfileId: coffeeProfileId || null,
      weightKg: weight,
      humidityPercent: humidity,
      score: scoreValue,
      originZone,
      initialComment,
      commercialClassification: lotKind === "PROC" ? "Procesado" : commercialClassification || null,
      receivedAt: req.body.receivedAt || new Date(),
      coffeeVariety: req.body.coffeeVariety || null,
      purchasePricePerKg: purchasePrice,
      purchaseTotal,
      purchasePaid,
      createdBy: req.user.id,
      presentation,
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
