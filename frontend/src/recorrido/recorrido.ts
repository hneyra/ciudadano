import type { Importe } from '@kamayuk/formato';

import { type ConSaldo, type Cuenta, conAmnistiaDe, cuentaDe, type Resumen, resumenDe, totalDe } from '../datos/cuentas.ts';
import type {
  ComprobanteDeDemostracion,
  ConceptoDeDeuda,
  Deuda,
  DeudaDelServidor,
  LaDemostracion,
  MedioDePago,
  QuienDebe,
  TipoDeDocumento,
} from '../datos/tipos.ts';
import {
  type Modo,
  PASOS_CON_PLATAFORMA,
  PASOS_DE_LA_DEMOSTRACION,
  POLITICA_DE_LA_DEMOSTRACION,
  type Paso,
  type PasoNumerado,
  type PoliticaDelModo,
  loLeidoDe,
  politicaDe,
} from '../modo/modo.ts';
import type { DatosLeidos } from './leido.ts';

/**
 * **El estado del recorrido de pago**, como un reductor puro.
 *
 * Porta el `state` del prototipo (`diseno/Ciudadano.dc.html`, lineas 927-940) y los manejadores que
 * lo cambian (1009-1080, 1172-1176, 1254-1271). Sin React: se prueba llamando a una funcion, y el
 * proveedor (`ProveedorDelRecorrido.tsx`) solo lo monta con `useReducer`.
 *
 * <h2>`pagadas` es la unica verdad sobre la deuda viva</h2>
 *
 * El artboard ya se corrigio una vez por esto (comentario de las lineas 931-934): cada pantalla
 * deducia «que sigue siendo deuda» de `marcadas` con un criterio distinto, y acababan
 * contradiciendose. Aqui la deuda viva sale de UN selector, `vivas`, y de el cuelgan la seleccion,
 * el resumen del paso 2 y los pendientes del historial. Ninguna pantalla filtra `DEUDAS` por su cuenta.
 *
 * <h2>El comprobante se SELLA al pagar</h2>
 *
 * `confirmarPago` guarda en `ultimo` lo que se pago, con los importes ya calculados por `cuentaDe`
 * (texto decimal, nunca `number`). Volver a marcar o desmarcar despues no lo mueve: el comprobante
 * dice lo que se cobro, no lo que hoy esta marcado.
 *
 * <h2>Lo que NO vive aqui, y por que</h2>
 *
 * · `errorBusqueda`, `errorCorreo`, `loginDoc`, `loginClave`, `errorLogin`: son del formulario de su
 *   paso, y con `react-hook-form` viven en el (issues 5 y 7). La clave, en particular, no sale nunca
 *   del formulario: ni al estado ni al almacenamiento del navegador.
 * · `menuSesion`: lo lleva el `Menu` de `@kamayuk/ui` (Radix).
 * · `toast`: los avisos son `avisar` de `@kamayuk/ui` (sonner). Un reductor puro no levanta avisos;
 *   quien despacha, avisa.
 *
 * <h2>De donde salen los conceptos: `estado.deudas`, que se LEE y no se guarda (issues 28 y 50)</h2>
 *
 * Hasta el issue 27 el reductor leia `DEUDAS` de `src/datos/demostracion.ts` en cada selector. Con
 * plataforma los conceptos los trae `GET /portal/situacion`, y el recorrido tiene que poder marcar,
 * pagar y sellar **esos**.
 *
 * Entre los issues 28 y 50 la lista vivia DENTRO del estado del reductor: un `useEffect` de
 * `LaConsulta` la copiaba de la cache de consultas con la accion `situacionLeida`. Dos copias del
 * mismo dato del servidor daban tres defectos (issue 50): un dibujo con la respuesta ya llegada y la
 * lista todavia vacia, una consulta repetida que volvia a marcarlo todo, y un error en ella que
 * borraba la lista a mitad de la eleccion. Ahora hay **una sola verdad** para lo que manda el
 * servidor, la cache de React Query, y el estado se parte en dos:
 *
 *   · `DecisionesDelRecorrido`: lo que decide la persona —en que paso esta, que marco (por id), que
 *     pago y con que medio—. Es lo UNICO que guarda el reductor montado (`ProveedorDelRecorrido`).
 *   · `DatosLeidos`: los conceptos y a nombre de quien estan. En demostracion son los del artboard
 *     (`datosDeLaDemostracion`, que desde el issue 58 los toma de la FUENTE y no de un `import`);
 *     con plataforma, `datosDeLaSituacion` de lo que la cache tenga en ese momento. **No se guardan**: el proveedor los pone al lado de las decisiones en cada
 *     dibujo, y en cada accion que los necesita.
 *
 * `EstadoDelRecorrido` es la suma de las dos, y es lo que leen los selectores y las pantallas. Por
 * eso este reductor sigue siendo una funcion pura sobre el estado entero —se prueba igual que
 * antes—, y lo que cambio es quien la llama: con los datos de ESE momento, no con una copia.
 *
 * <h2>Dos recorridos, y el estado lleva la POLITICA del modo, no el modo (issue 59)</h2>
 *
 * La politica del modo (`PoliticaDelModo`, en `src/modo/modo.ts`) entra en el estado **una vez, al
 * montar** (`estadoInicial`, desde `ProveedorDelRecorrido`), y los selectores le preguntan a ella que
 * pasos hay, cual es el primero, que vale un concepto sin marcar y si el pago es simulado. Se guarda
 * aqui en vez de preguntarsela a la fuente en cada selector porque el reductor es puro y se prueba
 * llamandolo: con la politica dentro del estado, los dos recorridos se prueban con datos y sin montar
 * nada.
 *
 * Hasta el issue 59 lo que entraba era el booleano `conPlataforma`, y cada selector lo resolvia a su
 * manera. Ningun selector sabe ya en que modo esta: un modo nuevo es una politica nueva.
 */

