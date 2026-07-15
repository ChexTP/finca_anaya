export const getCoffeeLotGroup = (lot) => {
  if (lot.lot_kind === "PROC") return "Procesados";
  if (lot.lot_kind === "PASILLA") return `Pasillas ${lot.coffee_type_name || ""}`.trim();
  if (lot.lot_kind === "RECUPERACION") return `Recuperaciones ${lot.commercial_classification || "Sin categoria"}`;

  const category = lot.commercial_classification || "Sin categoria";
  const process = lot.coffee_type_name || "Sin proceso";
  return `${category} ${process}`;
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
  const descriptors = lot.lot_kind === "PROC"
    ? [
        lot.coffee_profile_name,
        lot.commercial_classification !== "Procesado" ? lot.commercial_classification : null,
      ]
    : lot.lot_kind === "PASILLA"
      ? [
          "Pasilla",
          lot.coffee_type_name,
        ]
      : lot.lot_kind === "RECUPERACION"
        ? [
            "Recuperacion",
            lot.commercial_classification,
            lot.coffee_variety,
            lot.coffee_type_name,
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
