import { findCoffeeProfileById, findCoffeeTypeById } from "../models/lots.model.js";
import {
  createSampleRequest,
  findSampleRequestById,
  getNextSampleCode,
  listSampleRequests,
  updateSampleRequestStatus,
  replaceSampleBlend,
  hasCompleteSampleBlend,
} from "../models/samples.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

const isValidNumber = (value) => Number.isFinite(value);

const validStatuses = [
  "solicitada",
  "en_preparacion",
  "pendiente_laboratorio",
  "aprobada_laboratorio",
  "lista",
  "entregada",
  "cancelada",
];
const requiredSampleLabFields = [
  "humidityPercent",
  "aroma",
  "fragrance",
  "flavor",
  "sweetness",
  "body",
  "residual",
  "cleanCup",
  "score",
];

const hasCompleteSampleLabReview = (sample) => {
  return [
    sample.sample_humidity_percent,
    sample.sample_lab_aroma,
    sample.sample_lab_fragrance,
    sample.sample_lab_flavor,
    sample.sample_lab_sweetness,
    sample.sample_lab_body,
    sample.sample_lab_residual,
    sample.sample_lab_clean_cup,
    sample.sample_lab_score,
  ].every((value) => value !== null && value !== undefined);
};

export const getSamples = async (req, res) => {
  try {
    const createdBy = req.user.role === "seller" ? req.user.id : req.query.createdBy;
    const samples = await listSampleRequests({
      createdBy,
      status: req.query.status,
    });

    res.json(samples);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener solicitudes de muestras",
      error: error.message,
    });
  }
};

export const getSample = async (req, res) => {
  try {
    const sample = await findSampleRequestById(req.params.id);

    if (!sample) {
      return res.status(404).json({ message: "Solicitud de muestra no encontrada" });
    }

    if (req.user.role === "seller" && sample.created_by !== req.user.id) {
      return res.status(403).json({ message: "No tiene permisos para ver esta muestra" });
    }

    res.json(sample);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener solicitud de muestra",
      error: error.message,
    });
  }
};

export const postSample = async (req, res) => {
  try {
    const {
      requesterName,
      requesterPhone,
      requesterEmail,
      requesterCompany,
      requesterAddress,
      requesterCity,
      requesterCountry,
      items,
      currency = "COP",
      requestedAt,
      tentativeDeliveryDate,
      notes,
    } = req.body;

    if (!requesterName || !requestedAt || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Nombre, fecha y al menos una muestra son obligatorios",
      });
    }

    if (!["COP", "USD"].includes(currency)) {
      return res.status(400).json({ message: "La moneda debe ser COP o USD" });
    }

    const cleanItems = [];
    for (const item of items) {
      const coffeeTypeId = item.coffeeTypeId ? Number(item.coffeeTypeId) : null;
      const coffeeProfileId = item.coffeeProfileId ? Number(item.coffeeProfileId) : null;
      const quantityGrams = toNumber(item.quantityGrams);
      const price = toNumber(item.price);

      if (!coffeeTypeId && !coffeeProfileId && !item.description) {
        return res.status(400).json({ message: "Cada muestra debe indicar tipo, perfil o descripcion" });
      }
      if (!isValidNumber(quantityGrams) || quantityGrams <= 0) {
        return res.status(400).json({ message: "La cantidad de cada muestra debe ser mayor a cero" });
      }
      if (price !== null && (!isValidNumber(price) || price < 0)) {
        return res.status(400).json({ message: "El precio de cada muestra no puede ser negativo" });
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
          return res.status(404).json({ message: "Perfil de cafe no encontrado o inactivo" });
        }
      }

      cleanItems.push({
        coffeeTypeId,
        coffeeProfileId,
        description: item.description || null,
        quantityGrams,
        price,
      });
    }

    const code = await getNextSampleCode();
    const sample = await createSampleRequest({
      code,
      requesterName,
      requesterPhone: requesterPhone || null,
      requesterEmail,
      requesterCompany,
      requesterAddress,
      requesterCity,
      requesterCountry,
      items: cleanItems,
      currency,
      requestedAt,
      tentativeDeliveryDate: tentativeDeliveryDate || null,
      notes,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Solicitud de muestra creada correctamente",
      data: sample,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear solicitud de muestra",
      error: error.message,
    });
  }
};

