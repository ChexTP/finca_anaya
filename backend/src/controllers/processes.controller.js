import {
  getNextProcessCode,
  listProcesses,
  findProcessById,
  createProcess,
  startProcess,
  markProcessPendingLaboratory,
  finishProcess,
} from "../models/processes.model.js";
import {
  findCoffeeProfileById,
  getNextProcessedLotCode,
} from "../models/lots.model.js";
import { findQuoteById } from "../models/quotes.model.js";
import { findSaleById } from "../models/sales.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
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

export const getProcesses = async (req, res) => {
  try {
    const processes = await listProcesses({ status: req.query.status });
    res.json(processes);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener procesos",
      error: error.message,
    });
  }
};

export const getProcess = async (req, res) => {
  try {
    const process = await findProcessById(req.params.id);

    if (!process) {
      return res.status(404).json({ message: "Proceso no encontrado" });
    }

    res.json(process);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener proceso",
      error: error.message,
    });
  }
};

export const postProcess = async (req, res) => {
  try {
    const { quoteId, saleId, processLocation, notes, inputs } = req.body;

    if (!Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({ message: "Debe seleccionar al menos un lote de entrada" });
    }

    const cleanInputs = inputs.map((input) => ({
      lotId: input.lotId,
      quantityKg: toNumber(input.quantityKg),
    }));

    const invalidInput = cleanInputs.find(
      (input) => !input.lotId || !Number.isFinite(input.quantityKg) || input.quantityKg <= 0
    );

    if (invalidInput) {
      return res.status(400).json({
        message: "Cada lote de entrada debe tener lote y cantidad mayor a cero",
      });
    }

    if (quoteId) {
      const quote = await findQuoteById(quoteId);

      if (!quote) {
        return res.status(404).json({ message: "Preventa no encontrada" });
      }

      if (quote.quote_type !== "preventa") {
        return res.status(400).json({ message: "El proceso solo puede asociarse a una preventa" });
      }

      if (quote.status === "anulada") {
        return res.status(409).json({ message: "No se puede asociar un proceso a una preventa anulada" });
      }
    }

    if (saleId) {
      const sale = await findSaleById(saleId);

      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }

      if (["despachada", "anulada"].includes(sale.status)) {
        return res.status(409).json({ message: "No se puede crear proceso para una venta despachada o anulada" });
      }
    }

    const code = await getNextProcessCode();
    const process = await createProcess({
      code,
      quoteId,
      saleId,
      processLocation,
      notes,
      inputs: cleanInputs,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Solicitud de proceso creada correctamente",
      data: process,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear proceso",
      error: error.message,
    });
  }
};

export const putStartProcess = async (req, res) => {
  try {
    const { processLocation, estimatedReturnDate, notes } = req.body;

    if (!estimatedReturnDate) {
      return res.status(400).json({ message: "La fecha estimada de regreso a bodega es obligatoria" });
    }

    const result = await startProcess({
      processId: req.params.id,
      processLocation,
      estimatedReturnDate,
      notes,
      startedBy: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "Proceso no encontrado" });
    }

    if (result.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden iniciar procesos en estado pendiente",
        data: result.process,
      });
    }

    res.json({
      message: "Proceso iniciado correctamente",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al iniciar proceso",
      error: error.message,
    });
  }
};

export const putProcessPendingLaboratory = async (req, res) => {
  try {
    const result = await markProcessPendingLaboratory({
      processId: req.params.id,
      notes: req.body.notes,
    });

    if (!result) {
      return res.status(404).json({ message: "Proceso no encontrado" });
    }

    if (result.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden enviar a laboratorio procesos en estado en_proceso",
        data: result.process,
      });
    }

    res.json({
      message: "Proceso marcado como pendiente de laboratorio",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar proceso pendiente de laboratorio",
      error: error.message,
    });
  }
};

export const putFinishProcess = async (req, res) => {
  try {
    const {
      coffeeProfileId,
      outputWeightKg,
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
      initialComment,
    } = req.body;

    if (!coffeeProfileId) {
      return res.status(400).json({ message: "El perfil comercial es obligatorio" });
    }

    const profile = await findCoffeeProfileById(coffeeProfileId);

    if (!profile || !profile.is_active) {
      return res.status(404).json({ message: "Perfil comercial no encontrado o inactivo" });
    }

    const outputWeight = toNumber(outputWeightKg);
    const humidity = toNumber(humidityPercent);
    const scoreValue = toNumber(score);

    if (!Number.isFinite(outputWeight) || outputWeight <= 0) {
      return res.status(400).json({ message: "La cantidad final debe ser mayor a cero" });
    }

    if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
      return res.status(400).json({ message: "La humedad final debe estar entre 0 y 100" });
    }

    const missingField = requiredCuppingFields.find((field) => !req.body[field]);

    if (missingField || !Number.isFinite(scoreValue)) {
      return res.status(400).json({
        message: "Para finalizar el proceso, la catacion completa y el score son obligatorios",
      });
    }

    const code = await getNextProcessedLotCode();
    const result = await finishProcess({
      processId: req.params.id,
      finalizedBy: req.user.id,
      outputLot: {
        code,
        coffeeProfileId,
        weightKg: outputWeight,
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
        initialComment,
      },
    });

    if (!result) {
      return res.status(404).json({ message: "Proceso no encontrado" });
    }

    if (result.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden finalizar procesos pendientes de laboratorio",
        data: result.process,
      });
    }

    if (result.invalidWeight) {
      return res.status(409).json({
        message: "La cantidad final no puede ser mayor que la cantidad de entrada",
        data: result.process,
      });
    }

    res.json({
      message: "Proceso finalizado y lote PROC creado",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al finalizar proceso",
      error: error.message,
    });
  }
};
