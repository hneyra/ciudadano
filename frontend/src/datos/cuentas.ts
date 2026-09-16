import type { Importe } from '@kamayuk/formato';
import { formatearImporte, sumarImportes } from '@kamayuk/formato';

import type { TonoDeInsignia } from './tipos.ts';

/**
 * **Las cuentas del portal**, como funciones puras sobre importes de texto.
 *
 * Portan la logica del artboard que suma con `number` —`cuenta()` (lineas 992-998), `resumen`
 * (1108-1127) y los `suma`/`recargo` de cada concepto (1133-1134)— a sumas exactas con
 * `sumarImportes`. **Ninguna pantalla suma por su cuenta**: el paso 2, el resumen, el carrito, el
 * comprobante y los pendientes del historial piden la cifra aqui, y por eso no pueden discrepar
 * entre si (que es lo que el propio artboard dice haber sufrido, lineas 930-933).
 *
 * <h2>Por que se suma, si la regla dice «el total lo calcula el backend»</h2>
 *
 * Porque este portal **no tiene backend**: `cuentas.ts` es el backend simulado, que es el primer uso
 * legitimo que `sumarImportes` declara (`@kamayuk/formato/aritmetica.ts`). Derivar los totales en
 * vez de copiarlos hace que cambiar un sumando de `demostracion.ts` mueva lo que depende de el.
 *
 * Sin `+`, sin `-` y sin `.reduce` sobre importes: lo prohibe ESLint en todo el arbol, y
 * `cuentas.test.ts` demuestra que la prohibicion muerde en `src/datos/`.
 *
 * <h2>El reajuste, desde el issue 26</h2>
 *
 * El artboard cuenta con tres componentes —insoluto, interes y gastos— y `GET /portal/situacion`
 * con **cuatro**: entre medias va el `reajuste`, la actualizacion del tributo por el indice de
 * precios. Se le dio sitio propio en el modelo en vez de sumarlo a `gastos` (el porque esta en
 * `deLaSituacion.ts`), y por eso lo suman tambien estas funciones: con sitio propio pero sin
 * sumarse, seria dinero que se debe y no se cobra. Para lo del artboard, que no lo trae, la
 * aritmetica no cambia — se suma `'0.00'`, que es sumar ninguno.
 */

/**
 * **Lo minimo que hace falta para contar un concepto**: los componentes de su saldo.
 *
 * Se declara asi —y las funciones de abajo lo piden en vez de una `Deuda` entera— desde el issue
 * 26, cuando aparecio una segunda forma de concepto: la `DeudaDelServidor` de `/portal/situacion`,
 * que tiene los mismos importes y **ademas** reajuste, y que no tiene cuotas ni estado. Las cuentas
 * no necesitan saber de cual de las dos se trata; necesitan saber sumar.
 *
 * `reajuste` es **opcional** porque el artboard no lo tiene: alli la deuda son tres componentes y
 * aqui no se inventa un `'0.00'` en los datos para que cuadre una firma.
 */
export interface ConSaldo {
  readonly insoluto: Importe;
  readonly reajuste?: Importe;
  readonly interes: Importe;
  readonly gastos: Importe;
}

/** Lo anterior mas lo que se sepa del estado: `null` cuando quien lo cuenta es el servidor. */
export interface ConSaldoYEstado extends ConSaldo {
  readonly estado: string | null;
}

/**
 * Lo que se suma en lugar de un reajuste que no existe.
 *
 * No es un importe del dominio: es el neutro de `sumarImportes`, escrito una vez para que ningun
 * sitio lo escriba a mano.
 */
const NADA: Importe = '0.00';

/** Lo elegido para pagar, con sus cuatro componentes separados y los dos totales. */
export interface Cuenta {
  readonly insoluto: Importe;
  /**
   * La actualizacion del tributo por el indice de precios. Del servidor (issue 26); en la
   * demostracion, que no lo tiene, sale `'0.00'` — la suma de ninguno, no un cero inventado.
   */
  readonly reajuste: Importe;
  readonly interes: Importe;
  readonly gastos: Importe;
  /** Insoluto + reajuste + interes + gastos: lo que se deberia sin amnistia. */
  readonly total: Importe;
  /** Todo menos el interes, que la amnistia condona entero: lo que se cobra. */
  readonly conAmnistia: Importe;
}

/** Las cifras del paso 2 sobre la deuda viva, y cuantos conceptos hay y cuantos estan vencidos. */
export interface Resumen extends Cuenta {
  readonly conceptos: number;
  readonly vencidas: number;
}

/** El estado que NO cuenta como vencido en el resumen (artboard, linea 1111). */
const POR_VENCER = 'Por vencer';

/** Lo que va en lugar del importe en los pasos de un medio de pago. */
const HUECO_DEL_TOTAL = '{{TOTAL}}';

