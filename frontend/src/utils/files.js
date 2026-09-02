const DEFAULT_MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_DIMENSION = 1600;

const readFileAsDataUrl = (file, errorMessage = "No se pudo leer la imagen") => {
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

const loadImage = (source) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo preparar la imagen"));
    image.src = source;
  });
};

const dataUrlBytes = (dataUrl) => {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
};

const canvasToDataUrl = (canvas, quality) => canvas.toDataURL("image/jpeg", quality);

export const readImageFileAsDataUrl = (file, errorMessage = "No se pudo leer la imagen") => {
  return readFileAsDataUrl(file, errorMessage);
};

export const prepareImageForUpload = async (
  file,
  {
    errorMessage = "No se pudo leer la imagen",
    maxBytes = DEFAULT_MAX_IMAGE_BYTES,
    maxDimension = DEFAULT_MAX_IMAGE_DIMENSION,
  } = {}
) => {
  if (!file) {
    throw new Error("Seleccione una imagen");
  }

  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("El archivo debe ser una imagen");
  }

  const originalDataUrl = await readFileAsDataUrl(file, errorMessage);

  if (file.size <= maxBytes && dataUrlBytes(originalDataUrl) <= maxBytes) {
    return {
      image: originalDataUrl,
      fileName: file.name,
      mimeType: file.type,
      compressed: false,
    };
  }

  if (typeof document === "undefined") {
    throw new Error("La imagen es muy pesada y no se pudo comprimir en este dispositivo.");
  }

  const image = await loadImage(originalDataUrl);
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("La imagen es muy pesada y no se pudo comprimir en este dispositivo.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  let compressedDataUrl = canvasToDataUrl(canvas, 0.82);

  for (const quality of [0.74, 0.66, 0.58, 0.5, 0.42]) {
    if (dataUrlBytes(compressedDataUrl) <= maxBytes) break;
    compressedDataUrl = canvasToDataUrl(canvas, quality);
  }

  if (dataUrlBytes(compressedDataUrl) > maxBytes) {
    const reductionScale = Math.sqrt(maxBytes / dataUrlBytes(compressedDataUrl)) * 0.9;
    const reducedWidth = Math.max(1, Math.round(width * reductionScale));
    const reducedHeight = Math.max(1, Math.round(height * reductionScale));
    canvas.width = reducedWidth;
    canvas.height = reducedHeight;
    context.drawImage(image, 0, 0, reducedWidth, reducedHeight);
    compressedDataUrl = canvasToDataUrl(canvas, 0.58);
  }

  if (dataUrlBytes(compressedDataUrl) > maxBytes) {
    throw new Error("La imagen sigue pesando demasiado. Tome la foto un poco mas lejos o con menor resolucion.");
  }

  const cleanName = String(file.name || "foto.jpg").replace(/\.[^.]+$/, "");

  return {
    image: compressedDataUrl,
    fileName: `${cleanName}.jpg`,
    mimeType: "image/jpeg",
    compressed: true,
  };
};
