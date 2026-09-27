import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEUDAS } from '../datos/demostracion.ts';
import type { FuenteDelPortal } from '../datos/fuente.ts';
import { LA_DEMOSTRACION } from '../datos/fuenteDeDemostracion.ts';
import type { ComprobanteDeDemostracion, MedioDePago } from '../datos/tipos.ts';
import { CON_PLATAFORMA, type Modo, POLITICA_CON_PLATAFORMA, POLITICA_DE_LA_DEMOSTRACION, politicaDe } from '../modo/modo.ts';
import {
  type PagoRegistrado,
  type PagoSellado,
  type PagoSimulado,
  esSimulado,
  estadoInicial,
  recorrido,
} from './recorrido.ts';

/**
 * **Los estados que el modo deja fuera, fuera del tipo** (issue 59).
 *
 * Hasta el issue 59 el tipo admitia dos estados que no existen, y era la vista —o la suerte— la que
 * tenia que no llegar a ellos:
 *
 *   · **un pago simulado con numero de operacion**: `PagoSellado` tenia `medio`, `destino` y
 *     `comprobante: ComprobanteDeDemostracion | null` en los dos modos, asi que nada impedia sellar
 *     con plataforma un comprobante numerado, y el recibo tenia que esconderlo;
 *   · **una fuente sin plataforma y sin demostracion**: `consulta` y `demostracion` eran campos
 *     independientes, y con los dos a `null` el portal arrancaba en demostracion y reventaba en la
 *     primera pantalla (revision del PR #69).
 *
 * Estas pruebas son de TIPOS: los `@ts-expect-error` los comprueba `yarn typecheck` (que compila las
 * pruebas), y si un dia el tipo vuelve a admitir el estado, la directiva sobra y `tsc` sale rojo con
 * «Unused '@ts-expect-error' directive». Lo que se ejecuta aqui es lo poco que el tipo necesita del
 * reductor: que sella, de verdad, un pago de cada forma.
 */

const COMPROBANTE: ComprobanteDeDemostracion = {
  numero: '0003-0041418',
  operacion: '86 4418 2026 0913',
  fecha: '2026-09-13',
  hora: '10:42',
};

/** Lo que todo pago sellado lleva: los conceptos, de quien, y la cuenta. */
const LO_COMUN = {
  conceptos: DEUDAS.slice(0, 1),
  contribuyente: null,
  insoluto: '293.72',
  reajuste: '0.00',
  interes: '0.00',
  gastos: '0.00',
  total: '293.72',
  conAmnistia: '293.72',
} as const;