// Viven en `src/modo/modo.ts` desde el issue 59 —cada recorrido es de un modo— y se siguen exportando
// de aqui, que es donde los buscan las pantallas y las pruebas.
export { PASOS_CON_PLATAFORMA, PASOS_DE_LA_DEMOSTRACION };
export type { Paso, PasoNumerado };
// Lo leido, por lo mismo: vive en `leido.ts` para que el modulo del modo lo alcance sin importar este.
export { type DatosLeidos, SIN_DATOS, datosDeLaDemostracion, datosDeLaSituacion } from './leido.ts';

/**
 * Todos los pasos que existen, sin repetir: los de los dos recorridos mas el historial.
 *
 * De aqui salen las rutas del enrutador y las pantallas perezosas. **Derivado y no escrito otra
 * vez**: un paso nuevo en una lista y olvidado en la otra seria una ruta que no existe.
 */
export const TODOS_LOS_PASOS: readonly Paso[] = [
  ...new Set<Paso>([...PASOS_DE_LA_DEMOSTRACION, ...PASOS_CON_PLATAFORMA, 'historial']),
];

// Vive en `tipos.ts` desde el issue 58 —los ejemplos de cada tipo son dato de la demostracion— y se
// sigue exportando de aqui, que es donde lo buscan las pantallas.
export type { TipoDeDocumento };

/** Lo que todo pago sellado dice, sea de verdad o simulado. */
interface LoQueSeSella extends Cuenta {
  /**
   * **Los conceptos pagados, tal como estaban al pagar**, en el orden de la lista de la que salen.
   *
   * Los conceptos enteros y no sus ids (issue 50): con plataforma la lista es la de la cache de
   * consultas, y si una consulta posterior trae otra, un sello de ids quedaria apuntando a conceptos
   * que ya no estan —el recibo perderia filas, o las cambiaria de importe—. El comprobante dice lo
   * que se cobro, no lo que hoy dice el servidor.
   */
  readonly conceptos: readonly ConceptoDeDeuda[];
  /** A nombre de quien estaba esa deuda al pagar. Por lo mismo: no se vuelve a leer de la cache. */
  readonly contribuyente: QuienDebe | null;
}

/**
 * **Un pago registrado**: el de la demostracion, que dice con que se pago, a donde se envio el
 * comprobante y sus numeros.
 */
export interface PagoRegistrado extends LoQueSeSella {
  readonly medio: MedioDePago['id'];
  /** A donde se envio el comprobante; `null` es «su correo» (artboard, linea 1027). */
  readonly destino: string | null;
  /** Los numeros del sello: el comprobante y la operacion, los de la demostracion (issue 58). */
  readonly comprobante: ComprobanteDeDemostracion;
}

/**
 * **Un pago simulado** (issues 28 y 59): lo que se habria pagado, y nada mas.
 *
 * **No tiene donde poner** un medio, un destino, ni un numero de comprobante o de operacion: no hubo
 * cobro, no se envio nada y no hay ningun comprobante emitido que numerar. Hasta el issue 59 esos
 * campos existian con plataforma —`comprobante: null` y un medio elegido por omision— y era la vista
 * la que tenia que acordarse de no ensenarlos; ahora un pago simulado con numero de operacion no
 * compila (`recorrido.tipos.test.ts`).
 *
 * `comprobante: null` es el discriminante: `esSimulado(pago)` lo pregunta.
 */
export interface PagoSimulado extends LoQueSeSella {
  readonly comprobante: null;
}

/** Lo que el comprobante dice para siempre, sellado en `confirmarPago`: de verdad o simulado. */
export type PagoSellado = PagoRegistrado | PagoSimulado;

/** Si un pago sellado es simulado: no hubo cobro, y no hay ni medio, ni destino, ni numeros. */
export function esSimulado(pago: PagoSellado): pago is PagoSimulado {
  return pago.comprobante === null;
}

/**
 * **Los pasos cuyo progreso se guarda** (issue 61): los de la franja menos el comprobante, que lo abre
 * el sello (`ultimo`) y no se guarda dos veces.
 */
export type PasoDelProgreso = Exclude<PasoNumerado, 'comprobante'>;

/** `abierto`: se llego a el y se puede volver; `hecho`: ademas se completo. */
export type EstadoDelPaso = 'abierto' | 'hecho';

/** **El progreso**: que pasos se alcanzaron y cuales se completaron. Uno que no esta, no se alcanzo. */
export type Alcanzado = Readonly<Partial<Record<PasoDelProgreso, EstadoDelPaso>>>;

