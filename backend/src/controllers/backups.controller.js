import {
  listBackupModules,
  exportBackupModule,
  listBackupHistory,
} from "../models/backups.model.js";
import { sendCsv } from "../utils/csv.js";

export const getBackupModules = (req, res) => {
  res.json({
    modules: listBackupModules(),
  });
};

export const getBackupHistory = async (req, res) => {
  try {
    const history = await listBackupHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener historial de backups manuales",
      error: error.message,
    });
  }
};

export const exportBackup = async (req, res) => {
  try {
    const { module } = req.query;

    if (!module) {
      return res.status(400).json({ message: "Debe indicar el modulo a exportar" });
    }

    const rows = await exportBackupModule({
      moduleName: module,
      exportedBy: req.user.id,
    });

    if (!rows) {
      return res.status(404).json({ message: "Modulo de backup no encontrado" });
    }

    return sendCsv(res, `backup-${module}.csv`, rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al generar backup manual",
      error: error.message,
    });
  }
};