describe('un pago simulado no tiene donde poner un numero de operacion ni un medio', () => {
  it('su tipo no tiene ni `medio` ni `destino`, y su `comprobante` es `null`', () => {
    expectTypeOf<PagoSimulado>().not.toHaveProperty('medio');
    expectTypeOf<PagoSimulado>().not.toHaveProperty('destino');
    expectTypeOf<PagoSimulado['comprobante']>().toEqualTypeOf<null>();
    // Y uno registrado si los tiene todos, y su comprobante nunca es `null`.
    expectTypeOf<PagoRegistrado['medio']>().toEqualTypeOf<MedioDePago['id']>();
    expectTypeOf<PagoRegistrado['comprobante']>().toEqualTypeOf<ComprobanteDeDemostracion>();
  });

  it('darle un numero de operacion, o un medio, NO compila', () => {
    // @ts-expect-error — un pago simulado no tiene comprobante que numerar.
    const conNumero: PagoSimulado = { ...LO_COMUN, comprobante: COMPROBANTE };
    // @ts-expect-error — ni medio con que se pago.
    const conMedio: PagoSimulado = { ...LO_COMUN, comprobante: null, medio: 'yape' };
    // @ts-expect-error — ni a donde se envio: no se envio nada.
    const conDestino: PagoSimulado = { ...LO_COMUN, comprobante: null, destino: 'ana@example.com' };
    // Como `PagoSellado` tampoco: con `comprobante: null` es un simulado, y le sobra el medio.
    // @ts-expect-error — la union se discrimina por `comprobante`.
    const selladoConMedio: PagoSellado = { ...LO_COMUN, comprobante: null, medio: 'tarjeta', destino: null };
    // Y uno registrado sin sus numeros, tampoco.
    // @ts-expect-error — un pago registrado siempre tiene comprobante.
    const registradoSinNumeros: PagoRegistrado = { ...LO_COMUN, medio: 'tarjeta', destino: null, comprobante: null };
    // El control positivo (revision del PR #70): las formas buenas, con lo MISMO de arriba. Si
    // `LO_COMUN` dejara de ser lo que un pago lleva, los `@ts-expect-error` de arriba se cumplirian por
    // ese otro motivo y la prueba seguiria en verde sin medir nada; con estas, sale rojo.
    const simuladoBueno: PagoSimulado = { ...LO_COMUN, comprobante: null };
    const registradoBueno: PagoRegistrado = { ...LO_COMUN, medio: 'tarjeta', destino: null, comprobante: COMPROBANTE };
    const selladoSimulado: PagoSellado = { ...LO_COMUN, comprobante: null };
    const selladoRegistrado: PagoSellado = { ...LO_COMUN, medio: 'yape', destino: 'ana@example.com', comprobante: COMPROBANTE };
    expect([conNumero, conMedio, conDestino, selladoConMedio, registradoSinNumeros]).toHaveLength(5);
    expect([simuladoBueno, registradoBueno, selladoSimulado, selladoRegistrado]).toHaveLength(4);
  });

  it('y leer el numero de operacion de un pago sin saber cual es, tampoco', () => {
    // Funciones que no se llaman: lo que se mide es si compilan. Llamada, la primera reventaria.
    // @ts-expect-error — `comprobante` puede ser `null`: hay que preguntar antes `esSimulado(pago)`.
    const sinPreguntar = (pago: PagoSellado): string => pago.comprobante.operacion;
    const preguntando = (pago: PagoSellado): string | null => (esSimulado(pago) ? null : pago.comprobante.operacion);
    expect([sinPreguntar, preguntando]).toHaveLength(2);
  });

  it('el reductor sella un simulado con la politica de la plataforma, y uno registrado con la de la demostracion', () => {
    const plataforma = {
      ...estadoInicial({ en: CON_PLATAFORMA, autenticado: true, amnistia: false }),
      deudas: DEUDAS,
    };
    const simulado = recorrido({ ...plataforma, paso: 'pagar' }, { tipo: 'confirmarPago' }).ultimo;
    expect(simulado).not.toBeNull();
    expect(simulado === null ? null : esSimulado(simulado)).toBe(true);
    // Sin las claves que no le tocan, y no solo vacias: un `medio: undefined` tambien seria una clave.
    expect(Object.keys(simulado ?? {}).sort()).toEqual(
      ['comprobante', 'conAmnistia', 'conceptos', 'contribuyente', 'gastos', 'insoluto', 'interes', 'reajuste', 'total'],
    );

    const enDemostracion = estadoInicial({
      en: { modo: 'demostracion', demostracion: LA_DEMOSTRACION },
      autenticado: true,
      amnistia: true,
    });
    const registrado = recorrido(
      { ...enDemostracion, numero: '03593174', paso: 'pagar' },
      { tipo: 'confirmarPago' },
    ).ultimo;
    expect(registrado === null ? null : esSimulado(registrado)).toBe(false);
  });
});

describe('una fuente sin plataforma y sin demostracion no existe', () => {
  it('un modo de demostracion sin sus datos NO compila, ni como modo ni como fuente', () => {
    // @ts-expect-error — sin `demostracion` no es un modo de demostracion.
    const modoSinDatos: Modo = { modo: 'demostracion' };
    const loDemas = { amnistia: false, historial: () => Promise.resolve([]), unidades: () => Promise.resolve([]) };
    // @ts-expect-error — y una fuente que no tiene ni consulta ni demostracion no es de ningun modo.
    const fuenteSinNada: FuenteDelPortal = { modo: 'demostracion', ...loDemas };
    // @ts-expect-error — con plataforma, la consulta no es opcional.
    const plataformaSinConsulta: FuenteDelPortal = { modo: 'plataforma', ...loDemas };
    // Las dos formas buenas, para que las de arriba fallen por lo que dicen y no por otra cosa.
    const buena: FuenteDelPortal = { modo: 'demostracion', demostracion: LA_DEMOSTRACION, ...loDemas };
    const otraBuena: FuenteDelPortal = { modo: 'plataforma', consulta: () => Promise.reject(new Error('no')), ...loDemas };
    expect([modoSinDatos, fuenteSinNada, plataformaSinConsulta, buena, otraBuena]).toHaveLength(5);
  });

  it('y cada modo tiene su politica, que es lo que leen las pantallas', () => {
    expect(politicaDe(CON_PLATAFORMA)).toBe(POLITICA_CON_PLATAFORMA);
    expect(politicaDe({ modo: 'demostracion', demostracion: LA_DEMOSTRACION })).toBe(POLITICA_DE_LA_DEMOSTRACION);
  });
});
