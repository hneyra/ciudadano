import { type Tono, formatearFecha, formatearImporte } from '@kamayuk/formato';
import type { TFunction } from 'i18next';

import { cifraSinSimbolo, totalDe } from '../../datos/cuentas.ts';
import type { PagoDelHistorial, SituacionDelServidor } from '../../datos/tipos.ts';
import {
  type EstadoDelRecorrido,
  type PagoSellado,
  aCobrar,
  cuentaPendiente,
  esSimulado,
  pendientes,
} from '../../recorrido/recorrido.ts';
import { selloDeLaDemostracion } from '../comprobante/sello.ts';

/**
 * **Lo que «Mis pagos» dibuja, preparado sin React** (issue 60).
 *
 * El modelo de vista del historial: funciones puras del estado del recorrido, de lo que contestaron la
 * fuente y la consulta, y de `t`. Las secciones (`PagoReciente.tsx`, `PagosRealizados.tsx`,
 * `LoQueQuedaPendiente.tsx`, `DeDondeSale.tsx`) solo colocan lo que devuelven. Se prueban solas en
 * `vista.test.ts`.
 *
 * **Ninguna cifra se calcula aqui**: el total pendiente es `cuentaPendiente(estado).total` (de
 * `cuentaDe`) y el de cada concepto `totalDe`, los dos de `src/datos/cuentas.ts`; la columna «Importe
 * S/» es `cifraSinSimbolo`. Lo mide `Historial.cuentas.test.tsx` sustituyendo las cuentas por otras.
 */

// ── El pago de esta visita ─────────────────────────────────────────────────────────────────────

/** La banda de arriba (artboard, lineas 573-581 y 1330-1335). */
export interface PagoRecienteDicho {
  /** Un pago simulado no tiene numeros, ni medio, ni destino: sin verde y diciendo lo que es. */
  readonly simulado: boolean;
  readonly titulo: string;
  readonly detalle: string;
  readonly boton: string;
}

/**
 * **Con el pago simulado no se dice que se pago** (issue 28, revision): no hubo cobro, no hay operacion
 * que numerar y no se envio nada. Una sola pregunta, al pago (issue 59): el registrado va junto con su
 * sello, los dos existen o ninguno.
 */
export function pagoReciente(estado: EstadoDelRecorrido, pago: PagoSellado, t: TFunction): PagoRecienteDicho {
  const importe = formatearImporte(aCobrar(estado, pago));
  if (esSimulado(pago)) {
    return {
      simulado: true,
      titulo: t('Pago simulado de {{importe}} en esta visita', { importe }),
      detalle: t('No se cobró nada, no se envió ningún comprobante y su deuda sigue pendiente.'),
      boton: t('Ver cómo se vería'),
    };
  }
  const sello = selloDeLaDemostracion(estado, pago);
  return {
    simulado: false,
    titulo: t('Pago de {{importe}} registrado hoy', { importe }),
    detalle: t('Operación {{operacion}} · {{medio}} · comprobante {{numero}}, enviado a {{destino}}', {
      operacion: sello.comprobante.operacion,
      medio: t(sello.medio),
      numero: sello.comprobante.numero,
      destino: pago.destino ?? t('su correo'),
    }),
    boton: t('Ver el comprobante'),
  };
}

// ── Pagos realizados ───────────────────────────────────────────────────────────────────────────

/** Una fila de la tabla de pagos, ya dicha: fecha, concepto, medio, comprobante e importe. */
export interface FilaDePago {
  readonly fecha: string;
  readonly concepto: string;
  readonly medio: string;
  readonly comprobante: string;
  readonly importe: string;
  readonly reciente: boolean;
}

/**
 * «Pagos realizados» (lineas 583-611 y 1337-1348): el reciente, si lo hay, y los del historial.
 *
 * **Un pago simulado NO entra**: esa tabla es la lista de lo que se pago, y ahi no se pago nada (issue
 * 28, revision). Lo de esta visita lo dice la banda de arriba, que ademas dice que es simulado. Se
 * pregunta al pago, no al modo (issue 59). El reciente sale SOLO de `ultimo`, y solo si
 * `recienPagado`: sus conceptos, su importe, su medio y los numeros del comprobante.
 */
export function filasDePagos(
  estado: EstadoDelRecorrido,
  anteriores: readonly PagoDelHistorial[] | undefined,
  t: TFunction,
): readonly FilaDePago[] {
  const ultimo = estado.recienPagado ? estado.ultimo : null;
  const reciente: FilaDePago[] =
    ultimo === null || esSimulado(ultimo)
      ? []
      : [
          {
            fecha: formatearFecha(ultimo.comprobante.fecha),
            concepto: ultimo.conceptos.map((deuda) => deuda.concepto).join(' · '),
            medio: t(selloDeLaDemostracion(estado, ultimo).medio),
            comprobante: ultimo.comprobante.numero,
            importe: cifraSinSimbolo(aCobrar(estado, ultimo)),
            reciente: true,
          },
        ];
  return [
    ...reciente,
    ...(anteriores ?? []).map((anterior) => ({
      fecha: formatearFecha(anterior.fecha),
      concepto: t(anterior.concepto),
      medio: t(anterior.medio),
      comprobante: anterior.comprobante,
      importe: cifraSinSimbolo(anterior.importe),
      reciente: false,
    })),
  ];
}

