// Globales que el motor de scripts de Bedrock trae y que no están en @minecraft/server.
declare const console: {
  log(...datos: unknown[]): void;
  info(...datos: unknown[]): void;
  warn(...datos: unknown[]): void;
  error(...datos: unknown[]): void;
};
