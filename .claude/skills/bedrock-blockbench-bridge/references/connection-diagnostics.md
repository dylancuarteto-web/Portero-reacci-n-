# Diagnóstico de conexión Blockbench MCP

## Arquitectura

`Claude Code --MCP stdio--> servidor Node MCP --HTTP localhost--> plugin puente dentro de Blockbench Desktop`.

## Comprobación por capas

1. **Cliente:** ejecuta `/mcp` dentro de Claude Code. El servidor `blockbench` debe aparecer conectado, no solo configurado.
2. **Configuración:** revisa `.mcp.json` en la raíz del proyecto. `args[0]` debe apuntar a `dist/index.js` real.
3. **Servidor MCP:** confirma que Node.js 18+ está disponible y que el repositorio upstream fue compilado (`dist/index.js`).
4. **Plugin:** Blockbench Desktop debe haber cargado `plugin/blockbench_mcp.js` y concedido permiso de red.
5. **Puente local:** `http://127.0.0.1:8787/ping` debe responder JSON con `ok: true`.
6. **Proyecto:** `has_project: true` indica que existe un proyecto activo. Si es false, abre uno antes de modelar.

## Fallos típicos

- `Cannot reach Blockbench`: plugin no cargado, servidor detenido, permiso de red denegado o puerto distinto.
- `Server failed to start`: revisa el permiso `net` del plugin y reinicia Blockbench.
- `Unknown format`: instala/activa de forma manual el formato necesario y consulta otra vez la lista de formatos.
- No hay herramientas visibles: cierra y reabre la sesión de Claude Code y aprueba el servidor en `/mcp`.
- Dos ventanas Blockbench: el puente upstream documenta una sola ventana activa; cierra instancias adicionales.

No intentes remediar estos errores exponiendo el servicio a la red. El host debe mantenerse en loopback `127.0.0.1`.
