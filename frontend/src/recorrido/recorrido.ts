import { type Cuenta, cuentaDe, type Resumen, resumenDe } from '../datos/cuentas.ts';
import { COMPROBANTE, DEUDAS, USUARIO } from '../datos/demostracion.ts';
import type { ComprobanteDeDemostracion, Deuda, MedioDePago } from '../datos/tipos.ts';

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
 * <h2>Los datos son los de la demostracion</h2>
 *
 * El reductor trabaja sobre `DEUDAS` de `src/datos/demostracion.ts`, la misma lista que
 * `fuenteDeDemostracion` devuelve para cualquier documento. No se copia ni un concepto aqui.
 */

/** Los cinco pasos numerados de la franja, en su orden (artboard, lineas 1018-1022). */
export const PASOS_NUMERADOS = ['buscar', 'deudas', 'identificar', 'pagar', 'comprobante'] as const;

export type PasoNumerado = (typeof PASOS_NUMERADOS)[number];

/**
 * Donde puede estar el recorrido. El artboard llama `listo` al quinto; aqui es `comprobante`, que es
 * su ruta (`#/comprobante`). `historial` no es un paso numerado: con sesion, alli no hay nada que
 * avanzar y no se dibuja la franja.
 */
export type Paso = PasoNumerado | 'historial';

/** Por que se busca la deuda (artboard, linea 1084). Es dato y se traduce al dibujarse. */
export type TipoDeDocumento = 'Código de contribuyente' | 'DNI' | 'RUC';

/** Lo que el comprobante dice para siempre, sellado en `confirmarPago`. */
export interface PagoSellado extends Cuenta {
  /** Los conceptos pagados, en el orden de `DEUDAS`. */
  readonly ids: readonly string[];
  readonly medio: MedioDePago['id'];
  /** A donde se envio el comprobante; `null` es «su correo» (artboard, linea 1027). */
  readonly destino: string | null;
  readonly comprobante: ComprobanteDeDemostracion;
}

