import { describe, expect, it } from 'vitest';

import { DEUDAS } from '../datos/demostracion.ts';
import type { DeudaDelServidor, QuienDebe, SituacionDelServidor } from '../datos/tipos.ts';
import {
  ESTADO_INICIAL,
  PASOS_CON_PLATAFORMA,
  PASOS_DE_LA_DEMOSTRACION,
  SIN_DATOS,
  type EstadoDelRecorrido,
  aCobrar,
  aCobrarDe,
  cuenta,
  cuentaPorPagar,
  cuentaPendiente,
  destinoAlPagar,
  datosDeLaSituacion,
  decisionesDe,
  destinoDelComprobante,
  estaMarcada,
  estadoInicial,
  inicio,
  pasoAlcanzable,
  pasosNumerados,
  primerPaso,
  recorrido,
  seleccion,
  ultimoAlcanzable,
  vivas,
  vivasDelArtboard,
  vivasDelServidor,
} from './recorrido.ts';

/**
 * **AC1 — el recorrido con plataforma** (issue 28).
 *
 * Dos recorridos sobre el mismo reductor: cinco pasos en demostracion —«Buscar mi deuda · Elegir qué
 * pago · Mis datos · Pagar · Comprobante»— y **cuatro** con plataforma —«Entrar · Elegir qué pago ·
 * Pagar · Comprobante»—. Lo que se mide aqui:
 *
 *   · que `buscar` e `identificar` **no son alcanzables** con plataforma, ni yendo a ellos ni
 *     escribiendo su ruta;
 *   · que `entrar` no es alcanzable sin plataforma, ni **con la sesion ya abierta** —ese paso no se
 *     repite, y el emisor devuelve el navegador a `#/entrar`—;
 *   · y que **en demostracion no se movio nada**: el recorrido de hoy sigue entero, que es lo que
 *     `recorrido.test.ts` mide entero y aqui se comprueba de un vistazo.
 */

/** Una obligacion ya adaptada, con los cinco `null` que el contrato deja (issue 26). */
function delServidor(id: string, insoluto: string): DeudaDelServidor {
  const fecha = '2026-09-16';
  return {
    id,
    concepto: `Impuesto predial ${id}`,
    unidad: 'Sin detalle del predio',
    insoluto,
    reajuste: '0.00',
    interes: '0.00',
    gastos: '0.00',
    actualizadoA: { insoluto: fecha, reajuste: fecha, interes: fecha, gastos: fecha },
    totalDelServidor: insoluto,
    tributo: 'PREDIAL',
    ejercicio: 2024,
    cuotas: null,
    vence: null,
    estado: null,
    tono: null,
    detalle: null,
  };
}

const QUIEN: QuienDebe = { nombre: 'Rufina Medina Medina', codigo: '00000025673', documento: 'DNI 03593174' };

/** Aplica una lista de acciones desde el estado inicial de demostracion. */
const tras = (acciones: readonly Parameters<typeof recorrido>[1][]) => acciones.reduce(recorrido, ESTADO_INICIAL);

const conSesion = estadoInicial({ conPlataforma: true, autenticado: true, amnistia: false });
const sinSesion = estadoInicial({ conPlataforma: true, autenticado: false, amnistia: false });

/**
 * Con plataforma, sesion y dos conceptos leidos: el estado desde el que se puede pagar.
 *
 * Lo leido se pone AL LADO de las decisiones, como lo hace `ProveedorDelRecorrido` en cada dibujo
 * (issue 50): no hay accion que lo copie al reductor.
 */
const DOS = [delServidor('predial-2024', '1000.00'), delServidor('predial-2025', '500.00')];
const conLeido = (decisiones: EstadoDelRecorrido, deudas: readonly DeudaDelServidor[]): EstadoDelRecorrido => ({
  ...decisiones,
  deudas,
  contribuyente: QUIEN,
});
const conDeuda: EstadoDelRecorrido = conLeido(conSesion, DOS);

