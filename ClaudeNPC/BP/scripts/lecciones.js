// Lecciones de Claude Maestro. "nodo" es la táctica que los alumnos usarán más
// después de la clase; "pizarra" son los apuntes cortos que escribe en el cartel
// (máximo ~14 letras por línea) y "frases" lo que explica en voz alta.

export const LECCIONES = [
  {
    tema: "Torres", nodo: "torre",
    pizarra: ["1 Centrarse", "2 Mirar abajo", "3 Saltar+poner"],
    frases: ["Para subir rápido, primero céntrate en el bloque.", "Mira hacia abajo, salta y coloca el bloque en lo más alto del salto.",
      "Si hay un techo encima de tu cabeza, rómpelo antes de seguir subiendo."],
    pregunta: "¿Cuándo se coloca el bloque en una torre?", respuesta: "¡En el punto más alto del salto!",
  },
  {
    tema: "Puentes", nodo: "puente",
    pizarra: ["1 Agacharse", "2 Mirar hueco", "3 Desde el aire"],
    frases: ["En el borde, agáchate para no caerte.", "Mira el hueco y coloca el bloque contra el borde, paso a paso.",
      "Con práctica se hace desde el aire: saltar y colocar bajo los pies."],
    pregunta: "¿Por qué hay que agacharse en el borde?", respuesta: "¡Para no caerse al vacío!",
  },
  {
    tema: "Arco", nodo: "arco",
    pizarra: ["1 Predecir", "2 Caída", "3 Distancia"],
    frases: ["No apuntes donde está el jugador: apunta adonde va a estar.", "La flecha cae con la distancia: apunta un poco más arriba.",
      "El arco sirve de lejos; de cerca, la espada es mejor."],
    pregunta: "¿Adónde se apunta con el arco?", respuesta: "¡Adonde va a estar el blanco!",
  },
  {
    tema: "Escudo", nodo: "escudo",
    pizarra: ["1 Ver el arco", "2 Escudo arriba", "3 Bajar y atacar"],
    frases: ["Si alguien tensa un arco, levanta el escudo de inmediato.", "El escudo solo cubre por delante: mira hacia la flecha.",
      "El escudo no es un arma: para atacar, bájalo y usa la espada."],
    pregunta: "¿El escudo sirve para golpear?", respuesta: "¡No! Sirve para cubrirse de las flechas.",
  },
  {
    tema: "Water drop", nodo: "vacio",
    pizarra: ["1 Cubo listo", "2 Mirar suelo", "3 Recoger agua"],
    frases: ["Antes de saltar, ten el cubo de agua en la mano.", "Coloca el agua justo antes de tocar el suelo.",
      "Después recoge el agua: un buen jugador no deja charcos."],
    pregunta: "¿Cuándo se pone el agua en un water drop?", respuesta: "¡Justo antes de tocar el suelo!",
  },
  {
    tema: "Redstone", nodo: "torreta",
    pizarra: ["1 Dispensador", "2 Un pulso", "3 Un disparo"],
    frases: ["Un dispensador con flechas es una torreta sencilla.", "Cada pulso de redstone dispara una vez.",
      "Un bloque de redstone que aparece y desaparece da pulsos."],
    pregunta: "¿Cuántos disparos da un pulso de redstone?", respuesta: "¡Uno por cada pulso!",
  },
  {
    tema: "Trampas", nodo: "trampa",
    pizarra: ["1 Predecir paso", "2 Placa", "3 TNT abajo"],
    frases: ["Una trampa se pone donde el otro va a pisar, no donde está.", "La placa de presión va encima y la TNT justo debajo.",
      "Nunca pongas trampas cerca de tu propia casa."],
    pregunta: "¿Dónde se pone una trampa?", respuesta: "¡Donde el otro va a pisar!",
  },
  {
    tema: "Perlas", nodo: "perla",
    pizarra: ["1 Lanzar alto", "2 Caer detrás", "3 Atacar"],
    frases: ["La perla de ender te lleva adonde cae.", "Si caes detrás del otro, te costará más verte.",
      "Úsala para acercarte rápido o para escapar."],
    pregunta: "¿Para qué sirve una perla de ender?", respuesta: "¡Para teletransportarse adonde cae!",
  },
  {
    tema: "Elytra y maza", nodo: "elytra",
    pizarra: ["1 Cohete", "2 Planear", "3 Caer con maza"],
    frases: ["Despega con un cohete y planea con la elytra.", "Cuanto más alto caigas con la maza, más fuerte es el golpe.",
      "Necesitas cielo libre encima para volar."],
    pregunta: "¿De qué depende el golpe de la maza?", respuesta: "¡De la altura de la caída!",
  },
  {
    tema: "Construcción", nodo: "torre",
    pizarra: ["1 Cimiento", "2 Paredes", "3 Techo y luz"],
    frases: ["Una casa empieza por un piso firme y plano.", "Las paredes se levantan por hileras, dando la vuelta.",
      "Ilumina bien por dentro para que no aparezcan monstruos."],
    pregunta: "¿Por qué hay que iluminar la casa?", respuesta: "¡Para que no aparezcan monstruos!",
  },
  {
    tema: "Minería", nodo: "cavar",
    pizarra: ["1 Escalera", "2 Antorchas", "3 Ojo lava"],
    frases: ["Nunca mines recto hacia abajo: baja en escalera.", "Pon antorchas cada pocos bloques para no perderte.",
      "Si escuchas lava, cambia de rumbo."],
    pregunta: "¿Cómo se debe bajar al minar?", respuesta: "¡En escalera, nunca recto hacia abajo!",
  },
  {
    tema: "Matemáticas", nodo: null,
    pizarra: ["16x16 = chunk", "64 = un stack", "20 ticks = 1 s"],
    frases: ["Un chunk mide 16 por 16 bloques.", "Un stack completo son 64 objetos.",
      "En Minecraft, 20 ticks son un segundo."],
    pregunta: "¿Cuántos objetos hay en un stack?", respuesta: "¡64!",
  },
];
