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
 */

/** Los siete peldanos de `@kamayuk/sesion`, tal como los nombra la libreria. */
export type ClaveDelPeldano = Peldano['clave'];

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
 * **Los siete peldanos, con las palabras del portal.**
 *
 * El registro es **completo por el tipo**: `Record<ClaveDelPeldano, …>` no compila si la libreria
 * anade un octavo peldano y aqui no se decide que decir. Sin eso, el peldano nuevo llegaria a la
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
  // 422. Hoy no puede llegar: la unica peticion del portal es una lectura sin parametros. Tiene
  // texto por lo mismo que `sin-municipalidad`.
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
 * Las veintiuna claves de la escalera, sin repetidos. Las lee `el-locale-esta-completo.test.ts`.
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
