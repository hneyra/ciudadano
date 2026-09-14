import { formatearImporte, sumarImportes } from '@kamayuk/formato';
import type { InsigniaProps } from '@kamayuk/ui';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { cuentaDe, pasosConTotal, recargoDe, resumenDe, tonoDe, totalDe } from './cuentas.ts';
import { DEUDAS, MEDIOS } from './demostracion.ts';
import type { Deuda } from './tipos.ts';

/**
 * **Las cuentas del portal dan las cifras que el artboard dibuja.**
 *
 * Las cifras esperadas estan escritas A MANO a proposito, y son las que el revisor del issue 3
 * recalculo del artboard (lineas 740-806):
 *
 *     insoluto  293.72 + 291.60 + 1842.60 + 614.00 = 3041.92
 *     interes     0.00 +  18.44 +  212.44 + 182.44 =  413.32
 *     gastos      0.00 +   0.00 +   12.00 +  96.00 =  108.00
 *     total     3041.92 + 413.32 + 108.00          = 3563.24
 *     con amnistia  3041.92 + 108.00               = 3149.92
 *
 * Derivarlas aqui con `sumarImportes` seria probar la funcion contra si misma.
 */

/** Un concepto por id, o un rojo que lo nombra. */
function deuda(id: string): Deuda {
  const encontrada = DEUDAS.find((d) => d.id === id);
  if (encontrada === undefined) throw new Error(`No hay concepto «${id}» en DEUDAS`);
  return encontrada;
}

describe('cuentaDe', () => {
  it('con los cuatro conceptos da las cifras recalculadas del artboard', () => {
    expect(cuentaDe(DEUDAS)).toStrictEqual({
      insoluto: '3041.92',
      interes: '413.32',
      gastos: '108.00',
      total: '3563.24',
      conAmnistia: '3149.92',
    });
  });

  it('sin nada marcado da cero, no un fallo', () => {
    expect(cuentaDe([])).toStrictEqual({
      insoluto: '0.00',
      interes: '0.00',
      gastos: '0.00',
      total: '0.00',
      conAmnistia: '0.00',
    });
  });

  it('con una seleccion parcial suma solo lo marcado', () => {
    expect(cuentaDe([deuda('arb26'), deuda('veh24')])).toStrictEqual({
      insoluto: '905.60',
      interes: '200.88',
      gastos: '96.00',
      total: '1202.48',
      conAmnistia: '1001.60',
    });
  });
});

describe('totalDe y recargoDe', () => {
  it.each([
    ['pred26', '293.72', '0.00'],
    ['arb26', '310.04', '18.44'],
    ['pred24', '2067.04', '224.44'],
    ['veh24', '892.44', '278.44'],
  ])('%s: total %s, recargo %s', (id, total, recargo) => {
    expect(totalDe(deuda(id))).toBe(total);
    expect(recargoDe(deuda(id))).toBe(recargo);
  });
});

describe('los desgloses del artboard cuadran con las cuentas', () => {
  // No es una comprobacion de `cuentas.ts` sino de la coherencia de los datos: si alguien retoca un
  // insoluto en `demostracion.ts` y no su desglose, el ciudadano veria dos cifras que no casan.
  it('predial 2026: las cuotas «Por vencer» suman el insoluto', () => {
    const d = deuda('pred26');
    const porVencer = d.detalle.filas.filter((fila) => fila[3] === 'Por vencer').map((fila) => fila[2] ?? '');
    expect(sumarImportes(porVencer)).toBe(d.insoluto);
  });

  it('arbitrios 2026: los ocho meses de cada servicio suman el insoluto', () => {
    const d = deuda('arb26');
    expect(sumarImportes(d.detalle.filas.map((fila) => fila[3] ?? ''))).toBe(d.insoluto);
  });

  it.each(['pred24', 'veh24'])('%s: la fila de total dice el total y lo que queda con la amnistia', (id) => {
    const d = deuda(id);
    const [, conLaAmnistia, total] = d.detalle.filas.at(-1) ?? [];
    expect(`S/ ${total ?? ''}`).toBe(formatearImporte(totalDe(d)));
    expect(conLaAmnistia).toBe(`Con la amnistía: ${formatearImporte(cuentaDe([d]).conAmnistia)}`);
  });
});

describe('resumenDe', () => {
  it('con los cuatro vivos: 3 de 4 conceptos estan vencidos', () => {
    const resumen = resumenDe(DEUDAS);
    expect(resumen.vencidas).toBe(3);
    expect(resumen.conceptos).toBe(4);
  });

  it('lleva las mismas cifras que la cuenta de esos conceptos', () => {
    expect(resumenDe(DEUDAS)).toStrictEqual({ ...cuentaDe(DEUDAS), conceptos: 4, vencidas: 3 });
  });

  it('pagado el predial 2024, quedan 2 vencidos de 3', () => {
    const vivas = DEUDAS.filter((d) => d.id !== 'pred24');
    expect(resumenDe(vivas)).toMatchObject({ conceptos: 3, vencidas: 2, total: '1496.20' });
  });
});

describe('tonoDe', () => {
  it.each([
    ['Pagada', 'ok'],
    ['Por vencer', 'atencion'],
    ['Vencida', 'mal'],
    ['En coactiva', 'mal'],
    ['Al día', 'ok'],
  ] as const)('«%s» es %s', (texto, tono) => {
    expect(tonoDe(texto)).toBe(tono);
  });

  it('el tono que DEUDAS escribe a mano es el que sale de su estado', () => {
    expect(DEUDAS.map((d) => [d.id, tonoDe(d.estado)])).toEqual(DEUDAS.map((d) => [d.id, d.tono]));
  });

  it('esta tipado con el `tono` de `Insignia`', () => {
    // Lo comprueba `tsc` en `yarn typecheck`, no Vitest: si `TonoDeInsignia` deja de ser el tipo
    // de `InsigniaProps['tono']`, esta linea no compila.
    expectTypeOf(tonoDe).returns.toEqualTypeOf<InsigniaProps['tono']>();
  });
});

describe('pasosConTotal', () => {
  const conAmnistia = cuentaDe(DEUDAS).conAmnistia;

  function pasosDe(id: string): readonly string[] {
    const pasos = MEDIOS.find((m) => m.id === id)?.pasos;
    if (pasos === undefined) throw new Error(`El medio «${id}» no tiene pasos`);
    return pasos;
  }

  it('Yape con los cuatro marcados: «Confirme el monto exacto de S/ 3,149.92 y …»', () => {
    const pasos = pasosConTotal(pasosDe('yape'), conAmnistia);
    expect(pasos[2]).toBe(
      'Confirme el monto exacto de S/ 3,149.92 y escriba su código de contribuyente en el mensaje.',
    );
    // Los que no llevan hueco salen tal cual.
    expect(pasos[0]).toBe(pasosDe('yape')[0]);
    expect(pasos.join('\n')).not.toContain('{{TOTAL}}');
  });

  it('el banco, con el mismo importe', () => {
    expect(pasosConTotal(pasosDe('banco'), conAmnistia)[2]).toBe(
      'Escriba el código de pago y confirme el monto de S/ 3,149.92.',
    );
  });

  it('no escribe «S/» dos veces ni pierde los decimales', () => {
    expect(pasosConTotal(['de S/ {{TOTAL}}.'], '614')).toEqual(['de S/ 614.00.']);
  });
});
