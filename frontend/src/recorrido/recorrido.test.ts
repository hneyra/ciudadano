import { describe, expect, expectTypeOf, it } from 'vitest';

import { COMPROBANTE, DEUDAS, USUARIO } from '../datos/demostracion.ts';
import {
  type AccionDelRecorrido,
  ESTADO_INICIAL,
  type EstadoDelRecorrido,
  PASOS_NUMERADOS,
  cuenta,
  conceptosDelPago,
  cuentaPorPagar,
  destinoAlEntrar,
  destinoAlPagar,
  hayQuePagar,
  inicio,
  pasoAlcanzable,
  pendientes,
  porPagar,
  recorrido,
  resumen,
  seleccion,
  ultimoAlcanzable,
  vivas,
} from './recorrido.ts';

/**
 * **El reductor del recorrido hace lo que el artboard hace, y no se contradice consigo mismo.**
 *
 * Las cifras van escritas A MANO, como en `cuentas.test.ts`: son las que el revisor del issue 3
 * recalculo del artboard. Por concepto (insoluto / interes / gastos):
 *
 *     pred26   293.72 /   0.00 /  0.00
 *     arb26    291.60 /  18.44 /  0.00
 *     pred24  1842.60 / 212.44 / 12.00
 *     veh24    614.00 / 182.44 / 96.00
 */

/** Aplica una lista de acciones desde un estado. */
const tras = (acciones: readonly AccionDelRecorrido[], desde: EstadoDelRecorrido = ESTADO_INICIAL) =>
  acciones.reduce(recorrido, desde);

const ids = (lista: readonly { id: string }[]) => lista.map((d) => d.id);

describe('el estado inicial', () => {
  it('es el de las lineas 927-940 del artboard', () => {
    expect(ESTADO_INICIAL).toStrictEqual({
      paso: 'buscar',
      tipoDeDocumento: 'Código de contribuyente',
      numero: '',
      marcadas: { pred26: true, arb26: true, pred24: true, veh24: true },
      pagadas: {},
      ultimo: null,
      abierta: null,
      correo: '',
      avisarVencimiento: true,
      autenticado: false,
      medio: 'tarjeta',
      valores: {},
      recienPagado: false,
    });
  });

  it('marca exactamente los conceptos de `DEUDAS`, ni uno mas ni uno menos', () => {
    // Si `demostracion.ts` gana o pierde un concepto, lo marcado por omision tiene que decidirse otra
    // vez: el artboard los marca todos.
    expect(Object.keys(ESTADO_INICIAL.marcadas)).toEqual(ids(DEUDAS));
  });
});

