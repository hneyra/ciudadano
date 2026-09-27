import { beforeAll, describe, expect, it } from 'vitest';

import { LA_DEMOSTRACION } from '../../datos/fuenteDeDemostracion.ts';
import type { DeudaDelServidor } from '../../datos/tipos.ts';
import i18n, { IDIOMA_POR_OMISION } from '../../i18n/i18n.ts';
import { CON_PLATAFORMA, enDemostracion } from '../../modo/modo.ts';
import { type EstadoDelRecorrido, estadoInicial, recorrido } from '../../recorrido/recorrido.ts';
import { elRecibo, laBanda } from './vista.ts';

/**
 * **El modelo de vista del comprobante, sin montar nada** (issue 60). Las cifras, a mano: las del
 * artboard (`Comprobante.test.tsx`) y las de una obligacion del servidor.
 */

const t = i18n.t.bind(i18n);

beforeAll(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

/** Buscado, con correo, y pagados los cuatro con tarjeta: el pago registrado de la demostracion. */
const REGISTRADO = [
  { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' },
  { tipo: 'continuarConCorreo', correo: 'maria@example.com', avisarVencimiento: false },
  { tipo: 'confirmarPago' },
] as const satisfies readonly Parameters<typeof recorrido>[1][];
const PAGADO = REGISTRADO.reduce(
  recorrido,
  estadoInicial({ en: enDemostracion(LA_DEMOSTRACION), autenticado: false, amnistia: true }),
);

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

/** Con plataforma, a nombre de quien dijo el servidor, y el pago simulado. */
const SIMULADO: EstadoDelRecorrido = recorrido(
  {
    ...estadoInicial({ en: CON_PLATAFORMA, autenticado: true, amnistia: false }),
    deudas: [PREDIAL],
    contribuyente: { nombre: 'Rufina Medina Medina', codigo: null, documento: 'DNI 03593174' },
  },
  { tipo: 'confirmarPago' },
);

describe('la banda', () => {
  it('registrado: los tres hechos del artboard, con el medio en minusculas y el correo dado', () => {
    const { ultimo } = PAGADO;
    expect(ultimo === null ? null : laBanda(PAGADO, ultimo, t)).toBe(
      'Pagó S/ 3,149.92 con tarjeta. Le enviamos el comprobante a maria@example.com, y puede descargarlo aquí mismo. La deuda pagada ya se descontó de su cuenta.',
    );
  });

  it('simulado: en condicional, y negando los tres', () => {
    const { ultimo } = SIMULADO;
    expect(ultimo === null ? null : laBanda(SIMULADO, ultimo, t)).toBe(
      'Esto es lo que habría pagado: S/ 1,842.60. No se cobró nada, no se envió ningún comprobante y su deuda no ha cambiado.',
    );
  });
});

describe('el recibo', () => {
  it('registrado: la constancia con su numero, la meta entera, el condonado y el total pagado', () => {
    const { ultimo } = PAGADO;
    const recibo = ultimo === null ? null : elRecibo(PAGADO, ultimo, t);
    expect(recibo).toMatchObject({ simulado: false, titulo: 'Constancia de pago', numero: '0003-0041418' });
    expect(recibo?.meta.map((linea) => [linea.rotulo, linea.valor])).toEqual([
      ['Número de operación', '86 4418 2026 0913'],
      ['Fecha y hora', '13/09/2026 · 10:42'],
      ['Medio de pago', 'Tarjeta'],
      ['Contribuyente', 'Suc. Rufina Medina Medina'],
      ['Código', '00000025673'],
      ['Enviado a', 'maria@example.com'],
    ]);
    expect(recibo?.filas.map((fila) => fila.importe)).toEqual(['293.72', '291.60', '1,854.60', '710.00']);
    expect(recibo?.condonado).toEqual({ rotulo: 'Interés condonado por la Ordenanza 012-2026-MPS', valor: '− 413.32' });
    expect(recibo?.total).toEqual({ rotulo: 'Total pagado', valor: '3,149.92' });
  });

  it('simulado: de ejemplo, sin numero, sin operacion ni medio ni destino, sin condonar, y lo que se pagaria', () => {
    const { ultimo } = SIMULADO;
    const recibo = ultimo === null ? null : elRecibo(SIMULADO, ultimo, t);
    expect(recibo).toMatchObject({ simulado: true, titulo: 'Comprobante de ejemplo', numero: null, condonado: null });
    expect(recibo?.meta).toEqual([{ rotulo: 'Contribuyente', valor: 'Rufina Medina Medina' }]);
    expect(recibo?.filas).toEqual([
      { id: 'predial-2024', concepto: 'Impuesto predial 2024', unidad: 'Sin detalle del predio', cuotas: null, importe: '1,842.60' },
    ]);
    expect(recibo?.total).toEqual({ rotulo: 'Total que se pagaría', valor: '1,842.60' });
    expect(recibo?.nota).toMatch(/^Este comprobante es una vista de ejemplo y no acredita ningún pago/);
  });
});
