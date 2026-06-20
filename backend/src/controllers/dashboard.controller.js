import { getDashboardData } from "../models/dashboard.model.js";

export const getDashboard = async (req, res) => {
  try {
    const dashboard = await getDashboardData({
      role: req.user.role,
      userId: req.user.id,
    });

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener dashboard",
      error: error.message,
    });
  }
};
