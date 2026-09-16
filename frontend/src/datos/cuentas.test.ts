import { formatearImporte, sumarImportes } from '@kamayuk/formato';
import type { InsigniaProps } from '@kamayuk/ui';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  cifraSinSimbolo,
  conAmnistiaDe,
  cuentaDe,
  pasosConTotal,
  recargoDe,
  resumenDe,
  tonoDe,
  totalDe,
} from './cuentas.ts';
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
      reajuste: '0.00',
      interes: '413.32',
      gastos: '108.00',
      total: '3563.24',
      conAmnistia: '3149.92',
    });
  });

  it('sin nada marcado da cero, no un fallo', () => {
    expect(cuentaDe([])).toStrictEqual({
      insoluto: '0.00',
      reajuste: '0.00',
      interes: '0.00',
      gastos: '0.00',
      total: '0.00',
      conAmnistia: '0.00',
    });
  });

  it('con una seleccion parcial suma solo lo marcado', () => {
    expect(cuentaDe([deuda('arb26'), deuda('veh24')])).toStrictEqual({
      insoluto: '905.60',
      reajuste: '0.00',
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

describe('conAmnistiaDe y cifraSinSimbolo (issue 9)', () => {
  it('cada fila del comprobante es insoluto + gastos, sin el interes que la amnistia condona', () => {
    // Escritas a mano (lineas 740-806): 293.72 + 0.00, 291.60 + 0.00, 1842.60 + 12.00, 614.00 + 96.00.
    expect(DEUDAS.map((d) => [d.id, conAmnistiaDe(d)])).toEqual([
      ['pred26', '293.72'],
      ['arb26', '291.60'],
      ['pred24', '1854.60'],
      ['veh24', '710.00'],
    ]);
  });

  it('la cifra sin «S/ », con miles y dos decimales, como la columna «Importe S/»', () => {
    expect(cifraSinSimbolo('1854.6')).toBe('1,854.60');
    expect(cifraSinSimbolo('413.32')).toBe('413.32');
    expect(cifraSinSimbolo('3149.92')).toBe('3,149.92');
  });
});

/**
 * **El reajuste del servidor entra en las cuentas** (issue 26).
 *
 * El artboard no lo tiene y `/portal/situacion` si. Se le dio sitio propio en el modelo en vez de
 * sumarlo a `gastos` —«Gastos y costas» es lo que cuesta cobrar, y el reajuste es la actualizacion
 * del tributo—, y la contrapartida de esa decision es esta: **si no se sumara, seria dinero que se
 * debe y no se cobra**. Las cifras estan escritas a mano: 1842.60 + 12.40 + 212.44 + 12.00.
 */
describe('el reajuste (issue 26)', () => {
  const conReajuste = { insoluto: '1842.60', reajuste: '12.40', interes: '212.44', gastos: '12.00' };

  it('cuenta en el total del concepto', () => {
    expect(totalDe(conReajuste)).toBe('2079.44');
  });

  it('no lo condona la amnistia, que solo perdona el interes', () => {
    expect(conAmnistiaDe(conReajuste)).toBe('1867.00');
  });

  it('y va con el recargo, que es lo que se suma por no pagar a tiempo', () => {
    expect(recargoDe(conReajuste)).toBe('236.84');
  });

  it('en la cuenta de la seleccion sale como su propia cifra, no escondido en los gastos', () => {
    expect(cuentaDe([conReajuste, { insoluto: '291.60', reajuste: '0.00', interes: '18.44', gastos: '0.00' }])).toStrictEqual(
      {
        insoluto: '2134.20',
        reajuste: '12.40',
        interes: '230.88',
        gastos: '12.00',
        total: '2389.48',
        conAmnistia: '2158.60',
      },
    );
  });

  it('y lo del artboard, que no lo trae, suma igual que antes: el reajuste es «0.00»', () => {
    // Sumar ninguno, no un cero inventado en los datos.
    expect(cuentaDe(DEUDAS).reajuste).toBe('0.00');
    expect(cuentaDe(DEUDAS).total).toBe('3563.24');
  });
});

/**
 * **Un concepto sin estado no se cuenta como vencido** (issue 26).
 *
 * `DeudaDelServidor.estado` es `null`: el contrato no dice si una obligacion esta vencida. Contarla
 * como vencida —o como al dia— seria afirmar algo que nadie sabe.
 */
describe('el resumen con estados que no se saben (issue 26)', () => {
  it('con `estado: null` los conceptos se cuentan, y los vencidos no', () => {
    const sinEstado = [
      { insoluto: '1842.60', reajuste: '12.40', interes: '212.44', gastos: '12.00', estado: null },
      { insoluto: '291.60', reajuste: '0.00', interes: '18.44', gastos: '0.00', estado: null },
    ];

    expect(resumenDe(sinEstado).conceptos).toBe(2);
    expect(resumenDe(sinEstado).vencidas).toBe(0);
  });
});
