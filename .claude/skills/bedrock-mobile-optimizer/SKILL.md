---
name: bedrock-mobile-optimizer
description: Optimiza add-ons de Minecraft Bedrock para Android y dispositivos de recursos limitados, revisando partículas, geometría, texturas, entidades y scripts.
---

# Bedrock Mobile Optimizer

Optimiza el add-on sin destruir su diseño ni eliminar características silenciosamente. Las mejoras deben ser medibles y reversibles.

## Auditoría inicial

Registra:
- dispositivo y versión Bedrock objetivo, si el usuario los proporciona;
- número aproximado de entidades activas por zona;
- número de partículas/emisores por habilidad;
- tamaño y cantidad de texturas;
- geometría, huesos y animaciones activos;
- frecuencia de tareas Script API;
- errores/warnings y caída visible de FPS.

No inventes métricas. Si no hay profiling real, describe el análisis como estático/estimado.

## Prioridades

1. **Scripts**: usa eventos en lugar de polling; agrupa intervalos; limita consultas a entidades/chunks cercanos; evita trabajo repetido.
2. **Partículas**: limita emisores, densidad y lifetime; apaga efectos no visibles; reutiliza texturas.
3. **Texturas**: usa atlas y resoluciones proporcionales al detalle; elimina duplicados y archivos sin uso.
4. **Geometría**: elimina caras internas, cubos ocultos y huesos inútiles; conserva silueta.
5. **Entidades**: evita spawn duplicado; limita compañeros activos; reduce lógica de entidades lejanas.
6. **Animaciones**: simplifica keyframes y controladores que no aportan valor.
7. **Paquetes**: elimina archivos temporales y exportaciones duplicadas del release.

## Perfiles de calidad

Crea perfiles conceptuales `mobile`, `balanced` y `high_visuals` si el proyecto necesita escalabilidad. No supongas que Bedrock tiene un selector automático de calidad para todos los recursos; implementa solo mecanismos confirmados y documenta cualquier selección manual.

## Pruebas de aceptación

- Mundo vacío con el add-on activo.
- Escena normal con todas las funciones de apoyo activas.
- Pico de entidades previsto.
- Repetición frecuente de VFX.
- Sesión larga para observar acumulación o degradación.
- Multijugador cuando corresponda.

Registra dispositivo, distancia de render, escena, cantidad de entidades/efectos y observaciones. Si no se dispone de un teléfono real, deja `DEVICE_TEST_NOT_RUN`.

## Regla principal

No sacrifiques la estabilidad ni la legibilidad por más partículas o geometría. Optimiza primero los elementos que más trabajo hacen por frame/tick y vuelve a medir.
