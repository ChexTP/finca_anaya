import { listCatalog } from "../models/catalogs.model.js";

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

