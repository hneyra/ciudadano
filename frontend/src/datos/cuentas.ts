import type { Importe } from '@kamayuk/formato';
import { formatearImporte, sumarImportes } from '@kamayuk/formato';

import type { Deuda, TonoDeInsignia } from './tipos.ts';

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
 */

/** Lo elegido para pagar, con sus tres componentes separados y los dos totales. */
export interface Cuenta {
  readonly insoluto: Importe;
  readonly interes: Importe;
  readonly gastos: Importe;
  /** Insoluto + interes + gastos: lo que se deberia sin amnistia. */
  readonly total: Importe;
  /** Insoluto + gastos: lo que se cobra, porque la amnistia condona el interes entero. */
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

/** Lo que el concepto suma entero: insoluto + interes + gastos (artboard, linea 1133). */
export function totalDe(deuda: Deuda): Importe {
  return sumarImportes([deuda.insoluto, deuda.interes, deuda.gastos]);
}

/**
 * Lo que se cobra de un concepto con la amnistia: insoluto + gastos, porque el interes se condona
 * entero. Es el «Importe S/» de cada fila del comprobante (artboard, linea 1308).
 */
export function conAmnistiaDe(deuda: Deuda): Importe {
  return sumarImportes([deuda.insoluto, deuda.gastos]);
}

/** Lo que se le suma al impuesto por no pagar a tiempo: interes + gastos (artboard, linea 1134). */
export function recargoDe(deuda: Deuda): Importe {
  return sumarImportes([deuda.interes, deuda.gastos]);
}

/** La cuenta de los conceptos elegidos (artboard, `cuenta()`, lineas 992-998). */
export function cuentaDe(deudas: readonly Deuda[]): Cuenta {
  const insoluto = sumarImportes(deudas.map((deuda) => deuda.insoluto));
  const interes = sumarImportes(deudas.map((deuda) => deuda.interes));
  const gastos = sumarImportes(deudas.map((deuda) => deuda.gastos));
  return {
    insoluto,
    interes,
    gastos,
    total: sumarImportes([insoluto, interes, gastos]),
    conAmnistia: sumarImportes([insoluto, gastos]),
  };
}

/**
 * El resumen del paso 2 sobre la deuda viva (artboard, `resumen`, lineas 1108-1127): las mismas
 * cifras que `cuentaDe`, mas cuantos conceptos quedan y cuantos no estan «Por vencer», que es lo
 * que escribe «3 de 4 conceptos están vencidos».
 */
export function resumenDe(vivas: readonly Deuda[]): Resumen {
  return {
    ...cuentaDe(vivas),
    conceptos: vivas.length,
    vencidas: vivas.filter((deuda) => deuda.estado !== POR_VENCER).length,
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
