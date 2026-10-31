// Lecciones de Claude Maestro. "nodo" es la táctica que los alumnos usarán más
// después de la clase; "pizarra" son los apuntes cortos que escribe en el cartel
// (máximo ~14 letras por línea) y "frases" lo que explica en voz alta.
// Los maestros genios (IQ 500) enseñan su propia ciencia (más abajo).

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

// Lecciones de los maestros genios, con datos reales de cada científico.
export const LECCIONES_GENIOS = {
  einstein: [
    {
      tema: "Relatividad", nodo: "perla",
      pizarra: ["E = mc²", "Luz: 300000km/s", "Tiempo relativo"],
      frases: ["La energía y la masa son dos caras de lo mismo: E = mc².", "Nada viaja más rápido que la luz: unos 300.000 km por segundo.",
        "Si viajas muy, muy rápido, para ti el tiempo pasa más lento."],
      pregunta: "¿Qué tan rápido viaja la luz?", respuesta: "¡Unos 300.000 km por segundo!",
    },
    {
      tema: "Imaginación", nodo: null,
      pizarra: ["Imaginar", "Preguntar", "Experimentar"],
      frases: ["La imaginación es más importante que el conocimiento.", "Nunca dejes de hacer preguntas.",
        "Los experimentos mentales también son ciencia: imagina y razona."],
      pregunta: "¿Qué es más importante que el conocimiento?", respuesta: "¡La imaginación!",
    },
    {
      tema: "Fotones", nodo: "arco",
      pizarra: ["Luz = fotones", "Fotoeléctrico", "Nobel 1921"],
      frases: ["La luz viaja en paquetitos de energía llamados fotones.", "La luz puede arrancar electrones de un metal: el efecto fotoeléctrico.",
        "Por explicarlo ganó el Premio Nobel de Física de 1921."],
      pregunta: "¿Cómo se llaman los paquetitos de luz?", respuesta: "¡Fotones!",
    },
  ],
  tesla: [
    {
      tema: "Corriente alterna", nodo: "torreta",
      pizarra: ["Va y vuelve", "Viaja lejos", "En tu casa"],
      frases: ["La corriente alterna cambia de sentido muchas veces por segundo.", "Así la electricidad puede viajar muy lejos por los cables.",
        "Hoy casi todas las casas del mundo usan corriente alterna."],
      pregunta: "¿Qué corriente usan casi todas las casas?", respuesta: "¡La corriente alterna!",
    },
    {
      tema: "Bobina de Tesla", nodo: "trampa",
      pizarra: ["Dos bobinas", "Alto voltaje", "¡Rayos!"],
      frases: ["Una bobina de Tesla crea chispas y rayos con muchísimo voltaje.", "Funciona con dos bobinas que se pasan la energía una a otra.",
        "Nunca toques la electricidad sin protección."],
      pregunta: "¿Qué crea una bobina de Tesla?", respuesta: "¡Rayos de alto voltaje!",
    },
    {
      tema: "Magnetismo", nodo: "torreta",
      pizarra: ["Polo N y S", "Imán + corriente", "Motor"],
      frases: ["Un imán tiene un polo norte y un polo sur.", "Electricidad e imanes juntos pueden hacer girar un motor.",
        "Su motor de inducción todavía se usa en muchas máquinas."],
      pregunta: "¿Qué polos tiene un imán?", respuesta: "¡Norte y sur!",
    },
  ],
  curie: [
    {
      tema: "Radiactividad", nodo: "cavar",
      pizarra: ["Radiactivo", "Polonio", "Radio"],
      frases: ["Algunos elementos emiten energía por sí solos: eso es la radiactividad.", "Descubrió dos elementos nuevos: el polonio y el radio.",
        "Llamó polonio a uno en honor a su país, Polonia."],
      pregunta: "¿Qué dos elementos descubrió?", respuesta: "¡El polonio y el radio!",
    },
    {
      tema: "Dos Nobel", nodo: null,
      pizarra: ["Nobel Física", "Nobel Química", "Perseverar"],
      frases: ["Fue la primera persona en ganar dos Premios Nobel.", "Uno de Física y otro de Química.",
        "Trabajó años en un laboratorio muy sencillo y nunca se rindió."],
      pregunta: "¿Cuántos Premios Nobel ganó?", respuesta: "¡Dos!",
    },
    {
      tema: "Laboratorio seguro", nodo: "escudo",
      pizarra: ["Protección", "Medir", "Anotar"],
      frases: ["En su época no se sabía lo peligrosa que era la radiación.", "Hoy los científicos usan protección y miden con cuidado.",
        "Anota todo: una buena científica deja apuntes claros."],
      pregunta: "¿Qué usan hoy los científicos con la radiación?", respuesta: "¡Protección!",
    },
  ],
  newton: [
    {
      tema: "Gravedad", nodo: "vacio",
      pizarra: ["Todo se atrae", "La manzana", "La Luna cae"],
      frases: ["Todo lo que tiene masa atrae a lo demás: eso es la gravedad.", "Se cuenta que una manzana al caer le hizo pensar en ella.",
        "La misma fuerza mantiene a la Luna girando alrededor de la Tierra."],
      pregunta: "¿Qué fuerza hace caer las cosas?", respuesta: "¡La gravedad!",
    },
    {
      tema: "Leyes del movimiento", nodo: "martillazo",
      pizarra: ["1 Inercia", "2 F = m·a", "3 Acc.-reacc."],
      frases: ["Primera: un objeto sigue igual si nada lo empuja.", "Segunda: fuerza es masa por aceleración, F = m·a.",
        "Tercera: a toda acción le corresponde una reacción igual y opuesta."],
      pregunta: "¿Cuál es la segunda ley?", respuesta: "¡Fuerza es igual a masa por aceleración!",
    },
    {
      tema: "Luz y colores", nodo: "arco",
      pizarra: ["Prisma", "Arcoíris", "Telescopio"],
      frases: ["Con un prisma separó la luz blanca en colores.", "La luz blanca tiene dentro todos los colores del arcoíris.",
        "También construyó un telescopio con espejos."],
      pregunta: "¿Qué hay dentro de la luz blanca?", respuesta: "¡Todos los colores del arcoíris!",
    },
  ],
  lovelace: [
    {
      tema: "Algoritmos", nodo: "torre",
      pizarra: ["Paso 1, 2, 3", "Orden claro", "Programa"],
      frases: ["Un algoritmo es una lista de pasos para resolver algo.", "Ada escribió uno de los primeros programas de la historia.",
        "Lo hizo para la máquina analítica de Charles Babbage."],
      pregunta: "¿Qué es un algoritmo?", respuesta: "¡Una lista de pasos para resolver algo!",
    },
    {
      tema: "Bucles", nodo: "puente",
      pizarra: ["Repetir", "Bucle", "Hasta acabar"],
      frases: ["Un bucle repite los mismos pasos varias veces.", "Así una máquina hace mucho trabajo con pocas instrucciones.",
        "Los Claudes construyen sus casas con bucles: hilera tras hilera."],
      pregunta: "¿Para qué sirve un bucle?", respuesta: "¡Para repetir pasos!",
    },
    {
      tema: "Ciencia poética", nodo: null,
      pizarra: ["Números", "Música", "Imaginación"],
      frases: ["Ada imaginó que las máquinas podrían hacer más que cuentas.", "Pensó que algún día podrían componer música.",
        "Unir ciencia e imaginación: ella lo llamó ciencia poética."],
      pregunta: "¿Qué imaginó Ada que harían las máquinas?", respuesta: "¡Componer música!",
    },
  ],
};
