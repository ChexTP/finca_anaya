export const alphabetLetters = [..."ABCDEFGHIJKLMN\u00d1OPQRSTUVWXYZ", "#"];
const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export const compareNames = (left, right) => (
  collator.compare(String(left.name || "").trim(), String(right.name || "").trim())
  || Number(left.id || 0) - Number(right.id || 0)
);

export const getNameInitial = (name) => {
  const first = String(name || "").trim().charAt(0).toLocaleUpperCase("es")
    .normalize("NFD").replace(/[\u0300-\u0302\u0308]/g, "").normalize("NFC");
  return alphabetLetters.includes(first) && first !== "#" ? first : "#";
};

export const matchesNameInitial = (name, letter) => !letter || getNameInitial(name) === letter;