/** **Lo que DECIDE la persona**: lo unico que guarda el reductor montado (issue 50). */
export interface DecisionesDelRecorrido {
  readonly paso: Paso;
  /**
   * **El progreso** (issue 61): hasta donde llego la persona por el recorrido, paso a paso. De aqui
   * salen lo que se puede abrir (`pasoAlcanzable`) y lo que la franja da por hecho (`pasoHecho`). Ver
   * «El recorrido es una maquina de estados» en la cabecera.
   */
  readonly alcanzado: Alcanzado;
  /**
   * **Lo que decide el modo** (issue 59): que pasos hay, por cual se empieza, si el pago es simulado…
   * Se fija al montar y no cambia: ver la cabecera. Las pantallas la leen con `useModo()`.
   */
  readonly politica: PoliticaDelModo;
  /**
   * **Si hay una amnistia que condone el interes** (issue 49). La dice la FUENTE
   * (`FuenteDelPortal.amnistia`) y se fija al montar, como la politica: en demostracion, la del
   * artboard; con plataforma, ninguna, porque `GET /portal/situacion` no trae ninguna. De aqui cuelga
   * lo que se cobra (`aCobrar`, `aCobrarDe`) y si las pantallas la nombran.
   */
  readonly amnistia: boolean;
  readonly tipoDeDocumento: TipoDeDocumento;
  /** El codigo o el documento que se busco. */
  readonly numero: string;
  /**
   * Lo que el ciudadano marco o desmarco, por id. **Un id que no esta aqui vale lo de por omision**
   * (`estaMarcada`, que se lo pregunta a la politica: `marcadoPorOmision`).
   *
   * Por id y con omision, y no una lista marcada entera (issue 50): asi un concepto que llega en una
   * consulta posterior sale marcado como los demas, y lo que la persona ya decidio de los que siguen
   * no se toca. Antes `situacionLeida` lo reescribia todo cada vez que la lista cambiaba.
   */
  readonly marcadas: Readonly<Record<string, boolean>>;
  /** Lo ya pagado, por id. La unica verdad sobre la deuda viva. */
  readonly pagadas: Readonly<Record<string, true>>;
  readonly ultimo: PagoSellado | null;
  /** El concepto con el desglose abierto en el paso 2. */
  readonly abierta: string | null;
  readonly correo: string;
  /** «Avisarme por correo cuando venza mi próxima cuota» (artboard, linea 329). El `copia` de alli. */
  readonly avisarVencimiento: boolean;
  readonly autenticado: boolean;
  readonly medio: MedioDePago['id'];
  /** Lo escrito en los campos del medio (la tarjeta). El `vals` del artboard. */
  readonly valores: Readonly<Record<string, string>>;
  /** Hay un pago de esta visita, que el historial pone el primero. */
  readonly recienPagado: boolean;
  /**
   * «Mis predios y vehículos» pidio llevar la vista a «De dónde sale lo que paga» (issue 10). No es del
   * artboard, donde las dos opciones del menu abren el historial igual (lineas 1052-1053): la pantalla
   * lo cumple una vez —foco y desplazamiento— y despacha `unidadesEnfocadas`.
   */
  readonly enfocarUnidades: boolean;
}

/**
 * **Las decisiones con que una prueba puede hacer empezar el portal**: todas menos la politica
 * (revision del PR #70). La politica la fija SIEMPRE el proveedor, de la fuente (`politicaDe`): una
 * prueba que la pisara montaria el recorrido de un modo con los datos del otro, y el modo volveria a
 * leerse de dos sitios. Con este tipo, pisarla no compila.
 */
export type DecisionesDePartida = Omit<DecisionesDelRecorrido, 'politica'>;

/** Lo que leen los selectores y las pantallas: lo decidido y lo leido, juntos. */
export interface EstadoDelRecorrido extends DecisionesDelRecorrido, DatosLeidos {}

/**
 * **Los datos de la demostracion, para una pantalla que solo existe en demostracion** (issue 58).
 *
 * «Buscar mi deuda», «Mis datos», el paso 2 del artboard, los medios de pago, la usuaria de la barra:
 * todo eso se dibuja solo sin plataforma, y ahi la fuente siempre trae la demostracion. Si una de esas
 * pantallas llega a dibujarse sin ella, es un recorrido roto —una pantalla de un modo en el otro—, y
 * se dice con su nombre en vez de dibujar huecos: un campo sin ejemplo o una barra sin nombre pasarian
 * por buenos.
 */
export function laDemostracion(estado: DatosLeidos): LaDemostracion {
  if (estado.demostracion === null) {
    throw new Error(
      'Una pantalla de la demostracion se dibujo sin sus datos: la fuente no trae `demostracion` ' +
        '(con plataforma no la trae, y esta pantalla no deberia ser alcanzable).',
    );
  }
  return estado.demostracion;
}

/**
 * **Las decisiones, sin los datos leidos**: lo que el reductor montado guarda. Si un estado entero
 * llega aqui —el `inicial` de una prueba, o lo que devuelve `recorrido`—, lo leido se tira: la
 * proxima vez lo vuelve a poner quien lo lee, de donde este en ese momento.
 */
export function decisionesDe(estado: DecisionesDelRecorrido & Partial<DatosLeidos>): DecisionesDelRecorrido {
  const { deudas: _deudas, contribuyente: _contribuyente, demostracion: _demostracion, ...decisiones } = estado;
  return decisiones;
}

/**
 * **Las decisiones con que se abre el portal**, sin nada leido: las del artboard (lineas 927-940)
 * menos sus cuatro marcas, que son de sus cuatro conceptos y las escribe `estadoInicial` cuando la
 * fuente trae esos conceptos (issue 58).
 */
export const DECISIONES_INICIALES: DecisionesDelRecorrido = {
  paso: 'buscar',
  alcanzado: { buscar: 'abierto' },
  politica: POLITICA_DE_LA_DEMOSTRACION,
  amnistia: true,
  tipoDeDocumento: 'Código de contribuyente',
  numero: '',
  marcadas: {},
  pagadas: {},
  ultimo: null,
  abierta: null,
  correo: '',
  avisarVencimiento: true,
  autenticado: false,
  medio: 'tarjeta',
  valores: {},
  recienPagado: false,
  enfocarUnidades: false,
};

/** Como arranca el portal: en que modo, y si ya hay sesion abierta. */
export interface ComoEmpieza {
  /**
   * El modo (issue 59): la fuente, que es uno, o en las pruebas del reductor `CON_PLATAFORMA` y
   * `enDemostracion(…)`. En demostracion trae sus datos: un modo de demostracion sin ellos no existe.
   */
  readonly en: Modo;
  /** Con la sesion del emisor, `haySesion()`; en demostracion, siempre `false` (no hay a quien entrar). */
  readonly autenticado: boolean;
  /** Lo que dice la fuente: `FuenteDelPortal.amnistia` (issue 49). */
  readonly amnistia: boolean;
}

/**
 * **El estado con que se abre el portal, segun de donde lea** (issue 28).
 *
 * Lo leido al empezar es lo que el modo tenga ya (`loLeidoDe`, sin respuesta todavia): con plataforma
 * no hay deuda que ensenar hasta que la consulta conteste, y la lista arranca **vacia** y sin ninguna
 * marca escrita —lo que llegue, llega marcado por omision (`marcadoPorOmision`)—.
 *
 * En demostracion, los conceptos y la persona son los que aporta la fuente (issue 58), y cada
 * concepto arranca con su marca ESCRITA: son las cuatro del artboard (linea 929), que las escribe
 * todas. Se derivan de los conceptos en vez de copiarse por id para que las marcas no puedan hablar
 * de conceptos que no estan. Es la misma linea para los dos modos: con la lista vacia no escribe
 * ninguna.
 *
 * Quien lo llama es `ProveedorDelRecorrido`, una sola vez: la bandera es de construccion y el token
 * lo fija el canje ANTES de montar (`src/arranque.ts`).
 */
