export const saleStatusLabels = {
  pendiente_alistamiento: "Pendiente de decision",
  pendiente_bodega: "Pendiente de bodega",
  lote_asignado: "Con lote asignado",
  proceso_solicitado: "Proceso solicitado",
  en_proceso: "En proceso",
  listo_para_ensamble: "Listo para ensamble",
  ensamble_definido: "Ensamble definido",
  pendiente_laboratorio: "Pendiente laboratorio",
  aprobada_laboratorio: "Aprobada laboratorio",
  alistada: "Alistada",
  despachada: "Despachada",
  anulada: "Anulada",
};

export const processStatusLabels = {
  pendiente: "Por iniciar",
  en_proceso: "En proceso",
  pendiente_revision_fisica: "Revision fisica en bodega",
  pendiente_laboratorio: "Por analizar",
  finalizado: "Finalizado",
};

export const lotStatusLabels = {
  pendiente_revision_fisica: "Revision fisica",
  pendiente_laboratorio: "Pendiente laboratorio",
  disponible: "Disponible",
  vendido_parcial: "Disponible parcial",
  agotado: "Agotado",
  danado: "Danado",
  rechazado: "Rechazado",
  retirado: "Retirado",
};

export const paymentStatusLabels = {
  pendiente_pago: "Pendiente",
  pago_parcial: "Pago parcial",
  pagada: "Pagada",
};

export const quoteStatusLabels = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  anulada: "Anulada",
};

export const getQuoteNextAction = (quote) => {
  const actions = {
    borrador: "Comercial debe revisar y enviar al cliente",
    enviada: "Esperar respuesta del cliente",
    aceptada: "Contabilidad debe convertirla en venta",
    anulada: "Sin accion comercial",
  };

  return actions[quote?.status] || "Revisar cotizacion";
};

export const getSaleNextAction = (sale) => {
  if (sale?.status === "pendiente_bodega" && sale?.blend_required === false) {
    return "Bodega debe asignar el lote procesado y alistar";
  }

  const actions = {
    pendiente_alistamiento: "Bodega debe decidir si asigna lote o solicita proceso",
    pendiente_bodega: "Bodega debe asignar cafe o solicitar proceso",
    lote_asignado: "Bodega debe alistar el pedido",
    proceso_solicitado: "Administracion debe confirmar el inicio del proceso",
    en_proceso: "Esperando finalizacion para enviar a examen de laboratorio",
    listo_para_ensamble: "Bodega debe revisar la orden de mezcla o alistar",
    ensamble_definido: "Bodega debe enviar a laboratorio despues del ensamble",
    pendiente_laboratorio: "Laboratorio debe aprobar las caracteristicas de cada producto",
    aprobada_laboratorio: "Bodega puede alistar y descontar inventario",
    alistada: "Bodega puede despachar",
    despachada: "Contabilidad debe revisar pago si queda saldo",
    anulada: "Sin accion operativa",
  };

  return actions[sale?.status] || "Revisar estado";
};

export const getSaleTaskKey = (sale) => {
  if (sale.status === "pendiente_bodega" && sale.blend_required === false) return "prepare";
  if (["pendiente_alistamiento", "pendiente_bodega"].includes(sale.status)) return "decision";
  if (sale.status === "lote_asignado") return "prepare";
  if (["proceso_solicitado", "en_proceso"].includes(sale.status)) return "process";
  if (["listo_para_ensamble", "ensamble_definido"].includes(sale.status)) return "blend";
  if (sale.status === "pendiente_laboratorio") return "lab";
  if (sale.status === "aprobada_laboratorio") return "prepare";
  if (sale.status === "alistada") return "dispatch";
  return "other";
};

export const getSaleStatusTone = (sale) => {
  if (sale?.status === "despachada") return "success";
  if (sale?.status === "anulada") return "danger";
  if (sale?.status === "alistada") return "success";
  if (["proceso_solicitado", "en_proceso", "listo_para_ensamble", "pendiente_laboratorio"].includes(sale?.status)) return "warning";
  if (sale?.status === "aprobada_laboratorio") return "success";
  return "neutral";
};

export const getProcessNextAction = (process) => {
  const actions = {
    pendiente: "Confirmar inicio y fecha estimada de regreso",
    en_proceso: "Marcar pendiente de examen cuando termine fisicamente",
    pendiente_revision_fisica: "Bodega debe registrar cantidad final, humedad y factor",
    pendiente_laboratorio: "Registrar mediciones y crear lote PROC",
    finalizado: "Proceso cerrado",
  };

  return actions[process?.status] || "Revisar proceso";
};

export const getProcessStatusTone = (process) => {
  if (process?.status === "finalizado") return "success";
  if (process?.status === "pendiente_laboratorio") return "warning";
  if (process?.status === "en_proceso") return "neutral";
  return "warning";
};

export const isDeliveryDueSoon = (dateValue) => {
  if (!dateValue) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveryDate = new Date(dateValue);
  deliveryDate.setHours(0, 0, 0, 0);

  const differenceDays = Math.ceil((deliveryDate.getTime() - today.getTime()) / 86400000);
  return differenceDays <= 1;
};