describe('los dos recorridos, y sus pasos', () => {
  it('con plataforma son cuatro y empiezan por entrar; en demostracion, los cinco de siempre', () => {
    expect(pasosNumerados(sinSesion)).toEqual(['entrar', 'deudas', 'pagar', 'comprobante']);
    expect(pasosNumerados(ESTADO_INICIAL)).toEqual(['buscar', 'deudas', 'identificar', 'pagar', 'comprobante']);
    // Y las dos listas son las que el modulo publica, no una copia escrita aqui.
    expect(pasosNumerados(sinSesion)).toBe(PASOS_CON_PLATAFORMA);
    expect(pasosNumerados(ESTADO_INICIAL)).toBe(PASOS_DE_LA_DEMOSTRACION);
  });

  it('el primer paso: `entrar` sin sesion, `deudas` con ella, y `buscar` en demostracion', () => {
    expect(primerPaso(sinSesion)).toBe('entrar');
    expect(primerPaso(conSesion)).toBe('deudas');
    expect(primerPaso(ESTADO_INICIAL)).toBe('buscar');
    // Y es donde arranca el portal, que es lo que hace `ProveedorDelRecorrido`.
    expect(sinSesion.paso).toBe('entrar');
    expect(conSesion.paso).toBe('deudas');
    expect(ESTADO_INICIAL.paso).toBe('buscar');
  });

  it('con plataforma no se arrastra la deuda del artboard, ni sus cuatro marcas', () => {
    expect(sinSesion.deudas).toEqual([]);
    expect(sinSesion.marcadas).toEqual({});
    expect(sinSesion.contribuyente).toBeNull();
    // En demostracion, la lista y las marcas del artboard, sin tocar.
    expect(ESTADO_INICIAL.deudas).toBe(DEUDAS);
    expect(Object.keys(ESTADO_INICIAL.marcadas)).toHaveLength(4);
  });
});

describe('AC1 — `buscar` no es alcanzable con plataforma', () => {
  it('ni desde el primer paso ni desde ninguno de los otros tres', () => {
    for (const paso of ['entrar', 'deudas', 'pagar', 'comprobante'] as const) {
      const estado = recorrido(conDeuda, { tipo: 'irA', paso });
      expect(pasoAlcanzable(estado, 'buscar'), `desde «${paso}»`).toBe(false);
      expect(pasoAlcanzable(estado, 'identificar'), `desde «${paso}»`).toBe(false);
    }
  });

  it('y escribir `#/buscar` redirige al primer paso del recorrido con plataforma', () => {
    // Es lo que hace `PantallaDelPaso` con lo no alcanzable: `ultimoAlcanzable` del estado.
    expect(ultimoAlcanzable({ ...sinSesion, paso: 'buscar' })).toBe('entrar');
    expect(ultimoAlcanzable({ ...conSesion, paso: 'identificar' })).toBe('deudas');
  });

  it('`entrar`, al reves: solo con plataforma, y solo mientras no haya sesion', () => {
    expect(pasoAlcanzable(sinSesion, 'entrar')).toBe(true);
    // Ese paso no se repite: quien ya entro sale por «Cerrar sesión», no volviendo aqui. Y el emisor
    // devuelve el navegador a `#/entrar`, que sin esto acabaria en la pantalla de la que se salio.
    expect(pasoAlcanzable(conSesion, 'entrar')).toBe(false);
    expect(pasoAlcanzable(ESTADO_INICIAL, 'entrar')).toBe(false);
  });

  it('y el recorrido con plataforma avanza como el otro: cada paso abre los anteriores', () => {
    const enPagar = recorrido(conDeuda, { tipo: 'irA', paso: 'pagar' });
    expect(PASOS_CON_PLATAFORMA.filter((paso) => pasoAlcanzable(enPagar, paso))).toEqual([
      'deudas',
      'pagar',
    ]);
    // «entrar» queda fuera porque hay sesion, no porque sea un paso futuro.
    expect(pasoAlcanzable({ ...enPagar, autenticado: false }, 'entrar')).toBe(true);
  });
});

describe('AC1 — a donde llevan las acciones con plataforma', () => {
  it('«Pagar» va a pagar y nunca a «Mis datos», que no existe en este recorrido', () => {
    expect(destinoAlPagar(conDeuda)).toBe('pagar');
    // En demostracion sigue decidiendolo la sesion, como en el artboard.
    expect(destinoAlPagar(ESTADO_INICIAL)).toBe('identificar');
  });

  it('la marca de la barra lleva al historial con sesion y al primer paso sin ella', () => {
    expect(inicio(conSesion)).toBe('historial');
    expect(inicio(sinSesion)).toBe('entrar');
    expect(inicio(ESTADO_INICIAL)).toBe('buscar');
  });

  it('y el comprobante no dice un correo que el token no trae', () => {
    // El realm del ciudadano pone `tipo_documento` y `numero_documento`, y ni correo ni codigo.
    expect(destinoDelComprobante(conSesion)).toBeNull();
    // En demostracion, el del artboard, como siempre.
    expect(destinoDelComprobante(recorrido(ESTADO_INICIAL, { tipo: 'entrar' }))).toBe('maria.castillo@example.com');
  });
});

