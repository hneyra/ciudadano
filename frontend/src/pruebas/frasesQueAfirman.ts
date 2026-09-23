/**
 * **Las frases que, con plataforma, afirman un hecho que NO ocurrio** (revision del issue 28 e
 * issue 49).
 *
 * Son textos del artboard, y en DEMOSTRACION describen la ficcion entera y se quedan tal cual. Con
 * plataforma cada una es una afirmacion falsa sobre la deuda de una persona de verdad: no hubo cobro,
 * no se envio ningun comprobante, no hay operacion que numerar, no hay amnistia en el contrato, no hay
 * constancia que emitir, y una consulta que no contesto no es un «Al día». Un aviso al lado no arregla
 * una afirmacion falsa en el cuerpo: quien la lee se va creyendo lo que dice.
 *
 * <h2>Una lista, en un solo sitio</h2>
 *
 * La leen dos pruebas: `src/pasos/pagar/Pagar.plataforma.test.tsx` (los pasos 4 y 5, en los dos
 * sentidos) y `src/afirmaciones.plataforma.test.tsx`, la guarda **por modo**, que recorre cada paso
 * alcanzable con plataforma en cada final de la consulta y mira el documento ENTERO, marco incluido.
 * Hasta el issue 49 la lista vivia dentro de la primera, y se vigilaba pantalla por pantalla: por eso
 * se escaparon el «Al día» de «Mis pagos», la amnistia de la barra de pago y la frase del pie.
 *
 * Se buscan **por texto y no por clave**: lo que importa es lo que llega a la pantalla.
 *
 * `pantalla` dice en que pantalla de la DEMOSTRACION sale la frase, que es donde la busca el otro
 * sentido de `Pagar.plataforma.test.tsx` (solo las de `pagar` y `comprobante`).
 */

export type PantallaDeLaFrase = 'entrar' | 'deudas' | 'pagar' | 'comprobante' | 'historial' | 'marco';

export interface FraseQueAfirma {
  readonly texto: string | RegExp;
  /** Donde la dice el artboard, para que el rojo diga a donde mirar. */
  readonly donde: string;
  readonly pantalla: PantallaDeLaFrase;
}

export const FRASES_QUE_AFIRMAN: readonly FraseQueAfirma[] = [
  // ── Pagar y el comprobante (revision del issue 28) ────────────────────────────────────────────
  { texto: /Pagó S\/ [\d,.]+ con \w+\./, donde: 'la banda de exito del paso 5', pantalla: 'comprobante' },
  { texto: 'La deuda pagada ya se descontó de su cuenta.', donde: 'la banda de exito del paso 5', pantalla: 'comprobante' },
  { texto: /Le enviamos el comprobante a /, donde: 'la banda de exito del paso 5 y el aviso del 4', pantalla: 'comprobante' },
  { texto: 'Constancia de pago', donde: 'la cabecera del recibo', pantalla: 'comprobante' },
  { texto: 'Número de operación', donde: 'la meta del recibo', pantalla: 'comprobante' },
  { texto: 'Enviado a', donde: 'la meta del recibo', pantalla: 'comprobante' },
  { texto: 'Total pagado', donde: 'el pie de la tabla del recibo', pantalla: 'comprobante' },
  { texto: /Esta constancia acredita el pago/, donde: 'el cierre del recibo', pantalla: 'comprobante' },
  { texto: /El comprobante se enviará a /, donde: 'el resumen del paso 4', pantalla: 'pagar' },
  { texto: 'Pago registrado. Le enviamos el comprobante a su correo.', donde: 'el aviso al confirmar', pantalla: 'comprobante' },
  { texto: 'Descargar comprobante', donde: 'las acciones del paso 5', pantalla: 'comprobante' },
  // Y las del selector de medios, que no son frases sino DATOS ACCIONABLES: un numero de telefono
  // al que alguien puede yapear de verdad, y un codigo de pago «valido por 72 horas».
  { texto: '969 032 194', donde: 'el numero para yapear del paso 4', pantalla: 'pagar' },
  { texto: '2026-0025673-4418', donde: 'el codigo de pago del banco del paso 4', pantalla: 'pagar' },
  {
    texto: /El pago se aplica al instante y el comprobante se emite de inmediato/,
    donde: 'el panel de la tarjeta',
    pantalla: 'pagar',
  },

  // ── La amnistia: el contrato de `GET /portal/situacion` no trae ninguna (issue 49, caso 2) ────
  // Insensible a mayusculas: «Amnistía vigente…» de la portada y «Con la amnistía paga…» de la barra.
  { texto: /amnist[ií]a/i, donde: 'la barra de pago del paso 2, la portada y las cifras', pantalla: 'deudas' },
  { texto: /Interés condonado/, donde: 'el resumen del paso 4 y el pie del recibo', pantalla: 'pagar' },

  // ── «Mis pagos» (issue 49, casos 1 y 5) ───────────────────────────────────────────────────────
  // Sin « al »: «Sin deuda pendiente al 16/09/2026» es la frase que redacta el SERVIDOR para una
  // municipalidad que de verdad no tiene saldo, y esa se ensena tal cual.
  { texto: /Sin deuda pendiente(?! al )/, donde: 'la cifra de «Lo que queda pendiente»', pantalla: 'historial' },
  { texto: 'Al día', donde: 'la insignia de «Lo que queda pendiente»', pantalla: 'historial' },
  { texto: /constancia de no adeudo/i, donde: '«Mis pagos» y el paso 2 sin deuda', pantalla: 'historial' },
  { texto: 'Todos sus pagos, con sus comprobantes', donde: 'la entrada de «Mis pagos»', pantalla: 'historial' },
  { texto: /registrado hoy/, donde: 'la banda del pago reciente de «Mis pagos»', pantalla: 'historial' },
  { texto: 'Pagó todos sus conceptos', donde: 'el paso 2 sin deuda', pantalla: 'deudas' },

  // ── La portada (issue 49, caso 5) ─────────────────────────────────────────────────────────────
  { texto: 'Pagar en línea', donde: '«Qué puede hacer aquí»', pantalla: 'entrar' },
  { texto: /Con tarjeta, Yape/, donde: '«Qué puede hacer aquí»', pantalla: 'entrar' },
  { texto: /con el vencimiento de cada cuota/, donde: '«Qué puede hacer aquí»', pantalla: 'entrar' },
  { texto: /podrá pagar/, donde: 'la entrada del paso 1', pantalla: 'entrar' },

  // ── El marco (issue 49, casos 3 y 4) ──────────────────────────────────────────────────────────
  { texto: 'Los datos de esta pantalla son de demostración.', donde: 'el pie', pantalla: 'marco' },
  { texto: 'Abriría el cambio de clave.', donde: '«Cambiar mi clave» del menu de la barra', pantalla: 'marco' },
];

/** Si `texto` dice la frase. */
export function laDice(texto: string, frase: FraseQueAfirma): boolean {
  return typeof frase.texto === 'string' ? texto.includes(frase.texto) : frase.texto.test(texto);
}

/** Como se nombra una frase en un rojo: su texto y donde la dice el artboard. */
export function nombreDe(frase: FraseQueAfirma): string {
  return `«${String(frase.texto)}» (${frase.donde})`;
}