export function estadoInicial({ en, autenticado, amnistia }: ComoEmpieza): EstadoDelRecorrido {
  const leido = loLeidoDe(en, undefined);
  const base: EstadoDelRecorrido = {
    ...DECISIONES_INICIALES,
    ...leido,
    politica: politicaDe(en),
    autenticado,
    amnistia,
    marcadas: Object.fromEntries(leido.deudas.map((deuda) => [deuda.id, true])),
  };
  const paso = primerPaso(base);
  return { ...base, paso, alcanzado: alcanzadoHasta(base, paso) };
}

export type AccionDelRecorrido =
  /**
   * Busqueda valida: se guarda que se busco y se pasa a elegir (artboard, 1002-1007). Una busqueda
   * nueva vuelve a empezar la eleccion (`alcanzado`).
   */
  | { readonly tipo: 'buscar'; readonly tipoDeDocumento: TipoDeDocumento; readonly numero: string }
  /**
   * **La navegacion libre** (issue 61): abrir un paso YA ALCANZADO, desde la franja o porque la URL lo
   * nombra (atras, adelante, un enlace). Hacia un paso que no es alcanzable no hace nada. Es la unica
   * accion que lleva un paso en su carga: las demas dicen lo que la persona hizo, y a donde lleva lo
   * decide el reductor. Solo la despachan la franja y `rutas.ts`
   * (`verificaciones/ninguna-pantalla-decide-el-paso.test.ts`).
   */
  | { readonly tipo: 'irA'; readonly paso: Paso }
  /**
   * «Pagar todo» / «Pagar lo marcado» del paso 2 (artboard, 1173): a «Mis datos» sin sesion, a pagar
   * con ella (`destinoAlPagar`). Sin nada marcado no lleva a ninguna parte; el aviso es de la pantalla.
   */
  | { readonly tipo: 'confirmarEleccion' }
  /** «Cambiar lo que voy a pagar» del paso 4: a donde se elige (`dondeSeElige`). */
  | { readonly tipo: 'volverAElegir' }
  /** La marca de la barra y «No soy yo» (artboard, `irInicio`, 1175): a `inicio`. */
  | { readonly tipo: 'irAlInicio' }
  /**
   * «Iniciar sesión» de la barra en demostracion, y «Crear mi cuenta» del comprobante: a «Mis datos»,
   * que es donde se entra. Solo sin sesion y si el recorrido tiene ese paso: con plataforma se entra
   * por la puerta del emisor, no por una pantalla.
   */
  | { readonly tipo: 'identificarse' }
  /** «Pagar lo pendiente» del historial y «Pagar otra deuda» del comprobante: con sesion, a elegir. */
  | { readonly tipo: 'pagarLoPendiente' }
  /** «Mis pagos» del menu y «Ver mis pagos» del comprobante: al historial, que exige sesion. */
  | { readonly tipo: 'verMisPagos' }
  /** «Ver el comprobante» del pago reciente del historial: al comprobante, que exige un sello. */
  | { readonly tipo: 'verElComprobante' }
  | { readonly tipo: 'alternar'; readonly id: string }
  /** «Marcar todo» / «Quitar todo» sobre la deuda viva (artboard, 1152-1157). */
  | { readonly tipo: 'marcarTodo' }
  /** Abre el desglose de un concepto, o lo cierra si ya estaba abierto (artboard, 1145). */
  | { readonly tipo: 'abrirDetalle'; readonly id: string }
  | { readonly tipo: 'continuarConCorreo'; readonly correo: string; readonly avisarVencimiento: boolean }
  /**
   * Entrar con la cuenta de demostracion (artboard, 1195-1200). Lleva a `destinoAlEntrar`. La clave no
   * viaja en la accion: en la demostracion no se comprueba, y lo que no entra aqui no se guarda.
   */
  | { readonly tipo: 'entrar' }
  | { readonly tipo: 'elegirMedio'; readonly medio: MedioDePago['id'] }
  | { readonly tipo: 'fijarValor'; readonly clave: string; readonly valor: string }
  | { readonly tipo: 'confirmarPago' }
  /** «Cerrar sesión» del menu (artboard, 1055). Olvida tambien el pago sellado: ver el reductor. */
  | { readonly tipo: 'cerrarSesion' }
  /** «Consultar otra deuda» del comprobante sin sesion (artboard, 1281). */
  | { readonly tipo: 'consultarOtra' }
  /** «Mis predios y vehículos» del menu: al historial, con la vista en sus unidades (issue 10). */
  | { readonly tipo: 'verPrediosYVehiculos' }
  /** El historial ya llevo la vista a las unidades: no se vuelve a hacer en cada dibujo. */
  | { readonly tipo: 'unidadesEnfocadas' };

// ── Selectores ─────────────────────────────────────────────────────────────────────────────────

/** Los pasos numerados de ESTE recorrido: cinco en demostracion, cuatro con plataforma. */
export function pasosNumerados(estado: DecisionesDelRecorrido): readonly PasoNumerado[] {
  return estado.politica.recorrido.pasos;
}

/**
 * El primer paso al que se puede ir: `buscar` en demostracion, `entrar` con plataforma y sin sesion,
 * y `deudas` con plataforma y sesion —quien ya entro no vuelve a entrar—.
 *
 * Es tambien a donde redirige lo que no es alcanzable, asi que **tiene que ser alcanzable siempre**:
 * devolver `entrar` con la sesion abierta dejaria al enrutador redirigiendo en circulo.
 */
