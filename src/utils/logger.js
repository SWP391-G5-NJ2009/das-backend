const formatMeta = (meta) => {
  if (!meta) return "";

  if (meta instanceof Error) {
    return meta.stack || meta.message;
  }

  if (typeof meta === "string") {
    return meta;
  }

  return JSON.stringify(meta);
};

const write = (level, message, meta = null) => {
  const details = formatMeta(meta);
  const line = details ? `[${level}] ${message} ${details}` : `[${level}] ${message}`;

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
};

const logger = {
  info: (message, meta) => write("INFO", message, meta),
  warn: (message, meta) => write("WARN", message, meta),
  error: (message, meta) => write("ERROR", message, meta),
};

module.exports = logger;
