import { testConnection } from "../db.js";

export const getHealth = (req, res) => {
  res.json({
    ok: true,
    message: "Backend Finca Anaya funcionando",
  });
};

export const getDbHealth = async (req, res) => {
  try {
    const data = await testConnection();

    res.json({
      ok: true,
      message: "Conexion a base de datos funcionando",
      data,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "No se pudo conectar a la base de datos",
      error: error.message,
    });
  }
};
