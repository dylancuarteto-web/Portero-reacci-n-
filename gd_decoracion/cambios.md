# Cambios: decoración dorada del nivel "Unnamed 15 Autosave 2"

Archivos de esta carpeta:

| Archivo | Qué es |
|---|---|
| `nivel_original_backup.gdlvl` | Copia exacta del nivel original (solo lectura, no se ha modificado; SHA-256 `66b52f20…b04b0d3`). |
| `nivel_decorado.gdlvl` | **El nivel nuevo, listo para importar.** |
| `referencia_objetos.gdlvl` | Tu nivel con los 37 objetos de referencia. |
| `generar_decoracion.py` | Script que genera el nivel decorado a partir del backup (`python3 generar_decoracion.py nivel_original_backup.gdlvl referencia_objetos.gdlvl nivel_decorado.gdlvl`). |

El archivo de salida usa el mismo formato que el original (base64 URL-safe con gzip, y `k4` igual por dentro). Lo volví a leer después de guardarlo y se lee bien. También actualicé `k48` (número de objetos): 2198 → 1812.

---

## 1. Lista de objetos: qué se borró y qué se conservó

### Borrados: 1298 objetos decorativos

| ID | Cantidad | Tipo |
|---|---:|---|
| 50 | 291 | círculos/brillos decorativos |
| 1011 | 160 | glow de borde |
| 1 | 139 | bloque básico escalado y usado para dibujar (lo confirmaste tú) |
| 20 | 110 | pincho decorativo (encima de los pinchos de juego) |
| 54 | 101 | destellos decorativos |
| 3638 | 72 | detalle 2.2 de borde |
| 1820 | 72 | relleno decorativo |
| 1753 | 57 | detalle de contorno |
| 1886 | 50 | glow |
| 3827 | 50 | glow 2.2 |
| 1888 | 38 | glow de esquina |
| 21 | 30 | pincho decorativo |
| 41 | 26 | cadenas colgantes |
| 53 | 21 | brillos grandes de fondo |
| 1754 | 18 | detalle de contorno |
| 19 | 17 | pincho decorativo grande |
| 51 | 16 | anillos decorativos |
| 1887 | 15 | glow cuadrado |
| 413 | 10 | cuadrado con bisel |
| 410 | 5 | cuadrado con bisel |

### Conservados sin tocar: 900 objetos

- **Gameplay:** 444 bloques sólidos ID 467, 42 pinchos ID 8, 15 pinchos pequeños ID 39, 6 orbes amarillos, 5 azules, 3 rosas, 1 pad rojo, 4 portales de velocidad (200 ×2, 201, 203), 3 portales de tamaño (99 ×2, 101) y 4 de gravedad (10 ×2, 11 ×2).
- **Triggers:** 107 de movimiento (901), 236 de pulso (1006), 5 de color (899), 1 de canción (1934) y 2 de cámara (2913, 2915).
- **Dudosos (los conservé, como decidiste):** la llave 1275; los giratorios 186 ×8, 187 y 1734; 1722 ×2, 1719 y 1720 en el suelo; y 481, 507, 103, 3884, 3890 y 1743 ×2 (estos dos últimos están dentro de la torre, en el grupo 1). Las celdas donde hay un 481 o un 507 dentro de un bloque no llevan decoración, para no taparlos.

Todos estos objetos están **idénticos byte a byte** al original, salvo los triggers de pulso y de color: en ellos solo cambié el color (y el canal de destino de los pulsos), para quitar el morado.

---

## 2. Análisis del nivel

- **Suelo, techo y paredes:** todo está hecho con el bloque 467 (253 posiciones distintas). Hay 194 copias del 467 escaladas a 1.22 y en la capa B3, puestas detrás de los bloques. **Las conservé**, porque pueden agrandar la colisión. Les puse color negro (canal 1) y ahora hacen de contorno oscuro alrededor de todas las formas.
- **Grupo 1:** es la torre/puerta de x=225–405 (base de 7×3 bloques y columna de 3×6, hasta y=345) con 7 pinchos. El trigger de movimiento de x=151 (de toque) la sube 75 unidades. **Toda la decoración de la torre (201 objetos) lleva el grupo 1**, así que sube con ella.
- **Música:** ya había 236 pulsos sincronizados. Además, los grupos 101–106 rebotan con el ritmo mediante 89 triggers de movimiento, y los grupos 120–123 hacen una animación de entrada.
- **"Corazón":** no encontré ningún objeto que fuera claramente el corazón y no elegiste ninguno, así que **el elemento central es la torre del grupo 1**. Es la que lleva los pinchos grandes, el glow T3, los engranajes y los destellos, y por tanto lo más brillante de la pantalla. Si el corazón es otro objeto (por ejemplo los dos ID 1743 de los huecos de la torre o el ID 3884), dímelo y lo cambio.

