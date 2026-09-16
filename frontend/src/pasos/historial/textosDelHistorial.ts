import { HISTORIAL, UNIDADES } from '../../datos/demostracion.ts';
import type { PagoDelHistorial, Unidad } from '../../datos/tipos.ts';

/**
 * **Lo que dicen los pagos y las unidades del historial, y por eso se traduce**, sacado del dato
 * (issue 10). Es el mismo mecanismo que `src/pasos/pagar/textosDeLosMedios.ts` (issue 8).
 *
 * Los textos viven en `HISTORIAL` y `UNIDADES` (`src/datos/demostracion.ts`, copia literal del
 * artboard) y la pantalla los pasa por `t()` con una variable. `i18next-cli` no sigue variables, asi que
 * el inventario del locale no los escribe a mano: los DERIVA de aqui. Y la pantalla no traduce otra
 * lista: `Historial.test.tsx` recorre la pagina en el idioma `marcado` y exige que CADA texto de estas
 * funciones llegue marcado al DOM, y que nada fuera del dato llegue sin marcar.
 *
 * <h2>Lo que NO se traduce, y por que</h2>
 *
 * · `fecha`, `comprobante` e `importe` de un pago: son dato con su forma (`13/09/2026`, `0003-0041182`,
 *   `294.84`), como los numeros del sello en el comprobante.
 * · `base` de una unidad: un importe, que dice `formatearImporte`.
 */
export function textosDelPago(pago: PagoDelHistorial): readonly string[] {
  return [pago.concepto, pago.medio];
}

/** Lo que dice una unidad: su titulo, su detalle, de que es la base, sus datos y de donde salen. */
export function textosDeLaUnidad(unidad: Unidad): readonly string[] {
  return [unidad.titulo, unidad.detalle, unidad.baseEtiqueta, ...unidad.datos, unidad.origen];
}

/** Todas las claves de los pagos y las unidades, sin repetidos. Las lee `el-locale-esta-completo.test.ts`. */
export function clavesDelHistorial(): readonly string[] {
  return [...new Set([...HISTORIAL.flatMap(textosDelPago), ...UNIDADES.flatMap(textosDeLaUnidad)])];
}
