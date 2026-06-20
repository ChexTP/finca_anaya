import {
  listClients,
  findClientById,
  createClient,
  updateClient,
} from "../models/clients.model.js";

export const getClients = async (req, res) => {
  try {
    const clients = await listClients({ search: req.query.search });
    res.json(clients);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener clientes",
      error: error.message,
    });
  }
};

export const getClient = async (req, res) => {
  try {
    const client = await findClientById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener cliente",
      error: error.message,
    });
  }
};

export const postClient = async (req, res) => {
  try {
    const {
      name,
      documentType,
      documentNumber,
      phone,
      email,
      address,
      city,
      country,
      shippingNotes,
      billingNotes,
    } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        message: "Nombre, telefono y direccion son obligatorios",
      });
    }

    const client = await createClient({
      name,
      documentType,
      documentNumber,
      phone,
      email,
      address,
      city,
      country,
      shippingNotes,
      billingNotes,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Cliente creado correctamente",
      data: client,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un cliente con ese telefono" });
    }

    res.status(500).json({
      message: "Error al crear cliente",
      error: error.message,
    });
  }
};

export const putClient = async (req, res) => {
  try {
    const {
      name,
      documentType,
      documentNumber,
      phone,
      email,
      address,
      city,
      country,
      shippingNotes,
      billingNotes,
      isActive = true,
    } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        message: "Nombre, telefono y direccion son obligatorios",
      });
    }

    const client = await updateClient(req.params.id, {
      name,
      documentType,
      documentNumber,
      phone,
      email,
      address,
      city,
      country,
      shippingNotes,
      billingNotes,
      isActive,
    });

    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json({
      message: "Cliente actualizado correctamente",
      data: client,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un cliente con ese telefono" });
    }

    res.status(500).json({
      message: "Error al actualizar cliente",
      error: error.message,
    });
  }
};
