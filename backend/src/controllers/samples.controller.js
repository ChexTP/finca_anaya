import { findCoffeeProfileById, findCoffeeTypeById } from "../models/lots.model.js";
import {
  createSampleRequest,
  findSampleRequestById,
  getNextSampleCode,
  listSampleRequests,
  replaceSampleBlend,
  updateSampleRequest,
  updateSampleRequestStatus,
  updateSampleItemReviews,
  updateSampleShippingGuide,
  deleteSampleRequestById,
} from "../models/samples.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

const isValidNumber = (value) => Number.isFinite(value);
const toText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

const validStatuses = [
  "borrador",
  "enviada",
  "aprobada",
  "solicitada",
  "en_preparacion",
  "pendiente_laboratorio",
  "aprobada_laboratorio",
  "lista",
  "entregada",
  "cancelada",
];
const allowedShippingGuideStatuses = ["lista", "entregada"];
const maxShippingGuideSize = 4 * 1024 * 1024;
const requiredSampleLabFields = [
  "humidityPercent",
  "aroma",
  "flavor",
  "sweetness",
  "body",
  "residual",
  "cleanCup",
  "score",
];

const hasCompleteItemLabReview = (item) => {
  return [
    item.sample_humidity_percent,
    item.sample_lab_aroma,
    item.sample_lab_flavor,
    item.sample_lab_sweetness,
    item.sample_lab_body,
    item.sample_lab_residual,
    item.sample_lab_clean_cup,
    item.sample_lab_score,
  ].every((value) => value !== null && value !== undefined && String(value).trim() !== "");
};

const hasCompleteSampleLabReview = (sample) => {
  return sample.items?.length > 0 && sample.items.every(hasCompleteItemLabReview);
};

export const getSamples = async (req, res) => {
  try {
    const createdBy = req.user.role === "seller" ? req.user.id : req.query.createdBy;
    const samples = await listSampleRequests({
      createdBy,
      status: req.query.status,
    });

    if (req.user.role === "samples") {
      // Muestras debe ver las ordenes enviadas para preparar el trabajo, aunque la aprobacion siga en administracion.
      res.json(samples.filter((sample) => sample.status !== "borrador"));
      return;
    }

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
      status = "borrador",
    } = req.body;

    if (!["borrador", "enviada"].includes(status)) {
      return res.status(400).json({ message: "La muestra nueva solo puede quedar en borrador o enviada" });
    }

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
      status,
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

export const putSample = async (req, res) => {
  try {
    const sampleBeforeUpdate = await findSampleRequestById(req.params.id);

    if (!sampleBeforeUpdate) {
      return res.status(404).json({ message: "Solicitud de muestra no encontrada" });
    }

    if (req.user.role === "seller" && sampleBeforeUpdate.created_by !== req.user.id) {
      return res.status(403).json({ message: "No tiene permisos para editar esta muestra" });
    }

    if (!["borrador", "enviada", "aprobada"].includes(sampleBeforeUpdate.status)) {
      return res.status(409).json({ message: "Solo se puede editar la muestra antes de iniciar preparacion" });
    }

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
      status = sampleBeforeUpdate.status,
    } = req.body;

    const allowedEditStatuses = req.user.role === "admin" ? ["borrador", "enviada", "aprobada"] : ["borrador", "enviada"];
    if (!allowedEditStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado de muestra no valido para edicion" });
    }

    if (!requesterName || !requestedAt || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Nombre, fecha y al menos una muestra son obligatorios",
      });
    }

    if (!["COP", "USD"].includes(currency)) {
      return res.status(400).json({ message: "La moneda debe ser COP o USD" });
    }

    const cleanItems = await cleanSampleItems(items);

    const sample = await updateSampleRequest({
      id: Number(req.params.id),
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
      status,
      handledBy: req.user.id,
    });

    res.json({
      message: "Solicitud de muestra actualizada correctamente",
      data: sample,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar solicitud de muestra",
      error: error.message,
    });
  }
};