/** El simbolo que `formatearImporte` antepone y que el paso ya escribe («de S/ {{TOTAL}}»). */
const SIMBOLO = 'S/ ';

/**
 * Lo que el concepto suma entero: insoluto + reajuste + interes + gastos (artboard, linea 1133,
 * mas el reajuste que el servidor si trae).
 */
export function totalDe(deuda: ConSaldo): Importe {
  return sumarImportes([deuda.insoluto, deuda.reajuste ?? NADA, deuda.interes, deuda.gastos]);
}

/**
 * Lo que se cobra de un concepto con la amnistia: todo menos el interes, que se condona entero. Es
 * el «Importe S/» de cada fila del comprobante (artboard, linea 1308).
 *
 * El reajuste **no** se condona: la amnistia perdona el interes moratorio, y el reajuste es lo que
 * el tributo vale hoy.
 */
export function conAmnistiaDe(deuda: ConSaldo): Importe {
  return sumarImportes([deuda.insoluto, deuda.reajuste ?? NADA, deuda.gastos]);
}

/**
 * Lo que se le suma al impuesto por no pagar a tiempo: reajuste + interes + gastos (artboard, linea
 * 1134; el reajuste se le une porque tambien sale de no haber pagado el ano en que tocaba).
 */
export function recargoDe(deuda: ConSaldo): Importe {
  return sumarImportes([deuda.reajuste ?? NADA, deuda.interes, deuda.gastos]);
}

/** La cuenta de los conceptos elegidos (artboard, `cuenta()`, lineas 992-998). */
export function cuentaDe(deudas: readonly ConSaldo[]): Cuenta {
  const insoluto = sumarImportes(deudas.map((deuda) => deuda.insoluto));
  const reajuste = sumarImportes(deudas.map((deuda) => deuda.reajuste ?? NADA));
  const interes = sumarImportes(deudas.map((deuda) => deuda.interes));
  const gastos = sumarImportes(deudas.map((deuda) => deuda.gastos));
  return {
    insoluto,
    reajuste,
    interes,
    gastos,
    total: sumarImportes([insoluto, reajuste, interes, gastos]),
    conAmnistia: sumarImportes([insoluto, reajuste, gastos]),
  };
}

/**
 * El resumen del paso 2 sobre la deuda viva (artboard, `resumen`, lineas 1108-1127): las mismas
 * cifras que `cuentaDe`, mas cuantos conceptos quedan y cuantos no estan «Por vencer», que es lo
 * que escribe «3 de 4 conceptos están vencidos».
 */
export function resumenDe(vivas: readonly ConSaldoYEstado[]): Resumen {
  return {
    ...cuentaDe(vivas),
    conceptos: vivas.length,
    // `null` NO cuenta como vencida: es lo que pasa con los datos del servidor, que no dice el
    // estado de nada (issue 26). Contarla seria afirmar un vencimiento que nadie sabe.
    vencidas: vivas.filter((deuda) => deuda.estado !== null && deuda.estado !== POR_VENCER).length,
  };
}

/**
 * El tono de una situacion, sacado de su propio texto (artboard, `tono()`, lineas 958-965): son
 * las palabras que usa el recibo y no hay mas. Lo que no es «coactiva», «vencida» ni «por vencer»
 * —«Pagada», «Al día»— es `ok`. Se mira en minusculas: la tabla escribe «Por vencer» y el
 * artboard busca «por vencer».
 */
export function tonoDe(texto: string): TonoDeInsignia {
  const minusculas = texto.toLowerCase();
  if (/coactiva|vencida/.test(minusculas)) return 'mal';
  if (/por vencer/.test(minusculas)) return 'atencion';
  return 'ok';
}

/**
 * Los pasos de un medio de pago con el importe puesto donde dice `{{TOTAL}}` (artboard, linea
 * 1025): con separador de miles y dos decimales, y **sin «S/ »**, porque el paso ya lo escribe
 * delante del hueco.
 *
 * Como en el artboard, se sustituye la primera aparicion de cada paso; ningun paso trae dos.
 */
export function pasosConTotal(pasos: readonly string[], importe: Importe): string[] {
  const cifra = cifraSinSimbolo(importe);
  return pasos.map((paso) => paso.replace(HUECO_DEL_TOTAL, cifra));
}

/**
 * Un importe con separador de miles y dos decimales, **sin «S/ »**: `'1854.6'` -> `'1,854.60'`. Para
 * donde el simbolo ya lo dice otro —el paso de un medio de pago, o la columna «Importe S/» del
 * comprobante—. Formatea; no suma ni redondea.
 */
export function cifraSinSimbolo(importe: Importe): string {
  return formatearImporte(importe).replace(SIMBOLO, '');
}