export function primerPaso(estado: DecisionesDelRecorrido): Paso {
  const { primerPaso: primero } = estado.politica.recorrido;
  return estado.autenticado ? primero.conSesion : primero.sinSesion;
}

/** La deuda que sigue viva: todo lo que no esta pagado (artboard, `vivas()`, linea 990). */
export function vivas(estado: EstadoDelRecorrido): readonly ConceptoDeDeuda[] {
  return estado.deudas.filter((deuda) => estado.pagadas[deuda.id] !== true);
}

/**
 * La deuda viva **del artboard**, con su forma entera (cuotas, vencimiento, estado y desglose).
 *
 * La pide solo la pantalla de demostracion del paso 2, que se dibuja unicamente cuando no hay
 * plataforma: alli `estado.deudas` son los del artboard, y el filtro no puede perder ninguno. Con plataforma
 * devuelve una lista vacia, que es la verdad: los conceptos del servidor no tienen esa forma.
 */
export function vivasDelArtboard(estado: EstadoDelRecorrido): readonly Deuda[] {
  return vivas(estado).filter((deuda): deuda is Deuda => deuda.detalle !== null);
}

/**
 * La deuda viva **del servidor**, con su forma: cada importe con su fecha, y `cuotas`, `vence`,
 * `estado`, `tono` y `detalle` en `null` (issue 26).
 *
 * El reverso de `vivasDelArtboard`: la pide solo la pantalla con plataforma. En demostracion
 * devuelve una lista vacia.
 */
export function vivasDelServidor(estado: EstadoDelRecorrido): readonly DeudaDelServidor[] {
  return vivas(estado).filter((deuda): deuda is DeudaDelServidor => deuda.detalle === null);
}

/**
 * Si un concepto esta marcado: lo que decidio la persona, o, si no decidio nada de el, lo de por
 * omision —marcado con plataforma, desmarcado en demostracion—. Ver `marcadas`.
 */
export function estaMarcada(estado: DecisionesDelRecorrido, id: string): boolean {
  return estado.marcadas[id] ?? estado.politica.recorrido.marcadoPorOmision;
}

/** Lo marcado DE LA DEUDA VIVA: lo pagado no se vuelve a cobrar aunque siga marcado. */
export function seleccion(estado: EstadoDelRecorrido): readonly ConceptoDeDeuda[] {
  return vivas(estado).filter((deuda) => estaMarcada(estado, deuda.id));
}

/** La cuenta de lo seleccionado (artboard, `cuenta()`, lineas 992-998). */
export function cuenta(estado: EstadoDelRecorrido): Cuenta {
  return cuentaDe(seleccion(estado));
}

/** Las cifras del paso 2, sobre la deuda viva (artboard, 1108-1127). */
export function resumen(estado: EstadoDelRecorrido): Resumen {
  return resumenDe(vivas(estado));
}

/** Lo que queda pendiente en el historial (artboard, 1349-1368). Es la deuda viva, sin mas. */
export function pendientes(estado: EstadoDelRecorrido): readonly ConceptoDeDeuda[] {
  return vivas(estado);
}

/**
 * La cuenta de lo pendiente: su `total` es la cifra en rojo de «Lo que queda pendiente» (artboard,
 * lineas 1351-1356, que suman insoluto + interes + gastos de cada concepto vivo). Sin deuda viva,
 * `'0.00'`: el «S/ 0.00» de la fila «No le queda nada pendiente».
 */
export function cuentaPendiente(estado: EstadoDelRecorrido): Cuenta {
  return cuentaDe(pendientes(estado));
}

/**
 * A donde lleva «Pagar»: sin sesion hay que dar un correo; con sesion, directo a pagar (1173).
 *
 * **Sin «Mis datos» en el recorrido, siempre a pagar**: con plataforma ese paso no existe —se entro
 * con la cuenta del portal en el paso 1— y mandar alli seria mandar a un paso que no es alcanzable.
 * Se deduce de los pasos de la politica, no del modo.
 */
export function destinoAlPagar(estado: EstadoDelRecorrido): 'identificar' | 'pagar' {
  if (indiceDelPaso(estado, 'identificar') < 0) return 'pagar';
  return estado.autenticado ? 'pagar' : 'identificar';
}

/**
 * **A donde se vuelve desde el paso 4 para cambiar lo que se paga** (issue 59, antes en `Pagar.tsx`).
 *
 * A buscar si el recorrido empieza buscando y no se busco —se llego a pagar por «Iniciar sesión» →
 * «Solo con mi correo» (issue 8)—; si no, a elegir qué pago. Con plataforma `buscar` no existe: se
 * vuelve siempre a elegir. Se deduce de los pasos de la politica, no del modo.
 */
export function dondeSeElige(estado: EstadoDelRecorrido): 'buscar' | 'deudas' {
  return indiceDelPaso(estado, 'buscar') >= 0 && estado.numero === '' ? 'buscar' : 'deudas';
}

/**
 * Si hay algo que pagar: **se busco la deuda o hay sesion**, y la seleccion viva no esta vacia.
 *
 * `numero` vacio es «no se busco»: al abrir el portal y tras «Consultar otra deuda». Sin busqueda ni
 * sesion, `marcadas` trae lo marcado por omision, que no es una seleccion de nadie.
 *
 * **Con sesion el contribuyente ya es conocido** (nota del revisor del issue 10): quien entra desde la
 * barra sin buscar llega al historial, y desde alli «Pagar lo pendiente» → «Elegir qué pago» → «Pagar»
 * tiene que poder pagar lo que elija. Exigir `numero` tambien entonces dejaba ese «Pagar» en «No hay
 * nada que pagar.».
 */
export function hayQuePagar(estado: EstadoDelRecorrido): boolean {
  return (estado.numero !== '' || estado.autenticado) && seleccion(estado).length > 0;
}

