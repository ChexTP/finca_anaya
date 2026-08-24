import { formatOperationalKg } from "./coffeeCalculations";

export const getCoffeeLotGroup = (lot) => {
  const presentation = lot.presentation || "Pergamino";

  if (lot.lot_kind === "PROC") return `${presentation} - Proceso - ${lot.coffee_profile_name || lot.coffee_variety || "Sin perfil"}`;
  if (lot.lot_kind === "PASILLA") {
    return `${presentation} - Pasillas ${lot.coffee_profile_name || lot.coffee_variety || lot.coffee_type_name || ""}`.trim();
  }
  if (lot.lot_kind === "RECUPERACION") {
    return `${presentation} - Recuperacion ${lot.coffee_profile_name || lot.coffee_variety || lot.coffee_type_name || ""}`.trim();
  }

  const category = lot.commercial_classification || "Sin categoria";
  const process = lot.coffee_type_name || "Sin proceso";

  if (["Regional", "Varietal"].includes(category) && ["Lavado", "Natural"].includes(process)) {
    return `${presentation} - ${category} ${process}`;
  }

  return `${presentation} - ${category} ${process}`;
};

export const groupCoffeeLots = (lots) => {
  return lots.reduce((groups, lot) => {
    const groupName = getCoffeeLotGroup(lot);
    const current = groups[groupName] || {
      name: groupName,
      count: 0,
      kg: 0,
      lots: [],
    };

    return {
      ...groups,
      [groupName]: {
        ...current,
        count: current.count + 1,
        kg: current.kg + Number(lot.available_weight_kg || 0),
        lots: [...current.lots, lot],
      },
    };
  }, {});
};

export const formatCoffeeLotOption = (lot) => {
  return `${formatCoffeeLotCodeName(lot)} - ${formatOperationalKg(lot.available_weight_kg)}`;
};

export const getCoffeeLotDescription = (lot) => {
  const presentation = lot.presentation;
  const descriptors = lot.lot_kind === "PROC"
    ? [presentation, lot.coffee_profile_name || "Cafe procesado", lot.commercial_classification !== "Procesado" ? lot.commercial_classification : "Procesado"]
    : lot.lot_kind === "PASILLA"
      ? [presentation, "Pasilla", lot.coffee_profile_name || lot.coffee_variety || lot.coffee_type_name]
      : lot.lot_kind === "RECUPERACION"
        ? [presentation, "Recuperacion", lot.coffee_profile_name || lot.coffee_variety, lot.commercial_classification, lot.coffee_type_name]
        : [presentation, lot.coffee_variety || lot.coffee_profile_name || lot.commercial_classification, lot.commercial_classification, lot.coffee_type_name];

  const uniqueDescriptors = [...new Set(descriptors.filter(Boolean))];
  const [main, ...details] = uniqueDescriptors;

  if (!main) return "Cafe sin clasificar";
  if (details.length === 0) return main;

  return `${main} (${details.join(" / ")})`;
};

export const formatCoffeeLotCodeName = (lot) => {
  const baseName = `${lot.code || lot.lot_code || "Sin codigo"} - ${getCoffeeLotDescription(lot)}`;
  const supplierName = lot.supplier_name || lot.lot_supplier_name || lot.supplierName;

  return supplierName ? `${baseName} - ${supplierName}` : baseName;
};
