import bcrypt from "bcryptjs";
import { changeUserOperator, listUserOperators } from "../models/userOperators.model.js";
import {
  listUsers,
  createUser,
  findRoleByName,
  changeUserPassword,
  changeUserStatus,
} from "../models/users.model.js";

export const getUsers = async (req, res) => {
  try {
    const users = await listUsers();
    const operators = await listUserOperators();
    res.json(users.map((user) => ({ ...user, operator_name: operators.get(Number(user.id)) || null })));
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener usuarios",
      error: error.message,
    });
  }
};

export const createSeller = async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        message: "Nombre, usuario y contrasena son obligatorios",
      });
    }

    const role = await findRoleByName("seller");

    if (!role) {
      return res.status(500).json({
        message: "No existe el rol vendedor en la base de datos",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      username,
      passwordHash,
      roleId: role.id,
    });

    res.status(201).json({
      message: "Vendedor creado correctamente",
      data: user,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un usuario con ese nombre de usuario" });
    }

    res.status(500).json({
      message: "Error al crear vendedor",
      error: error.message,
    });
  }
};

export const updateUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "La nueva contrasena es obligatoria" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await changeUserPassword(id, passwordHash);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ message: "Contrasena actualizada correctamente" });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar contrasena",
      error: error.message,
    });
  }
};

export const updateUserOperator = async (req, res) => {
  try {
    const { operatorName } = req.body;
    if (typeof operatorName !== "string" || operatorName.trim().length > 120) {
      return res.status(400).json({ message: "El nombre del operario debe tener hasta 120 caracteres" });
    }
    const user = await changeUserOperator(req.params.id, operatorName.trim());
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ message: "Operario actualizado correctamente", data: user });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar operario", error: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive debe ser booleano" });
    }

    const user = await changeUserStatus(id, isActive);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({
      message: "Estado de usuario actualizado correctamente",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar estado de usuario",
      error: error.message,
    });
  }
};
