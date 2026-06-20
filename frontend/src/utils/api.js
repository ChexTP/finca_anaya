const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem("finca_anaya_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(data?.message || "Error de comunicacion con el servidor");
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
