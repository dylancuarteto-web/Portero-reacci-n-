// Hook de resolución de módulos: sustituye los módulos de Minecraft por los simuladores.
const MAP = {
  "@minecraft/server": new URL("./mock-server.mjs", import.meta.url).href,
  "@minecraft/server-ui": new URL("./mock-server-ui.mjs", import.meta.url).href,
};

export async function resolve(specifier, context, next) {
  if (MAP[specifier]) return { url: MAP[specifier], shortCircuit: true };
  return next(specifier, context);
}
