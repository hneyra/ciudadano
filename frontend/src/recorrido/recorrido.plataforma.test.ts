import { describe, expect, it } from 'vitest';

import { DEUDAS } from '../datos/demostracion.ts';
import type { DeudaDelServidor, QuienDebe } from '../datos/tipos.ts';
import {
  ESTADO_INICIAL,
  PASOS_CON_PLATAFORMA,
  PASOS_DE_LA_DEMOSTRACION,
  type EstadoDelRecorrido,
  cuenta,
  cuentaPendiente,
  destinoAlPagar,
  destinoDelComprobante,
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

const conSesion = estadoInicial({ conPlataforma: true, autenticado: true });
const sinSesion = estadoInicial({ conPlataforma: true, autenticado: false });

/** Con plataforma, sesion y dos conceptos leidos: el estado desde el que se puede pagar. */
const DOS = [delServidor('predial-2024', '1000.00'), delServidor('predial-2025', '500.00')];
const conDeuda: EstadoDelRecorrido = recorrido(conSesion, {
  tipo: 'situacionLeida',
  deudas: DOS,
  contribuyente: QUIEN,
});

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
    expect(destinoDelComprobante(recorrido(ESTADO_INICIAL, { tipo: 'entrar' }))).toBe('fruiz159@gmail.com');
  });
});

describe('`situacionLeida`: los conceptos del servidor pasan a ser los del recorrido', () => {
  it('los guarda, los marca todos y guarda a nombre de quien estan', () => {
    expect(conDeuda.deudas).toBe(DOS);
    expect(conDeuda.marcadas).toEqual({ 'predial-2024': true, 'predial-2025': true });
    expect(conDeuda.contribuyente).toBe(QUIEN);
    expect(vivasDelServidor(conDeuda).map((deuda) => deuda.id)).toEqual(['predial-2024', 'predial-2025']);
    // Y no son deuda del artboard: la pantalla de demostracion no dibujaria ninguno.
    expect(vivasDelArtboard(conDeuda)).toEqual([]);
  });

  it('con la MISMA lista no cambia nada: volver al paso 2 no vuelve a marcarlo todo', () => {
    const conUnaQuitada = recorrido(conDeuda, { tipo: 'alternar', id: 'predial-2025' });
    const otraVez = recorrido(conUnaQuitada, { tipo: 'situacionLeida', deudas: DOS, contribuyente: QUIEN });

    expect(otraVez).toBe(conUnaQuitada);
    expect(seleccion(otraVez).map((deuda) => deuda.id)).toEqual(['predial-2024']);
  });

  it('las cuentas se hacen sobre lo que trajo el servidor, y no sobre el artboard', () => {
    expect(cuenta(conDeuda).total).toBe('1500.00');
    const soloUno = recorrido(conDeuda, { tipo: 'alternar', id: 'predial-2025' });
    expect(cuenta(soloUno).total).toBe('1000.00');
  });

  it('y pagar sella lo del servidor: al comprobante, con sus ids y sus importes', () => {
    const pagado = recorrido(recorrido(conDeuda, { tipo: 'irA', paso: 'pagar' }), { tipo: 'confirmarPago' });

    expect(pagado.paso).toBe('comprobante');
    expect(pagado.ultimo?.ids).toEqual(['predial-2024', 'predial-2025']);
    expect(pagado.ultimo?.total).toBe('1500.00');
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
      { tipo: 'continuarConCorreo', correo: 'maria@correo.com', avisarVencimiento: false },
      { tipo: 'confirmarPago' },
    ]);

    expect(Object.keys(pagado.pagadas)).toEqual(['pred26', 'arb26', 'pred24', 'veh24']);
    expect(vivas(pagado)).toEqual([]);
  });
});
