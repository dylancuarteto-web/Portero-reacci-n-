# VFX y rendimiento móvil

## Presupuesto
- Limita cantidad de emisores activos por entidad/jugador.
- Limita partículas emitidas por segundo y su vida útil.
- Prefiere una textura atlas reutilizable.
- No mantengas orbitales complejos activos cuando el efecto no es visible.
- Usa bursts breves en vez de lluvia persistente.
- Evita efectos de pantalla completa o que oculten el juego.

## Pruebas
1. Un jugador, un efecto.
2. Un jugador, el máximo previsto de entidades con efecto.
3. Multijugador con efectos visibles para varios clientes.
4. Teléfono Android objetivo y distancia de render habitual.
5. Repetición frecuente de la habilidad y cambio de dimensión.

Registra FPS aproximados/caídas, número de emisores y observaciones. No inventes métricas sin medir.