// ── Lo que queda pendiente ─────────────────────────────────────────────────────────────────────

/** Una fila de lo pendiente (lineas 619-627). */
export interface FilaPendienteDicha {
  readonly id: string;
  readonly concepto: string;
  /** Lo que se dice bajo el concepto: el vencimiento, o la unidad cuando nadie lo sabe (issue 26). */
  readonly vence: string;
  /** La situacion del concepto, o `null` cuando nadie la sabe (issue 26). */
  readonly insignia: { readonly tono: Tono; readonly texto: string } | null;
  readonly monto: string;
}

/** «Lo que queda pendiente», con la deuda viva del recorrido (lineas 613-640 y 1349-1371). */
export interface LoPendienteDicho {
  /** El total, o «Sin deuda pendiente». */
  readonly cifra: string;
  /** Si queda algo: el pie ofrece pagarlo; si no, la constancia. */
  readonly hay: boolean;
  readonly filas: readonly FilaPendienteDicha[];
}

/**
 * Lo pendiente en demostracion: la deuda viva, o la constancia si no queda nada. Sin vencimiento ni
 * estado (un concepto del servidor), en su sitio va la unidad y la insignia no se dibuja: no se deducen.
 */
export function loPendiente(estado: EstadoDelRecorrido, t: TFunction): LoPendienteDicho {
  const lista = pendientes(estado);
  const { total } = cuentaPendiente(estado);
  if (lista.length === 0) {
    return {
      cifra: t('Sin deuda pendiente'),
      hay: false,
      filas: [
        {
          id: 'al-dia',
          concepto: t('No le queda nada pendiente'),
          vence: t('Puede pedir su constancia de no adeudo'),
          insignia: { tono: 'ok', texto: t('Al día') },
          monto: formatearImporte(total),
        },
      ],
    };
  }
  return {
    cifra: formatearImporte(total),
    hay: true,
    filas: lista.map((deuda) => ({
      id: deuda.id,
      concepto: deuda.concepto,
      vence: deuda.vence ?? t(deuda.unidad),
      insignia: deuda.estado === null || deuda.tono === null ? null : { tono: deuda.tono, texto: deuda.estado },
      monto: formatearImporte(totalDe(deuda)),
    })),
  };
}

/** Lo que dice la consulta en «Lo que queda pendiente» con plataforma. */
export interface LoQueDiceLaConsulta {
  readonly cifra: string;
  /** Lo que se dice debajo, o `null` si lo dicen las filas. */
  readonly dicho: string | null;
  /** Si se ofrece volver a preguntar. */
  readonly reintentar: boolean;
  readonly filas: readonly FilaPendienteDicha[];
}

/**
 * **Lo que dijo la CONSULTA, y nada que no dijera** (issue 49). Cada final dice lo suyo:
 *
 *   · **con deuda**: los conceptos del servidor y el total que sumo el servidor, tal cual;
 *   · **no se pudo consultar**, o la consulta **no contesto**: que no se pudo, sin cifra, y reintentar;
 *   · **sin registros**: que no figura nada a su nombre;
 *   · **sin deuda**: que no tiene deuda pendiente, que es lo que el servidor dijo. Sin «Al día» ni
 *     constancia: el portal no emite ninguna.
 */
export function loQueDiceLaConsulta(
  consulta: { readonly pidiendo: boolean; readonly situacion: SituacionDelServidor | undefined },
  t: TFunction,
): LoQueDiceLaConsulta {
  const { pidiendo, situacion } = consulta;
  const nada = { dicho: null, reintentar: false, filas: [] };
  if (pidiendo) return { ...nada, cifra: t('Consultando…') };
  if (situacion === undefined) {
    return {
      ...nada,
      cifra: t('Sin total'),
      dicho: t('No pudimos consultar su deuda. Vuelva a intentarlo en unos minutos.'),
      reintentar: true,
    };
  }
  switch (situacion.estado) {
    case 'con-deuda':
      return {
        ...nada,
        cifra: situacion.totalConsolidado === null ? '' : formatearImporte(situacion.totalConsolidado.importe),
        // El contrato no trae vencimiento ni estado (issue 26): va la unidad, y sin insignia.
        filas: situacion.deudas.map((deuda) => ({
          id: deuda.id,
          concepto: deuda.concepto,
          vence: t(deuda.unidad),
          insignia: null,
          monto: formatearImporte(totalDe(deuda)),
        })),
      };
    case 'no-se-pudo-consultar':
      return {
        ...nada,
        cifra: t('Sin total'),
        dicho: t('No pudimos consultar toda su deuda, así que no le mostramos ningún total.'),
        reintentar: true,
      };
    case 'sin-registros':
      return {
        ...nada,
        cifra: t('Sin registros'),
        dicho: t('No encontramos deuda a su nombre en las municipalidades del sistema.'),
      };
    case 'sin-deuda':
      return {
        ...nada,
        cifra: t('Nada pendiente'),
        dicho: t('Según la consulta de hoy, no tiene deuda pendiente en las municipalidades del sistema.'),
      };
  }
}