describe('lo leido: los conceptos del servidor son los del recorrido (issues 28 y 50)', () => {
  it('llegan todos marcados —nadie decidio nada de ellos— y a nombre de quien estan', () => {
    expect(conDeuda.marcadas).toEqual({});
    expect(seleccion(conDeuda).map((deuda) => deuda.id)).toEqual(['predial-2024', 'predial-2025']);
    expect(vivasDelServidor(conDeuda).map((deuda) => deuda.id)).toEqual(['predial-2024', 'predial-2025']);
    // Y no son deuda del artboard: la pantalla de demostracion no dibujaria ninguno.
    expect(vivasDelArtboard(conDeuda)).toEqual([]);
  });

  it('`estaMarcada`: lo decidido manda, y lo no decidido vale lo de por omision de cada modo', () => {
    const conUnaQuitada = recorrido(conDeuda, { tipo: 'alternar', id: 'predial-2025' });
    expect(conUnaQuitada.marcadas).toEqual({ 'predial-2025': false });
    expect(estaMarcada(conUnaQuitada, 'predial-2024')).toBe(true);
    expect(estaMarcada(conUnaQuitada, 'predial-2025')).toBe(false);
    // En demostracion, lo no escrito es desmarcado: las cuatro marcas del artboard ya estan escritas.
    expect(estaMarcada(ESTADO_INICIAL, 'otro')).toBe(false);
    expect(estaMarcada(ESTADO_INICIAL, 'pred26')).toBe(true);
  });

  it('AC2 — una respuesta DISTINTA se reconcilia sola: lo que sigue conserva su marca, lo nuevo llega marcado', () => {
    const conUnaQuitada = recorrido(conDeuda, { tipo: 'alternar', id: 'predial-2024' });
    // 2025 se pago en la ventanilla y aparece 2023: la misma persona, otra lista.
    const otraLista = [delServidor('predial-2023', '40.00'), delServidor('predial-2024', '1000.00')];
    const despues = conLeido(conUnaQuitada, otraLista);

    expect(seleccion(despues).map((deuda) => deuda.id)).toEqual(['predial-2023']);
    expect(estaMarcada(despues, 'predial-2024')).toBe(false);
    expect(cuenta(despues).total).toBe('40.00');
  });

  it('`datosDeLaSituacion`: solo con deuda hay algo que leer, y es el MISMO arreglo de la respuesta', () => {
    const situacion = (estado: SituacionDelServidor['estado']): SituacionDelServidor => ({
      estado,
      tipoDeDocumento: 'DNI',
      numeroDeDocumento: '03593174',
      aLaFecha: '2026-09-16',
      municipalidadesRecorridas: 1,
      totalConsolidado: null,
      notaDelTotal: null,
      municipalidades: [],
      deudas: estado === 'con-deuda' ? DOS : [],
    });
    const leido = datosDeLaSituacion(situacion('con-deuda'));
    // El mismo arreglo, no una copia: una respuesta repetida e igual no cambia nada de lo que se dibuja.
    expect(leido.deudas).toBe(DOS);
    expect(leido.contribuyente).toEqual({ nombre: '', codigo: null, documento: 'DNI 03593174' });
    // Sin respuesta, y en los otros tres finales, nada que marcar ni que pagar.
    expect(datosDeLaSituacion(undefined)).toBe(SIN_DATOS);
    for (const final of ['sin-deuda', 'sin-registros', 'no-se-pudo-consultar'] as const) {
      expect(datosDeLaSituacion(situacion(final)), final).toBe(SIN_DATOS);
    }
  });

  it('el reductor montado no guarda lo leido: `decisionesDe` lo tira', () => {
    const decisiones = decisionesDe(conDeuda);
    expect('deudas' in decisiones).toBe(false);
    expect('contribuyente' in decisiones).toBe(false);
    expect(decisiones.marcadas).toBe(conDeuda.marcadas);
  });

  it('las cuentas se hacen sobre lo que trajo el servidor, y no sobre el artboard', () => {
    expect(cuenta(conDeuda).total).toBe('1500.00');
    const soloUno = recorrido(conDeuda, { tipo: 'alternar', id: 'predial-2025' });
    expect(cuenta(soloUno).total).toBe('1000.00');
  });

  it('y pagar sella lo del servidor: al comprobante, con sus conceptos, sus importes y su contribuyente', () => {
    const pagado = recorrido(recorrido(conDeuda, { tipo: 'irA', paso: 'pagar' }), { tipo: 'confirmarPago' });

    expect(pagado.paso).toBe('comprobante');
    expect(pagado.ultimo?.conceptos).toEqual(DOS);
    expect(pagado.ultimo?.total).toBe('1500.00');
    expect(pagado.ultimo?.contribuyente).toBe(QUIEN);
  });

  it('issue 50 — el sello no cuelga de la lista: otra respuesta despues no le quita ni le cambia filas', () => {
    const pagado = recorrido(conDeuda, { tipo: 'confirmarPago' });
    const otraRespuesta = conLeido(pagado, [delServidor('predial-2023', '40.00')]);

    expect(otraRespuesta.ultimo).toBe(pagado.ultimo);
    expect(otraRespuesta.ultimo?.conceptos.map((deuda) => deuda.id)).toEqual(['predial-2024', 'predial-2025']);
    expect(otraRespuesta.ultimo?.contribuyente).toBe(QUIEN);
  });

  it('REVISION — pero la deuda NO se da por pagada: no hubo cobro', () => {
    // El aviso de los pasos 4 y 5 promete que «su deuda no cambia». Con `pagadas` tocado, la deuda
    // desaparecia de la lista y del historial: el mismo embuste que la frase «la deuda pagada ya se
    // descontó de su cuenta», dicho con la lista en vez de con palabras.
    const pagado = recorrido(recorrido(conDeuda, { tipo: 'irA', paso: 'pagar' }), { tipo: 'confirmarPago' });

    expect(pagado.pagadas).toEqual({});
    expect(vivasDelServidor(pagado).map((deuda) => deuda.id)).toEqual(['predial-2024', 'predial-2025']);
    expect(cuentaPendiente(pagado).total).toBe('1500.00');
  });

  it('EL OTRO SENTIDO: en demostracion pagar SI descuenta la deuda, como el artboard', () => {
    const pagado = tras([
      { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' },
      { tipo: 'continuarConCorreo', correo: 'maria@example.com', avisarVencimiento: false },
      { tipo: 'confirmarPago' },
    ]);

    expect(Object.keys(pagado.pagadas)).toEqual(['pred26', 'arb26', 'pred24', 'veh24']);
    expect(vivas(pagado)).toEqual([]);
  });
});

describe('issue 49 — la amnistia sale de la FUENTE, y con plataforma no hay ninguna', () => {
  /** Una obligacion con interes: sin el, cobrar «con amnistia» y cobrar el total darian lo mismo. */
  const conInteres: DeudaDelServidor = {
    ...delServidor('predial-2024', '1500.00'),
    reajuste: '42.60',
    interes: '200.00',
    gastos: '100.00',
    totalDelServidor: '1842.60',
  };
  const leida = conLeido(conSesion, [conInteres]);

  it('el estado la lleva desde el arranque: la fuente dice si hay, y la de la plataforma dice que no', () => {
    expect(conSesion.amnistia).toBe(false);
    expect(estadoInicial({ conPlataforma: true, autenticado: true, amnistia: true }).amnistia).toBe(true);
    // En demostracion, la del artboard (la Ordenanza 012-2026-MPS).
    expect(ESTADO_INICIAL.amnistia).toBe(true);
  });

  it('sin amnistia se cobra el TOTAL, interes incluido: en lo elegido, en cada concepto y en el sello', () => {
    // 1500 + 42.60 + 200 + 100: el interes no se condona, porque nadie lo condono.
    expect(aCobrar(leida, cuentaPorPagar(leida))).toBe('1842.60');
    expect(aCobrarDe(leida, conInteres)).toBe('1842.60');

    const sellado = recorrido(leida, { tipo: 'confirmarPago' });
    expect(sellado.ultimo).not.toBeNull();
    expect(aCobrar(sellado, sellado.ultimo!)).toBe('1842.60');
  });

  it('con amnistia, todo menos el interes, como el artboard', () => {
    const conAmnistia: EstadoDelRecorrido = { ...leida, amnistia: true };
    expect(aCobrar(conAmnistia, cuentaPorPagar(conAmnistia))).toBe('1642.60');
    expect(aCobrarDe(conAmnistia, conInteres)).toBe('1642.60');
  });
});
