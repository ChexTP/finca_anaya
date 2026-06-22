export const getInitialRouteByRole = (role) => {
  if (role === "laboratory") {
    return "/laboratorio";
  }

  if (role === "warehouse") {
    return "/bodega";
  }

  if (role === "seller") {
    return "/comercial";
  }

  if (role === "samples") {
    return "/muestras";
  }

  return "/dashboard";
};
