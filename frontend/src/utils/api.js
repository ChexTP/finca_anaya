const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const DEFAULT_TIMEOUT_MS = 45000;

export const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem("finca_anaya_token");
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La solicitud tardo demasiado. Revise la conexion e intente actualizar de nuevo.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") || "";
  const requestId = response.headers.get("x-request-id");
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    console.error("[API ERROR]", {
      path,
      status: response.status,
      requestId,
      response: data,
    });

    const details = data?.error ? `: ${data.error}` : "";
    throw new Error(`${data?.message || "Error de comunicacion con el servidor"}${details}`);
  }

  return data;
};

export const saveToken = (token) => {
  localStorage.setItem("finca_anaya_token", token);
};

export const getToken = () => {
  return localStorage.getItem("finca_anaya_token");
};

export const removeToken = () => {
  localStorage.removeItem("finca_anaya_token");
};
