export const formatCoffeeLotOption = (lot) => {
  const descriptors = lot.lot_kind === "PROC"
    ? [
        lot.coffee_profile_name,
        lot.commercial_classification !== "Procesado" ? lot.commercial_classification : null,
      ]
    : [
        lot.coffee_type_name,
        lot.commercial_classification,
        lot.coffee_variety,
        lot.coffee_profile_name,
      ];

  const uniqueDescriptors = [...new Set(descriptors.filter(Boolean))];
  const coffeeDescription = uniqueDescriptors.length > 0 ? uniqueDescriptors.join(" - ") : "Cafe sin clasificar";

  return `${lot.code} - ${coffeeDescription} - ${lot.available_weight_kg} kg`;
};
