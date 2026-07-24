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

const normalizeProfileComponents = (components = []) => {
  if (!Array.isArray(components)) {
    return { error: "Los componentes deben enviarse como una lista" };
  }

  const cleanComponents = components
    .map((component) => ({
      purchaseCoffeeId: Number(component.purchaseCoffeeId || component.purchase_coffee_id),
      percentage: null,
    }))
    .filter((component) => component.purchaseCoffeeId);

  if (
    cleanComponents.some((component) => (
      !Number.isInteger(component.purchaseCoffeeId) ||
      component.purchaseCoffeeId <= 0
    ))
  ) {
    return { error: "Cada componente debe tener un cafe valido" };
  }

  return { components: cleanComponents };
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
      components = [],
    } = req.body;

    if (!name || !allowedCoffeeProfileCategories.includes(category)) {
      return res.status(400).json({ message: "Nombre y categoria del cafe son obligatorios" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);
    const processPct = toNumber(processPercentage);
    const basePct = toNumber(basePercentage);
    const normalizedComponents = normalizeProfileComponents(components);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    if (normalizedComponents.error) {
      return res.status(400).json({ message: normalizedComponents.error });
    }

    const profile = await findCoffeeProfileById(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Perfil comercial no encontrado" });
    }

    const firstComponent = normalizedComponents.components[0];
    const secondComponent = normalizedComponents.components[1];

    const updatedProfile = await updateCoffeeProfile(req.params.id, {
      name,
      code: code || null,
      category: category || null,
      processPurchaseCoffeeId: firstComponent?.purchaseCoffeeId || processPurchaseCoffeeId || null,
      basePurchaseCoffeeId: secondComponent?.purchaseCoffeeId || basePurchaseCoffeeId || null,
      processPercentage: processPct,
      basePercentage: basePct,
      basePriceCop: priceCop,
      basePriceUsd: priceUsd,
      components: normalizedComponents.components,
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
      components = [],
    } = req.body;

    if (!name || !allowedCoffeeProfileCategories.includes(category)) {
      return res.status(400).json({ message: "Nombre y categoria del cafe son obligatorios" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);
    const processPct = toNumber(processPercentage);
    const basePct = toNumber(basePercentage);
    const normalizedComponents = normalizeProfileComponents(components);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    if (normalizedComponents.error) {
      return res.status(400).json({ message: normalizedComponents.error });
    }

    const firstComponent = normalizedComponents.components[0];
    const secondComponent = normalizedComponents.components[1];

    const profile = await createCoffeeProfile({
      name,
      code: code || null,
      category: category || null,
      processPurchaseCoffeeId: firstComponent?.purchaseCoffeeId || processPurchaseCoffeeId || null,
      basePurchaseCoffeeId: secondComponent?.purchaseCoffeeId || basePurchaseCoffeeId || null,
      processPercentage: processPct,
      basePercentage: basePct,
      basePriceCop: priceCop,
      basePriceUsd: priceUsd,
      components: normalizedComponents.components,
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
