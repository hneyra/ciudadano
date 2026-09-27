import { beforeAll, describe, expect, it } from 'vitest';

import { HISTORIAL } from '../../datos/demostracion.ts';
import { LA_DEMOSTRACION } from '../../datos/fuenteDeDemostracion.ts';
import type { DeudaDelServidor, SituacionDelServidor } from '../../datos/tipos.ts';
import i18n, { IDIOMA_POR_OMISION } from '../../i18n/i18n.ts';
import { CON_PLATAFORMA, enDemostracion } from '../../modo/modo.ts';
import { type EstadoDelRecorrido, estadoInicial, recorrido } from '../../recorrido/recorrido.ts';
import { filasDePagos, loPendiente, loQueDiceLaConsulta, pagoReciente } from './vista.ts';

/**
 * **El modelo de vista de «Mis pagos», sin montar nada** (issue 60). Las cifras, a mano: las del
 * artboard (`recorrido.test.ts`).
 */

const t = i18n.t.bind(i18n);

beforeAll(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

const BUSCADO = recorrido(
  estadoInicial({ en: enDemostracion(LA_DEMOSTRACION), autenticado: false, amnistia: true }),
  { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' },
);
/** Pagados los cuatro conceptos, con tarjeta: el pago registrado de la demostracion. */
const PAGADO = recorrido({ ...BUSCADO, paso: 'pagar' }, { tipo: 'confirmarPago' });

const PREDIAL: DeudaDelServidor = {
  id: 'predial-2024',
  concepto: 'Impuesto predial 2024',
  unidad: 'Sin detalle del predio',
  insoluto: '1500.00',
  reajuste: '42.60',
  interes: '200.00',
  gastos: '100.00',
  actualizadoA: { insoluto: '2026-09-16', reajuste: '2026-09-16', interes: '2026-09-16', gastos: '2026-09-16' },
  totalDelServidor: '1842.60',
  tributo: 'PREDIAL',
  ejercicio: 2024,
  cuotas: null,
  vence: null,
  estado: null,
  tono: null,
  detalle: null,
};

/** Con plataforma y el pago simulado: la deuda sigue viva. */
const SIMULADO: EstadoDelRecorrido = recorrido(
  { ...estadoInicial({ en: CON_PLATAFORMA, autenticado: true, amnistia: false }), deudas: [PREDIAL], paso: 'pagar' },
  { tipo: 'confirmarPago' },
);

describe('el pago de esta visita', () => {
  it('registrado: en verde, con sus numeros, su medio y a donde se envio', () => {
    const { ultimo } = PAGADO;
    expect(ultimo === null ? null : pagoReciente(PAGADO, ultimo, t)).toEqual({
      simulado: false,
      titulo: 'Pago de S/ 3,149.92 registrado hoy',
      detalle: 'Operación 86 4418 2026 0913 · Tarjeta · comprobante 0003-0041418, enviado a su correo',
      boton: 'Ver el comprobante',
    });
  });

  it('simulado: dice que no se cobro, sin numeros ni destino', () => {
    const { ultimo } = SIMULADO;
    expect(ultimo === null ? null : pagoReciente(SIMULADO, ultimo, t)).toEqual({
      simulado: true,
      titulo: 'Pago simulado de S/ 1,842.60 en esta visita',
      detalle: 'No se cobró nada, no se envió ningún comprobante y su deuda sigue pendiente.',
      boton: 'Ver cómo se vería',
    });
  });
});

describe('pagos realizados', () => {
  it('el reciente primero, con sus conceptos juntos, y luego los anteriores', () => {
    const filas = filasDePagos(PAGADO, HISTORIAL, t);
    expect(filas).toHaveLength(HISTORIAL.length + 1);
    expect(filas[0]).toEqual({
      fecha: '13/09/2026',
      concepto: 'Impuesto predial 2026 · Arbitrios municipales 2026 · Impuesto predial 2024 · Impuesto vehicular 2024',
      medio: 'Tarjeta',
      comprobante: '0003-0041418',
      importe: '3,149.92',
      reciente: true,
    });
    expect(filas[1]).toEqual({
      fecha: '12/08/2026',
      concepto: 'Impuesto predial 2026 — cuotas 1 y 2',
      medio: 'Tarjeta',
      comprobante: '0003-0041182',
      importe: '294.84',
      reciente: false,
    });
  });

  it('un pago simulado NO entra en la tabla de lo pagado', () => {
    expect(filasDePagos(SIMULADO, undefined, t)).toEqual([]);
  });
});

describe('lo que queda pendiente', () => {
  it('pagado todo: «Sin deuda pendiente» y la fila de «Al día»', () => {
    expect(loPendiente(PAGADO, t)).toEqual({
      cifra: 'Sin deuda pendiente',
      hay: false,
      filas: [
        {
          id: 'al-dia',
          concepto: 'No le queda nada pendiente',
          vence: 'Puede pedir su constancia de no adeudo',
          insignia: { tono: 'ok', texto: 'Al día' },
          monto: 'S/ 0.00',
        },
      ],
    });
  });

  it('con deuda viva: cada concepto con su vencimiento y su insignia, y el total', () => {
    const lo = loPendiente(BUSCADO, t);
    expect(lo.cifra).toBe('S/ 3,563.24');
    expect(lo.filas.map((fila) => [fila.id, fila.insignia?.texto ?? null, fila.monto])).toEqual([
      ['pred26', 'Por vencer', 'S/ 293.72'],
      ['arb26', 'Vencida', 'S/ 310.04'],
      ['pred24', 'Vencida', 'S/ 2,067.04'],
      ['veh24', 'En coactiva', 'S/ 892.44'],
    ]);
  });

  it('con el pago simulado la deuda sigue ahi, con la unidad y sin insignia', () => {
    expect(loPendiente(SIMULADO, t).filas).toEqual([
      { id: 'predial-2024', concepto: 'Impuesto predial 2024', vence: 'Sin detalle del predio', insignia: null, monto: 'S/ 1,842.60' },
    ]);
  });
});

describe('lo que dice la consulta, final por final', () => {
  const situacion = (estado: string, resto: object = {}) =>
    ({ estado, ...resto }) as unknown as SituacionDelServidor;

  it.each([
    ['pidiendo', { pidiendo: true, situacion: undefined }, 'Consultando…', null, false],
    [
      'no contesto',
      { pidiendo: false, situacion: undefined },
      'Sin total',
      'No pudimos consultar su deuda. Vuelva a intentarlo en unos minutos.',
      true,
    ],
    [
      'no se pudo consultar',
      { pidiendo: false, situacion: situacion('no-se-pudo-consultar') },
      'Sin total',
      'No pudimos consultar toda su deuda, así que no le mostramos ningún total.',
      true,
    ],
    [
      'sin registros',
      { pidiendo: false, situacion: situacion('sin-registros') },
      'Sin registros',
      'No encontramos deuda a su nombre en las municipalidades del sistema.',
      false,
    ],
    [
      'sin deuda',
      { pidiendo: false, situacion: situacion('sin-deuda') },
      'Nada pendiente',
      'Según la consulta de hoy, no tiene deuda pendiente en las municipalidades del sistema.',
      false,
    ],
  ] as const)('%s: ni una fila, y ninguna cifra de consuelo', (_final, consulta, cifra, dicho, reintentar) => {
    expect(loQueDiceLaConsulta(consulta, t)).toEqual({ cifra, dicho, reintentar, filas: [] });
  });

  it('con deuda: el total que sumo el servidor y sus conceptos, sin insignia', () => {
    const conDeuda = situacion('con-deuda', {
      totalConsolidado: { importe: '1842.60', actualizadoA: '2026-09-16' },
      deudas: [PREDIAL],
    });
    expect(loQueDiceLaConsulta({ pidiendo: false, situacion: conDeuda }, t)).toEqual({
      cifra: 'S/ 1,842.60',
      dicho: null,
      reintentar: false,
      filas: [
        { id: 'predial-2024', concepto: 'Impuesto predial 2024', vence: 'Sin detalle del predio', insignia: null, monto: 'S/ 1,842.60' },
      ],
    });
  });
});
