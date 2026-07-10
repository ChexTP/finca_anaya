import { getManagementProductionReport } from "../models/management.model.js";

export const getProductionReport = async (req, res) => {
  try {
    const report = await getManagementProductionReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener informe gerencial de produccion",
      error: error.message,
    });
  }
};
