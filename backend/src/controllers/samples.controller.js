import { findCoffeeProfileById, findCoffeeTypeById } from "../models/lots.model.js";
import {
  createSampleRequest,
  findSampleRequestById,
  getNextSampleCode,
  listSampleRequests,
  updateSampleRequestStatus,
} from "../models/samples.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

const isValidNumber = (value) => Number.isFinite(value);

const validStatuses = ["solicitada", "en_preparacion", "lista", "entregada", "cancelada"];

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

    if (!requesterName || !requesterPhone || !requestedAt || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Nombre, telefono, fecha y al menos una muestra son obligatorios",
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
      requesterPhone,
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

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado de muestra no valido" });
    }

    const sample = await updateSampleRequestStatus({
      id: req.params.id,
      status,
      notes,
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
