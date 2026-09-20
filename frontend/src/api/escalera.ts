import { peldanoDe, type Peldano } from '@kamayuk/sesion';

/**
 * **La escalera de identidad, dicha al CIUDADANO** (issue 13).
 *
 * <h2>Que se toma de la libreria y que no</h2>
 *
 * De `peldanoDe` se toma **la clasificacion**, que es lo que de verdad cuesta y lo que el backend
 * distingue: en que peldano se quedo la peticion (`clave`), si hay que volver a la puerta
 * (`pideIdentidad`) y si esto es el sistema roto o el sistema funcionando (`esAveria`). Eso sale
 * del `codigo` del contrato —`NO_AUTENTICADO`, `SIN_MUNICIPALIDAD`, `SIN_PRIVILEGIO`—, es igual en
 * los cinco sistemas del producto y no tiene por que escribirse dos veces.
 *
 * De la libreria **no** se toman los textos, y ese es todo el motivo de que este archivo exista.
 * Los suyos estan escritos para quien atiende en ventanilla y lo dicen sin disimulo:
 *
 *   · «Reintente en unos segundos. Si sigue igual, **avise a soporte** con este mensaje.»
 *   · «Lo asigna **el administrador del sistema** en el emisor de identidad.»
 *   · «**Revise con que cuenta esta trabajando.**»
 *   · «Pida el permiso a quien administre **los perfiles**.»
 *
 * A quien entra a pagar su predial no hay soporte al que avisar, ni administrador que conozca, ni
 * perfiles que pedir: hay una ventanilla a la que ir con el DNI. Un remedio que nombra a gente que
 * el ciudadano no tiene es indistinguible de no dar remedio.
 *
 * <h2>Por que los textos son DATO y los traduce quien los dibuja</h2>
 *
 * Igual que los cuatro medios de pago (`src/pasos/pagar/textosDeLosMedios.ts`, issue 8): el texto
 * se elige por una `clave` que solo se conoce en tiempo de ejecucion, asi que la pantalla lo pasa
 * por `t()` con una variable y ninguna extraccion estatica lo sigue. Por eso el inventario del
 * locale no los copia a mano —un olvido ahi no daria ningun rojo— sino que los DERIVA de
 * `clavesDeLaEscalera()`.
 *
 * Y para que no haya que acordarse de traducir los tres, `peldanoDelPortal` recibe el traductor y
 * devuelve el peldano **ya traducido**: quien lo llama no puede olvidarse de uno.
 *
 * <h2>Lo que el backend dijo no se ensena, y es una decision</h2>
 *
 * La libreria usa el `mensaje` del `problem+json` como `detalle`. Aqui no: ese texto tambien esta
 * escrito para la ventanilla, y el unico endpoint que este portal consulta —`GET
 * /portal/situacion`, sin parametros— no tiene forma de contestar nada que el ciudadano pueda
 * corregir leyendolo. La nota que SI se ensena tal cual es otra —`notaDelTotal`, que viene en un
 * 200 y explica por que falta un total— y es del issue 14, no de esta escalera.
 *
 * <h2>Y los TRES miembros que `ErrorDeLaApi` conserva desde kamayuk-lib#96 (issue 33)</h2>
 *
 * `incidencia`, `detalles` y `parametroQueFalta` llegaban por el cable y se tiraban en el cliente;
 * ahora se conservan. **Aqui no se ensena ninguno de los tres**, y no es un olvido: cada uno tiene
 * su motivo, y los tres son el mismo motivo de arriba dicho tres veces.
 *
 *   · **`incidencia`** — el identificador con el que SOPORTE encuentra la causa de un 500 en el
 *     registro del servidor. Este portal no tiene soporte al que avisar: ante una averia su remedio
 *     es esperar unos minutos o ir a la ventanilla, y treinta y seis caracteres que no hay a quien
 *     dar son ruido encima de una mala noticia. Tampoco **se registra**: aqui no hay ni un
 *     `console` ni telemetria a donde mandarlo (medido en `src/`, issue 33), asi que «registrarlo»
 *     seria escribirlo donde nadie va a leerlo. El dia que este portal tenga a donde avisar, el
 *     dato sigue en el error.
 *   · **`detalles`** — es donde viaja el campo por el que se pidio ordenar («Campo pedido: …»).
 *     Son nombres de campos de la API, redactados para quien programa; y el ciudadano no pidio
 *     ningun orden ni tiene como cambiarlo, asi que ensenarselo seria darle un dato del que no se
 *     sale.
 *   · **`parametroQueFalta`** — `{ ejercicio, llave }`, la cifra normativa que no esta publicada.
 *     Distingue dos 404 de la hoja de Publicacion de `normativa` (normativa#66 y #67), que es una
 *     pantalla de back-office: este portal no la dibuja y no pide ningun ejercicio.
 *
 * Los tres **se conservan en el error** y quien los quiera leer los tiene; lo que no hacen es
 * llegar a la pantalla. Que no lleguen lo mide `escalera.test.ts`, y no por ausencia: la prueba
 * comprueba que los tres textos que salen son EXACTAMENTE los de la tabla, traducidos.
 */

