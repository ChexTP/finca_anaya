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
  purchaseCoffees: "purchase_coffees",
  packagingTypes: "packaging_types",
  paymentMethods: "payment_methods",
  payableCategories: "payable_categories",
};

const allowedCoffeeProfileCategories = ["Regional", "Varietal", "Exotico"];

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
      processPurchaseCoffeeId,
      basePurchaseCoffeeId,
      processPercentage,
      basePercentage,
      basePriceCop = 0,
      basePriceUsd = 0,
      isActive = true,
    } = req.body;

    if (!name || !allowedCoffeeProfileCategories.includes(category)) {
      return res.status(400).json({ message: "Nombre y categoria del cafe son obligatorios" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);
    const processPct = toNumber(processPercentage);
    const basePct = toNumber(basePercentage);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    if (
      (processPct !== null && (!Number.isFinite(processPct) || processPct < 0 || processPct > 100)) ||
      (basePct !== null && (!Number.isFinite(basePct) || basePct < 0 || basePct > 100))
    ) {
      return res.status(400).json({ message: "Los porcentajes de ensamble deben estar entre 0 y 100" });
    }

    if (category === "Exotico" && processPct !== null && basePct !== null && Number((processPct + basePct).toFixed(2)) !== 100) {
      return res.status(400).json({ message: "En un exotico, los porcentajes de proceso y base deben sumar 100" });
    }

    const profile = await findCoffeeProfileById(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Perfil comercial no encontrado" });
    }

    const updatedProfile = await updateCoffeeProfile(req.params.id, {
      name,
      code: code || null,
      category: category || null,
      processPurchaseCoffeeId: processPurchaseCoffeeId || null,
      basePurchaseCoffeeId: basePurchaseCoffeeId || null,
      processPercentage: processPct,
      basePercentage: basePct,
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
      processPurchaseCoffeeId,
      basePurchaseCoffeeId,
      processPercentage,
      basePercentage,
      basePriceCop = 0,
      basePriceUsd = 0,
    } = req.body;

    if (!name || !allowedCoffeeProfileCategories.includes(category)) {
      return res.status(400).json({ message: "Nombre y categoria del cafe son obligatorios" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);
    const processPct = toNumber(processPercentage);
    const basePct = toNumber(basePercentage);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    if (
      (processPct !== null && (!Number.isFinite(processPct) || processPct < 0 || processPct > 100)) ||
      (basePct !== null && (!Number.isFinite(basePct) || basePct < 0 || basePct > 100))
    ) {
      return res.status(400).json({ message: "Los porcentajes de ensamble deben estar entre 0 y 100" });
    }

    if (category === "Exotico" && processPct !== null && basePct !== null && Number((processPct + basePct).toFixed(2)) !== 100) {
      return res.status(400).json({ message: "En un exotico, los porcentajes de proceso y base deben sumar 100" });
    }

    const profile = await createCoffeeProfile({
      name,
      code: code || null,
      category: category || null,
      processPurchaseCoffeeId: processPurchaseCoffeeId || null,
      basePurchaseCoffeeId: basePurchaseCoffeeId || null,
      processPercentage: processPct,
      basePercentage: basePct,
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