/**
 * **Lo que el paso 4 cobra**: la seleccion viva, pero solo si `hayQuePagar`.
 *
 * No es `seleccion` a secas porque «Pagar» se alcanza tambien sin haber buscado: «Iniciar sesión»
 * abre «Mis datos» y «Solo con mi correo» lleva a pagar (issue 8). Ahi `marcadas` trae lo marcado por
 * omision, que no eligio nadie, y `seleccion` daria los cuatro conceptos: el resumen diria
 * `S/ 3,149.92` y confirmar sellaria un pago que nadie pidio. De aqui cuelgan el resumen, las
 * instrucciones de cada medio y lo que `confirmarPago` sella, asi que no pueden discrepar.
 */
export function porPagar(estado: EstadoDelRecorrido): readonly ConceptoDeDeuda[] {
  return hayQuePagar(estado) ? seleccion(estado) : [];
}

/**
 * **Lo que se cobra de una cuenta** (issue 49): con amnistia, todo menos el interes (`conAmnistia`);
 * sin ella, el total entero.
 *
 * Hasta el issue 49 las pantallas leian `conAmnistia` a secas, y con plataforma cobraban a una deuda
 * de verdad el descuento de una ordenanza del artboard que el contrato no trae. La pregunta «¿hay
 * amnistia?» se contesta aqui, una vez, con lo que dijo la fuente; ninguna pantalla la repite.
 * Sirve para lo elegido (`cuentaPorPagar`) y para el pago sellado (`ultimo`), que tambien es una
 * `Cuenta`: `amnistia` no cambia en toda la visita, asi que el sello se lee igual que se cobro.
 */
export function aCobrar(estado: EstadoDelRecorrido, lo: Cuenta): Importe {
  return estado.amnistia ? lo.conAmnistia : lo.total;
}

/** Lo mismo, de un concepto: la fila del recibo. `conAmnistiaDe` o `totalDe`, segun la fuente. */
export function aCobrarDe(estado: EstadoDelRecorrido, deuda: ConSaldo): Importe {
  return estado.amnistia ? conAmnistiaDe(deuda) : totalDe(deuda);
}

/** La cuenta de `porPagar`: el resumen y el `{{TOTAL}}` de las instrucciones del paso 4. */
export function cuentaPorPagar(estado: EstadoDelRecorrido): Cuenta {
  return cuentaDe(porPagar(estado));
}

/**
 * A donde lleva entrar con la cuenta. El artboard siempre va a `pagar` (linea 1200); la nota del
 * revisor del issue 7 lo corrige: «Iniciar sesión» abre «Mis datos» aunque no se haya buscado, y
 * sin nada que pagar ese «Pagar» quedaria vacio. Entonces se va al historial.
 *
 * Se pregunta sobre el estado de ANTES de entrar, sin sesion todavia: si no se busco, lo marcado por
 * omision no es un pago elegido y se va al historial, aunque con la sesion ya puesta `hayQuePagar` lo
 * daria por bueno (issue 10). Desde el historial, pagar es elegirlo en «Pagar lo pendiente».
 */
export function destinoAlEntrar(estado: EstadoDelRecorrido): 'pagar' | 'historial' {
  return hayQuePagar(estado) ? 'pagar' : 'historial';
}

/** A donde lleva la marca de la barra (artboard, `irInicio`, linea 1175). */
export function inicio(estado: EstadoDelRecorrido): Paso {
  return estado.autenticado ? 'historial' : primerPaso(estado);
}

/**
 * A donde se envia el comprobante (artboard, linea 1027). `null`: aun no hay correo, «su correo».
 *
 * **Con la sesion del emisor no hay correo que decir**: el realm del ciudadano pone `tipo_documento`
 * y `numero_documento`, y ni el correo ni el codigo de contribuyente (`src/api/claims.ts`). Poner el
 * del artboard escribiria el buzon de otra persona debajo del pago de esta.
 */
export function destinoDelComprobante(estado: EstadoDelRecorrido): string | null {
  // El de la cuenta, que llega con los datos de la demostracion (issue 58). Se lee el DATO y no se
  // exige (`laDemostracion` revienta sin el): una politica que diga que la sesion trae el correo con
  // una fuente que no lo aporte cae en el correo escrito, en vez de tumbar el paso 4 (revision del
  // PR #71). En demostracion el dato esta siempre, y el resultado es el de antes.
  const deLaCuenta = estado.demostracion?.usuario.correo;
  if (estado.autenticado && estado.politica.sesion.traeElCorreo && deLaCuenta !== undefined) {
    return deLaCuenta;
  }
  const correo = estado.correo.trim();
  return correo === '' ? null : correo;
}

/** La posicion de un paso en la franja de ESTE recorrido, o -1 si no esta en ella. */
export function indiceDelPaso(estado: DecisionesDelRecorrido, paso: Paso): number {
  return pasosNumerados(estado).indexOf(paso as PasoNumerado);
}

/**
 * **El progreso de quien llego a `paso` por el camino** (issue 61): cada paso de la franja anterior a
 * el, hecho; el, abierto. Es con lo que se abre el portal (en su primer paso) y lo que una prueba que
 * empieza a mitad del recorrido da por recorrido (`src/pruebas/portal.tsx`).
 *
 * El comprobante no se guarda: lo abre el sello (`pasoAlcanzable`). Un paso que no es de la franja —el
 * historial— no dice nada del camino: se da por alcanzado solo el primero.
 */
export function alcanzadoHasta(estado: DecisionesDelRecorrido, paso: Paso): Alcanzado {
  const pasos = pasosNumerados(estado);
  const donde = pasos.indexOf(paso as PasoNumerado);
  if (donde < 0) return alcanzadoHasta(estado, primerPaso(estado));
  const progreso: Partial<Record<PasoDelProgreso, EstadoDelPaso>> = {};
  pasos.slice(0, donde + 1).forEach((cada, i) => {
    if (cada !== 'comprobante') progreso[cada] = i < donde ? 'hecho' : 'abierto';
  });
  return progreso;
}

