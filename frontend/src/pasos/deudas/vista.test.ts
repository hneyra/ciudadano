import { beforeAll, describe, expect, it } from 'vitest';

import { LA_DEMOSTRACION } from '../../datos/fuenteDeDemostracion.ts';
import type { DeudaDelServidor, SituacionDelServidor } from '../../datos/tipos.ts';
import i18n, { IDIOMA_POR_OMISION } from '../../i18n/i18n.ts';
import { CON_PLATAFORMA, enDemostracion } from '../../modo/modo.ts';
import { type EstadoDelRecorrido, estadoInicial, recorrido } from '../../recorrido/recorrido.ts';
import {
  componentesDelSaldo,
  elTotal,
  estaTodoMarcado,
  laBarraDePago,
  notaDelRecargo,
  quienEsDelServidor,
} from './vista.ts';

/**
 * **El modelo de vista del paso 2, sin montar nada** (issue 60).
 *
 * Lo que la pantalla dibuja, preguntado a funciones puras. Las cifras van escritas A MANO, como en
 * `recorrido.test.ts`: son las del artboard.
 */

const t = i18n.t.bind(i18n);

beforeAll(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

const DEMOSTRACION = estadoInicial({ en: enDemostracion(LA_DEMOSTRACION), autenticado: false, amnistia: true });

/** Una obligacion del servidor, con interes, y los cinco `null` que el contrato deja (issue 26). */
function delServidor(id: string): DeudaDelServidor {
  return {
    id,
    concepto: `Impuesto predial ${id}`,
    unidad: 'Sin detalle del predio',
    insoluto: '1500.00',
    reajuste: '42.60',
    interes: '200.00',
    gastos: '100.00',
    actualizadoA: { insoluto: '2026-09-16', reajuste: '2026-09-15', interes: '2026-09-14', gastos: '2026-09-13' },
    totalDelServidor: '1842.60',
    tributo: 'PREDIAL',
    ejercicio: 2024,
    cuotas: null,
    vence: null,
    estado: null,
    tono: null,
    detalle: null,
  };
}

/** Con plataforma, sesion y dos conceptos leidos, como los pone el proveedor al lado de las decisiones. */
const CON_DEUDA: EstadoDelRecorrido = {
  ...estadoInicial({ en: CON_PLATAFORMA, autenticado: true, amnistia: false }),
  deudas: [delServidor('predial-2024'), delServidor('predial-2025')],
};

describe('la barra de pago', () => {
  it('en demostracion, con los cuatro marcados: «Pagar todo», el ahorro de la amnistia, y a «Mis datos»', () => {
    expect(laBarraDePago(DEMOSTRACION, t)).toEqual({
      detalle: 'Va a pagar los 4 conceptos',
      total: '3563.24',
      amnistia: 'Con la amnistía paga S/ 3,149.92: se descuentan S/ 413.32 de interés',
      vacio: false,
      rotulo: 'Pagar todo',
      destino: 'identificar',
    });
  });

  it('sin nada marcado no lleva a ningun sitio, y lo dice', () => {
    const nada = recorrido(DEMOSTRACION, { tipo: 'marcarTodo' });
    expect(laBarraDePago(nada, t)).toMatchObject({
      detalle: 'No ha marcado ningún concepto',
      vacio: true,
      rotulo: 'Pagar lo marcado',
      destino: null,
    });
    expect(estaTodoMarcado(nada)).toBe(false);
  });

  it('con uno de cuatro, «Va a pagar 1 concepto de 4»', () => {
    const uno = recorrido(recorrido(DEMOSTRACION, { tipo: 'marcarTodo' }), { tipo: 'alternar', id: 'pred26' });
    expect(laBarraDePago(uno, t).detalle).toBe('Va a pagar 1 concepto de 4');
  });

  it('con plataforma, marcado por omision y SIN amnistia aunque haya interes (issue 49), y a pagar', () => {
    const barra = laBarraDePago(CON_DEUDA, t);
    expect(barra).toMatchObject({ detalle: 'Va a pagar los 2 conceptos', total: '3685.20', vacio: false, destino: 'pagar' });
    expect(barra.amnistia).toBeNull();
    expect(estaTodoMarcado(CON_DEUDA)).toBe(true);
  });

  it('y una amnistia sin interes que condonar no promete ningun ahorro', () => {
    const sinInteres = recorrido(DEMOSTRACION, { tipo: 'marcarTodo' });
    const soloElPredial2026 = recorrido(sinInteres, { tipo: 'alternar', id: 'pred26' });
    expect(laBarraDePago(soloElPredial2026, t).amnistia).toBeNull();
  });
});

describe('el total de la demostracion y cada concepto', () => {
  it('la banda, la frase de lo vencido y las cuatro cifras, de `resumen`', () => {
    const total = elTotal(DEMOSTRACION, t);
    expect(total.alDia).toBe('Deuda total al 13 de setiembre de 2026');
    expect([total.total, total.conAmnistia]).toEqual(['3563.24', '3149.92']);
    expect(total.descuento).toBe('se descuenta S/ 413.32 de interés');
    expect(total.cuatro.map((una) => [una.rotulo, una.valor])).toEqual([
      ['Impuesto y arbitrios', { importe: '3041.92', verde: false }],
      ['Interés moratorio', { importe: '413.32', verde: true }],
      ['Gastos y costas', { importe: '108.00', verde: false }],
      ['Conceptos', { cuantos: 4 }],
    ]);
  });

  it('el recargo, solo si lo hay', () => {
    const [pred26, , pred24] = LA_DEMOSTRACION.deudas;
    expect(pred26 === undefined ? 'falta' : notaDelRecargo(pred26, t)).toBeNull();
    expect(pred24 === undefined ? 'falta' : notaDelRecargo(pred24, t)).toBe('incluye S/ 224.44 de recargo');
  });

  it('del servidor, cuatro componentes, cada uno con SU fecha', () => {
    expect(componentesDelSaldo(delServidor('x'), t)).toEqual([
      { rotulo: 'Impuesto y arbitrios', valor: '1500.00', fecha: '2026-09-16' },
      { rotulo: 'Reajuste', valor: '42.60', fecha: '2026-09-15' },
      { rotulo: 'Interés moratorio', valor: '200.00', fecha: '2026-09-14' },
      { rotulo: 'Gastos y costas', valor: '100.00', fecha: '2026-09-13' },
    ]);
  });

  it('quien es, segun el servidor: sin codigo, solo el documento', () => {
    const situacion = {
      tipoDeDocumento: 'DNI',
      numeroDeDocumento: '03593174',
      municipalidades: [
        { nombreDelContribuyente: 'Rufina Medina Medina', codigoDelContribuyente: '1' },
        { nombreDelContribuyente: 'Rufina Medina Medina', codigoDelContribuyente: '2' },
      ],
    } as unknown as SituacionDelServidor;
    expect(quienEsDelServidor(situacion, t)).toEqual({ nombre: 'Rufina Medina Medina', linea: 'DNI 03593174' });
  });
});
