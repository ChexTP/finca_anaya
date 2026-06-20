import {
  getNextPayableCode,
  listPayables,
  findPayableById,
  findPayableCategoryById,
  createPayable,
  registerPayablePayment,
} from "../models/payables.model.js";
import { findSupplierById } from "../models/suppliers.model.js";
import { findLotById, findPaymentMethodById } from "../models/lots.model.js";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number(value);
};

export const getPayables = async (req, res) => {
  try {
    const payables = await listPayables({
      status: req.query.status,
      categoryId: req.query.categoryId,
      supplierId: req.query.supplierId,
      lotId: req.query.lotId,
    });

    res.json(payables);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener cuentas por pagar",
      error: error.message,
    });
  }
};

export const getPayable = async (req, res) => {
  try {
    const payable = await findPayableById(req.params.id);

    if (!payable) {
      return res.status(404).json({ message: "Cuenta por pagar no encontrada" });
    }

    res.json(payable);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener cuenta por pagar",
      error: error.message,
    });
  }
};

export const postPayable = async (req, res) => {
  try {
    const {
      categoryId,
      supplierId,
      lotId,
      status,
      thirdPartyName,
      description,
      total,
      amountPaid = 0,
      dueDate,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
    } = req.body;

    if (!categoryId || !description || total === undefined || !status) {
      return res.status(400).json({
        message: "Categoria, descripcion, total y estado son obligatorios",
      });
    }

    if (!["pendiente", "pago_parcial", "pagada"].includes(status)) {
      return res.status(400).json({ message: "Estado de cuenta por pagar invalido" });
    }

    const totalAmount = toNumber(total);
    const paidAmount = toNumber(amountPaid);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "El total debe ser mayor a cero" });
    }

    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({
        message: "El valor pagado debe ser valido y no superar el total",
      });
    }

    if (status === "pagada" && paidAmount !== totalAmount) {
      return res.status(400).json({
        message: "Una cuenta pagada debe tener pagado el total",
      });
    }

    if (status === "pendiente" && paidAmount !== 0) {
      return res.status(400).json({
        message: "Una cuenta pendiente no debe tener pago registrado",
      });
    }

    if (status === "pago_parcial" && (paidAmount <= 0 || paidAmount >= totalAmount)) {
      return res.status(400).json({
        message: "Una cuenta parcial debe tener un abono menor al total",
      });
    }

    if (["pendiente", "pago_parcial"].includes(status) && !dueDate) {
      return res.status(400).json({
        message: "La fecha estimada de pago es obligatoria si queda saldo pendiente",
      });
    }

    if (paidAmount > 0 && (!paymentMethodId || !paymentReference)) {
      return res.status(400).json({
        message: "Metodo y referencia de pago son obligatorios si hay pago inicial",
      });
    }

    const category = await findPayableCategoryById(categoryId);

    if (!category || !category.is_active) {
      return res.status(404).json({ message: "Categoria de cuenta por pagar no encontrada o inactiva" });
    }

    if (supplierId) {
      const supplier = await findSupplierById(supplierId);

      if (!supplier || !supplier.is_active) {
        return res.status(404).json({ message: "Proveedor no encontrado o inactivo" });
      }
    }

    if (lotId) {
      const lot = await findLotById(lotId);

      if (!lot) {
        return res.status(404).json({ message: "Lote no encontrado" });
      }
    }

    if (paymentMethodId) {
      const paymentMethod = await findPaymentMethodById(paymentMethodId);

      if (!paymentMethod || !paymentMethod.is_active) {
        return res.status(404).json({ message: "Metodo de pago no encontrado o inactivo" });
      }
    }

    const code = await getNextPayableCode();
    const payable = await createPayable({
      code,
      categoryId,
      supplierId,
      lotId,
      status,
      thirdPartyName,
      description,
      total: totalAmount,
      amountPaid: paidAmount,
      dueDate,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
      createdBy: req.user.id,
    });
    const fullPayable = await findPayableById(payable.id);

    res.status(201).json({
      message: "Cuenta por pagar creada correctamente",
      data: fullPayable,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear cuenta por pagar",
      error: error.message,
    });
  }
};

export const postPayablePayment = async (req, res) => {
  try {
    const {
      amount,
      paymentMethodId,
      paymentReference,
      paidAt,
      notes,
    } = req.body;

    const paymentAmount = toNumber(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: "El valor del pago debe ser mayor a cero" });
    }

    if (!paymentMethodId || !paymentReference) {
      return res.status(400).json({
        message: "Metodo de pago y referencia son obligatorios",
      });
    }

    const paymentMethod = await findPaymentMethodById(paymentMethodId);

    if (!paymentMethod || !paymentMethod.is_active) {
      return res.status(404).json({ message: "Metodo de pago no encontrado o inactivo" });
    }

    const payable = await registerPayablePayment({
      payableId: req.params.id,
      amount: paymentAmount,
      paymentMethodId,
      paymentReference,
      paidAt: paidAt || new Date(),
      notes,
      registeredBy: req.user.id,
    });

    if (!payable) {
      return res.status(404).json({ message: "Cuenta por pagar no encontrada" });
    }

    if (payable.amountTooHigh) {
      return res.status(409).json({
        message: "El pago no puede superar el saldo pendiente",
        data: payable.payable,
      });
    }

    const fullPayable = await findPayableById(req.params.id);

    res.status(201).json({
      message: "Pago de cuenta por pagar registrado correctamente",
      data: fullPayable,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al registrar pago de cuenta por pagar",
      error: error.message,
    });
  }
};
