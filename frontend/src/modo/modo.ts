import type { FuenteDelPortal } from '../datos/fuente.ts';
import type { LaDemostracion, SituacionDelServidor } from '../datos/tipos.ts';
import { type DatosLeidos, datosDeLaDemostracion, datosDeLaSituacion } from '../recorrido/leido.ts';

/**
 * **El modo del portal —demostracion o plataforma— y lo que cada uno decide** (issue 59).
 *
 * <h2>Por que un modulo, y por que es el UNICO que lee el modo</h2>
 *
 * Hasta el issue 59 el modo era un booleano repartido: `conPlataforma` aparecia 57 veces en el codigo
 * de produccion, se leia de dos sitios —`estado.conPlataforma` y `hayPlataforma(fuente)`— y se
 * resolvia de tres formas, con una docena de ternarios `simulado ? null : …` en las pantallas. Las
 * frases falsas del issue 49 se escaparon por ramas que nadie miro, y el tipo admitia estados que no
 * existen: una fuente sin plataforma y sin demostracion arrancaba en demostracion y reventaba en la
 * primera pantalla, y con plataforma el reductor podia sellar un comprobante con numero de operacion
 * que luego la vista tenia que esconder.
 *
 * Ahora hay dos cosas, y las dos viven aqui:
 *
 *   · **`Modo`, una union discriminada**: en demostracion, con sus datos (`demostracion`); con
 *     plataforma, sin ellos. «Sin plataforma y sin demostracion» no es un valor del tipo. La fuente
 *     (`FuenteDelPortal`, en `src/datos/fuente.ts`) es un `Modo` con lo que sabe pedir encima.
 *   · **`PoliticaDelModo`, lo que cada modo decide**: que pasos hay y por cual se empieza, si el pago
 *     es simulado, de donde sale la deuda, que ofrece la portada, de quien es la sesion… Las
 *     pantallas y el reductor **preguntan a la politica** (`useModo()`, `estado.politica`), nunca
 *     por el modo. Un modo nuevo es una variante mas de `Modo` y una entrada mas de `POLITICAS` —el
 *     tipo obliga a escribirla entera—, no un `if` mas en cada archivo.
 *
 * Que el modo no se lea fuera de `src/modo/` lo vigila `verificaciones/el-modo-se-lee-en-su-modulo.test.ts`,
 * con los tipos del compilador: el discriminante y las propiedades propias de cada variante.
 *
 * <h2>Lo que NO es del modo, aunque cambie con el</h2>
 *
 * **La amnistia** (issue 49) la dice la FUENTE (`FuenteDelPortal.amnistia`) y el recorrido la copia al
 * arrancar: hoy la de demostracion la trae y la de la plataforma no, pero el dia que el contrato de
 * `GET /portal/situacion` traiga una, saldra de la respuesta y no del modo. Por eso `estado.amnistia`
 * sigue siendo un dato, y se pregunta en un solo sitio (`aCobrar`).
 *
 * Sin React: el reductor, `arranque.ts` y las pruebas de tipos lo leen sin montar nada. El gancho de
 * las pantallas, `useModo()`, vive al lado (`useModo.ts`).
 */

// ── El modo ────────────────────────────────────────────────────────────────────────────────────

/** El portal en demostracion: con los datos del artboard, que llegan con la fuente (issue 58). */
export interface EnDemostracion {
  readonly modo: 'demostracion';
  readonly demostracion: LaDemostracion;
}

/** El portal con plataforma: sin datos de ejemplo; lo que sabe lo pregunta a `GET /portal/situacion`. */
export interface ConPlataforma {
  readonly modo: 'plataforma';
}

export type Modo = EnDemostracion | ConPlataforma;

/** El modo con plataforma. Sin datos: para las pruebas del reductor, que no montan ninguna fuente. */
export const CON_PLATAFORMA: ConPlataforma = { modo: 'plataforma' };

/** El modo de demostracion, con sus datos. */
export function enDemostracion(demostracion: LaDemostracion): EnDemostracion {
  return { modo: 'demostracion', demostracion };
}

// ── Los pasos de cada recorrido ────────────────────────────────────────────────────────────────

