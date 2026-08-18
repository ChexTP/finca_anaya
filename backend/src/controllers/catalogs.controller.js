import {
  createSimpleCatalogItem,
  createPurchaseCoffee,
  createCoffeeProfile,
  ensureRequiredCatalogs,
  listCatalog,
  listCoffeeProfilesForAdmin,
  listPurchaseCoffeesForAdmin,
  listSimpleCatalogForAdmin,
  updateSimpleCatalogItem,
  updatePurchaseCoffee,
  updateCoffeeProfile,
} from "../models/catalogs.model.js";
import { findCoffeeProfileById } from "../models/lots.model.js";

const allowedCatalogs = {
  coffeePresentations: "coffee_presentations",
  coffeeTypes: "coffee_types",
  coffeeProfiles: "coffee_profiles",
  purchaseCoffees: "purchase_coffees",
  packagingTypes: "packaging_types",
  paymentMethods: "payment_methods",
  payableCategories: "payable_categories",
};

const allowedCoffeeProfileCategories = ["Regional", "Varietal", "Exotico"];
const allowedCoffeeProfileProcesses = ["Lavado", "Natural", "Semilavado", "Honey"];
const allowedPurchaseCoffeeFamilies = ["Regional", "Varietal"];

export const getCatalogs = async (req, res) => {
  try {
    await ensureRequiredCatalogs();

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

export const getPurchaseCoffeesAdmin = async (req, res) => {
  try {
    await ensureRequiredCatalogs();
    const coffees = await listPurchaseCoffeesForAdmin();
    res.json(coffees);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener perfiles de compra",
      error: error.message,
    });
  }
};

const validatePurchaseCoffeePayload = ({ name, family, processType }) => {
  if (!name || !allowedPurchaseCoffeeFamilies.includes(family) || !processType?.trim()) {
    return "Nombre, familia y proceso son obligatorios para el perfil de compra";
  }

  return null;
};

const editableCatalogs = {
  "coffee-types": {
    tableName: "coffee_types",
    label: "tipo de cafe",
  },
  "coffee-presentations": {
    tableName: "coffee_presentations",
    label: "presentacion",
  },
};

const getEditableCatalog = (catalogKey) => editableCatalogs[catalogKey];

const validateSimpleCatalogPayload = ({ name }) => {
  if (!name || !name.trim()) {
    return "El nombre es obligatorio";
  }

  if (name.trim().length > 80) {
    return "El nombre no debe superar 80 caracteres";
  }

  return null;
};

export const getEditableCatalogItems = async (req, res) => {
  try {
    await ensureRequiredCatalogs();
    const catalog = getEditableCatalog(req.params.catalogKey);

    if (!catalog) {
      return res.status(404).json({ message: "Catalogo no encontrado" });
    }

    const items = await listSimpleCatalogForAdmin(catalog.tableName);
    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener catalogo editable",
      error: error.message,
    });
  }
};

