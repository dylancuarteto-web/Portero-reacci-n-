---
name: bedrock-vfx-studio
description: Crea efectos visuales avanzados para Minecraft Bedrock con partículas JSON, Molang, emisores, animaciones y composición por capas, optimizados para móvil.
---

# Bedrock VFX Studio 2.0

Crea VFX originales y legibles. No crees sonido; el usuario lo añadirá posteriormente.

## Principios de composición

Cada efecto complejo debe dividirse en capas con funciones visuales distintas:
1. **Core**: foco o núcleo.
2. **Halo**: anillo o borde luminoso.
3. **Orbitals**: partículas alrededor del punto de interés.
4. **Trail**: estela direccional breve.
5. **Burst**: destello puntual y controlado.
6. **Fade**: salida/disipación limpia.

No es obligatorio usar todas las capas. Prioriza legibilidad y rendimiento.

## Pipeline
1. Define qué acción visual comunica el efecto.
2. Selecciona textura/material y paleta.
3. Elige forma del emisor y lifetime.
4. Construye movimiento con velocidad, aceleración y Molang solo cuando aporte valor.
5. Añade eventos de ciclo de vida y curvas.
6. Conecta el identifier del efecto al evento/animación/script real.
7. Comprueba anclaje, orientación, duración y visibilidad en multiplayer.
8. Optimiza densidad y frecuencia para Android.

## Reglas
- Identificadores propios: `namespace:effect_name`.
- Archivos de partículas dentro de `RP/particles/`.
- No uses `minecraft:` para partículas propias.
- Todas las rutas de textura deben existir.
- Las unidades de partículas son metros/bloques y segundos; velocidades en m/s.
- Las partículas son visuales: no implementan lógica ni interacción por sí mismas.
- No emitas efectos persistentes desde cada tick sin límite.
- Usa presets por calidad cuando sea necesario.
- Evita estropear visibilidad del jugador con fog/flash excesivo.

## Tipos de VFX

- luz, magia, energía abstracta y cristales;
- agua, hielo, viento y naturaleza;
- portales decorativos y teletransporte visual de apoyo;
- auras de compañeros pacíficos;
- marcadores de destino y construcción;
- transiciones y apariciones de entidades;
- efectos ambientales y estacionales.

Lee `references/particle-composition.md` y `references/mobile-performance.md`.
