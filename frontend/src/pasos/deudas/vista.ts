import { type Fecha, type Importe, compararImportes, formatearImporte } from '@kamayuk/formato';
import type { TFunction } from 'i18next';

import { recargoDe } from '../../datos/cuentas.ts';
import { FECHA_DE_CORTE } from '../../datos/constantes.ts';
import { fechaDelImporte, quienDebeDe } from '../../datos/deLaSituacion.ts';
import type { Contribuyente, Deuda, DeudaDelServidor, SituacionDelServidor } from '../../datos/tipos.ts';
import {
  type EstadoDelRecorrido,
  cuenta,
  resumen,
  seleccion,
  vivas,
} from '../../recorrido/recorrido.ts';
import { fechaEnPalabras } from './fechaEnPalabras.ts';

/**
 * **Lo que el paso 2 dibuja, preparado sin React** (issue 60).
 *
 * El modelo de vista de «Elegir qué pago», en sus dos modos: funciones puras del estado del recorrido
 * (o de lo que contesto el servidor) y de `t`, que devuelven los textos ya dichos y las cifras ya
 * elegidas. Las pantallas (`Deudas.tsx`, `LaConsulta.tsx` y sus piezas) solo los colocan. Se prueban
 * solas, en `vista.test.ts`, sin montar nada.
 *
 * **Ninguna cifra se calcula aqui**: las cuentas son las de `src/datos/cuentas.ts` y el reductor
 * (`resumen`, `cuenta`, `recargoDe`); aqui solo se PREGUNTA si un importe es mayor que cero, para
 * decidir si se dice «incluye … de recargo» o el ahorro de la amnistia.
 */

const CERO: Importe = '0.00';

/** Si un importe es mayor que cero. Lo unico que se le pregunta a una cifra en esta pantalla. */
export const hay = (importe: Importe): boolean => compararImportes(importe, CERO) > 0;

// ── Quien es ───────────────────────────────────────────────────────────────────────────────────

/** Quien es, para que no pague la deuda de otro: el nombre y la linea de debajo. */
export interface QuienEsDicho {
  readonly nombre: string;
  /** El codigo y el documento; `null` si el servidor no dijo ni codigo ni documento. */
  readonly linea: string | null;
}

/** El contribuyente de la demostracion, con su codigo, su documento y cuantos predios y vehiculos tiene. */
export function quienEsDeLaDemostracion(contribuyente: Contribuyente, t: TFunction): QuienEsDicho {
  const { nombre, codigo, tipoDeDocumento, numeroDeDocumento, predios, vehiculos } = contribuyente;
  return {
    nombre,
    linea: t('Código {{codigo}} · {{tipoDeDocumento}} {{numeroDeDocumento}} · {{predios}} y {{vehiculos}}', {
      codigo,
      tipoDeDocumento,
      numeroDeDocumento,
      predios: t('{{count}} predio', { count: predios }),
      vehiculos: t('{{count}} vehículo', { count: vehiculos }),
    }),
  };
}

/** Quien es, segun el servidor: lo poco que el contrato deja decir, y ni una linea mas. */
export function quienEsDelServidor(situacion: SituacionDelServidor, t: TFunction): QuienEsDicho {
  const quien = quienDebeDe(situacion);
  return {
    nombre: quien.nombre,
    linea:
      quien.codigo === null
        ? quien.documento
        : t('Código {{codigo}} · {{documento}}', { codigo: quien.codigo, documento: quien.documento }),
  };
}

// ── La barra de pago ───────────────────────────────────────────────────────────────────────────

/** Lo que dice la barra de pago (artboard, lineas 284-299), en los dos modos. */
export interface LaBarraDePago {
  /** «No ha marcado ningún concepto», «Va a pagar los N conceptos» o «Va a pagar N concepto de M». */
  readonly detalle: string;
  readonly total: Importe;
  /** La linea verde del ahorro, o `null` si no hay amnistia o no hay interes que condonar. */
  readonly amnistia: string | null;
  /** Sin nada marcado: el boton se pinta apagado y la ayuda sale debajo. */
  readonly vacio: boolean;
  /** «Pagar todo» o «Pagar lo marcado». */
  readonly rotulo: string;
}

/**
 * **La barra de pago, una sola para los dos modos** (issue 60).
 *
 * Hasta el issue 60 habia dos, y ya decian cosas distintas: la de la demostracion ensenaba el ahorro
 * si habia interes (`hay(lo.interes)`), la del servidor si la fuente aportaba una amnistia
 * (`estado.amnistia`, issue 49). Son las dos mitades de la misma pregunta —¿hay algo que condonar?—,
 * y ahora se hacen las dos: sin amnistia no hay ahorro que prometer, y sin interes no hay nada que
 * descontar. En los dos modos de hoy dice lo mismo que antes; el dia que la plataforma traiga una
 * amnistia, la linea saldra solo si ahorra algo.
 *
 * La deuda viva es `vivas`: en demostracion son los conceptos del artboard y con plataforma los del
 * servidor, asi que contarla no necesita saber cual es.
 */
