import {
  listAvailableLots,
  getGroupedInventory,
  listLotMovements,
  listInventoryInProcess,
  listSampleInventoryOutputs,
  listFarmShipments,
  adjustLotInventory,
  registerSampleInventoryOutput,
  sendLotToFarm,
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

export const getInventoryInProcess = async (req, res) => {
  try {
    const rows = await listInventoryInProcess();
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener cafe fuera de bodega",
      error: error.message,
    });
  }
};

export const getSampleInventoryOutputs = async (req, res) => {
  try {
    const outputs = await listSampleInventoryOutputs();
    res.json(outputs);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener salidas de cafe a muestras",
      error: error.message,
    });
  }
};

export const getFarmShipments = async (req, res) => {
  try {
    const shipments = await listFarmShipments();
    res.json(shipments);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener lotes enviados a finca",
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

export const postSampleInventoryOutput = async (req, res) => {
  try {
    const { quantityKg, sampleReference, notes } = req.body;
    const quantity = toNumber(quantityKg);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "La cantidad para muestras debe ser mayor a cero",
      });
    }

    const lot = await registerSampleInventoryOutput({
      lotId: req.params.lotId,
      quantityKg: quantity,
      sampleReference,
      notes,
      userId: req.user.id,
    });

    if (!lot) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (lot.invalidStatus) {
      return res.status(409).json({
        message: "Solo se puede sacar muestra de lotes disponibles, vendidos parcialmente o agotados",
        data: lot.lot,
      });
    }

    if (lot.negativeInventory) {
      return res.status(409).json({
        message: "La muestra no puede dejar inventario negativo",
        data: lot.lot,
      });
    }

    res.json({
      message: "Salida a muestras registrada correctamente",
      data: lot,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar salida a muestras",
      error: error.message,
    });
  }
};

export const postFarmShipment = async (req, res) => {
  try {
    const { quantityKg } = req.body;
    const quantity = toNumber(quantityKg);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "La cantidad para enviar a finca debe ser mayor a cero",
      });
    }

    const shipment = await sendLotToFarm({
      lotId: req.params.lotId,
      quantityKg: quantity,
      userId: req.user.id,
    });

    if (!shipment) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (shipment.invalidStatus) {
      return res.status(409).json({
        message: "Solo se puede enviar a finca cafe disponible o vendido parcialmente",
        data: shipment.lot,
      });
    }

    if (shipment.negativeInventory) {
      return res.status(409).json({
        message: "La cantidad enviada a finca no puede superar el disponible del lote",
        data: shipment.lot,
      });
    }

    res.status(201).json({
      message: "Envio a finca registrado correctamente",
      data: shipment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar envio a finca",
      error: error.message,
    });
  }
};
