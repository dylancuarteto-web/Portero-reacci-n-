# Controles (pensados para pantalla táctil)

Ninguna habilidad necesita teclado ni comandos. Todo se hace **usando un objeto**. En Android eso significa **mantener pulsado** la pantalla (o tocar el botón de usar, según el esquema de control) con el objeto en la mano.

## Formas de lanzar habilidades

| Método | Cómo | Ideal para |
|---|---|---|
| **Runas** | Pon cada Runa en la barra rápida. Selecciónala y úsala: la habilidad sale al instante | Combate rápido: un toque por habilidad |
| **Libro Táctico** | Úsalo para abrir el menú *Jugadas de La Cobra*. Muestra tu energía y el estado de cada habilidad. Toca una jugada para lanzarla | Ver el estado de todas las habilidades y lanzar desde un solo hueco de la barra |
| **Espada de La Cobra** | Golpea normalmente. Al **usarla** lanza la habilidad que tengas asignada (por defecto, Instinto) | Combinar cuerpo a cuerpo y habilidades con un único objeto |

Para cambiar la habilidad de la espada: Libro Táctico → **Habilidad de la Espada** → elige una.

> **Progresión:** el Libro y la Espada solo pueden lanzar habilidades cuya **Runa tengas en el inventario**. En creativo todas están desbloqueadas.

## Indicador en pantalla

Cuando llevas un objeto de La Cobra en una mano, o hay una habilidad activa, aparece encima de la barra rápida:

```
Energía ||||||||||||||||||||  100   » Dominio 7s
INS  REM 3  VEN  DOM 21  SUP 80
```

- Verde: lista. Gris: falta energía. Rojo con número: segundos de enfriamiento.
- Los avisos («Energía insuficiente», «No hay ningún objetivo hostil a la vista», «Enfriamiento 5s») aparecen ahí mismo, sin llenar el chat.
- Suena un aviso cuando **Dominio** y **Suprema** vuelven a estar listos.

## Objetos con acción

| Objeto | Acción |
|---|---|
| Balón Dorado | Usar = lanzarlo (como una bola de nieve). Se recupera donde cae |
| Guantes del GOAT | En la **mano secundaria**: pasiva. En la mano principal, usar = **Atajada del GOAT** |
| Tótem de La Cobra | Usar = activarlo. Si lo llevas en cualquier mano, **te salva automáticamente** de un golpe mortal |
| Amuleto Cobra | Pasivo: llévalo en la barra rápida o en la mano secundaria |
| Ídolo de la Serpiente | Usar = ritual de 3 s para invocar al jefe, 6 bloques delante de ti |
| Armadura de La Cobra | Póntela. Con las 4 piezas se activa la bonificación de conjunto |

## Comandos de prueba (opcionales)

Necesitan ser operador. Los marcados con * también requieren trucos activados.

| Comando | Qué hace |
|---|---|
| `/lacobra:estado` | Muestra energía, enfriamientos y diagnóstico (tareas activas, efectos vivos, jefes). Cualquier jugador puede usarlo |
| `/lacobra:energia <0-100>` | Fija tu energía |
| `/lacobra:reset` | Energía al máximo y enfriamientos a cero |
| `/lacobra:habilidad <instinto\|remate\|veneno\|dominio\|suprema>` | Lanza una habilidad con las mismas validaciones de siempre |
| `/lacobra:kit` * | Te da todos los objetos |
| `/lacobra:jefe` * | Inicia el ritual del jefe sin gastar un Ídolo |
