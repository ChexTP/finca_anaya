import { flattenManagementReport, getManagementProductionReport } from "../models/management.model.js";
import { sendCsv } from "../utils/csv.js";

export const getProductionReport = async (req, res) => {
  try {
    const report = await getManagementProductionReport();

    if (req.query.format === "csv") {
      return sendCsv(res, "informe-gerencial-produccion.csv", flattenManagementReport(report));
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener informe gerencial de produccion",
      error: error.message,
    });
  }
};