export interface EstadoDelRecorrido {
  readonly paso: Paso;
  readonly tipoDeDocumento: TipoDeDocumento;
  /** El codigo o el documento que se busco. */
  readonly numero: string;
  /** Lo que el ciudadano marco para pagar, por id. */
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

/** El estado con que se abre el portal. Artboard, lineas 927-940. */
export const ESTADO_INICIAL: EstadoDelRecorrido = {
  paso: 'buscar',
  tipoDeDocumento: 'Código de contribuyente',
  numero: '',
  marcadas: { pred26: true, arb26: true, pred24: true, veh24: true },
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

export type AccionDelRecorrido =
  /** Busqueda valida: se guarda que se busco y se pasa a elegir (artboard, 1002-1007). */
  | { readonly tipo: 'buscar'; readonly tipoDeDocumento: TipoDeDocumento; readonly numero: string }
  /** Ir a un paso. No comprueba que sea alcanzable: eso lo decide quien lo ofrece (`pasoAlcanzable`). */
  | { readonly tipo: 'irA'; readonly paso: Paso }
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

/** La deuda que sigue viva: todo lo que no esta pagado (artboard, `vivas()`, linea 990). */
export function vivas(estado: EstadoDelRecorrido): readonly Deuda[] {
  return DEUDAS.filter((deuda) => estado.pagadas[deuda.id] !== true);
}

/** Lo marcado DE LA DEUDA VIVA: lo pagado no se vuelve a cobrar aunque siga marcado. */
export function seleccion(estado: EstadoDelRecorrido): readonly Deuda[] {
  return vivas(estado).filter((deuda) => estado.marcadas[deuda.id] === true);
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
export function pendientes(estado: EstadoDelRecorrido): readonly Deuda[] {
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
 * Los conceptos de un pago sellado, en el orden de `DEUDAS`: las filas del comprobante (artboard,
 * linea 1283 y 1302-1310). Salen de `pago.ids` y de nada mas: ni de `marcadas` ni de la deuda viva.
 */
export function conceptosDelPago(pago: PagoSellado): readonly Deuda[] {
  return DEUDAS.filter((deuda) => pago.ids.includes(deuda.id));
}

/** A donde lleva «Pagar»: sin sesion hay que dar un correo; con sesion, directo a pagar (1173). */
export function destinoAlPagar(estado: EstadoDelRecorrido): 'identificar' | 'pagar' {
  return estado.autenticado ? 'pagar' : 'identificar';
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
export function porPagar(estado: EstadoDelRecorrido): readonly Deuda[] {
  return hayQuePagar(estado) ? seleccion(estado) : [];
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
export function inicio(estado: EstadoDelRecorrido): 'historial' | 'buscar' {
  return estado.autenticado ? 'historial' : 'buscar';
}

/** A donde se envia el comprobante (artboard, linea 1027). `null`: aun no hay correo, «su correo». */
export function destinoDelComprobante(estado: EstadoDelRecorrido): string | null {
  if (estado.autenticado) return USUARIO.correo;
  const correo = estado.correo.trim();
  return correo === '' ? null : correo;
}

/** La posicion de un paso en la franja, o -1 si no es numerado (el historial). */
export function indiceDelPaso(paso: Paso): number {
  return PASOS_NUMERADOS.indexOf(paso as PasoNumerado);
}

/**
 * Si se puede ir a `paso` desde donde esta el recorrido.
 *
 * · El historial exige sesion.
 * · **El comprobante, siempre que haya un pago sellado** (issue 9). Es la constancia que se conserva:
 *   volver a elegir qué pago y regresar a `#/comprobante` tiene que ensenar el MISMO recibo, y con la
 *   regla de la franja sola, desde `deudas` el comprobante seria un paso futuro y se redirigiria.
 * · Un paso numerado, solo si es el actual o uno anterior: lo mismo que la franja del artboard
 *   (`alcanzable = i <= iPaso`, linea 1068). Desde el historial ninguno lo es por esta via: alli se
 *   vuelve al recorrido con las acciones de su pantalla, no escribiendo la ruta.
 */
export function pasoAlcanzable(estado: EstadoDelRecorrido, paso: Paso): boolean {
  if (paso === 'historial') return estado.autenticado;
  if (paso === 'comprobante' && estado.ultimo !== null) return true;
  const actual = indiceDelPaso(estado.paso);
  return actual >= 0 && indiceDelPaso(paso) <= actual;
}

/** A donde se redirige un paso no alcanzable: el ultimo que si lo es. */
export function ultimoAlcanzable(estado: EstadoDelRecorrido): Paso {
  return pasoAlcanzable(estado, estado.paso) ? estado.paso : 'buscar';
}

// ── El reductor ────────────────────────────────────────────────────────────────────────────────

export function recorrido(estado: EstadoDelRecorrido, accion: AccionDelRecorrido): EstadoDelRecorrido {
  switch (accion.tipo) {
    case 'buscar':
      return { ...estado, tipoDeDocumento: accion.tipoDeDocumento, numero: accion.numero, paso: 'deudas' };

    case 'irA':
      return estado.paso === accion.paso ? estado : { ...estado, paso: accion.paso };

    case 'alternar':
      return {
        ...estado,
        marcadas: { ...estado.marcadas, [accion.id]: estado.marcadas[accion.id] !== true },
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
        ...estado,
        correo: accion.correo,
        avisarVencimiento: accion.avisarVencimiento,
        paso: 'pagar',
      };

    case 'entrar':
      // `destinoAlEntrar` sobre `estado`, que aun no tiene sesion: ver su comentario.
      return { ...estado, autenticado: true, paso: destinoAlEntrar(estado) };

    case 'elegirMedio':
      return { ...estado, medio: accion.medio };

    case 'fijarValor':
      return { ...estado, valores: { ...estado.valores, [accion.clave]: accion.valor } };

    case 'confirmarPago': {
      // `porPagar` y no `seleccion`: sin busqueda, lo marcado por omision no es un pago (issue 8).
      const pagado = porPagar(estado);
      // Sin nada que pagar no se sella nada. El aviso «No hay nada que pagar.» es de la pantalla.
      if (pagado.length === 0) return estado;
      return {
        ...estado,
        paso: 'comprobante',
        recienPagado: true,
        pagadas: {
          ...estado.pagadas,
          ...Object.fromEntries(pagado.map((deuda) => [deuda.id, true as const])),
        },
        ultimo: {
          ids: pagado.map((deuda) => deuda.id),
          ...cuentaDe(pagado),
          medio: estado.medio,
          destino: destinoDelComprobante(estado),
          comprobante: COMPROBANTE,
        },
      };
    }

    case 'cerrarSesion':
      // Tambien se olvida el comprobante de esta visita (revision del PR del issue 9; el artboard solo
      // cambia `autenticado` y `paso`, linea 1055). En un equipo compartido, tras «Cerrar sesión» el
      // recibo sellado —nombre, correo de la cuenta, numero de operacion— no puede seguir a un clic:
      // sin `ultimo`, `#/comprobante` deja de ser alcanzable y redirige como cualquier otro paso.
      return {
        ...estado,
        autenticado: false,
        paso: 'buscar',
        ultimo: null,
        recienPagado: false,
        enfocarUnidades: false,
      };

    case 'consultarOtra':
      return { ...estado, paso: 'buscar', numero: '' };

    case 'verPrediosYVehiculos':
      return { ...estado, paso: 'historial', enfocarUnidades: true };

    case 'unidadesEnfocadas':
      return estado.enfocarUnidades ? { ...estado, enfocarUnidades: false } : estado;
  }
}