/**
 * Los peldanos que el portal decide, que son los de `@kamayuk/sesion` y **dos mas** (issue 33).
 *
 * `conflicto` y `orden-no-admitido` los trae [kamayuk-lib#96](https://github.com/hneyra/kamayuk-lib/pull/96),
 * que se mezcla **pareado** con la rama de este issue. Se nombran aqui como union propia —y no se
 * espera a que la libreria los traiga— por dos motivos:
 *
 *   · Decir que se le dice a un ciudadano ante un 409 es decision de este portal, no de la epica
 *     que empuja el cambio, y por eso el PR de la libreria se queda abierto hasta que exista esta.
 *   · Esta union es un **superconjunto** de `Peldano['clave']`, asi que la tabla de abajo sigue
 *     siendo completa por el tipo respecto de la libreria: crecer la union de la libreria con un
 *     decimo peldano deja la tabla corta igual que antes. La guarda no se afloja; se adelanta.
 *
 * Cuando kamayuk-lib#96 este mezclado, los dos literales pasan a ser redundantes —la union de la
 * libreria ya los trae— y borrarlos no cambia nada. Lo que NO se puede borrar es la tabla.
 */
export type ClaveDelPeldano = Peldano['clave'] | 'conflicto' | 'orden-no-admitido';

/** Lo que el portal dice en un peldano: que paso, y que hacer. Sin traducir: ver la cabecera. */
export interface TextosDelPeldano {
  readonly titulo: string;
  /** Lo que paso, en una frase que se entienda sin saber que es un token. */
  readonly detalle: string;
  /** Que hacer para salir de aqui. Nunca «reintente» a secas, y nunca «avise a soporte». */
  readonly remedio: string;
}

/** Un peldano con los textos de ESTE portal, ya traducidos. */
export interface PeldanoDelPortal extends TextosDelPeldano {
  readonly clave: ClaveDelPeldano;
  /** Si la pantalla ofrece el boton que lleva a entrar. Lo decide la libreria. */
  readonly pideIdentidad: boolean;
  /** Si esto es el sistema roto o el sistema funcionando. Lo decide la libreria. */
  readonly esAveria: boolean;
}

/**
 * **Los nueve peldanos, con las palabras del portal.**
 *
 * El registro es **completo por el tipo**: `Record<ClaveDelPeldano, …>` no compila si la libreria
 * anade un decimo peldano y aqui no se decide que decir. Sin eso, el peldano nuevo llegaria a la
 * pantalla con el texto de funcionario de la libreria — o con `undefined`.
 */
