# Checklist de objetos Bedrock

## Especificación
- [ ] Identifier único en namespace propio.
- [ ] Función central descrita en una frase.
- [ ] Componentes confirmados en docs para la build objetivo.
- [ ] Métodos Script API confirmados en el módulo declarado.
- [ ] Cooldowns y límites definidos.

## Recursos
- [ ] Icono en inventario probado.
- [ ] Textura/atlas con ruta correcta.
- [ ] Representación en mano revisada.
- [ ] Attachables, geometría y render controllers coinciden.
- [ ] Animación y VFX apuntan al identifier correcto.
- [ ] No hay archivos de audio no solicitados.

## Comportamiento
- [ ] Acción se ejecuta una sola vez por activación.
- [ ] Cooldown se comprueba antes de ejecutar.
- [ ] Hay feedback de cooldown/uso inválido.
- [ ] Manejo de dimensión, jugador desconectado y destino bloqueado.
- [ ] En multijugador solo afecta al objetivo previsto.

## Referencias
- https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/minecraft_items?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable
