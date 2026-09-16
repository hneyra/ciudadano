import { type Cuenta, cuentaDe, type Resumen, resumenDe } from '../datos/cuentas.ts';
import { COMPROBANTE, CONTRIBUYENTE, DEUDAS, USUARIO } from '../datos/demostracion.ts';
import type {
  ComprobanteDeDemostracion,
  ConceptoDeDeuda,
  Deuda,
  DeudaDelServidor,
  MedioDePago,
  QuienDebe,
} from '../datos/tipos.ts';

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
 * <h2>De donde salen los conceptos: `estado.deudas`, y no una lista escrita aqui (issue 28)</h2>
 *
 * Hasta el issue 27 el reductor leia `DEUDAS` de `src/datos/demostracion.ts` en cada selector. Con
 * plataforma los conceptos los trae `GET /portal/situacion`, y el recorrido tiene que poder marcar,
 * pagar y sellar **esos**. Asi que la lista vive en el estado: `ESTADO_INICIAL.deudas` es la del
 * artboard —en demostracion nada cambia, es la misma lista de siempre— y con plataforma arranca
 * vacia y la pone `situacionLeida` cuando la consulta contesta. No se copia ni un concepto aqui.
 *
 * <h2>Dos recorridos, y el modo lo dice el estado</h2>
 *
 * `conPlataforma` entra en el estado **una vez, al montar** (`estadoInicial`, desde
 * `ProveedorDelRecorrido`), y de el cuelgan que pasos hay, cual es el primero y a donde lleva
 * «Pagar». Se guarda aqui en vez de preguntarselo a la fuente en cada selector porque el reductor es
 * puro y se prueba llamandolo: con la bandera dentro del estado, los dos recorridos se prueban con
 * datos y sin montar nada.
 */

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

export type PasoNumerado =
  | (typeof PASOS_DE_LA_DEMOSTRACION)[number]
  | (typeof PASOS_CON_PLATAFORMA)[number];

/**
 * Donde puede estar el recorrido. El artboard llama `listo` al quinto; aqui es `comprobante`, que es
 * su ruta (`#/comprobante`). `historial` no es un paso numerado: con sesion, alli no hay nada que
 * avanzar y no se dibuja la franja.
 */
export type Paso = PasoNumerado | 'historial';

/**
 * Todos los pasos que existen, sin repetir: los de los dos recorridos mas el historial.
 *
 * De aqui salen las rutas del enrutador y las pantallas perezosas. **Derivado y no escrito otra
 * vez**: un paso nuevo en una lista y olvidado en la otra seria una ruta que no existe.
 */
export const TODOS_LOS_PASOS: readonly Paso[] = [
  ...new Set<Paso>([...PASOS_DE_LA_DEMOSTRACION, ...PASOS_CON_PLATAFORMA, 'historial']),
];

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
  /** Si el portal lee de la plataforma. Se fija al montar y no cambia: ver la cabecera. */
  readonly conPlataforma: boolean;
  /**
   * Los conceptos sobre los que trabaja el recorrido: los del artboard en demostracion, los de
   * `GET /portal/situacion` con plataforma. De aqui cuelgan `vivas`, `seleccion` y lo que se sella.
   */
  readonly deudas: readonly ConceptoDeDeuda[];
  /** De quien es esa deuda. `null` con plataforma mientras la consulta no ha contestado. */
  readonly contribuyente: QuienDebe | null;
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

