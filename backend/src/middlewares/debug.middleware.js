import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";

export const requestDebugLogger = (req, res, next) => {
  const startedAt = Date.now();
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);

  logger.info("Solicitud recibida", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("Solicitud finalizada", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id,
      userRole: req.user?.role,
    });
  });

  next();
};