export const putSampleStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const itemReviews = Array.isArray(req.body.itemReviews) ? req.body.itemReviews : [];
    const commercialSampleStatuses = ["borrador", "enviada", "aprobada", "cancelada"];
    const canManageCommercialSample = ["admin", "accounting"].includes(req.user.role);

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

    if (req.user.role === "samples") {
      if (["aprobada", "solicitada"].includes(sampleBeforeUpdate.status) && status !== "en_preparacion") {
        return res.status(403).json({ message: "Muestras debe iniciar preparacion desde una solicitud aprobada" });
      }

      if (!["aprobada", "solicitada"].includes(sampleBeforeUpdate.status) && status === "en_preparacion") {
        return res.status(409).json({ message: "La solicitud debe estar aprobada antes de iniciar preparacion" });
      }
    }

    if (req.user.role === "accounting" && !commercialSampleStatuses.includes(status)) {
      return res.status(403).json({ message: "Contabilidad solo puede aprobar o cancelar muestras comerciales" });
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

    if (commercialSampleStatuses.includes(status) && !canManageCommercialSample) {
      return res.status(403).json({ message: "Solo administracion o contabilidad puede aprobar o devolver muestras comerciales" });
    }

    const cleanItemReviews = itemReviews.map((review) => ({
      sampleItemId: Number(review.sampleItemId),
      humidityPercent: toText(review.humidityPercent),
      aroma: toText(review.aroma),
      flavor: toText(review.flavor),
      sweetness: toText(review.sweetness),
      body: toText(review.body),
      residual: toText(review.residual),
      cleanCup: toText(review.cleanCup),
      score: toText(review.score),
      notes: toText(review.notes),
    }));

    if (status === "aprobada_laboratorio" && !hasCompleteSampleLabReview(sampleBeforeUpdate)) {
      const missingLabField = cleanItemReviews.length !== sampleBeforeUpdate.items.length || cleanItemReviews.some((review) => (
        !Number.isInteger(review.sampleItemId) ||
        requiredSampleLabFields.some((field) => !review[field])
      ));

      if (missingLabField) {
        return res.status(400).json({
          message: "Los datos completos de laboratorio de cada cafe solicitado son obligatorios para aprobar el analisis",
        });
      }

    }

    if (["lista", "entregada"].includes(status) && !hasCompleteSampleLabReview(sampleBeforeUpdate)) {
      return res.status(400).json({
        message: "Antes de avanzar la muestra laboratorio debe registrar y aprobar los datos de analisis",
      });
    }

    if (status === "aprobada_laboratorio" && cleanItemReviews.length > 0) {
      await updateSampleItemReviews({
        sampleId: Number(req.params.id),
        itemReviews: cleanItemReviews,
      });
    }

    const sample = await updateSampleRequestStatus({
      id: req.params.id,
      status,
      notes,
      labReview: null,
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

const cleanSampleItems = async (items) => {
  const cleanItems = [];

  for (const item of items) {
    const coffeeTypeId = item.coffeeTypeId ? Number(item.coffeeTypeId) : null;
    const coffeeProfileId = item.coffeeProfileId ? Number(item.coffeeProfileId) : null;
    const quantityGrams = toNumber(item.quantityGrams);
    const price = toNumber(item.price);

    if (!coffeeTypeId && !coffeeProfileId && !item.description) {
      throw new Error("Cada muestra debe indicar tipo, perfil o descripcion");
    }
    if (!isValidNumber(quantityGrams) || quantityGrams <= 0) {
      throw new Error("La cantidad de cada muestra debe ser mayor a cero");
    }
    if (price !== null && (!isValidNumber(price) || price < 0)) {
      throw new Error("El precio de cada muestra no puede ser negativo");
    }

    if (coffeeTypeId) {
      const coffeeType = await findCoffeeTypeById(coffeeTypeId);

      if (!coffeeType || !coffeeType.is_active) {
        throw new Error("Tipo de cafe no encontrado o inactivo");
      }
    }

    if (coffeeProfileId) {
      const coffeeProfile = await findCoffeeProfileById(coffeeProfileId);

      if (!coffeeProfile || !coffeeProfile.is_active) {
        throw new Error("Perfil de cafe no encontrado o inactivo");
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

  return cleanItems;
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
      lotId: item.lotId ? Number(item.lotId) : null,
      componentDescription: item.componentDescription?.trim() || null,
      percentage: toNumber(item.percentage),
      notes: item.notes || null,
    }));

    const invalid = items.some(
      (item) =>
        !Number.isInteger(item.sampleItemId) ||
        !item.componentDescription ||
        !isValidNumber(item.percentage) ||
        !Number.isInteger(item.percentage) ||
        item.percentage <= 0 ||
        item.percentage > 100
    );
    if (invalid) return res.status(400).json({ message: "Cafe, descripcion del componente y porcentaje entero entre 1 y 100 son obligatorios" });

    const totals = items.reduce((result, item) => {
      result[item.sampleItemId] = (result[item.sampleItemId] || 0) + item.percentage;
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

export const putSampleShippingGuide = async (req, res) => {
  try {
    const { image, fileName, mimeType } = req.body;
    const sample = await findSampleRequestById(req.params.id);

    if (!sample) {
      return res.status(404).json({ message: "Solicitud de muestra no encontrada" });
    }

    if (!allowedShippingGuideStatuses.includes(sample.status)) {
      return res.status(409).json({
        message: "La guia de envio solo se puede asociar cuando la muestra esta lista o entregada",
      });
    }

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return res.status(400).json({ message: "Debe cargar una imagen valida de la guia de envio" });
    }

    if (mimeType && !String(mimeType).startsWith("image/")) {
      return res.status(400).json({ message: "El archivo de guia debe ser una imagen" });
    }

    const base64Size = Math.ceil((image.length * 3) / 4);
    if (base64Size > maxShippingGuideSize) {
      return res.status(400).json({ message: "La imagen de la guia no debe superar 4 MB" });
    }

    await updateSampleShippingGuide({
      id: sample.id,
      image,
      fileName,
      mimeType,
      uploadedBy: req.user.id,
    });

    const updatedSample = await findSampleRequestById(sample.id);

    res.json({
      message: "Guia de envio asociada correctamente",
      data: updatedSample,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al guardar guia de envio",
      error: error.message,
    });
  }
};

export const deleteSample = async (req, res) => {
  try {
    const sample = await findSampleRequestById(req.params.id);

    if (!sample) {
      return res.status(404).json({ message: "Solicitud de muestra no encontrada" });
    }

    await deleteSampleRequestById(req.params.id);

    res.json({
      message: "Solicitud de muestra eliminada correctamente para pruebas",
      data: sample,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar solicitud de muestra",
      error: error.message,
    });
  }
};
