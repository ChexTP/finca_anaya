import {
  getNextProcessCode,
  listProcesses,
  findProcessById,
  createProcess,
  startProcess,
  markProcessPendingLaboratory,
  completeProcessPhysicalReview,
  finishProcess,
} from "../models/processes.model.js";
import {
  findCoffeeProfileById,
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
  "flavor",
  "sweetness",
  "body",
  "residual",
  "cleanCup",
];

export const getProcesses = async (req, res) => {
  try {
    const processes = await listProcesses({ status: req.query.status, processType: req.query.processType });
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
    const { quoteId, saleId, processType, processLocation, notes, inputs } = req.body;

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
      processType,
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
    const { processType, processLocation, estimatedReturnDate, notes } = req.body;

    if (!estimatedReturnDate) {
      return res.status(400).json({ message: "La fecha estimada de regreso a bodega es obligatoria" });
    }

    const result = await startProcess({
      processId: req.params.id,
      processType,
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
      message: "Proceso recibido y pendiente de revision fisica en bodega",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar proceso pendiente de laboratorio",
      error: error.message,
    });
  }
};

export const putProcessPhysicalReview = async (req, res) => {
  try {
    const outputs = Array.isArray(req.body.outputs)
      ? req.body.outputs.map((output) => ({
          coffeeProfileId: Number(output.coffeeProfileId),
          outputWeightKg: toNumber(output.outputWeightKg),
          humidityPercent: toNumber(output.humidityPercent),
          performanceFactor: toNumber(output.performanceFactor),
          presentation: output.presentation || "Excelso",
          notes: output.notes || null,
        }))
      : [];
    const outputWeight = outputs.length
      ? outputs.reduce((total, output) => total + Number(output.outputWeightKg || 0), 0)
      : toNumber(req.body.outputWeightKg);
    const humidity = toNumber(req.body.humidityPercent);
    const performance = toNumber(req.body.performanceFactor);

    const invalidOutput = outputs.find((output) => (
      !Number.isInteger(output.coffeeProfileId) ||
      !Number.isFinite(output.outputWeightKg) ||
      output.outputWeightKg <= 0 ||
      !["Pergamino", "Excelso"].includes(output.presentation) ||
      !Number.isFinite(output.humidityPercent) ||
      output.humidityPercent < 0 ||
      output.humidityPercent > 100 ||
      !Number.isFinite(output.performanceFactor) ||
      output.performanceFactor < 0
    ));

    if (outputs.length > 0 && invalidOutput) {
      return res.status(400).json({
        message: "Cada salida debe tener perfil comercial, presentacion, peso, humedad y factor validos",
      });
    }

    if (!Number.isFinite(outputWeight) || outputWeight <= 0) {
      return res.status(400).json({ message: "La cantidad final debe ser mayor a cero" });
    }
    if (outputs.length === 0 && (!Number.isFinite(humidity) || humidity < 0 || humidity > 100)) {
      return res.status(400).json({ message: "La humedad debe estar entre 0 y 100" });
    }
    if (outputs.length === 0 && (!Number.isFinite(performance) || performance < 0)) {
      return res.status(400).json({ message: "El factor de rendimiento es obligatorio" });
    }

    const process = await completeProcessPhysicalReview({
      processId: req.params.id,
      outputWeightKg: outputWeight,
      humidityPercent: humidity,
      performanceFactor: performance,
      outputs,
      reviewedBy: req.user.id,
    });

    if (!process) {
      return res.status(409).json({
        message: "El proceso no esta pendiente de revision fisica o la cantidad supera la entrada",
      });
    }

    res.json({ message: "Revision fisica guardada. El proceso paso a laboratorio", data: process });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar revision fisica del proceso", error: error.message });
  }
};

export const putFinishProcess = async (req, res) => {
  try {
    const {
      coffeeProfileId,
      aroma,
      flavor,
      sweetness,
      body,
      residual,
      cleanCup,
      score,
      notes,
      initialComment,
      outputReviews = [],
    } = req.body;

    const currentProcess = await findProcessById(req.params.id);

    if (!currentProcess) {
      return res.status(404).json({ message: "Proceso no encontrado" });
    }

    if (!currentProcess.outputs?.length && !coffeeProfileId) {
      return res.status(400).json({ message: "El perfil comercial es obligatorio cuando el proceso no tiene salidas divididas" });
    }

    if (coffeeProfileId) {
      const profile = await findCoffeeProfileById(coffeeProfileId);

      if (!profile || !profile.is_active) {
        return res.status(404).json({ message: "Perfil comercial no encontrado o inactivo" });
      }
    }

    const hasDividedOutputs = currentProcess.outputs?.length > 0;
    const cleanOutputReviews = Array.isArray(outputReviews)
      ? outputReviews.map((review) => ({
          processOutputId: Number(review.processOutputId),
          aroma: review.aroma,
          fragrance: null,
          flavor: review.flavor,
          acidity: null,
          sweetness: review.sweetness,
          body: review.body,
          balance: null,
          uniformity: null,
          residual: review.residual,
          cleanCup: review.cleanCup,
          score: toNumber(review.score),
          notes: review.notes,
          initialComment: review.initialComment,
        }))
      : [];

    if (hasDividedOutputs) {
      const validOutputIds = new Set(currentProcess.outputs.map((output) => Number(output.id)));
      const invalidReview = cleanOutputReviews.find((review) => (
        !validOutputIds.has(review.processOutputId) ||
        requiredCuppingFields.some((field) => !review[field]) ||
        !Number.isFinite(review.score)
      ));

      if (cleanOutputReviews.length !== currentProcess.outputs.length || invalidReview) {
        return res.status(400).json({
          message: "Debe registrar catacion completa y score para cada salida del proceso",
        });
      }
    }

    const scoreValue = toNumber(score);
    const missingField = requiredCuppingFields.find((field) => !req.body[field]);

    if (!hasDividedOutputs && (missingField || !Number.isFinite(scoreValue))) {
      return res.status(400).json({
        message: "Para finalizar el proceso, la catacion completa y el score son obligatorios",
      });
    }

    const result = await finishProcess({
      processId: req.params.id,
      finalizedBy: req.user.id,
      outputLot: {
        coffeeProfileId: coffeeProfileId ? Number(coffeeProfileId) : null,
        outputReviews: cleanOutputReviews,
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

    if (result.missingPhysicalReview) {
      return res.status(409).json({
        message: "La revision fisica de bodega debe completarse antes del analisis sensorial",
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
