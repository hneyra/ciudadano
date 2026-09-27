import { beforeAll, describe, expect, it } from 'vitest';

import { LA_DEMOSTRACION } from '../../datos/fuenteDeDemostracion.ts';
import type { DeudaDelServidor } from '../../datos/tipos.ts';
import i18n, { IDIOMA_POR_OMISION } from '../../i18n/i18n.ts';
import { CON_PLATAFORMA, enDemostracion } from '../../modo/modo.ts';
import { type EstadoDelRecorrido, estadoInicial, recorrido } from '../../recorrido/recorrido.ts';
import { alConfirmar, elResumen, pasosDelMedio } from './vista.ts';

/**
 * **El modelo de vista del paso 4, sin montar nada** (issue 60). Las cifras, a mano: las del artboard
 * (`recorrido.test.ts`) y las de una obligacion del servidor con reajuste.
 */

const t = i18n.t.bind(i18n);

beforeAll(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

const AL_ABRIR = estadoInicial({ en: enDemostracion(LA_DEMOSTRACION), autenticado: false, amnistia: true });
/** Buscado y con los cuatro conceptos marcados: lo que se paga en demostracion. */
const BUSCADO = recorrido(AL_ABRIR, { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' });

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

/** Con plataforma y sesion, con la obligacion leida al lado de las decisiones. */
const CON_PLATAFORMA_Y_DEUDA: EstadoDelRecorrido = {
  ...estadoInicial({ en: CON_PLATAFORMA, autenticado: true, amnistia: false }),
  deudas: [PREDIAL],
};

describe('confirmar', () => {
  it('sin haber buscado no hay nada que pagar, y se dice', () => {
    expect(alConfirmar(AL_ABRIR, t)).toEqual({ nada: true, aviso: 'No hay nada que pagar.' });
  });

  it('en demostracion se registra y se envia al correo, que todavia no se dio', () => {
    expect(alConfirmar(BUSCADO, t)).toEqual({
      nada: false,
      aviso: 'Pago registrado. Le enviamos el comprobante a su correo.',
    });
  });

  it('con plataforma el pago es simulado: no promete ningun correo', () => {
    expect(alConfirmar(CON_PLATAFORMA_Y_DEUDA, t)).toEqual({
      nada: false,
      aviso: 'Pago simulado. No se cobró nada y su deuda no ha cambiado.',
    });
  });
});

describe('el resumen', () => {
  it('en demostracion: tres filas, el interes condonado, y el total con la amnistia', () => {
    const resumen = elResumen(BUSCADO, t);
    expect(resumen.conceptos.map((c) => [c.id, c.cuotas === null, c.total])).toEqual([
      ['pred26', false, '293.72'],
      ['arb26', false, '310.04'],
      ['pred24', false, '2067.04'],
      ['veh24', false, '892.44'],
    ]);
    expect(resumen.filas).toEqual([
      { rotulo: 'Impuesto y arbitrios', valor: '3041.92', condonado: false },
      { rotulo: 'Interés condonado', valor: '413.32', condonado: true },
      { rotulo: 'Gastos y costas', valor: '108.00', condonado: false },
    ]);
    expect(resumen.total).toBe('3149.92');
    expect(resumen.aviso).toBe('El comprobante se enviará a su correo.');
    expect(resumen.volver).toBe('Cambiar lo que voy a pagar');
  });

  it('con plataforma: la fila del reajuste, el interes cobrado, sin cuotas y sin correo', () => {
    const resumen = elResumen(CON_PLATAFORMA_Y_DEUDA, t);
    expect(resumen.conceptos).toEqual([
      { id: 'predial-2024', concepto: 'Impuesto predial 2024', cuotas: null, total: '1842.60' },
    ]);
    expect(resumen.filas.map((fila) => [fila.rotulo, fila.valor, fila.condonado])).toEqual([
      ['Impuesto y arbitrios', '1500.00', false],
      ['Reajuste', '42.60', false],
      ['Interés moratorio', '200.00', false],
      ['Gastos y costas', '100.00', false],
    ]);
    expect(resumen.total).toBe('1842.60');
    expect(resumen.aviso).toBe('Aquí no se envía ningún comprobante: el portal todavía no cobra en línea.');
  });

  it('sin nada que pagar: ni filas, y a buscar la deuda', () => {
    const resumen = elResumen(AL_ABRIR, t);
    expect([resumen.conceptos, resumen.filas]).toEqual([[], []]);
    expect(resumen.volver).toBe('Buscar mi deuda');
  });
});

describe('los pasos de un medio', () => {
  it('llevan el importe que se cobra donde el artboard dice {{TOTAL}}', () => {
    const yape = LA_DEMOSTRACION.medios.find((medio) => medio.id === 'yape');
    expect(yape === undefined ? [] : pasosDelMedio(yape, BUSCADO, t).join(' ')).toContain('3,149.92');
  });
});