/**
 * Si se puede ir a `paso` desde donde esta el recorrido.
 *
 * · El historial exige sesion.
 * · **Un paso que no esta en la franja de este recorrido, nunca**: `buscar` e `identificar` con
 *   plataforma, `entrar` sin ella. Es lo que hace que escribir `#/buscar` con plataforma no
 *   ensene un formulario que el backend ya no atiende (ADR-0020).
 * · **El comprobante, siempre que haya un pago sellado** (issue 9), y sin sello nunca (issue 61). Es la
 *   constancia que se conserva: volver a elegir qué pago y regresar a `#/comprobante` tiene que
 *   ensenar el MISMO recibo. Sin sello no hay recibo que ensenar, y hasta el issue 61 un comprobante
 *   sin sello era alcanzable por su posicion y dejaba la pantalla en blanco.
 * · **`entrar` solo sin sesion** (issue 28). Es el paso que no se repite: quien ya
 *   entro no vuelve a entrar —para cambiar de cuenta se cierra la sesion, que es otra cosa y esta en
 *   la barra—, y ademas el emisor devuelve el navegador a `#/entrar`, asi que sin esta linea entrar
 *   con la cuenta acabaria en la misma pantalla de la que se salio.
 * · **Los demas, si se alcanzaron** (`alcanzado`, issue 61), y el primero siempre —es a donde se
 *   redirige lo que no es alcanzable—. Hasta el issue 61 era la regla de la franja del artboard
 *   (`alcanzable = i <= iPaso`, linea 1068): lo alcanzable dependia de la posicion ACTUAL, asi que
 *   volver atras dejaba fuera lo que se acababa de recorrer y el boton Adelante del navegador no
 *   llevaba a ninguna parte; y desde el historial no se alcanzaba ninguno.
 */
export function pasoAlcanzable(estado: EstadoDelRecorrido, paso: Paso): boolean {
  if (paso === 'historial') return estado.autenticado;
  if (indiceDelPaso(estado, paso) < 0) return false;
  if (paso === 'comprobante') return estado.ultimo !== null;
  if (paso === 'entrar') return !estado.autenticado;
  return paso === primerPaso(estado) || estado.alcanzado[paso] !== undefined;
}

/**
 * **Si la franja da `paso` por hecho** (issue 61): se completo y no es el actual. Sale del progreso y
 * no de la posicion: tras «Iniciar sesión» sin haber buscado, «Mis datos» es el paso 3 y ni «Buscar
 * mi deuda» ni «Elegir qué pago» estan hechos. El comprobante no se «hace»: es el final.
 */
export function pasoHecho(estado: DecisionesDelRecorrido, paso: Paso): boolean {
  return paso !== estado.paso && paso !== 'comprobante' && paso !== 'historial' && estado.alcanzado[paso] === 'hecho';
}

/** A donde se redirige un paso no alcanzable: el ultimo que si lo es. */
export function ultimoAlcanzable(estado: EstadoDelRecorrido): Paso {
  return pasoAlcanzable(estado, estado.paso) ? estado.paso : primerPaso(estado);
}

// ── El reductor ────────────────────────────────────────────────────────────────────────────────

/**
 * **Una transicion del recorrido**: deja `desde` hecho y lleva a `a`, que queda abierto si no lo
 * estaba —lo hecho sigue hecho—. Solo los pasos de la franja de ESTE recorrido llevan progreso: con
 * plataforma no hay «Mis datos» que completar, y el historial y el comprobante no se guardan.
 */
function avanzar(estado: EstadoDelRecorrido, desde: PasoDelProgreso | null, a: Paso): EstadoDelRecorrido {
  let alcanzado = estado.alcanzado;
  if (desde !== null && indiceDelPaso(estado, desde) >= 0 && alcanzado[desde] !== 'hecho') {
    alcanzado = { ...alcanzado, [desde]: 'hecho' };
  }
  if (a !== 'comprobante' && a !== 'historial' && indiceDelPaso(estado, a) >= 0 && alcanzado[a] === undefined) {
    alcanzado = { ...alcanzado, [a]: 'abierto' };
  }
  return { ...estado, paso: a, alcanzado };
}

/**
 * **El progreso tras una busqueda**: buscar hecho y elegir abierto, y nada de lo que venia despues
 * —otra busqueda es otra eleccion, y pagar lo de antes sin volver a elegir seria pagar a ciegas—. Con
 * sesion se conserva «Mis datos»: la sesion es la identificacion, y no depende de lo que se busco.
 */
function progresoDeUnaBusqueda(estado: EstadoDelRecorrido): Alcanzado {
  const misDatos = estado.alcanzado.identificar;
  return {
    buscar: 'hecho',
    deudas: 'abierto',
    ...(estado.autenticado && misDatos !== undefined ? { identificar: misDatos } : {}),
  };
}

