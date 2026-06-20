import {
  buildQuoteDocument,
  buildSaleDocument,
} from "../models/documents.model.js";
import { findQuoteById } from "../models/quotes.model.js";

export const getQuoteDocument = async (req, res) => {
  try {
    const quote = await findQuoteById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: "Cotizacion no encontrada" });
    }

    if (req.user.role === "seller" && quote.seller_id !== req.user.id) {
      return res.status(403).json({ message: "No tiene permisos para generar este documento" });
    }

    const document = await buildQuoteDocument(req.params.id);

    res.json(document);
  } catch (error) {
    res.status(500).json({
      message: "Error al generar datos de cotizacion",
      error: error.message,
    });
  }
};

export const getSaleDocument = async (req, res) => {
  try {
    const includePayments = req.query.includePayments === "true";
    const document = await buildSaleDocument({
      id: req.params.id,
      includePayments,
    });

    if (!document) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({
      message: "Error al generar datos de venta",
      error: error.message,
    });
  }
};
