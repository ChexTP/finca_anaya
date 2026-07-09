import {
  listAvailableLots,
  getGroupedInventory,
  listLotMovements,
  adjustLotInventory,
} from "../models/inventory.model.js";
import { findLotById } from "../models/lots.model.js";

export const getInventoryLots = async (req, res) => {
  try {
    const lots = await listAvailableLots({
      status: req.query.status,
      coffeeTypeId: req.query.coffeeTypeId,
      coffeeProfileId: req.query.coffeeProfileId,
    });

    res.json(lots);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener inventario por lotes",
      error: error.message,
    });
  }
};

export const getInventoryGrouped = async (req, res) => {
  try {
    const groups = await getGroupedInventory();
    res.json(groups);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener inventario agrupado",
      error: error.message,
    });
  }
};

export const getInventoryMovements = async (req, res) => {
  try {
    const lot = await findLotById(req.params.lotId);

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    const movements = await listLotMovements(req.params.lotId);

    res.json({
      lot,
      movements,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener movimientos del lote",
      error: error.message,
    });
  }
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

export const postInventoryAdjustment = async (req, res) => {
  try {
    const { adjustmentType, quantityKg, reason } = req.body;

    if (!["increase", "decrease"].includes(adjustmentType)) {
      return res.status(400).json({
        message: "El tipo de ajuste debe ser increase o decrease",
      });
    }

    const quantity = toNumber(quantityKg);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "La cantidad del ajuste debe ser mayor a cero",
      });
    }

    if (!reason) {
      return res.status(400).json({
        message: "La razon del ajuste es obligatoria",
      });
    }

    const lot = await adjustLotInventory({
      lotId: req.params.lotId,
      adjustmentType,
      quantityKg: quantity,
      reason,
      userId: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Solo se pueden ajustar lotes disponibles, vendidos parcialmente o agotados",
        data: lot.lot,
      });
    }

    if (lot.negativeInventory) {
      return res.status(409).json({
        message: "El ajuste no puede dejar inventario negativo",
        data: lot.lot,
      });
    }

    res.json({
      message: "Ajuste de inventario registrado correctamente",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar ajuste de inventario",
      error: error.message,
    });
  }
};
