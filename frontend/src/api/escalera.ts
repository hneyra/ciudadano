import { peldanoDe, type Peldano } from '@kamayuk/sesion';

import { RespuestaQueNoEntiendo } from '../datos/respuestaQueNoEntiendo.ts';

/**
 * **La escalera de identidad, dicha al CIUDADANO** (issue 13).
 *
 * De `peldanoDe` se toma **la clasificacion**: en que peldano se quedo la peticion (`clave`), si hay que
 * volver a la puerta (`pideIdentidad`) y si esto es el sistema roto o el sistema funcionando
 * (`esAveria`). Eso sale del `codigo` del contrato y es igual en los cinco sistemas del producto.
 *
 * De la libreria **no** se toman los textos: estan escritos para quien atiende en ventanilla («avise a
 * soporte», «lo asigna el administrador del sistema», «pida el permiso a quien administre los
 * perfiles»), y a quien entra a pagar su predial no le sirve ninguno. Los de aqui son DATO, como los
 * medios de pago: `peldanoDelPortal` recibe `t()` y devuelve el peldano ya traducido, y el locale los
 * deriva de `clavesDeLaEscalera()`.
 *
 * **Lo que dijo el backend no se ensena**: ni el `mensaje` del `problem+json` —escrito para la
 * ventanilla—, ni los tres miembros que `ErrorDeLaApi` conserva desde kamayuk-lib#96. `incidencia` es
 * para soporte, y aqui no hay soporte al que darla ni un `console` o telemetria donde registrarla;
 * `detalles` lleva el campo de un orden que el ciudadano no pidio; `parametroQueFalta` distingue dos 404
 * de la hoja de Publicacion de `normativa`, que este portal no dibuja. Se conservan en el error; no
 * llegan a la pantalla, y `escalera.test.ts` lo mide por igualdad con la tabla.
 *
 * Por que, y que se descarto: `docs/adr/CIU-0009-la-escalera-del-ciudadano.md`.
 */

/**
 * Los peldanos que el portal decide: los de `@kamayuk/sesion` y **uno mas**, `respuesta-ilegible`
 * (issue 34), que no traera ninguna libreria.
 *
 * No sale de un codigo HTTP sino de la frontera de ESTE portal: el servidor contesto, y lo que
 * contesto no tiene la forma del contrato (`RespuestaQueNoEntiendo`, que lanza `leerLaSituacion`).
 * La libreria no conoce ese contrato —para ella es una averia mas, y le diria «el portal no esta
 * respondiendo», que es falso: respondio—. Por eso lo reconoce `peldanoDelPortal` **antes** de
 * preguntar a `peldanoDe`.
 *
 * Es un **superconjunto** de `Peldano['clave']`, asi que la tabla de abajo es completa por el tipo
 * respecto de la libreria: un peldano nuevo de la libreria la deja corta y no compila.
 */
export type ClaveDelPeldano = Peldano['clave'] | 'respuesta-ilegible';

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
 * **Los diez peldanos, con las palabras del portal.**
 *
 * El registro es **completo por el tipo**: `Record<ClaveDelPeldano, …>` no compila si la libreria
 * anade un peldano mas y aqui no se decide que decir. Sin eso, el peldano nuevo llegaria a la
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
  // 409 (issue 33). «Vuelva a intentarlo» seria el remedio CONTRARIO: un 409 es el servidor diciendo
  // que la situacion de ahora no admite lo que se pidio, y volver a pedir lo mismo trae el mismo
  // 409. Al ciudadano no se le habla de «conflicto» ni de «estado»: se le dice que eso, ahora, no se
  // puede, y que lo primero es mirar como esta su cuenta de verdad.
  //
  // La unica peticion del portal, una lectura sin parametros, no lo provoca. Tiene texto por lo
  // mismo que `sin-municipalidad`.
  conflicto: {
    titulo: 'Eso ya no se puede hacer ahora',
    detalle:
      'Lo que se pidió no encaja con la situación en que está su cuenta en este momento: puede que ya esté hecho, o que algo haya cambiado desde que abrió esta pantalla.',
    remedio:
      'Vuelva a cargar la página para ver cómo está su cuenta ahora. Si sigue sin poder hacerse, acérquese con su documento a la ventanilla de la municipalidad.',
  },
  // 422 ORDEN_NO_ADMITIDO (issue 33). No comparte texto con `no-valido`, que dice «revise lo que
  // escribió»: aqui no hay nada que el ciudadano haya escrito, el orden lo pidio la PANTALLA, por un
  // campo que el servidor no admite. Decirle que corrija algo seria mandarle a dar vueltas por un
  // defecto que no es suyo, asi que el detalle lo dice y el remedio no le pide que arregle nada.
  //
  // La consulta del portal no pide ningun orden, asi que no lo provoca. Tiene texto por lo mismo.
  'orden-no-admitido': {
    titulo: 'No pudimos ordenar la lista así',
    detalle:
      'El portal pidió esta lista ordenada por un dato que el sistema no admite. No es nada que usted haya escrito ni que pueda corregir.',
    remedio:
      'Vuelva a cargar la página. Si sigue sin poder verla, acérquese con su documento a la ventanilla de la municipalidad: allí se la consultan en el momento.',
  },
  // 422 con cualquier otro codigo. La unica peticion del portal, una lectura sin parametros, no lo
  // provoca. Tiene texto por lo mismo que `sin-municipalidad`.
  'no-valido': {
    titulo: 'No pudimos procesar lo que se envió',
    detalle: 'El portal rechazó los datos de la consulta porque no cumplen una de sus reglas.',
    remedio: 'Revise lo que escribió y vuelva a intentarlo.',
  },
  // La respuesta que no tiene la forma del contrato (issue 34). Es averia —el sistema no hace lo que
  // debe— pero NO es la de abajo: el servidor si contesto, asi que «no esta respondiendo» seria
  // falso. Lo que importa decirle es por que no hay ni una cifra en la pantalla: preferimos no
  // ensenarle nada a ensenarle una equivocada. Nada de lo que encontro el esquema —rutas del JSON,
  // «expected number»— llega aqui: eso es para quien depura (`RespuestaQueNoEntiendo.fallos`).
  // El remedio no promete que insistir lo arregle: si vuelve a pasar, la ventanilla.
  'respuesta-ilegible': {
    titulo: 'No pudimos leer lo que nos contestó el sistema',
    detalle:
      'El sistema que guarda su deuda contestó, pero de una forma que el portal no sabe leer. Por eso no le mostramos ninguna cifra: preferimos no enseñarle nada antes que enseñarle un importe equivocado.',
    remedio:
      'Vuelva a intentarlo más tarde. Si sigue igual, acérquese con su documento a la ventanilla de la municipalidad: allí le consultan su deuda en el momento.',
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
  // La frontera del portal se pregunta ANTES que la libreria: para `peldanoDe`, un error que no es
  // un `ErrorDeLaApi` es `averia`, y le daria a una respuesta ilegible el texto del corte de red.
  const { clave, pideIdentidad, esAveria } =
    fallo instanceof RespuestaQueNoEntiendo
      ? { clave: 'respuesta-ilegible' as const, pideIdentidad: false, esAveria: true }
      : peldanoDe(fallo);
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
 * Las claves de la escalera —los tres textos de cada peldano—, sin repetidos. Las lee
 * `el-locale-esta-completo.test.ts`.
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