export function recorrido(estado: EstadoDelRecorrido, accion: AccionDelRecorrido): EstadoDelRecorrido {
  switch (accion.tipo) {
    case 'buscar':
      if (indiceDelPaso(estado, 'buscar') < 0) return estado;
      return {
        ...estado,
        tipoDeDocumento: accion.tipoDeDocumento,
        numero: accion.numero,
        paso: 'deudas',
        alcanzado: progresoDeUnaBusqueda(estado),
      };

    case 'irA':
      // La navegacion libre: solo a un paso ya alcanzado (issue 61). Hasta entonces el reductor
      // aceptaba cualquiera, y quien despachaba decidia.
      if (estado.paso === accion.paso || !pasoAlcanzable(estado, accion.paso)) return estado;
      return { ...estado, paso: accion.paso };

    case 'confirmarEleccion':
      if (seleccion(estado).length === 0) return estado;
      return avanzar(estado, 'deudas', destinoAlPagar(estado));

    case 'volverAElegir':
      return avanzar(estado, null, dondeSeElige(estado));

    case 'irAlInicio': {
      const a = inicio(estado);
      return a === estado.paso ? estado : { ...estado, paso: a };
    }

    case 'identificarse':
      if (estado.autenticado || indiceDelPaso(estado, 'identificar') < 0) return estado;
      return avanzar(estado, null, 'identificar');

    case 'pagarLoPendiente':
      return estado.autenticado ? avanzar(estado, null, 'deudas') : estado;

    case 'verMisPagos':
      return estado.autenticado && estado.paso !== 'historial' ? { ...estado, paso: 'historial' } : estado;

    case 'verElComprobante':
      return estado.ultimo !== null && estado.paso !== 'comprobante' ? { ...estado, paso: 'comprobante' } : estado;

    case 'alternar':
      return {
        ...estado,
        marcadas: { ...estado.marcadas, [accion.id]: !estaMarcada(estado, accion.id) },
      };

    case 'marcarTodo': {
      // Sobre la deuda viva, como el artboard: si todo lo vivo esta marcado se quita todo, y si no,
      // se marca todo. Lo pagado sale de `marcadas`.
      const viva = vivas(estado);
      const todo = seleccion(estado).length === viva.length;
      return { ...estado, marcadas: Object.fromEntries(viva.map((deuda) => [deuda.id, !todo])) };
    }

    case 'abrirDetalle':
      return { ...estado, abierta: estado.abierta === accion.id ? null : accion.id };

    case 'continuarConCorreo':
      return {
        ...avanzar(estado, 'identificar', 'pagar'),
        correo: accion.correo,
        avisarVencimiento: accion.avisarVencimiento,
      };

    case 'entrar':
      // `destinoAlEntrar` sobre `estado`, que aun no tiene sesion: ver su comentario.
      return { ...avanzar(estado, 'identificar', destinoAlEntrar(estado)), autenticado: true };

    case 'elegirMedio':
      return { ...estado, medio: accion.medio };

    case 'fijarValor':
      return { ...estado, valores: { ...estado.valores, [accion.clave]: accion.valor } };

    case 'confirmarPago': {
      // `porPagar` y no `seleccion`: sin busqueda, lo marcado por omision no es un pago (issue 8).
      const pagado = porPagar(estado);
      // Sin nada que pagar no se sella nada. El aviso «No hay nada que pagar.» es de la pantalla.
      if (pagado.length === 0) return estado;
      const sellado = { conceptos: pagado, contribuyente: estado.contribuyente, ...cuentaDe(pagado) };
      // El paso 4 queda hecho; el comprobante lo abre el sello, que se pone aqui abajo.
      const alcanzado = avanzar(estado, 'pagar', 'comprobante').alcanzado;
      if (estado.politica.cobro.simulado) {
        // **Un pago simulado NO da la deuda por pagada** (issue 28, revision): no hubo cobro, y
        // quitar el concepto de la deuda viva seria el mismo embuste que la frase «la deuda pagada
        // ya se descontó de su cuenta» — dicho con la lista en vez de con palabras. El aviso de los
        // pasos 4 y 5 promete que «su deuda no cambia»; esto es lo que lo hace verdad. Y se sella sin
        // medio, sin destino y sin numeros (`PagoSimulado`, issue 59).
        return {
          ...estado,
          paso: 'comprobante',
          alcanzado,
          recienPagado: true,
          ultimo: { ...sellado, comprobante: null },
        };
      }
      return {
        ...estado,
        paso: 'comprobante',
        alcanzado,
        recienPagado: true,
        pagadas: {
          ...estado.pagadas,
          ...Object.fromEntries(pagado.map((deuda) => [deuda.id, true as const])),
        },
        ultimo: {
          ...sellado,
          medio: estado.medio,
          destino: destinoDelComprobante(estado),
          // Los numeros de la demostracion, que llegan con ella (issue 58).
          comprobante: laDemostracion(estado).comprobante,
        },
      };
    }

    case 'cerrarSesion':
      // Tambien se olvida el comprobante de esta visita (revision del PR del issue 9; el artboard solo
      // cambia `autenticado` y `paso`, linea 1055). En un equipo compartido, tras «Cerrar sesión» el
      // recibo sellado —nombre, correo de la cuenta, numero de operacion— no puede seguir a un clic:
      // sin `ultimo`, `#/comprobante` deja de ser alcanzable y redirige como cualquier otro paso.
      //
      // Y por el mismo argumento (issue 49), todo lo que la persona tecleo o eligio: la tarjeta
      // (`valores`: numero, vencimiento, CVV), el correo, lo que busco y lo que marco. Con el recibo
      // olvidado y la tarjeta todavia escrita en el paso 4, el equipo compartido seguia siendo un
      // problema. `marcadas` queda VACIO y no con las cuatro marcas del artboard: esas no son una
      // eleccion de nadie (`hayQuePagar`), y tras cerrar sesion no hay nadie que haya elegido. Vacio
      // es «nadie decidio nada»: cada concepto vale lo de por omision (`estaMarcada`).
      return {
        ...estado,
        autenticado: false,
        paso: primerPaso({ ...estado, autenticado: false }),
        // Y el progreso: sin nadie que haya elegido, nada esta hecho (issue 61).
        alcanzado: alcanzadoHasta({ ...estado, autenticado: false }, primerPaso({ ...estado, autenticado: false })),
        ultimo: null,
        recienPagado: false,
        enfocarUnidades: false,
        valores: {},
        correo: '',
        numero: '',
        tipoDeDocumento: DECISIONES_INICIALES.tipoDeDocumento,
        marcadas: {},
        abierta: null,
      };

    case 'consultarOtra':
      // Otra consulta empieza la eleccion de cero; el comprobante sellado sigue a mano (lo abre el sello).
      return { ...estado, paso: primerPaso(estado), numero: '', alcanzado: alcanzadoHasta(estado, primerPaso(estado)) };

    case 'verPrediosYVehiculos':
      return estado.autenticado ? { ...estado, paso: 'historial', enfocarUnidades: true } : estado;

    case 'unidadesEnfocadas':
      return estado.enfocarUnidades ? { ...estado, enfocarUnidades: false } : estado;
  }
}
