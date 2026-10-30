# ⚠️ Coloca aquí tus 22 texturas

La carpeta `textures/` **no venía en el repositorio**, así que el addon ya
referencia las rutas exactas pero los `.png` los tienes que copiar tú aquí.

Los 22 archivos que los client entities esperan en esta carpeta. Deben medir
**64×32** (o 128×64, el doble), con la misma distribución que la textura del
zombie vanilla: es lo que espera `geometry.zombie`. Una skin de 64×64 se vería
estirada; si tus texturas son de 64×64, hay que cambiar la geometría, no la
imagen. `python3 herramientas/validar.py` avisa si alguna no encaja.

```
zombie_normal.png          zombie_espadachin.png
zombie_corredor.png        zombie_hacha.png
zombie_tanque.png          zombie_caballero.png
zombie_explosivo.png       zombie_chaman.png
zombie_toxico.png          zombie_invocador.png
zombie_congelador.png      zombie_enderman.png
zombie_constructor.png     zombie_incendiario.png
zombie_minero.png          zombie_trepador.png
zombie_arquero.png         zombie_general.png
zombie_mutante.png         zombie_bebe_corredor.png
zombie_domador.png         zombie_demoledor.png
```

Sin ellas el addon funciona igual, pero los zombies se ven con la textura
rota (magenta/negro). Este archivo se puede borrar después.
