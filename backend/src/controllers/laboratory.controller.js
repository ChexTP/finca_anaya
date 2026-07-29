import { listLaboratoryHistory } from "../models/laboratory.model.js";
import { logControllerError } from "../utils/logger.js";

export const getLaboratoryHistory = async (_req, res) => {
  try {
    const history = await listLaboratoryHistory();
    res.json(history);
  } catch (error) {
    logControllerError("Error al obtener historico de laboratorio", error);
    res.status(500).json({
      message: "Error al obtener historico de laboratorio",
      error: error.message,
    });
  }
};
