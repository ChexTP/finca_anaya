import {
  getSalesSummaryReport,
  getSalesBySellerReport,
  getSalesByProfileReport,
  getProfitReport,
  getAccountsReceivableReport,
  getAccountsPayableReport,
  getInventoryReport,
} from "../models/reports.model.js";
import { sendCsv } from "../utils/csv.js";

const validateCurrency = (currency) => {
  return !currency || ["COP", "USD"].includes(currency);
};

const shouldExportCsv = (req) => {
  return req.query.format === "csv";
};

export const getSalesSummary = async (req, res) => {
  try {
    if (!validateCurrency(req.query.currency)) {
      return res.status(400).json({ message: "Moneda invalida" });
    }

    const report = await getSalesSummaryReport({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      currency: req.query.currency,
    });

    if (shouldExportCsv(req)) {
      return sendCsv(res, "reporte-ventas-resumen.csv", report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener reporte de ventas",
      error: error.message,
    });
  }
};

export const getSalesBySeller = async (req, res) => {
  try {
    if (!validateCurrency(req.query.currency)) {
      return res.status(400).json({ message: "Moneda invalida" });
    }

    const report = await getSalesBySellerReport({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      currency: req.query.currency,
    });

    if (shouldExportCsv(req)) {
      return sendCsv(res, "reporte-ventas-vendedor.csv", report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener reporte de ventas por vendedor",
      error: error.message,
    });
  }
};

export const getSalesByProfile = async (req, res) => {
  try {
    if (!validateCurrency(req.query.currency)) {
      return res.status(400).json({ message: "Moneda invalida" });
    }

    const report = await getSalesByProfileReport({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      currency: req.query.currency,
    });

    if (shouldExportCsv(req)) {
      return sendCsv(res, "reporte-ventas-perfil.csv", report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener reporte de ventas por perfil",
      error: error.message,
    });
  }
};

export const getProfit = async (req, res) => {
  try {
    if (!validateCurrency(req.query.currency)) {
      return res.status(400).json({ message: "Moneda invalida" });
    }

    const report = await getProfitReport({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      currency: req.query.currency,
    });

    if (shouldExportCsv(req)) {
      return sendCsv(res, "reporte-utilidad-estimada.csv", report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener reporte de utilidad",
      error: error.message,
    });
  }
};

export const getAccountsReceivable = async (req, res) => {
  try {
    if (!validateCurrency(req.query.currency)) {
      return res.status(400).json({ message: "Moneda invalida" });
    }

    const report = await getAccountsReceivableReport({
      clientId: req.query.clientId,
      currency: req.query.currency,
    });

    if (shouldExportCsv(req)) {
      return sendCsv(res, "reporte-cuentas-por-cobrar.csv", report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener cuentas por cobrar",
      error: error.message,
    });
  }
};

export const getAccountsPayable = async (req, res) => {
  try {
    if (req.query.status && !["pendiente", "pago_parcial", "pagada"].includes(req.query.status)) {
      return res.status(400).json({ message: "Estado de cuenta por pagar invalido" });
    }

    const report = await getAccountsPayableReport({
      status: req.query.status,
      categoryId: req.query.categoryId,
      supplierId: req.query.supplierId,
    });

    if (shouldExportCsv(req)) {
      return sendCsv(res, "reporte-cuentas-por-pagar.csv", report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener reporte de cuentas por pagar",
      error: error.message,
    });
  }
};

export const getInventory = async (req, res) => {
  try {
    const report = await getInventoryReport();

    if (shouldExportCsv(req)) {
      return sendCsv(res, "reporte-inventario.csv", report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener reporte de inventario",
      error: error.message,
    });
  }
};