describe('confirmarPago', () => {
  // Buscar, desmarcar el arbitrio, dar el correo, elegir Yape y pagar.
  const pagado = tras([
    { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' },
    { tipo: 'alternar', id: 'arb26' },
    { tipo: 'continuarConCorreo', correo: 'ana@correo.pe', avisarVencimiento: false },
    { tipo: 'elegirMedio', medio: 'yape' },
    { tipo: 'confirmarPago' },
  ]);

  it('marca como pagadas SOLO las seleccionadas vivas', () => {
    expect(pagado.pagadas).toStrictEqual({ pred26: true, pred24: true, veh24: true });
    expect(ids(vivas(pagado))).toEqual(['arb26']);
  });

  it('y lo ya pagado no se vuelve a pagar aunque siga marcado', () => {
    // Tras el primer pago `pred26` sigue marcada en `marcadas`; marcar el arbitrio y pagar de nuevo
    // tiene que sellar SOLO el arbitrio.
    const segundo = tras([{ tipo: 'alternar', id: 'arb26' }, { tipo: 'confirmarPago' }], pagado);
    expect(segundo.marcadas.pred26).toBe(true);
    expect(segundo.ultimo?.ids).toEqual(['arb26']);
    expect(segundo.ultimo?.conAmnistia).toBe('291.60');
    expect(vivas(segundo)).toEqual([]);
  });

  it('sella `ultimo` con los ids, los importes como texto, el medio y el destino', () => {
    // 293.72 + 1842.60 + 614.00 = 2750.32 · 0 + 212.44 + 182.44 = 394.88 · 0 + 12 + 96 = 108.00
    expect(pagado.ultimo).toStrictEqual({
      ids: ['pred26', 'pred24', 'veh24'],
      insoluto: '2750.32',
      interes: '394.88',
      gastos: '108.00',
      total: '3253.20',
      conAmnistia: '2858.32',
      medio: 'yape',
      destino: 'ana@correo.pe',
      comprobante: COMPROBANTE,
    });
    expectTypeOf(pagado.ultimo?.conAmnistia).toEqualTypeOf<string | undefined>();
  });

  it('pasa al comprobante y deja constancia de que hubo pago en esta visita', () => {
    expect(pagado.paso).toBe('comprobante');
    expect(pagado.recienPagado).toBe(true);
  });

  it('con sesion, el destino es el correo de la cuenta', () => {
    const conSesion = tras([{ tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '1' }, { tipo: 'entrar' }, { tipo: 'confirmarPago' }]);
    expect(conSesion.ultimo?.destino).toBe(USUARIO.correo);
    expect(conSesion.ultimo?.conAmnistia).toBe('3149.92');
  });

  it('sin nada seleccionado no sella nada ni cambia de paso', () => {
    const vacio = tras([{ tipo: 'marcarTodo' }, { tipo: 'irA', paso: 'pagar' }]);
    expect(seleccion(vacio)).toEqual([]);
    expect(recorrido(vacio, { tipo: 'confirmarPago' })).toBe(vacio);
  });

  it('sin busqueda no sella nada, aunque `marcadas` traiga lo marcado por omision (issue 8)', () => {
    // «Iniciar sesión» → «Mis datos» → «Solo con mi correo» llega a pagar sin haber buscado.
    const sinBuscar = tras([
      { tipo: 'irA', paso: 'identificar' },
      { tipo: 'continuarConCorreo', correo: 'ana@correo.pe', avisarVencimiento: true },
    ]);
    expect(sinBuscar.paso).toBe('pagar');
    expect(ids(seleccion(sinBuscar))).toEqual(ids(DEUDAS));
    expect(porPagar(sinBuscar)).toEqual([]);
    expect(cuentaPorPagar(sinBuscar).conAmnistia).toBe('0.00');
    expect(recorrido(sinBuscar, { tipo: 'confirmarPago' })).toBe(sinBuscar);
  });

  it('`porPagar` es la seleccion viva cuando se busco, y `cuentaPorPagar` su cuenta', () => {
    const conBusqueda = tras([
      { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' },
      { tipo: 'alternar', id: 'arb26' },
    ]);
    expect(porPagar(conBusqueda)).toEqual(seleccion(conBusqueda));
    expect(cuentaPorPagar(conBusqueda)).toStrictEqual(cuenta(conBusqueda));
    expect(cuentaPorPagar(conBusqueda).conAmnistia).toBe('2858.32');
  });
});

describe('el sello no se mueve', () => {
  it('cambiar `marcadas` despues de pagar NO cambia `ultimo`', () => {
    const pagado = tras([{ tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '1' }, { tipo: 'confirmarPago' }]);
    const sello = pagado.ultimo;
    expect(sello?.ids).toEqual(['pred26', 'arb26', 'pred24', 'veh24']);

    const despues = tras(
      [
        { tipo: 'alternar', id: 'pred26' },
        { tipo: 'alternar', id: 'veh24' },
        { tipo: 'marcarTodo' },
        { tipo: 'elegirMedio', medio: 'banco' },
      ],
      pagado,
    );
    expect(despues.marcadas).not.toStrictEqual(pagado.marcadas);
    expect(despues.ultimo).toBe(sello);
    expect(despues.ultimo).toStrictEqual({
      ids: ['pred26', 'arb26', 'pred24', 'veh24'],
      insoluto: '3041.92',
      interes: '413.32',
      gastos: '108.00',
      total: '3563.24',
      conAmnistia: '3149.92',
      medio: 'tarjeta',
      destino: null,
      comprobante: COMPROBANTE,
    });
  });
});

describe('`vivas` es la base de todo lo demas', () => {
  const conUnPago = tras([
    { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '1' },
    { tipo: 'alternar', id: 'arb26' },
    { tipo: 'alternar', id: 'pred24' },
    { tipo: 'alternar', id: 'veh24' },
    { tipo: 'confirmarPago' },
  ]);

  it('excluye lo pagado', () => {
    expect(conUnPago.pagadas).toStrictEqual({ pred26: true });
    expect(ids(vivas(conUnPago))).toEqual(['arb26', 'pred24', 'veh24']);
  });

  it('la seleccion sale de lo vivo: `pred26` sigue marcada y no se selecciona', () => {
    expect(conUnPago.marcadas.pred26).toBe(true);
    const todo = recorrido(conUnPago, { tipo: 'marcarTodo' });
    expect(ids(seleccion(todo))).toEqual(['arb26', 'pred24', 'veh24']);
    expect(cuenta(todo).conAmnistia).toBe('2856.20');
    // Y «Marcar todo» deja fuera de `marcadas` lo pagado, como el artboard.
    expect(Object.keys(todo.marcadas)).toEqual(['arb26', 'pred24', 'veh24']);
  });

  it('el resumen del paso 2 cuenta solo lo vivo', () => {
    // 291.60 + 1842.60 + 614.00 = 2748.20 · 18.44 + 212.44 + 182.44 = 413.32 · 108.00
    expect(resumen(conUnPago)).toStrictEqual({
      insoluto: '2748.20',
      interes: '413.32',
      gastos: '108.00',
      total: '3269.52',
      conAmnistia: '2856.20',
      conceptos: 3,
      vencidas: 3,
    });
  });

  it('y los pendientes del historial son lo vivo', () => {
    expect(pendientes(conUnPago)).toEqual(vivas(conUnPago));
    const todoPagado = tras([{ tipo: 'marcarTodo' }, { tipo: 'confirmarPago' }], conUnPago);
    expect(pendientes(todoPagado)).toEqual([]);
    expect(resumen(todoPagado).conceptos).toBe(0);
  });
});

describe('a donde lleva cada cosa', () => {
  it('`destinoAlPagar` da `identificar` sin sesion y `pagar` con sesion', () => {
    expect(destinoAlPagar(ESTADO_INICIAL)).toBe('identificar');
    expect(destinoAlPagar(recorrido(ESTADO_INICIAL, { tipo: 'entrar' }))).toBe('pagar');
  });

  it('`entrar` con una busqueda y algo seleccionado lleva a pagar, con sesion', () => {
    const conDeuda = tras([{ tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' }, { tipo: 'irA', paso: 'identificar' }]);
    expect(hayQuePagar(conDeuda)).toBe(true);
    expect(destinoAlEntrar(conDeuda)).toBe('pagar');
    const dentro = recorrido(conDeuda, { tipo: 'entrar' });
    expect([dentro.autenticado, dentro.paso]).toEqual([true, 'pagar']);
  });

  it('`entrar` sin nada que pagar lleva al historial, y no a un «Pagar» vacio (nota del revisor, #7)', () => {
    // Sin buscar: «Iniciar sesión» desde la barra, con lo marcado por omision pero sin busqueda.
    const sinBuscar = recorrido(ESTADO_INICIAL, { tipo: 'irA', paso: 'identificar' });
    expect(hayQuePagar(sinBuscar)).toBe(false);
    expect(destinoAlEntrar(sinBuscar)).toBe('historial');
    expect(recorrido(sinBuscar, { tipo: 'entrar' })).toMatchObject({ autenticado: true, paso: 'historial' });

    // Con busqueda, pero la seleccion viva vacia: nada marcado…
    const nadaMarcado = tras([
      { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' },
      { tipo: 'marcarTodo' },
      { tipo: 'irA', paso: 'identificar' },
    ]);
    expect(hayQuePagar(nadaMarcado)).toBe(false);
    expect(recorrido(nadaMarcado, { tipo: 'entrar' }).paso).toBe('historial');

    // …o todo lo marcado ya pagado, aunque siga marcado.
    const todoPagado = tras([
      { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' },
      { tipo: 'continuarConCorreo', correo: 'ana@correo.pe', avisarVencimiento: true },
      { tipo: 'confirmarPago' },
      { tipo: 'irA', paso: 'identificar' },
    ]);
    expect(seleccion(todoPagado)).toEqual([]);
    expect(recorrido(todoPagado, { tipo: 'entrar' }).paso).toBe('historial');
  });

  it('`inicio` da el historial con sesion y buscar sin ella', () => {
    expect(inicio(ESTADO_INICIAL)).toBe('buscar');
    expect(inicio(recorrido(ESTADO_INICIAL, { tipo: 'entrar' }))).toBe('historial');
  });

  it('`cerrarSesion` deja `autenticado=false` y `paso=\'buscar\'`', () => {
    const conSesion = tras([{ tipo: 'entrar' }, { tipo: 'irA', paso: 'historial' }]);
    expect(conSesion.autenticado).toBe(true);
    const cerrada = recorrido(conSesion, { tipo: 'cerrarSesion' });
    expect(cerrada.autenticado).toBe(false);
    expect(cerrada.paso).toBe('buscar');
  });

  it('`cerrarSesion` olvida el comprobante de la visita: sin `ultimo` ni `recienPagado`, y no alcanzable (issue 9)', () => {
    const pagadoConSesion = tras([
      { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '1' },
      { tipo: 'entrar' },
      { tipo: 'confirmarPago' },
    ]);
    expect(pagadoConSesion.ultimo).not.toBeNull();
    expect(pagadoConSesion.recienPagado).toBe(true);
    expect(pasoAlcanzable(pagadoConSesion, 'comprobante')).toBe(true);

    const cerrada = recorrido(pagadoConSesion, { tipo: 'cerrarSesion' });
    expect(cerrada.ultimo).toBeNull();
    expect(cerrada.recienPagado).toBe(false);
    expect(pasoAlcanzable(cerrada, 'comprobante')).toBe(false);
    expect(ultimoAlcanzable(cerrada)).toBe('buscar');
    // Lo pagado sigue pagado: se olvida el recibo a la vista, no la deuda que ya se cobro.
    expect(cerrada.pagadas).toStrictEqual(pagadoConSesion.pagadas);
  });

  it('`consultarOtra` vuelve a buscar con el numero vacio', () => {
    const otra = tras([{ tipo: 'buscar', tipoDeDocumento: 'RUC', numero: '20525118447' }, { tipo: 'consultarOtra' }]);
    expect(otra.paso).toBe('buscar');
    expect(otra.numero).toBe('');
  });
});

describe('`pasoAlcanzable`', () => {
  it('solo permite los pasos numerados hasta el actual, inclusive', () => {
    for (const [i, actual] of PASOS_NUMERADOS.entries()) {
      const estado = recorrido(ESTADO_INICIAL, { tipo: 'irA', paso: actual });
      const alcanzables = PASOS_NUMERADOS.filter((paso) => pasoAlcanzable(estado, paso));
      expect(alcanzables, `desde «${actual}»`).toEqual(PASOS_NUMERADOS.slice(0, i + 1));
    }
  });

  it('al empezar, solo buscar: ni `pagar` ni el historial', () => {
    expect(pasoAlcanzable(ESTADO_INICIAL, 'buscar')).toBe(true);
    expect(pasoAlcanzable(ESTADO_INICIAL, 'deudas')).toBe(false);
    expect(pasoAlcanzable(ESTADO_INICIAL, 'pagar')).toBe(false);
    expect(pasoAlcanzable(ESTADO_INICIAL, 'historial')).toBe(false);
    expect(ultimoAlcanzable(ESTADO_INICIAL)).toBe('buscar');
  });

  it('con un pago sellado el comprobante sigue alcanzable desde un paso anterior; sin sello, no (issue 9)', () => {
    // Pagar el predial 2026 y volver a elegir: el comprobante es la constancia, y no se pierde.
    const sellado = tras([
      { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '1' },
      { tipo: 'alternar', id: 'arb26' },
      { tipo: 'alternar', id: 'pred24' },
      { tipo: 'alternar', id: 'veh24' },
      { tipo: 'confirmarPago' },
      { tipo: 'irA', paso: 'deudas' },
    ]);
    expect(pasoAlcanzable(sellado, 'comprobante')).toBe(true);
    expect(pasoAlcanzable(sellado, 'identificar')).toBe(false);
    expect(pasoAlcanzable(recorrido(sellado, { tipo: 'consultarOtra' }), 'comprobante')).toBe(true);

    const sinSello = tras([{ tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '1' }]);
    expect(pasoAlcanzable(sinSello, 'comprobante')).toBe(false);
  });

  it('el historial exige sesion, y desde el ninguna ruta numerada es alcanzable', () => {
    const enElHistorial = tras([{ tipo: 'entrar' }, { tipo: 'irA', paso: 'historial' }]);
    expect(pasoAlcanzable(enElHistorial, 'historial')).toBe(true);
    expect(PASOS_NUMERADOS.filter((paso) => pasoAlcanzable(enElHistorial, paso))).toEqual([]);
    expect(ultimoAlcanzable(enElHistorial)).toBe('historial');
  });
});

describe('las acciones sueltas', () => {
  it('`abrirDetalle` abre uno y, pulsado otra vez, lo cierra', () => {
    const abierto = recorrido(ESTADO_INICIAL, { tipo: 'abrirDetalle', id: 'pred24' });
    expect(abierto.abierta).toBe('pred24');
    expect(recorrido(abierto, { tipo: 'abrirDetalle', id: 'veh24' }).abierta).toBe('veh24');
    expect(recorrido(abierto, { tipo: 'abrirDetalle', id: 'pred24' }).abierta).toBeNull();
  });

  it('`marcarTodo` quita todo si todo estaba marcado, y marca todo si faltaba alguno', () => {
    const nada = recorrido(ESTADO_INICIAL, { tipo: 'marcarTodo' });
    expect(seleccion(nada)).toEqual([]);
    const uno = recorrido(nada, { tipo: 'alternar', id: 'veh24' });
    expect(ids(seleccion(recorrido(uno, { tipo: 'marcarTodo' })))).toEqual(ids(DEUDAS));
  });

  it('`fijarValor` guarda un campo sin tocar los demas', () => {
    const dos = tras([
      { tipo: 'fijarValor', clave: 'numero', valor: '4111' },
      { tipo: 'fijarValor', clave: 'nombre', valor: 'ANA' },
    ]);
    expect(dos.valores).toStrictEqual({ numero: '4111', nombre: 'ANA' });
  });

  it('`continuarConCorreo` guarda el correo y la casilla y lleva a pagar', () => {
    const conCorreo = recorrido(ESTADO_INICIAL, {
      tipo: 'continuarConCorreo',
      correo: 'ana@correo.pe',
      avisarVencimiento: false,
    });
    expect([conCorreo.correo, conCorreo.avisarVencimiento, conCorreo.paso]).toEqual(['ana@correo.pe', false, 'pagar']);
  });

  it('el reductor no muta el estado que recibe', () => {
    const congelado = Object.freeze({ ...ESTADO_INICIAL, marcadas: Object.freeze({ ...ESTADO_INICIAL.marcadas }) });
    expect(() =>
      tras([{ tipo: 'alternar', id: 'pred26' }, { tipo: 'marcarTodo' }, { tipo: 'confirmarPago' }], congelado),
    ).not.toThrow();
    expect(congelado.marcadas.pred26).toBe(true);
  });
});

describe('`conceptosDelPago` (issue 9)', () => {
  it('son los del sello, en el orden de `DEUDAS`, y no cambian con lo que se marque despues', () => {
    const pagado = tras([
      { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '1' },
      { tipo: 'alternar', id: 'pred26' },
      { tipo: 'alternar', id: 'pred24' },
      { tipo: 'confirmarPago' },
    ]);
    const sello = pagado.ultimo;
    if (sello === null) throw new Error('confirmarPago no sello nada');
    expect(ids(conceptosDelPago(sello))).toEqual(['arb26', 'veh24']);

    const despues = tras([{ tipo: 'irA', paso: 'deudas' }, { tipo: 'alternar', id: 'pred24' }, { tipo: 'marcarTodo' }], pagado);
    expect(despues.ultimo).toBe(sello);
    expect(ids(conceptosDelPago(sello))).toEqual(['arb26', 'veh24']);
  });
});