export const putSampleStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const labReview = req.body.labReview || {};

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado de muestra no valido" });
    }

    const sampleBeforeUpdate = await findSampleRequestById(req.params.id);

    if (!sampleBeforeUpdate) {
      return res.status(404).json({ message: "Solicitud de muestra no encontrada" });
    }

    if (req.user.role === "laboratory") {
      if (sampleBeforeUpdate.status !== "pendiente_laboratorio") {
        return res.status(409).json({ message: "Laboratorio solo puede revisar muestras pendientes de analisis" });
      }

      if (!["aprobada_laboratorio", "en_preparacion"].includes(status)) {
        return res.status(403).json({ message: "Laboratorio solo puede aprobar o rechazar el analisis de muestra" });
      }
    }

    if (["admin", "samples"].includes(req.user.role)) {
      if (status === "aprobada_laboratorio") {
        return res.status(403).json({ message: "Solo laboratorio puede aprobar el analisis de muestra" });
      }

      if (status === "pendiente_laboratorio" && sampleBeforeUpdate.status !== "en_preparacion") {
        return res.status(409).json({ message: "La muestra debe estar en preparacion para solicitar analisis" });
      }

      if (status === "lista" && sampleBeforeUpdate.status !== "aprobada_laboratorio") {
        return res.status(409).json({ message: "Laboratorio debe aprobar la muestra antes de marcarla como lista" });
      }
    }

    const cleanLabReview = {
      humidityPercent: toNumber(labReview.humidityPercent),
      aroma: toNumber(labReview.aroma),
      fragrance: toNumber(labReview.fragrance),
      flavor: toNumber(labReview.flavor),
      sweetness: toNumber(labReview.sweetness),
      body: toNumber(labReview.body),
      residual: toNumber(labReview.residual),
      cleanCup: toNumber(labReview.cleanCup),
      score: toNumber(labReview.score),
      notes: labReview.notes || null,
    };

    if (status === "aprobada_laboratorio" && !hasCompleteSampleLabReview(sampleBeforeUpdate)) {
      const missingLabField = requiredSampleLabFields.find((field) => !isValidNumber(cleanLabReview[field]));

      if (missingLabField) {
        return res.status(400).json({
          message: "Los datos completos de laboratorio de la muestra son obligatorios para aprobar el analisis",
        });
      }

      const outOfRangeField = requiredSampleLabFields.find((field) => {
        const value = cleanLabReview[field];
        return value < 0 || value > 100;
      });

      if (outOfRangeField) {
        return res.status(400).json({
          message: "Los datos de laboratorio de la muestra deben estar entre 0 y 100",
        });
      }
    }

    if (["lista", "entregada"].includes(status) && !hasCompleteSampleLabReview(sampleBeforeUpdate)) {
      return res.status(400).json({
        message: "Antes de avanzar la muestra laboratorio debe registrar y aprobar los datos de analisis",
      });
    }

    if (["pendiente_laboratorio", "aprobada_laboratorio", "lista", "entregada"].includes(status) && !(await hasCompleteSampleBlend(req.params.id))) {
      return res.status(409).json({
        message: "Cada cafe de la solicitud debe tener un ensamble registrado que sume 100%",
      });
    }

    const sample = await updateSampleRequestStatus({
      id: req.params.id,
      status,
      notes,
      labReview: status === "aprobada_laboratorio" ? cleanLabReview : null,
      handledBy: req.user.id,
    });

    if (!sample) {
      return res.status(404).json({ message: "Solicitud de muestra no encontrada" });
    }

    res.json({
      message: "Estado de muestra actualizado correctamente",
      data: sample,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar estado de muestra",
      error: error.message,
    });
  }
};

export const putSampleBlend = async (req, res) => {
  try {
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({ message: "Debe registrar al menos una linea de ensamble" });
    }

    const sample = await findSampleRequestById(req.params.id);
    if (!sample) return res.status(404).json({ message: "Solicitud de muestra no encontrada" });

    const items = req.body.items.map((item) => ({
      sampleItemId: Number(item.sampleItemId),
      lotId: Number(item.lotId),
      percentage: toNumber(item.percentage),
      notes: item.notes || null,
    }));

    const invalid = items.some(
      (item) =>
        !Number.isInteger(item.sampleItemId) ||
        !Number.isInteger(item.lotId) ||
        !isValidNumber(item.percentage) ||
        item.percentage <= 0 ||
        item.percentage > 100
    );
    if (invalid) return res.status(400).json({ message: "Cafe, lote y porcentaje son obligatorios" });

    const totals = items.reduce((result, item) => {
      result[item.sampleItemId] = Number(((result[item.sampleItemId] || 0) + item.percentage).toFixed(2));
      return result;
    }, {});
    const allComplete = sample.items.every((item) => totals[item.id] === 100);
    if (!allComplete || Object.values(totals).some((total) => total !== 100)) {
      return res.status(400).json({ message: "El ensamble de cada cafe debe sumar exactamente 100%" });
    }

    await replaceSampleBlend({ sampleId: sample.id, items, createdBy: req.user.id });
    const updatedSample = await findSampleRequestById(sample.id);
    res.json({ message: "Ensamble de muestras guardado correctamente", data: updatedSample });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar ensamble de muestras", error: error.message });
  }
};
