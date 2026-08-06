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
