import {
  createCoffeeProfile,
  listCatalog,
  listCoffeeProfilesForAdmin,
  updateCoffeeProfile,
} from "../models/catalogs.model.js";
import { findCoffeeProfileById } from "../models/lots.model.js";

const allowedCatalogs = {
  coffeeTypes: "coffee_types",
  coffeeProfiles: "coffee_profiles",
  packagingTypes: "packaging_types",
  paymentMethods: "payment_methods",
  payableCategories: "payable_categories",
};

export const getCatalogs = async (req, res) => {
  try {
    const catalogs = {};

    for (const [key, tableName] of Object.entries(allowedCatalogs)) {
      catalogs[key] = await listCatalog(tableName);
    }

    res.json(catalogs);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener catalogos",
      error: error.message,
    });
  }
};

export const getCoffeeProfilesAdmin = async (req, res) => {
  try {
    const profiles = await listCoffeeProfilesForAdmin();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener perfiles comerciales",
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

export const putCoffeeProfile = async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      basePriceCop = 0,
      basePriceUsd = 0,
      isActive = true,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "El nombre del perfil es obligatorio" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    const profile = await findCoffeeProfileById(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Perfil comercial no encontrado" });
    }

    const updatedProfile = await updateCoffeeProfile(req.params.id, {
      name,
      code: code || null,
      category: category || null,
      basePriceCop: priceCop,
      basePriceUsd: priceUsd,
      isActive,
    });

    res.json({
      message: "Perfil comercial actualizado correctamente",
      data: updatedProfile,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un perfil con ese nombre" });
    }

    res.status(500).json({
      message: "Error al actualizar perfil comercial",
      error: error.message,
    });
  }
};

export const postCoffeeProfile = async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      basePriceCop = 0,
      basePriceUsd = 0,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "El nombre del perfil es obligatorio" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    const profile = await createCoffeeProfile({
      name,
      code: code || null,
      category: category || null,
      basePriceCop: priceCop,
      basePriceUsd: priceUsd,
    });

    res.status(201).json({
      message: "Perfil comercial creado correctamente",
      data: profile,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un perfil con ese nombre" });
    }

    res.status(500).json({
      message: "Error al crear perfil comercial",
      error: error.message,
    });
  }
};