### Arreglo importante de visibilidad
En el original, el **color de objeto (1004) tenía opacidad 0**, así que los pinchos de juego y los bloques eran invisibles: solo se veían gracias a los pinchos decorativos (ID 20/21) que había encima. Como esos pinchos eran decoración y se borran, puse **1004 = FFD700 con opacidad 1**. Ahora los pinchos de juego se ven en dorado.

---

## 3. Qué objeto de referencia va en cada paso

Elegiste que usara mi mejor suposición. Asigné los 8 bloques de `referencia_objetos.gdlvl` así:

| Bloque (x) | IDs | Paso | Motivo |
|---|---|---|---|
| B1 (435–637) | 469, 1265, 471, 1263, 1203, 1157 | **Contorno** | 1265 y 1263 están más abajo, igual que los dos puntitos del panel OUTLINE. Lo tomo como: 469/1203 = esquina en L, 471/1157 = línea. |
| B2 (825) | 211 | **Relleno** | El cuadrado sólido. |
| B2 (952–1100) | 1010, 1009, 503, 1292, 504 | **Detalles del contorno** | 1292 está más alto, como la textura dentada del panel; el resto son degradados. |
| B3+B4 (1185–1755) | 190, 231, 237, 1735, 1909, 326, 1754, 884, 1279 | **Detalles interiores** | 1735 es un objeto giratorio (el engranaje); 190 está más alto, como el glow pequeño de esquina. |
| B5 (1890–2025) | 3035, 3034, 3042, 3046 | **Más detalles** | 4 objetos, como el panel (rampa pequeña, pendiente, línea, ladrillo). |
| B6 (2175–2390) | 1887, 1886, 2974, 505, 504 | **Detalles finales** | 5 objetos en el mismo orden que el panel (orbe de glow, pico, línea, cuadrado con borde, degradado de esquina). |
| B7 (2452–2635) | 3048, 3044, 3047, 3043, 3045, 3049 | **Pinchos + cuadrados** | Cuadrado con bisel + 5 triángulos que se combinan para formar un pincho. |
| B8 (2715) | 2974 | **Glow T3** | Línea; el orbe (1887) y el degradado (504) se reutilizan de B6. |

No usé 1010, 1009, 503, 1754, 1279, 3035 ni 1886, porque no supe a qué forma corresponden. Solo se usan IDs de `referencia_objetos.gdlvl`; el script se detiene si aparece cualquier otro.

**No puedo ver los sprites del juego**, así que la forma y la rotación por defecto de cada objeto son suposiciones. Supuse que la L (469/1203) sin rotar es "┌", que la línea (471/1157) va en el lado izquierdo y que el degradado 504 está en la esquina superior izquierda. Por eso **cada paso está en su propia capa del editor** (de la 11 a la 18): si una capa se ve mal, puedes aislarla o borrarla en el editor sin tocar las demás.

---

## 4. Capas añadidas: 912 objetos

| Capa editor | Paso | Objetos | Qué hace | Color |
|---:|---|---:|---|---|
| 12 | Relleno | 242 | 211 en cada bloque visible (capa Z T2) | `0D1B3E` ×0.9; puerta de la torre en `000000` |
| 15 | Más detalles | 59 | Ladrillo 3046 en las celdas interiores; rampas 3034 y líneas "\|\|\|" 3042 en la torre | `1B2A4F` ×0.7, `B8860B`, `FFD700` |
| 13 | Detalles del contorno | 149 | Textura dentada 1292 en los lados izquierdo y derecho expuestos | `B8860B` |
| 11 | Contorno (borde principal) | 237 | L 469 en esquinas, líneas 471 en lados; marco interior de la puerta con 1203/1157 y puntos 1265/1263 | `FFD700` (puntos `FFF8E1`) |
| 17 | Pinchos + cuadrados | 105 | Cuadrado con bisel 3048 en cada esquina exterior; 3 pinchos grandes (escala 1.4 / 1.8 / 1.1) sobre la torre, cada uno con 5 triángulos apilados; 3 pinchos colgantes | `B8860B` → `FFD700` → `FFE066`, centro `000000` |
| 18 | Glow T3 + glow de esquina | 91 | Degradado 504 en cada esquina exterior; orbes 1887 en las esquinas de la torre; líneas de brillo 2974 en la columna (capa Z T3) | `FFE066` ×0.8 (blending) |
| 14 | Detalles interiores | 19 | 2 engranajes 1735 en la puerta, cadena de rombos 231/237 con triángulo 1909, hexágonos 326, glow 190, 4 destellos 884 | `FFD700`, `B8860B`, `FFE066`, `FFF8E1` ×0.9 |
| 16 | Detalles finales | 10 | Cuadrados con borde 505 en la base, orbes detrás de los engranajes, cadena de los colgantes | `FFD700`, `FFE066`, `B8860B` |