export const postEditableCatalogItem = async (req, res) => {
  try {
    const catalog = getEditableCatalog(req.params.catalogKey);

    if (!catalog) {
      return res.status(404).json({ message: "Catalogo no encontrado" });
    }

    const validationError = validateSimpleCatalogPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const item = await createSimpleCatalogItem(catalog.tableName, {
      name: req.body.name.trim(),
      isActive: req.body.isActive ?? true,
    });

    res.status(201).json({
      message: `${catalog.label} creado correctamente`,
      data: item,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un registro con ese nombre" });
    }

    res.status(500).json({
      message: "Error al crear registro de catalogo",
      error: error.message,
    });
  }
};

export const putEditableCatalogItem = async (req, res) => {
  try {
    const catalog = getEditableCatalog(req.params.catalogKey);

    if (!catalog) {
      return res.status(404).json({ message: "Catalogo no encontrado" });
    }

    const validationError = validateSimpleCatalogPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const item = await updateSimpleCatalogItem(catalog.tableName, req.params.id, {
      name: req.body.name.trim(),
      isActive: req.body.isActive ?? true,
    });

    if (!item) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    res.json({
      message: `${catalog.label} actualizado correctamente`,
      data: item,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un registro con ese nombre" });
    }

    res.status(500).json({
      message: "Error al actualizar registro de catalogo",
      error: error.message,
    });
  }
};

export const postPurchaseCoffee = async (req, res) => {
  try {
    const {
      name,
      family,
      processType,
      isActive = true,
    } = req.body;
    const validationError = validatePurchaseCoffeePayload({ name, family, processType });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const coffee = await createPurchaseCoffee({
      name: name.trim(),
      family,
      processType,
      isActive,
    });

    res.status(201).json({
      message: "Perfil de compra creado correctamente",
      data: coffee,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un perfil de compra con ese nombre" });
    }

    res.status(500).json({
      message: "Error al crear perfil de compra",
      error: error.message,
    });
  }
};

export const putPurchaseCoffee = async (req, res) => {
  try {
    const {
      name,
      family,
      processType,
      isActive = true,
    } = req.body;
    const validationError = validatePurchaseCoffeePayload({ name, family, processType });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const coffee = await updatePurchaseCoffee(req.params.id, {
      name: name.trim(),
      family,
      processType,
      isActive,
    });

    if (!coffee) {
      return res.status(404).json({ message: "Perfil de compra no encontrado" });
    }

    res.json({
      message: "Perfil de compra actualizado correctamente",
      data: coffee,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ya existe un perfil de compra con ese nombre" });
    }

    res.status(500).json({
      message: "Error al actualizar perfil de compra",
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

const normalizeProfileComponents = (components = [], basePercentage = null) => {
  if (!Array.isArray(components)) {
    return { error: "Los componentes deben enviarse como una lista" };
  }

  const cleanComponents = components
    .map((component) => {
      const componentType = component.componentType || component.component_type || (component.componentProfileId || component.component_profile_id ? "profile" : "purchase");

      return {
        componentType,
        purchaseCoffeeId: componentType === "purchase" ? Number(component.purchaseCoffeeId || component.purchase_coffee_id) : null,
        componentProfileId: componentType === "profile" ? Number(component.componentProfileId || component.component_profile_id) : null,
        percentage: toNumber(component.percentage),
      };
    })
    .filter((component) => component.purchaseCoffeeId || component.componentProfileId);

  if (
    cleanComponents.some((component) => (
      !["purchase", "profile"].includes(component.componentType) ||
      (component.componentType === "purchase" && (!Number.isInteger(component.purchaseCoffeeId) || component.purchaseCoffeeId <= 0)) ||
      (component.componentType === "profile" && (!Number.isInteger(component.componentProfileId) || component.componentProfileId <= 0))
    ))
  ) {
    return { error: "Cada componente debe tener un cafe valido" };
  }

  if (
    cleanComponents.some((component) => (
      !Number.isFinite(component.percentage) ||
      component.percentage <= 0 ||
      component.percentage > 100
    ))
  ) {
    return { error: "Cada componente debe tener un porcentaje mayor a 0 y menor o igual a 100" };
  }

  const normalizedBasePercentage = Number(basePercentage || 0);
  const totalPercentage = cleanComponents.reduce((total, component) => total + Number(component.percentage || 0), 0) + normalizedBasePercentage;

  if (cleanComponents.length > 0 && Math.abs(totalPercentage - 100) > 0.01) {
    return { error: `Los porcentajes de componentes y base deben sumar 100%. Actualmente suman ${totalPercentage.toFixed(2)}%` };
  }

  return { components: cleanComponents };
};

export const putCoffeeProfile = async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      processType,
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

    if (processType && !allowedCoffeeProfileProcesses.includes(processType)) {
      return res.status(400).json({ message: "Proceso comercial no valido" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);
    const processPct = toNumber(processPercentage);
    const basePct = toNumber(basePercentage);
    const normalizedComponents = normalizeProfileComponents(components, basePct);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    if (normalizedComponents.error) {
      return res.status(400).json({ message: normalizedComponents.error });
    }

    if (basePct !== null && (!Number.isFinite(basePct) || basePct <= 0 || basePct > 100)) {
      return res.status(400).json({ message: "El porcentaje de base debe ser mayor a 0 y menor o igual a 100" });
    }

    if (basePct !== null && !basePurchaseCoffeeId) {
      return res.status(400).json({ message: "Seleccione una base principal para usar porcentaje de base" });
    }

    if (basePurchaseCoffeeId && basePct === null) {
      return res.status(400).json({ message: "Indique el porcentaje de la base principal" });
    }

    const profile = await findCoffeeProfileById(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Perfil comercial no encontrado" });
    }

    const firstComponent = normalizedComponents.components.find((component) => component.componentType === "purchase");

    const updatedProfile = await updateCoffeeProfile(req.params.id, {
      name,
      code: code || null,
      category: category || null,
      processType: processType || null,
      processPurchaseCoffeeId: firstComponent?.purchaseCoffeeId || processPurchaseCoffeeId || null,
      basePurchaseCoffeeId: basePurchaseCoffeeId || null,
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
      processType,
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

    if (processType && !allowedCoffeeProfileProcesses.includes(processType)) {
      return res.status(400).json({ message: "Proceso comercial no valido" });
    }

    const priceCop = toNumber(basePriceCop);
    const priceUsd = toNumber(basePriceUsd);
    const processPct = toNumber(processPercentage);
    const basePct = toNumber(basePercentage);
    const normalizedComponents = normalizeProfileComponents(components, basePct);

    if (!Number.isFinite(priceCop) || priceCop < 0 || !Number.isFinite(priceUsd) || priceUsd < 0) {
      return res.status(400).json({
        message: "Los precios base deben ser valores validos mayores o iguales a cero",
      });
    }

    if (normalizedComponents.error) {
      return res.status(400).json({ message: normalizedComponents.error });
    }

    if (basePct !== null && (!Number.isFinite(basePct) || basePct <= 0 || basePct > 100)) {
      return res.status(400).json({ message: "El porcentaje de base debe ser mayor a 0 y menor o igual a 100" });
    }

    if (basePct !== null && !basePurchaseCoffeeId) {
      return res.status(400).json({ message: "Seleccione una base principal para usar porcentaje de base" });
    }

    if (basePurchaseCoffeeId && basePct === null) {
      return res.status(400).json({ message: "Indique el porcentaje de la base principal" });
    }

    const firstComponent = normalizedComponents.components.find((component) => component.componentType === "purchase");

    const profile = await createCoffeeProfile({
      name,
      code: code || null,
      category: category || null,
      processType: processType || null,
      processPurchaseCoffeeId: firstComponent?.purchaseCoffeeId || processPurchaseCoffeeId || null,
      basePurchaseCoffeeId: basePurchaseCoffeeId || null,
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
