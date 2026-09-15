import type { Fecha } from '@kamayuk/formato';

/**
 * **La fecha de corte en palabras, como la escribe el artboard**: «13 de setiembre de 2026»
 * (`diseno/Ciudadano.dc.html`, lineas 199 y 1043).
 *
 * <h2>Por que no es `formatearFechaEnPalabras` de `@kamayuk/formato`</h2>
 *
 * Se miro primero. Devuelve «13 de septiembre»: **sin año y con «septiembre»**. El texto del
 * artboard es definitivo y lleva las dos cosas —el año, porque la deuda se lee a una fecha y no a
 * un dia de cualquier año; y «setiembre», que es la forma que se usa en el Peru—. La nota del
 * revisor del issue 6 lo pide asi y sin tocar `kamayuk-lib`, que es de donde saldria el arreglo
 * para todo el producto. Hasta entonces, esta funcion pequena.
 *
 * <h2>Lo que comparte con la de la libreria</h2>
 *
 * Sin `Date` y sin `Intl`, por el mismo motivo que alli: `new Date('2026-09-13')` se interpreta en
 * UTC y se imprime en local, y en Lima sale el 12. Una tabla de doce nombres no tiene ese problema.
 * Y como alli, **la fecha no se traduce**: lo que pasa por `t()` es la frase que la envuelve
 * («Deuda total al {{fecha}}»).
 */

/** Los doce meses, con «setiembre», que es la forma del artboard. */
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** ISO 8601 sin hora, la forma de `Fecha`. */
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function fechaEnPalabras(fecha: Fecha): string {
  const partes = ISO.exec(fecha.trim());
  if (partes === null) {
    throw new Error(`Fecha con una forma que el portal no sabe leer: «${fecha}». Se espera «2026-09-13».`);
  }
  const [, anio = '', mes = '', dia = ''] = partes;
  const nombre = MESES[Number.parseInt(mes, 10) - 1];
  if (nombre === undefined) {
    throw new Error(`Fecha con un mes que no existe: «${fecha}».`);
  }
  // Sin el cero de la izquierda en el dia: «3 de marzo», no «03 de marzo».
  return `${String(Number.parseInt(dia, 10))} de ${nombre} de ${anio}`;
}