- **Contorno oscuro:** son las 194 copias negras ×1.22 del 467 que ya estaban (canal 1 = `000000`).
- **Capas Z:** el relleno y los paneles van en T2; el contorno, los brillos y los detalles van en T3, por encima. No hay decoración nueva en las capas B.
- **Pinchos colgantes:** usan los grupos 101–106 que ya existían, así que rebotan con la música gracias a sus triggers. Solo se colocaron donde no tocan ningún objeto de juego (contando el recorrido del rebote). Se saltaron 6 posiciones, por ejemplo la de x=385, encima de la torre.

### Colores
- **Canales nuevos:** 50 `FFD700` ×1.0 · 51 `FFE066` ×0.8 (blending) · 52 `B8860B` ×1.0 · 53 `FFF8E1` ×0.9 (blending) · 54 `0D1B3E` ×0.9 · 55 `1B2A4F` ×0.7 · 56 `000000` ×1.0.
- **Canales del juego:** fondo 1000 = `0A0F1E`; suelo 1001 = `0D1B3E`; suelo 2 (1009) = `000000`; middleground 1013 = `0A0F1E` y 1014 = `0D1B3E`; línea del suelo 1002 = `FFD700`; objeto 1004 = `FFD700`; canal 1 = `000000`.
- **Canales morados borrados:** los 2–45. Ya no los usaba ningún objeto.
- Los 5 triggers de color del inicio ahora ponen esos mismos colores de la paleta.
- **No quedan morados, violetas ni magentas** en objetos, canales ni triggers. Los únicos canales fuera de la paleta son los del sistema que no se tocaron: colores del jugador (1005 verde, 1006 cian) y los blancos 1003/1007. Ningún objeto de decoración los usa.

---

## 5. Sincronización con la música

Reutilicé los **236 pulsos que ya estaban sincronizados**: tienen el mismo número y la misma posición, y no se añadió ningún trigger nuevo. Solo cambié:
- **Colores de los flashes:** `FFF8E1` (blanco cálido), `FFE066` y `FFD700` (dorado), y `1B2A4F` / `0A0F1E` para pulsos suaves del fondo.
- **Canal de destino:** ahora apuntan a los canales nuevos (por ejemplo, los antiguos 2 y 44 → borde dorado 50; 21 y 23 → glow 51; 40 → dorado oscuro 52).
- **Duración del fade out:** entre 0.1 y 0.3 s. Antes había valores de hasta 0.4.

---

## 6. Revisión

- **El gameplay no cambió.** Antes y después hay los mismos 42 pinchos (8), 15 pinchos pequeños (39), 444 bloques (467), 107 triggers de movimiento (901), 15 orbes y pads, 11 portales (4 de velocidad, 3 de tamaño y 4 de gravedad), 236 pulsos y 5 triggers de color. Lo comprobé releyendo los dos archivos y comparando cada objeto byte a byte.
- **Los 107 triggers de movimiento siguen todos.** Los de los grupos 101–106 mueven los pinchos colgantes nuevos. Los de 120–123 apuntan ahora a grupos vacíos, así que no hacen nada.
- **Solape con el juego:** toda la decoración está dentro de los bloques de juego. Las excepciones son los pinchos de encima de la torre, que van en un hueco sin gameplay, y los colgantes, que se comprobaron uno a uno. Nada queda encima de pinchos, orbes ni portales.
- **La decoración de la torre sube con el grupo 1.**

## 7. Dudas pendientes

1. **¿Cuál es el "corazón"?** Hasta que me lo digas, el elemento central es la torre del grupo 1.
2. **Formas y rotaciones de los objetos de referencia:** si alguna capa se ve girada o con una forma rara, dime cuál (capa 11–18) y cómo se ve, y corrijo la rotación o el ID.
3. **Las 194 copias escaladas del 467 y los objetos dudosos** se dejaron sin tocar. Si son solo decoración, se pueden borrar.
