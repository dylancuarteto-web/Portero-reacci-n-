# Composición de partículas

## Anatomía básica
Un particle effect Bedrock define un identifier y parámetros de renderizado, además de componentes del emisor y/o de la partícula. Los componentes dependen del formato y deben cotejarse con la referencia oficial de la versión.

## Capas sugeridas

| Capa | Función | Duración típica de diseño |
|---|---|---|
| Núcleo | Punto focal | Corta o media |
| Halo | Define silueta | Media |
| Orbitales | Da profundidad | Media, con baja densidad |
| Estela | Indica dirección/movimiento | Muy corta |
| Destello | Marca el instante principal | Muy corta |
| Fade | Cierra el efecto | Corta |

Estos son criterios visuales, no valores obligatorios del motor.

## Movimiento con Molang
- Usa expresiones matemáticas simples y legibles.
- Valida funciones/queries Molang en la referencia actual.
- Para órbitas y espirales, controla radio, velocidad angular y lifetime.
- Evita divisiones por cero, valores no finitos y rangos de escala enormes.
- No copies una expresión de Java Edition.

## Texturas
- Usa atlas con sprites simples y transparencias limpias.
- Comprueba bordes del atlas y filtrado para evitar halos no deseados.
- Mantén tamaños moderados para Android.
- Conserva fuente editable PNG.

## Recetas visuales

### Aura calmada
Core suave + halo tenue + unas pocas partículas ascendentes + fade.

### Portal decorativo
Anillo exterior + núcleo translúcido + orbitales lentos + apagado gradual. El VFX no mueve por sí mismo al jugador; el teletransporte, si se requiere, pertenece al Script/Behavior Layer.

### Marcador de construcción
Pulso corto en un punto + anillo de lectura clara + partículas pequeñas con vida breve.

### Compañero mágico
Pequeñas partículas ligadas a una animación de reposo; reduce el ratio mientras el jugador está lejos.

## Referencias oficiales
- https://learn.microsoft.com/en-us/minecraft/creator/reference/content/particlesreference/particlesintroduction?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/reference/content/particlesreference/?view=minecraft-bedrock-stable
