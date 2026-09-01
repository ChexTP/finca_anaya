import {
  listAvailableLots,
  getGroupedInventory,
  listLotMovements,
  listInventoryInProcess,
  listSampleInventoryOutputs,
  listFarmShipments,
  listFarmProcessInputShipments,
  adjustLotInventory,
  registerSampleInventoryOutput,
  sendLotToFarm,
  markFarmShipmentAsReceived,
  markFarmProcessInputAsReceived,
  reserveLotInventory,
  releaseInventoryReservation,
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
    const [directShipments, processShipments] = await Promise.all([
      listFarmShipments(),
      listFarmProcessInputShipments(),
    ]);

    res.json([...directShipments, ...processShipments].sort((left, right) => {
      return new Date(right.shipped_at || right.created_at || 0) - new Date(left.shipped_at || left.created_at || 0);
    }));
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

export const postInventoryReservation = async (req, res) => {
  try {
    const { quantityKg, reservedFor } = req.body;
    const quantity = toNumber(quantityKg);
    const cleanReservedFor = String(reservedFor || "").trim();

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "La cantidad a reservar debe ser mayor a cero",
      });
    }

    if (!cleanReservedFor) {
      return res.status(400).json({
        message: "Debe indicar para quien o para que es la reserva",
      });
    }

    const reservation = await reserveLotInventory({
      lotId: req.params.lotId,
      quantityKg: quantity,
      reservedFor: cleanReservedFor,
      userId: req.user.id,
    });

    if (!reservation) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    if (reservation.invalidStatus) {
      return res.status(409).json({
        message: "Solo se puede reservar cafe disponible o vendido parcialmente",
        data: reservation.lot,
      });
    }

    if (reservation.insufficientInventory) {
      return res.status(409).json({
        message: `La reserva supera el libre operativo del lote. Libre operativo: ${Number(reservation.freeOperationalKg || 0).toLocaleString("es-CO")} kg`,
        data: reservation.lot,
      });
    }

    res.status(201).json({
      message: "Reserva registrada correctamente",
      data: reservation,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar reserva de inventario",
      error: error.message,
    });
  }
};

export const putInventoryReservationReleased = async (req, res) => {
  try {
    const reservation = await releaseInventoryReservation({
      reservationId: req.params.reservationId,
      userId: req.user.id,
    });

    if (!reservation) {
      return res.status(404).json({ message: "Reserva no encontrada o ya liberada" });
    }

    res.json({
      message: "Reserva liberada correctamente",
      data: reservation,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al liberar reserva de inventario",
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

export const putFarmShipmentReceived = async (req, res) => {
  try {
    const shipment = await markFarmShipmentAsReceived({
      shipmentId: req.params.shipmentId,
      userId: req.user.id,
    });

    if (!shipment) {
      return res.status(404).json({ message: "Envio a finca no encontrado o ya recibido" });
    }

    res.json({
      message: "Lote marcado como recibido desde finca",
      data: shipment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar lote como recibido desde finca",
      error: error.message,
    });
  }
};

export const putFarmProcessInputReceived = async (req, res) => {
  try {
    const input = await markFarmProcessInputAsReceived({
      inputId: req.params.inputId,
      userId: req.user.id,
    });

    if (!input) {
      return res.status(404).json({ message: "Registro de finca no encontrado o ya recibido" });
    }

    res.json({
      message: "Lote de finca marcado como recibido",
      data: input,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al marcar registro de finca como recibido",
      error: error.message,
    });
  }
};
