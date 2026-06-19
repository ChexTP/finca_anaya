import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { findUserByUsername, findUserById } from "../models/users.model.js";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Usuario y contrasena son obligatorios",
      });
    }

    const user = await findUserByUsername(username);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Credenciales invalidas" });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ message: "Credenciales invalidas" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role_name,
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      message: "Inicio de sesion correcto",
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role_name,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al iniciar sesion",
      error: error.message,
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role_name,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener perfil",
      error: error.message,
    });
  }
};