/** Los cinco pasos numerados de la franja en DEMOSTRACION, en su orden (artboard, lineas 1018-1022). */
export const PASOS_DE_LA_DEMOSTRACION = ['buscar', 'deudas', 'identificar', 'pagar', 'comprobante'] as const;

/**
 * **Los cuatro pasos numerados con plataforma** (issue 28).
 *
 * · `buscar` se cae porque el backend ya no ofrece buscar: el ADR-0020 retiro
 *   `GET /portal/deuda?doc=` —era una enumeracion de contribuyentes— y lo reemplazo por
 *   `GET /portal/situacion` **sin parametros**, donde el sujeto sale del token. Sin parametro que
 *   escribir, el primer paso no es buscar: es **entrar**.
 * · `identificar` se cae porque ese paso pedia un correo o una cuenta de demostracion para saber a
 *   quien enviar el comprobante. Con plataforma se entro con la cuenta del portal en el paso 1:
 *   volver a pedir quien es seria preguntarlo dos veces.
 */
export const PASOS_CON_PLATAFORMA = ['entrar', 'deudas', 'pagar', 'comprobante'] as const;

export type PasoNumerado = (typeof PASOS_DE_LA_DEMOSTRACION)[number] | (typeof PASOS_CON_PLATAFORMA)[number];

/**
 * Donde puede estar el recorrido. El artboard llama `listo` al quinto; aqui es `comprobante`, que es
 * su ruta (`#/comprobante`). `historial` no es un paso numerado: con sesion, alli no hay nada que
 * avanzar y no se dibuja la franja.
 */
export type Paso = PasoNumerado | 'historial';

// ── La politica ────────────────────────────────────────────────────────────────────────────────

/**
 * **Lo que el portal sabe hacer, dicho en la portada** («Qué puede hacer aquí», issue 49). Cada modo
 * elige cuales ofrece y en que orden; el texto y el icono de cada una los pone la portada
 * (`src/piezas/PortadaDelPortal.tsx`).
 *
 *   · `ver-la-deuda-con-cuotas`: el predial, los arbitrios y el vehicular, con el vencimiento de cada
 *     cuota. `ver-la-deuda-por-municipalidad`: lo que se debe en cada municipalidad, por tributo y
 *     año, con la fecha de cada importe —sin cuotas: el contrato no las trae—.
 *   · `pagar-en-linea` / `pagar-en-la-ventanilla`: si el cobro esta conectado o no.
 *   · `descargar-comprobantes`, `saber-de-donde-sale` (el autovaluo y los metros de frontis) y
 *     `ver-los-predios` (los que figuran a su nombre, con su codigo catastral).
 */
export type CapacidadDelPortal =
  | 'ver-la-deuda-con-cuotas'
  | 'ver-la-deuda-por-municipalidad'
  | 'pagar-en-linea'
  | 'pagar-en-la-ventanilla'
  | 'descargar-comprobantes'
  | 'saber-de-donde-sale'
  | 'ver-los-predios';

/** Por donde se va y por donde se empieza. */
export interface PoliticaDelRecorrido {
  /**
   * Los pasos numerados de la franja, en su orden. De aqui tambien se deduce que pasos existen: un paso
   * que no esta en la lista no es alcanzable (`pasoAlcanzable`), y un recorrido sin «Mis datos» no
   * manda alli antes de pagar (`destinoAlPagar`).
   */
  readonly pasos: readonly PasoNumerado[];
  /**
   * Por donde se empieza, sin sesion y con ella. Es tambien a donde redirige lo que no es alcanzable,
   * asi que **tiene que ser alcanzable siempre**: con plataforma y sesion no puede ser `entrar`, que
   * no se repite, o el enrutador redirigiria en circulo.
   */
  readonly primerPaso: { readonly sinSesion: PasoNumerado; readonly conSesion: PasoNumerado };
  /**
   * ¿Un concepto del que la persona no decidio nada cuenta como marcado? (`estaMarcada`). Con
   * plataforma si —el artboard abre con todo marcado, linea 929, y lo que llega en una consulta
   * posterior llega marcado como lo demas—; en demostracion no hace falta, porque las cuatro marcas del
   * artboard se escriben al arrancar.
   */
  readonly marcadoPorOmision: boolean;
}

