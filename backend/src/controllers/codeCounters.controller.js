import {
  codeCounterDefinitions,
  listCodeCounters,
  setCodeCounter,
} from "../models/codeCounters.model.js";

const allowedPrefixes = codeCounterDefinitions.map((definition) => definition.prefix);

export const getCodeCounters = async (req, res) => {
  try {
    const counters = await listCodeCounters();
    res.json(counters);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener consecutivos",
      error: error.message,
    });
  }
};

export const putCodeCounter = async (req, res) => {
  try {
    const { prefix } = req.params;
    const { nextNumber, year = new Date().getFullYear() } = req.body;
    const cleanNumber = Number(nextNumber);
    const cleanYear = Number(year);

    if (!allowedPrefixes.includes(prefix)) {
      return res.status(400).json({ message: "Prefijo de consecutivo no permitido" });
    }

    if (!Number.isInteger(cleanYear) || cleanYear < 2000 || cleanYear > 2100) {
      return res.status(400).json({ message: "Ano de consecutivo no valido" });
    }

    if (!Number.isInteger(cleanNumber) || cleanNumber <= 0) {
      return res.status(400).json({ message: "El proximo numero debe ser entero mayor a cero" });
    }

    const counter = await setCodeCounter({
      prefix,
      year: cleanYear,
      nextNumber: cleanNumber,
      userId: req.user.id,
    });

    res.json({
      message: "Consecutivo actualizado correctamente",
      data: counter,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar consecutivo",
      error: error.message,
    });
  }
};