export const TEXTOS_DEL_PORTAL: Readonly<Record<ClaveDelPeldano, TextosDelPeldano>> = {
  // 401 NO_AUTENTICADO. El unico que pide volver a la puerta.
  'sin-identidad': {
    titulo: 'Su sesión ya no está abierta',
    detalle: 'Para mostrarle su deuda tenemos que saber quién es, y la sesión se cerró.',
    remedio: 'Vuelva a entrar con su cuenta del portal y podrá seguir donde estaba.',
  },
  // 403 SIN_MUNICIPALIDAD. Con el token del ciudadano no deberia llegar —no trae el claim
  // `municipalidad_id` y la consulta no lo pide—, pero tiene texto porque «no deberia llegar» no
  // es «no llega», y el peldano sin texto es el que sale en blanco el dia que llega.
  'sin-municipalidad': {
    titulo: 'No pudimos consultar su deuda',
    detalle: 'Su cuenta entró bien, pero no trae los datos que hacen falta para buscarla.',
    remedio:
      'Acérquese con su documento a la ventanilla de la municipalidad: allí completan sus datos y le consultan en el momento.',
  },
  // 403 SIN_PRIVILEGIO. No es una averia: el portal contesto lo que tenia que contestar.
  'sin-privilegio': {
    titulo: 'Esta consulta no está disponible para su cuenta',
    detalle: 'La cuenta con la que entró no alcanza para ver esta información.',
    remedio:
      'Si cree que sí debería verla, acérquese con su documento a la ventanilla de la municipalidad.',
  },
  // 404. Para el ciudadano es «no hay nada a su nombre por este camino», no «no existe la ruta».
  'no-encontrado': {
    titulo: 'No encontramos esa información',
    detalle: 'El portal no encontró lo que se le pidió con su documento.',
    remedio:
      'Vuelva a intentarlo en unos minutos. Si sigue igual, acérquese con su documento a la ventanilla de la municipalidad.',
  },
  // 403 con cualquier otro codigo, y ahi cae el `SIN_DOCUMENTO` que devuelve
  // `GET /portal/situacion` cuando el token no identifica documento. Por eso el texto habla del
  // documento y no de permisos.
  'no-permitido': {
    titulo: 'Su cuenta no dice con qué documento consultar',
    detalle: 'Entró bien, pero su cuenta no tiene asociado el documento con el que se busca la deuda.',
    remedio:
      'Acérquese con su DNI o su carné de extranjería a la ventanilla de la municipalidad: el dato se completa en el momento.',
  },
  // 409 (issue 33, pareado con kamayuk-lib#96). Hasta ese PR el 409 caia en `averia`, o sea en
  // «vuelva a intentarlo», que es el remedio CONTRARIO: un 409 es el servidor diciendo que la
  // situacion de ahora no admite lo que se pidio, y volver a pedir lo mismo trae el mismo 409. Al
  // ciudadano no se le habla de «conflicto» ni de «estado»: se le dice que eso, ahora, no se puede,
  // y que lo primero es mirar como esta su cuenta de verdad.
  //
  // Hoy no puede llegar, como `no-valido`: la unica peticion del portal es una lectura sin
  // parametros. Tiene texto por lo mismo que `sin-municipalidad` — «no deberia llegar» no es «no
  // llega», y el peldano sin texto es el que sale en blanco el dia que llega.
  conflicto: {
    titulo: 'Eso ya no se puede hacer ahora',
    detalle:
      'Lo que se pidió no encaja con la situación en que está su cuenta en este momento: puede que ya esté hecho, o que algo haya cambiado desde que abrió esta pantalla.',
    remedio:
      'Vuelva a cargar la página para ver cómo está su cuenta ahora. Si sigue sin poder hacerse, acérquese con su documento a la ventanilla de la municipalidad.',
  },
  // 422 ORDEN_NO_ADMITIDO (issue 33, pareado con kamayuk-lib#96). Hasta ese PR compartia texto con
  // `no-valido`, que dice «revise lo que escribió» — y aqui no hay nada que el ciudadano haya
  // escrito: el orden lo pidio la PANTALLA, por un campo que el servidor no admite. Decirle que
  // corrija algo seria mandarle a dar vueltas por un defecto que no es suyo, asi que el detalle lo
  // dice y el remedio no le pide que arregle nada.
  //
  // Tampoco puede llegar hoy, y por lo mismo: la consulta del portal no pide ningun orden.
  'orden-no-admitido': {
    titulo: 'No pudimos ordenar la lista así',
    detalle:
      'El portal pidió esta lista ordenada por un dato que el sistema no admite. No es nada que usted haya escrito ni que pueda corregir.',
    remedio:
      'Vuelva a cargar la página. Si sigue sin poder verla, acérquese con su documento a la ventanilla de la municipalidad: allí se la consultan en el momento.',
  },
  // 422 con cualquier otro codigo. Hoy no puede llegar: la unica peticion del portal es una lectura
  // sin parametros. Tiene texto por lo mismo que `sin-municipalidad`.
  'no-valido': {
    titulo: 'No pudimos procesar lo que se envió',
    detalle: 'El portal rechazó los datos de la consulta porque no cumplen una de sus reglas.',
    remedio: 'Revise lo que escribió y vuelva a intentarlo.',
  },
  // Un corte de red, un 5xx, o cualquier cosa que no sea un `ErrorDeLaApi`. La unica averia de
  // verdad, y la unica donde el remedio es esperar — con una salida que no depende de esperar.
  averia: {
    titulo: 'El portal no está respondiendo',
    detalle: 'No pudimos comunicarnos con el sistema que guarda su deuda.',
    remedio:
      'Vuelva a intentarlo en unos minutos. Mientras tanto puede pagar en la ventanilla de la municipalidad.',
  },
};

/** Lo poco que la escalera necesita de `t()`: una frase en castellano entra, una frase sale. */
export type Traductor = (texto: string) => string;

/**
 * En que peldano se quedo esta peticion, dicho con las palabras del portal y ya traducido.
 *
 * @param fallo lo que lanzo el cliente. No tiene por que ser un `ErrorDeLaApi`: un corte de red
 *   lanza un `TypeError`, y ese caso tambien tiene que contestar algo (cae en `averia`).
 * @param t el `t()` de la pantalla que lo va a dibujar.
 */
export function peldanoDelPortal(fallo: unknown, t: Traductor): PeldanoDelPortal {
  const { clave, pideIdentidad, esAveria } = peldanoDe(fallo);
  const textos = TEXTOS_DEL_PORTAL[clave];

  return {
    clave,
    pideIdentidad,
    esAveria,
    titulo: t(textos.titulo),
    detalle: t(textos.detalle),
    remedio: t(textos.remedio),
  };
}

/**
 * Las veintisiete claves de la escalera, sin repetidos. Las lee `el-locale-esta-completo.test.ts`.
 *
 * Derivadas y no escritas alli: una frase nueva que no llegue al locale no da ningun rojo por si
 * sola, porque `i18next-cli` no sigue la variable con la que se traducen.
 */
export function clavesDeLaEscalera(): readonly string[] {
  return [
    ...new Set(
      Object.values(TEXTOS_DEL_PORTAL).flatMap((textos) => [
        textos.titulo,
        textos.detalle,
        textos.remedio,
      ]),
    ),
  ];
}
