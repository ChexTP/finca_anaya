const SENSITIVE_KEYS = ["password", "token", "authorization", "jwt", "secret"];

const sanitizeValue = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_KEYS.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
        return [key, "[oculto]"];
      }

      return [key, sanitizeValue(item)];
    })
  );
};

const writeLog = (level, message, meta = {}) => {
  const payload = {
    time: new Date().toISOString(),
    level,
    message,
    ...sanitizeValue(meta),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logger = {
  info: (message, meta) => writeLog("info", message, meta),
  warn: (message, meta) => writeLog("warn", message, meta),
  error: (message, meta) => writeLog("error", message, meta),
};

export const logControllerError = (req, error, context = {}) => {
  logger.error("Error controlado por controller", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    userRole: req.user?.role,
    body: req.body,
    params: req.params,
    query: req.query,
    context,
    error: {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      stack: error.stack,
    },
  });
};
