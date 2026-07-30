export const readImageFileAsDataUrl = (file, errorMessage = "No se pudo leer la imagen") => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Seleccione una imagen"));
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      reject(new Error("El archivo debe ser una imagen"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(errorMessage));
    reader.readAsDataURL(file);
  });
};