/** De quien es la sesion, dicho por lo que la sesion hace. */
export interface PoliticaDeLaSesion {
  /**
   * ¿La abre y la cierra un emisor de identidad? Si: la cuenta del portal, en Keycloak —«Iniciar
   * sesión» y «Cerrar sesión» van a la puerta, quien entro sale del token y al arrancar se le pregunta
   * al emisor en silencio (issue 35)—. No: la del artboard, que la abre el paso «Mis datos» y la
   * cierra el reductor, y la persona es la usuaria de los datos de ejemplo.
   */
  readonly laAbreUnEmisor: boolean;
  /**
   * ¿Quien entra trae un correo al que enviar el comprobante? (`destinoDelComprobante`). La cuenta del
   * artboard si; el realm del ciudadano pone el documento y ni el correo ni el codigo
   * (`src/api/claims.ts`), y poner el del artboard escribiria el buzon de otra persona.
   */
  readonly traeElCorreo: boolean;
}

/** Lo que pasa al pagar. */
export interface PoliticaDelCobro {
  /**
   * ¿El pago es simulado? (issue 28). No hay endpoint de cobro (D-14): no se ofrece ningun medio,
   * no se sella comprobante ni numero de operacion (`PagoSimulado`), la deuda no se da por pagada, y
   * los pasos 4 y 5 llevan el aviso permanente.
   */
  readonly simulado: boolean;
}

/** Lo que el portal sabe de la persona, y de donde lo sabe. */
export interface PoliticaDelContenido {
  /**
   * ¿La deuda se le pide a un servidor? Si: lo que contesta `GET /portal/situacion`, con sus cinco
   * finales (pidiendo, el peldano de la escalera, no se pudo consultar, sin registros, sin deuda), y el
   * paso 2 y «Lo que queda pendiente» se los preguntan a la consulta. No: cuatro conceptos que ya estan
   * en memoria, con cuotas, vencimiento, estado y desglose.
   */
  readonly laDeudaSeConsulta: boolean;
  /**
   * ¿Cada concepto trae un reajuste propio? (issue 26). El contrato lo da aparte, y el resumen de
   * «Pagar» le pone su fila: sin ella, las filas no sumaban el total. El artboard no lo tiene.
   */
  readonly traeReajuste: boolean;
  /** ¿Se publica el historial de pagos del ciudadano? Con plataforma no hay endpoint (issue 28). */
  readonly publicaLosPagos: boolean;
  /**
   * ¿Se publican los predios y vehiculos con la base de su tributo (el autovaluo, los metros de
   * frontis)? Si no, «De dónde sale lo que paga» ensena los predios que trae la consulta, sin cifra y
   * sin vehiculos (issue 28).
   */
  readonly publicaLasUnidades: boolean;
  /** ¿Lo que se ve son datos de ejemplo? El pie lo dice (issue 49). */
  readonly sonDatosDeEjemplo: boolean;
  /**
   * **Que ofrece la portada** (issue 49): las cuatro capacidades del artboard, o las tres que el portal
   * con plataforma tiene de verdad —ver lo que debe, ver sus predios, pagar en la ventanilla—.
   */
  readonly capacidades: readonly CapacidadDelPortal[];
}

/**
 * **Lo que un modo decide**, pregunta por pregunta y agrupado por de que trata (revision del PR #70).
 * Cada campo es una pregunta que antes se contestaba con `conPlataforma` en algun archivo; ahora se
 * contesta UNA vez por modo, aqui, y el que pregunta no sabe en que modo esta.
 *
 * <h2>Cada campo se nombra por la pregunta, no por el modo (issue 60)</h2>
 *
 * Hasta el issue 60 la politica tenia `deuda: 'del-artboard' | 'de-la-consulta'`, `sesion:
 * 'del-emisor' | 'de-la-demostracion'` y `capacidades: 'las-del-artboard' | 'las-de-la-plataforma'`:
 * valores con el nombre del modo, que cambiaban siempre juntos. Preguntar `deuda === 'de-la-consulta'`
 * era preguntar el modo con otras palabras, y `deuda` hacia de sustituto de preguntas distintas —la
 * fila «Reajuste» de «Pagar», que secciones dibuja «Mis pagos»—. Ahora cada pregunta tiene su campo
 * (`traeReajuste`, `publicaLasUnidades`…) y un modo nuevo contesta cada una por separado. Que ningun
 * valor vuelva a ser el nombre de un modo lo mide `modo.test.ts`.
 *
 * Son datos y no funciones: se comparan, se imprimen en un fallo y el estado del recorrido los lleva
 * dentro sin que deje de ser un valor.
 */
