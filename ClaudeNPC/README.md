# Claude NPC — Bedrock 26.60

NPC con forma de Claude: personaje naranja, solo ojos y un emblema de estrella de diseño propio (no es el logo oficial). Namespace `claudenpc`.

## Instalación

1. Abre `dist/ClaudeNPC.mcaddon` con Minecraft y activa el paquete de comportamiento en el mundo.
2. Genera a Claude con el huevo "Generar a Claude" (pestaña de huevos) o `/summon claudenpc:claude`.
3. Para que te ataque, el mundo debe tener PvP activado y tú estar en Supervivencia o Aventura.

## Qué hace

**Con un jugador a menos de 20 bloques (combate):**
- Cambia de arma cada 2,5-4 s: espada de diamante, maza, hacha, tridente, espada de netherita y escudo; lleva escudo (o tótem) en la otra mano.
- Se mueve de lado, retrocede, embiste y salta.
- Maza: salta y cae con una onda que daña y empuja.
- Escudo: golpe de escudo que daña y empuja fuerte.
- Perla de ender: si estás lejos, lanza una perla y aparece a tu lado.
- Construye: pilar para subir hasta ti, cava si estás abajo, puentes sobre huecos.
- Trampa: TNT bajo una placa de presión en tu camino.
- Torreta de redstone: dispensador con flechas (o TNT) disparado por pulsos de redstone; se desmonta sola.

**Sin jugadores cerca (trabajo):**
- Mina bloques que tiene delante solo si su pico es suficiente (madera → piedra → hierro → diamante → netherita).
- Simula craftear: pone una mesa de crafteo, la mira, trabaja y saca un objeto. Con lo minado mejora su pico y su armadura (cuero → netherita); si no, saca algo cualquiera (antorcha, pan, arco…).

Para que no toque bloques de tu mundo: `BP/scripts/config.js` → `MODIFICA_MUNDO = false`.

## Pendiente (siguiente versión)

Elytra, bote y arco/ballesta reales.

## Estado

Validado con las herramientas del kit (0 errores) y con los tipos oficiales de `@minecraft/server` 2.11.0. **No probado en el juego.** Riesgos: que los objetos en la mano se dibujen en un mob propio, y la orientación del dispensador.
