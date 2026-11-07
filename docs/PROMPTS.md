# Prompts

**Zombi gordo:** Lee las skills de arquitectura y rigging. Modifica el modelo del zombi para aumentar claramente la anchura del torso y el volumen de brazos; conserva nombres de huesos, ajusta pivotes, UV y animaciones, y configura la hitbox por separado. Entrega `.geo.json` y validación estática; no afirmes prueba in-game.

**Estructura:** Convierte `structure-design.json` a un formato nativo Bedrock válido para la versión indicada. No llames `.mcstructure` al JSON de diseño. Verifica bloques, dimensiones y rotaciones.

**Hilos:** Lee la skill de puppet threads y `examples/puppet-threads-design.json`. Implementa máquina de estados y órdenes del mob antes de renderizar varios hilos segmentados. No sustituyas el sistema por una línea recta o partículas aleatorias.