export interface PoliticaDelModo {
  readonly recorrido: PoliticaDelRecorrido;
  readonly sesion: PoliticaDeLaSesion;
  readonly cobro: PoliticaDelCobro;
  readonly contenido: PoliticaDelContenido;
}

/**
 * **Una politica por modo.** El tipo exige una entrada por cada variante de `Modo`: un modo nuevo sin
 * su politica no compila. Se exporta para que `modo.test.ts` las recorra TODAS (revision del PR #70);
 * fuera de `src/modo/` y de las pruebas no se usa (`verificaciones/lecturas-del-modo.ts`).
 */
export const POLITICAS: { readonly [M in Modo['modo']]: PoliticaDelModo } = {
  demostracion: {
    recorrido: {
      pasos: PASOS_DE_LA_DEMOSTRACION,
      primerPaso: { sinSesion: 'buscar', conSesion: 'buscar' },
      marcadoPorOmision: false,
    },
    sesion: { laAbreUnEmisor: false, traeElCorreo: true },
    cobro: { simulado: false },
    contenido: {
      laDeudaSeConsulta: false,
      traeReajuste: false,
      publicaLosPagos: true,
      publicaLasUnidades: true,
      sonDatosDeEjemplo: true,
      capacidades: ['ver-la-deuda-con-cuotas', 'pagar-en-linea', 'descargar-comprobantes', 'saber-de-donde-sale'],
    },
  },
  plataforma: {
    recorrido: {
      pasos: PASOS_CON_PLATAFORMA,
      // Quien ya entro no vuelve a entrar (issue 28).
      primerPaso: { sinSesion: 'entrar', conSesion: 'deudas' },
      marcadoPorOmision: true,
    },
    sesion: { laAbreUnEmisor: true, traeElCorreo: false },
    cobro: { simulado: true },
    contenido: {
      laDeudaSeConsulta: true,
      traeReajuste: true,
      publicaLosPagos: false,
      publicaLasUnidades: false,
      sonDatosDeEjemplo: false,
      capacidades: ['ver-la-deuda-por-municipalidad', 'ver-los-predios', 'pagar-en-la-ventanilla'],
    },
  },
};

/** La politica de la demostracion: la de las decisiones iniciales del reductor y la de sus pruebas. */
export const POLITICA_DE_LA_DEMOSTRACION: PoliticaDelModo = POLITICAS.demostracion;

/** La politica con plataforma. */
export const POLITICA_CON_PLATAFORMA: PoliticaDelModo = POLITICAS.plataforma;

/** La politica de un modo. Una fuente es un modo, asi que tambien la de una fuente. */
export function politicaDe(en: Modo): PoliticaDelModo {
  return POLITICAS[en.modo];
}

// ── Lo que depende de los datos de cada variante ───────────────────────────────────────────────

/**
 * **Lo que el recorrido lee, segun el modo** (issues 50 y 58): los datos del artboard en
 * demostracion; con plataforma, lo que la cache tenga de `GET /portal/situacion` —nada, mientras no
 * contesta—.
 */
export function loLeidoDe(en: Modo, situacion: SituacionDelServidor | undefined): DatosLeidos {
  switch (en.modo) {
    case 'demostracion':
      return datosDeLaDemostracion(en.demostracion);
    case 'plataforma':
      return datosDeLaSituacion(situacion);
  }
}

/**
 * **La consulta de la situacion, si la fuente tiene a quien preguntar**; `null` en demostracion, donde
 * la deuda no llega de ningun servidor. La leen los ganchos de `src/datos/fuente.ts`.
 */
export function consultaDe(fuente: FuenteDelPortal): (() => Promise<SituacionDelServidor>) | null {
  return fuente.modo === 'plataforma' ? fuente.consulta : null;
}

/** **Los datos del artboard, si el modo los trae** (issue 58). Para sumar sus textos al idioma. */
export function demostracionDe(en: Modo): LaDemostracion | null {
  return en.modo === 'demostracion' ? en.demostracion : null;
}
