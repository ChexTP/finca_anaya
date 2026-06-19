import {
  listSuppliers,
  findSupplierById,
  createSupplier,
  updateSupplier,
} from "../models/suppliers.model.js";

export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await listSuppliers();
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener proveedores",
      error: error.message,
    });
  }
};

export const getSupplier = async (req, res) => {
  try {
    const supplier = await findSupplierById(req.params.id);

    if (!supplier) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener proveedor",
      error: error.message,
    });
  }
};

export const postSupplier = async (req, res) => {
  try {
    const { name, phone, address, originZone, notes } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        message: "Nombre, telefono y direccion son obligatorios",
      });
    }

    const supplier = await createSupplier({ name, phone, address, originZone, notes });

    res.status(201).json({
      message: "Proveedor creado correctamente",
      data: supplier,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un proveedor con ese telefono" });
    }

    res.status(500).json({
      message: "Error al crear proveedor",
      error: error.message,
    });
  }
};

export const putSupplier = async (req, res) => {
  try {
    const { name, phone, address, originZone, notes, isActive = true } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        message: "Nombre, telefono y direccion son obligatorios",
      });
    }

    const supplier = await updateSupplier(req.params.id, {
      name,
      phone,
      address,
      originZone,
      notes,
      isActive,
    });

    if (!supplier) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    res.json({
      message: "Proveedor actualizado correctamente",
      data: supplier,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un proveedor con ese telefono" });
    }

    res.status(500).json({
      message: "Error al actualizar proveedor",
      error: error.message,
    });
  }
};

