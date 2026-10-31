# Claude NPC — Bedrock 26.60

NPC con forma de Claude: personaje naranja, solo ojos y un emblema de estrella de diseño propio (no es el logo oficial). Namespace `claudenpc`.

## Instalación

1. Abre `dist/ClaudeNPC.mcaddon` con Minecraft y activa el paquete de comportamiento en el mundo.
2. Genera a Claude con el huevo "Generar a Claude" (pestaña de huevos) o `/summon claudenpc:claude`.
3. Para que te ataque, el mundo debe tener PvP activado y tú estar en Supervivencia o Aventura.

## IQ

Encima del nombre lleva su **IQ** (empieza en 70, máximo 300). Sube cuando te ve construir, romper o subir en torre, cuando recibe golpes y flechas, cuando una táctica le funciona y con el tiempo de pelea. Se guarda en el NPC y en el mundo: un Claude nuevo hereda gran parte de lo aprendido. Con más IQ:
- piensa más rápido (de cada 1,5 s a cada 0,5 s);
- desbloquea tácticas: perla (85), water drop saltando al vacío (100), torreta (110), trampa (120), elytra + maza (125);
- apunta mejor con el arco (predice tu movimiento y la caída de la flecha);
- bloquea más golpes con el escudo y se mueve de lado más a menudo;
- recuerda tus costumbres (si sueles subir en torre o usar arco) y lo que le funcionó, y elige en consecuencia.

## Combate (jugador a menos de 32 bloques)

- **Se mueve como un jugador:** camina cerca, corre si tú corres o te alejas, salta mientras corre, se mueve de lado y retrocede tras golpear.
- **Cambia de arma constantemente** entre espadas, hacha y tridente; escudo en la otra mano.
- **Nodos de decisión con alternativas:**
  - Si subes en torre para escapar: construye un pilar, te dispara con el arco, despega con elytra o lanza una perla.
  - Si estás lejos: arco (con animación de tensar), perla, torreta.
  - Si estás abajo: salta al vacío con water drop o cava.
  - Cerca: salto con maza, golpe de escudo, trampas.
- **Elytra + maza:** despega con cohete, planea hacia ti y cae en picada con la maza; el daño depende de la altura.
- **Water drop:** si cae desde altura, coloca agua justo antes de tocar el suelo y luego la recoge.

## Trabajo (sin jugadores cerca)

- **Mina en escalera hacia abajo** (20 bloques) y después en túnel, un bloque por golpe, a ritmo humano, poniendo antorchas. Solo rompe lo que su pico permite y evita la lava.
- **Craftea despacio:** pone la mesa, la mira trabajando unos 9 s, saca el objeto y recoge la mesa. Mejora pico (12 bloques minados) y armadura (18).

Para que no toque bloques de tu mundo: `BP/scripts/config.js` → `MODIFICA_MUNDO = false`.

## Estado

Validado con las herramientas del kit (0 errores) y con los tipos oficiales de `@minecraft/server` 2.11.0. **No probado en el juego.** Riesgos: que los objetos en la mano se dibujen en un mob propio, y la orientación del dispensador.
