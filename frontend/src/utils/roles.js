export const roleLabels = {
  admin: "Administrador",
  accounting: "Contabilidad",
  warehouse: "Bodega",
  laboratory: "Laboratorio",
  seller: "Vendedor",
  samples: "Muestras",
};

export const canSeeReports = (role) => ["admin", "accounting"].includes(role);

export const canManageInventory = (role) => ["admin", "accounting", "warehouse"].includes(role);

export const canManageSales = (role) => ["admin", "accounting"].includes(role);