/** El estado con que se abre el portal EN DEMOSTRACION. Artboard, lineas 927-940. */
export const ESTADO_INICIAL: EstadoDelRecorrido = {
  paso: 'buscar',
  conPlataforma: false,
  deudas: DEUDAS,
  contribuyente: {
    nombre: CONTRIBUYENTE.nombre,
    codigo: CONTRIBUYENTE.codigo,
    documento: `${CONTRIBUYENTE.tipoDeDocumento} ${CONTRIBUYENTE.numeroDeDocumento}`,
  },
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

/** Como arranca el portal: de donde lee, y si ya hay sesion abierta. */
export interface ComoEmpieza {
  readonly conPlataforma: boolean;
  /** Con plataforma, `haySesion()`; en demostracion, siempre `false` (no hay a quien entrar). */
  readonly autenticado: boolean;
}

/**
 * **El estado con que se abre el portal, segun de donde lea** (issue 28).
 *
 * Con plataforma no hay deuda que ensenar hasta que la consulta conteste: la lista arranca **vacia**
 * y sin nada marcado. Las cuatro marcas de `ESTADO_INICIAL` son las de los cuatro conceptos del
 * artboard, y arrastrarlas a un recorrido cuyos conceptos son otros dejaria marcadas unas cosas que
 * no existen.
 *
 * Quien lo llama es `ProveedorDelRecorrido`, una sola vez: la bandera es de construccion y el token
 * lo fija el canje ANTES de montar (`src/arranque.ts`).
 */
export function estadoInicial({ conPlataforma, autenticado }: ComoEmpieza): EstadoDelRecorrido {
  const base: EstadoDelRecorrido = conPlataforma
    ? { ...ESTADO_INICIAL, conPlataforma: true, autenticado, deudas: [], marcadas: {}, contribuyente: null }
    : { ...ESTADO_INICIAL, autenticado };
  return { ...base, paso: primerPaso(base) };
}

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
  | { readonly tipo: 'unidadesEnfocadas' }
  /**
   * **La consulta a la plataforma contesto con deuda** (issue 28): sus conceptos pasan a ser los del
   * recorrido, y se marcan todos, como el artboard abre con los suyos marcados (linea 929).
   *
   * La despacha `LaConsulta` cuando `useLaSituacion` trae datos. Es idempotente: con la MISMA lista
   * —la que la cache de consultas guarda— devuelve el estado tal cual, asi que volver a entrar en el
   * paso 2 no borra lo que se acababa de marcar.
   */
  | {
      readonly tipo: 'situacionLeida';
      readonly deudas: readonly DeudaDelServidor[];
      readonly contribuyente: QuienDebe;
    };

// ── Selectores ─────────────────────────────────────────────────────────────────────────────────

/** Los pasos numerados de ESTE recorrido: cinco en demostracion, cuatro con plataforma. */
export function pasosNumerados(estado: EstadoDelRecorrido): readonly PasoNumerado[] {
  return estado.conPlataforma ? PASOS_CON_PLATAFORMA : PASOS_DE_LA_DEMOSTRACION;
}

/**
 * El primer paso al que se puede ir: `buscar` en demostracion, `entrar` con plataforma y sin sesion,
 * y `deudas` con plataforma y sesion —quien ya entro no vuelve a entrar—.
 *
 * Es tambien a donde redirige lo que no es alcanzable, asi que **tiene que ser alcanzable siempre**:
 * devolver `entrar` con la sesion abierta dejaria al enrutador redirigiendo en circulo.
 */
export function primerPaso(estado: EstadoDelRecorrido): Paso {
  if (!estado.conPlataforma) return 'buscar';
  return estado.autenticado ? 'deudas' : 'entrar';
}

/** La deuda que sigue viva: todo lo que no esta pagado (artboard, `vivas()`, linea 990). */
export function vivas(estado: EstadoDelRecorrido): readonly ConceptoDeDeuda[] {
  return estado.deudas.filter((deuda) => estado.pagadas[deuda.id] !== true);
}

/**
 * La deuda viva **del artboard**, con su forma entera (cuotas, vencimiento, estado y desglose).
 *
 * La pide solo la pantalla de demostracion del paso 2, que se dibuja unicamente cuando no hay
 * plataforma: alli `estado.deudas` ES `DEUDAS`, y el filtro no puede perder ninguno. Con plataforma
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

/** Lo marcado DE LA DEUDA VIVA: lo pagado no se vuelve a cobrar aunque siga marcado. */
export function seleccion(estado: EstadoDelRecorrido): readonly ConceptoDeDeuda[] {
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
 * Los conceptos de un pago sellado, en el orden de `DEUDAS`: las filas del comprobante (artboard,
 * linea 1283 y 1302-1310). Salen de `pago.ids` y de nada mas: ni de `marcadas` ni de la deuda viva.
 */
export function conceptosDelPago(estado: EstadoDelRecorrido, pago: PagoSellado): readonly ConceptoDeDeuda[] {
  return estado.deudas.filter((deuda) => pago.ids.includes(deuda.id));
}

/**
 * A donde lleva «Pagar»: sin sesion hay que dar un correo; con sesion, directo a pagar (1173).
 *
 * **Con plataforma, siempre a pagar**: el paso «Mis datos» no existe en ese recorrido —se entro con
 * la cuenta del portal en el paso 1— y mandar alli seria mandar a un paso que no es alcanzable.
 */
export function destinoAlPagar(estado: EstadoDelRecorrido): 'identificar' | 'pagar' {
  if (estado.conPlataforma) return 'pagar';
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
export function porPagar(estado: EstadoDelRecorrido): readonly ConceptoDeDeuda[] {
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
export function inicio(estado: EstadoDelRecorrido): Paso {
  return estado.autenticado ? 'historial' : primerPaso(estado);
}

/**
 * A donde se envia el comprobante (artboard, linea 1027). `null`: aun no hay correo, «su correo».
 *
 * **Con plataforma no hay correo que decir**: el realm del ciudadano pone `tipo_documento` y
 * `numero_documento`, y ni el correo ni el codigo de contribuyente (`src/api/claims.ts`). Poner el
 * del artboard escribiria el buzon de otra persona debajo del pago de esta.
 */
export function destinoDelComprobante(estado: EstadoDelRecorrido): string | null {
  if (estado.autenticado && !estado.conPlataforma) return USUARIO.correo;
  const correo = estado.correo.trim();
  return correo === '' ? null : correo;
}

/** La posicion de un paso en la franja de ESTE recorrido, o -1 si no esta en ella. */
export function indiceDelPaso(estado: EstadoDelRecorrido, paso: Paso): number {
  return pasosNumerados(estado).indexOf(paso as PasoNumerado);
}

/**
 * Si se puede ir a `paso` desde donde esta el recorrido.
 *
 * · El historial exige sesion.
 * · **El comprobante, siempre que haya un pago sellado** (issue 9). Es la constancia que se conserva:
 *   volver a elegir qué pago y regresar a `#/comprobante` tiene que ensenar el MISMO recibo, y con la
 *   regla de la franja sola, desde `deudas` el comprobante seria un paso futuro y se redirigiria.
 * · **`entrar` solo con plataforma y sin sesion** (issue 28). Es el paso que no se repite: quien ya
 *   entro no vuelve a entrar —para cambiar de cuenta se cierra la sesion, que es otra cosa y esta en
 *   la barra—, y ademas el emisor devuelve el navegador a `#/entrar`, asi que sin esta linea entrar
 *   con la cuenta acabaria en la misma pantalla de la que se salio.
 * · **Un paso que no esta en la franja de este recorrido, nunca**: `buscar` e `identificar` con
 *   plataforma, `entrar` sin ella. Es lo que hace que escribir `#/buscar` con plataforma no
 *   ensene un formulario que el backend ya no atiende (ADR-0020).
 * · Un paso numerado, solo si es el actual o uno anterior: lo mismo que la franja del artboard
 *   (`alcanzable = i <= iPaso`, linea 1068). Desde el historial ninguno lo es por esta via: alli se
 *   vuelve al recorrido con las acciones de su pantalla, no escribiendo la ruta.
 */
export function pasoAlcanzable(estado: EstadoDelRecorrido, paso: Paso): boolean {
  if (paso === 'historial') return estado.autenticado;
  if (paso === 'entrar') return estado.conPlataforma && !estado.autenticado;
  if (paso === 'comprobante' && estado.ultimo !== null) return true;
  const donde = indiceDelPaso(estado, paso);
  if (donde < 0) return false;
  const actual = indiceDelPaso(estado, estado.paso);
  return actual >= 0 && donde <= actual;
}

/** A donde se redirige un paso no alcanzable: el ultimo que si lo es. */
export function ultimoAlcanzable(estado: EstadoDelRecorrido): Paso {
  return pasoAlcanzable(estado, estado.paso) ? estado.paso : primerPaso(estado);
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
        // **Con plataforma, lo pagado NO se da por pagado** (issue 28, revision): no hubo cobro, y
        // quitar el concepto de la deuda viva seria el mismo embuste que la frase «la deuda pagada
        // ya se descontó de su cuenta» — dicho con la lista en vez de con palabras. El aviso de los
        // pasos 4 y 5 promete que «su deuda no cambia»; esto es lo que lo hace verdad.
        pagadas: estado.conPlataforma
          ? estado.pagadas
          : {
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
        paso: primerPaso({ ...estado, autenticado: false }),
        ultimo: null,
        recienPagado: false,
        enfocarUnidades: false,
      };

    case 'consultarOtra':
      return { ...estado, paso: primerPaso(estado), numero: '' };

    case 'verPrediosYVehiculos':
      return { ...estado, paso: 'historial', enfocarUnidades: true };

    case 'unidadesEnfocadas':
      return estado.enfocarUnidades ? { ...estado, enfocarUnidades: false } : estado;

    case 'situacionLeida':
      // La MISMA lista no es una lectura nueva: es el mismo objeto que guarda la cache de consultas,
      // que la pantalla vuelve a ver cada vez que se monta. Sin esta salida, volver al paso 2 desde
      // «Cambiar lo que voy a pagar» volveria a marcarlo todo.
      if (estado.deudas === accion.deudas) return estado;
      return {
        ...estado,
        deudas: accion.deudas,
        contribuyente: accion.contribuyente,
        // Todo marcado, como el artboard abre con sus cuatro (linea 929).
        marcadas: Object.fromEntries(accion.deudas.map((deuda) => [deuda.id, true as const])),
      };
  }
}