export function laBarraDePago(estado: EstadoDelRecorrido, t: TFunction): LaBarraDePago {
  const viva = vivas(estado).length;
  const marcadas = seleccion(estado).length;
  const lo = cuenta(estado);
  const vacio = marcadas === 0;
  const todo = marcadas === viva;

  let detalle: string;
  if (vacio) detalle = t('No ha marcado ningún concepto');
  else if (todo) detalle = t('Va a pagar los {{count}} conceptos', { count: viva });
  else detalle = t('Va a pagar {{count}} concepto de {{total}}', { count: marcadas, total: viva });

  return {
    detalle,
    total: lo.total,
    amnistia:
      estado.amnistia && hay(lo.interes)
        ? t('Con la amnistía paga {{conAmnistia}}: se descuentan {{interes}} de interés', {
            conAmnistia: formatearImporte(lo.conAmnistia),
            interes: formatearImporte(lo.interes),
          })
        : null,
    vacio,
    rotulo: todo ? t('Pagar todo') : t('Pagar lo marcado'),
  };
}

/** Si esta todo marcado: «Quitar todo» en vez de «Marcar todo». */
export function estaTodoMarcado(estado: EstadoDelRecorrido): boolean {
  return seleccion(estado).length === vivas(estado).length;
}

// ── El total de la demostracion ────────────────────────────────────────────────────────────────

/** Una de las cuatro cifras bajo el total (artboard, lineas 210-218). */
export interface UnaDeLasCuatro {
  readonly rotulo: string;
  readonly nota: string;
  /** Un importe, o el numero de conceptos. */
  readonly valor: { readonly importe: Importe; readonly verde: boolean } | { readonly cuantos: number };
}

/** El total, lo que queda con la amnistia, y las cuatro cifras que lo componen (lineas 197-218). */
export interface ElTotalDicho {
  /** «Deuda total al 13 de setiembre de 2026»: la fecha de todas las cifras de la pantalla. */
  readonly alDia: string;
  readonly total: Importe;
  readonly conAmnistia: Importe;
  readonly vencidas: string;
  readonly descuento: string;
  readonly cuatro: readonly UnaDeLasCuatro[];
}

export function elTotal(estado: EstadoDelRecorrido, t: TFunction): ElTotalDicho {
  const cifras = resumen(estado);
  return {
    // La de `@kamayuk/formato` dice «septiembre» y sin año: ver `fechaEnPalabras.ts`.
    alDia: t('Deuda total al {{fecha}}', { fecha: fechaEnPalabras(FECHA_DE_CORTE) }),
    total: cifras.total,
    conAmnistia: cifras.conAmnistia,
    vencidas: t('{{count}} de {{conceptos}} conceptos están vencidos. El interés corre cada día que pasa.', {
      count: cifras.vencidas,
      conceptos: cifras.conceptos,
    }),
    descuento: t('se descuenta {{importe}} de interés', { importe: formatearImporte(cifras.interes) }),
    cuatro: [
      {
        rotulo: t('Impuesto y arbitrios'),
        valor: { importe: cifras.insoluto, verde: false },
        nota: t('Lo que no se condona'),
      },
      {
        rotulo: t('Interés moratorio'),
        valor: { importe: cifras.interes, verde: true },
        nota: t('La amnistía lo condona entero'),
      },
      {
        rotulo: t('Gastos y costas'),
        valor: { importe: cifras.gastos, verde: false },
        nota: t('Emisión y cobranza coactiva'),
      },
      { rotulo: t('Conceptos'), valor: { cuantos: cifras.conceptos }, nota: t('Predial, arbitrios y vehicular') },
    ],
  };
}

// ── Un concepto ────────────────────────────────────────────────────────────────────────────────

/** «incluye S/ … de recargo» bajo el total de un concepto del artboard, o `null` si no lleva recargo. */
export function notaDelRecargo(deuda: Deuda, t: TFunction): string | null {
  const recargo = recargoDe(deuda);
  return hay(recargo) ? t('incluye {{importe}} de recargo', { importe: formatearImporte(recargo) }) : null;
}

/** Un componente del saldo de un concepto del servidor, con la fecha que el servidor le puso. */
export interface ComponenteDelSaldo {
  readonly rotulo: string;
  readonly valor: Importe;
  readonly fecha: Fecha;
}

/**
 * Los cuatro componentes del saldo de un concepto del servidor. Cada uno con **su** fecha
 * (`fechaDelImporte`): el contrato permite que difieran y aplanarlas seria decidir por el servidor.
 */
export function componentesDelSaldo(deuda: DeudaDelServidor, t: TFunction): readonly ComponenteDelSaldo[] {
  return [
    { rotulo: t('Impuesto y arbitrios'), valor: deuda.insoluto, fecha: fechaDelImporte(deuda, 'insoluto') },
    { rotulo: t('Reajuste'), valor: deuda.reajuste, fecha: fechaDelImporte(deuda, 'reajuste') },
    { rotulo: t('Interés moratorio'), valor: deuda.interes, fecha: fechaDelImporte(deuda, 'interes') },
    { rotulo: t('Gastos y costas'), valor: deuda.gastos, fecha: fechaDelImporte(deuda, 'gastos') },
  ];
}
