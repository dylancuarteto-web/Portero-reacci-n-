# Proyecto: Video de curiosidad de Dragon Ball

## Pedido del usuario
- Hacer un video con la MISMA duración del audio de narración (assets/narracion.mp3, ElevenLabs, voz "Marcos").
- Tema: curiosidad de Dragon Ball (Vegetto).
- Las imágenes se usan como "pruebas reales" de las hazañas.
- El usuario enviará el formato y más material después. NO empezar hasta que lo indique.

## Material recibido
1. assets/1_vegetto-vs-gogeta.jpg - Vegetto Blue vs Gogeta Blue (línea amarilla dividiendo)
2. assets/2_vegetto-vs-kidbuu.jpg - Manga a color: Vegetto vs Kid Buu ("Te has fusionado con alguien, eso es trampa")
3. assets/3_vegetto-blue-manga.jpg - Vegetto Blue sobre fondo de manga (vs Zamasu)
4. assets/4_vegetto-vs-zamasu.jpg - Manga a color: Vegetto Blue vs Zamasu Fusionado ("Este es Vegetto Blue")
5. assets/narracion.mp3 - Audio de narración

## Pendiente
- Formato del video (vertical/horizontal, resolución), estilo, subtítulos, música, etc.
- Más imágenes/audios que el usuario enviará.

## Estado
- Video final: video_final.mp4, vertical 1080x1920 (YouTube Shorts), 30 fps, 82.5 s (narración + audio extra insertado en 53.17 s).
- Estilo animado 2D (como el video de la paloma): Vegito, Buu, Zamasu fusionado y Gogeta dibujados en vectores y animados.
- Escenas: intro Vegito Blue de frente con las Esferas del Dragón; aterrizaje y combo; Vegito (SSJ) vs Buu con esquives,
  provocación y la escena del caramelo; transformación a Blue; Vegito Blue vs Zamasu fusionado; Vegito y Gogeta de frente
  en estado base -> se transforman a Blue -> se miran, zoom y cross counter (puños a la cara).
- Las imágenes enviadas aparecen en la esquina inferior derecha según la escena (sin etiqueta).
- Pelea vs Buuhan en el aire con fondo de viento: Vegito bloquea los golpes y lo provoca; Buuhan delgado; Gogeta con chaleco amarillo.
- Audio: narración a -16 LUFS, música Saiyajin con limpieza de ruido y ducking bajo la voz, efectos de golpes y power up sincronizados.
- Scripts para regenerar en fuentes/ (engine.py, chars.py, scenes.py, render_anim.py, audio2.py, mix.sh).
- Audio extra (assets/narracion_extra.mp3): "Además de esta hazaña, Vegito no recibió ningún golpe en el canon, siendo este que
  esquivó varios ataques de sus oponentes como Buu o Zamasu." Insertado tras la pelea con Zamasu, con escena propia:
  Vegito (base) recibe un 0 gigante que le cae encima (humo, tiembla), se transforma en SSJ y lo sube poco a poco, y en Blue
  lo levanta fácilmente (golpes recibidos: 0); luego contador de golpes bloqueados y esquives con "¡FALLÓ!".
- Vegito bloquea los golpes bajos de Buuhan subiendo la rodilla (espinilla vertical).
- Tabla "Ranking de fusiones" en la pregunta final: Vegito #1 y luego intercambio con Gogeta #1.
