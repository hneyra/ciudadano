import { describe, expect, it } from 'vitest';

import { LA_DEMOSTRACION } from '../datos/fuenteDeDemostracion.ts';
import type { DeudaDelServidor } from '../datos/tipos.ts';
import { CON_PLATAFORMA, enDemostracion } from '../modo/modo.ts';
import {
  type AccionDelRecorrido,
  type EstadoDelRecorrido,
  PASOS_CON_PLATAFORMA,
  PASOS_DE_LA_DEMOSTRACION,
  type PasoNumerado,
  alcanzadoHasta,
  estadoInicial,
  pasoAlcanzable,
  pasoHecho,
  recorrido,
} from './recorrido.ts';

/**
 * **El recorrido como maquina de estados explicita** (issue 61).
 *
 * Hasta el issue 61 el recorrido era una maquina implicita: las pantallas despachaban `irA` con el
 * destino ya decidido por ellas —trece sitios—, el reductor lo aceptaba sin preguntar, y lo alcanzable
 * se media por la posicion ACTUAL (`i <= actual`). Tres defectos salian de ahi: tras «Iniciar sesión»
 * la franja daba por hechos pasos que nadie hizo, el boton Adelante del navegador quedaba muerto, y
 * cualquier pantalla podia mandar a cualquier paso.
 *
 * Lo que se mide aqui, sin montar nada:
 *
 *   · cada transicion es una **accion con nombre** y el destino lo decide el reductor;
 *   · `irA` —la navegacion libre de la franja y de la URL— **no lleva a un paso no alcanzable**;
 *   · el progreso vive en `alcanzado`, y de el salen `pasoAlcanzable` y lo que la franja da por hecho.
 */

const EN_DEMOSTRACION = estadoInicial({ en: enDemostracion(LA_DEMOSTRACION), autenticado: false, amnistia: true });

const tras = (acciones: readonly AccionDelRecorrido[], desde: EstadoDelRecorrido = EN_DEMOSTRACION) =>
  acciones.reduce(recorrido, desde);

const BUSCAR: AccionDelRecorrido = { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' };

/** Lo que la franja pinta como hecho, en el orden de la franja. */
const hechos = (estado: EstadoDelRecorrido, pasos: readonly PasoNumerado[] = PASOS_DE_LA_DEMOSTRACION) =>
  pasos.filter((paso) => pasoHecho(estado, paso));

/** Lo que se puede abrir, en el orden de la franja. */
const abiertos = (estado: EstadoDelRecorrido, pasos: readonly PasoNumerado[] = PASOS_DE_LA_DEMOSTRACION) =>
  pasos.filter((paso) => pasoAlcanzable(estado, paso));

describe('`irA` es navegacion libre: solo entre pasos alcanzables', () => {
  it('no salta a un paso que no se alcanzo, y devuelve el MISMO estado', () => {
    for (const paso of ['deudas', 'identificar', 'pagar', 'comprobante', 'historial'] as const) {
      expect(recorrido(EN_DEMOSTRACION, { tipo: 'irA', paso }), paso).toBe(EN_DEMOSTRACION);
    }
  });

  it('y si lleva a uno alcanzado, en cualquier sentido, sin tocar el progreso', () => {
    const enPagar = tras([BUSCAR, { tipo: 'confirmarEleccion' }, { tipo: 'continuarConCorreo', correo: 'a@example.com', avisarVencimiento: true }]);
    const atras = recorrido(enPagar, { tipo: 'irA', paso: 'deudas' });
    expect(atras.paso).toBe('deudas');
    expect(atras.alcanzado).toBe(enPagar.alcanzado);
    expect(recorrido(atras, { tipo: 'irA', paso: 'pagar' }).paso).toBe('pagar');
  });
});

describe('las acciones con nombre deciden el destino', () => {
  it('`confirmarEleccion`: a «Mis datos» sin sesion, a pagar con ella; y sin nada marcado, a ninguna parte', () => {
    expect(tras([BUSCAR, { tipo: 'confirmarEleccion' }]).paso).toBe('identificar');
    const conSesion = { ...tras([BUSCAR]), autenticado: true };
    expect(recorrido(conSesion, { tipo: 'confirmarEleccion' }).paso).toBe('pagar');

    const nada = tras([BUSCAR, { tipo: 'marcarTodo' }]);
    expect(recorrido(nada, { tipo: 'confirmarEleccion' })).toBe(nada);
  });

  it('`volverAElegir`: a buscar si no se busco, a elegir qué pago si se busco', () => {
    const porElCamino = tras([BUSCAR, { tipo: 'confirmarEleccion' }, { tipo: 'continuarConCorreo', correo: 'a@example.com', avisarVencimiento: true }]);
    expect(recorrido(porElCamino, { tipo: 'volverAElegir' }).paso).toBe('deudas');

    const sinBuscar = tras([{ tipo: 'identificarse' }, { tipo: 'continuarConCorreo', correo: 'a@example.com', avisarVencimiento: true }]);
    expect(sinBuscar.paso).toBe('pagar');
    expect(recorrido(sinBuscar, { tipo: 'volverAElegir' }).paso).toBe('buscar');
  });

  it('`irAlInicio`: al primer paso sin sesion, al historial con ella', () => {
    const enDeudas = tras([BUSCAR]);
    expect(recorrido(enDeudas, { tipo: 'irAlInicio' }).paso).toBe('buscar');
    expect(recorrido({ ...enDeudas, autenticado: true }, { tipo: 'irAlInicio' }).paso).toBe('historial');
  });

  it('`pagarLoPendiente`, `verMisPagos` y `verElComprobante` exigen lo que su destino exige', () => {
    // Sin sesion no hay historial ni «lo pendiente» de nadie; sin sello, no hay comprobante.
    expect(recorrido(EN_DEMOSTRACION, { tipo: 'pagarLoPendiente' })).toBe(EN_DEMOSTRACION);
    expect(recorrido(EN_DEMOSTRACION, { tipo: 'verMisPagos' })).toBe(EN_DEMOSTRACION);
    expect(recorrido(EN_DEMOSTRACION, { tipo: 'verElComprobante' })).toBe(EN_DEMOSTRACION);

    const conSesion = tras([{ tipo: 'identificarse' }, { tipo: 'entrar' }]);
    expect(conSesion.paso).toBe('historial');
    expect(recorrido(conSesion, { tipo: 'pagarLoPendiente' }).paso).toBe('deudas');
    expect(recorrido(recorrido(conSesion, { tipo: 'pagarLoPendiente' }), { tipo: 'verMisPagos' }).paso).toBe('historial');
  });

  it('`identificarse`: a «Mis datos» sin sesion; con ella, o sin ese paso en el recorrido, a ninguna parte', () => {
    expect(recorrido(EN_DEMOSTRACION, { tipo: 'identificarse' }).paso).toBe('identificar');
    const conSesion = { ...EN_DEMOSTRACION, autenticado: true };
    expect(recorrido(conSesion, { tipo: 'identificarse' })).toBe(conSesion);
    const conPlataforma = estadoInicial({ en: CON_PLATAFORMA, autenticado: false, amnistia: false });
    expect(recorrido(conPlataforma, { tipo: 'identificarse' })).toBe(conPlataforma);
  });
});

describe('el progreso: `alcanzado`', () => {
  it('se abre con el primer paso, y nada hecho', () => {
    expect(EN_DEMOSTRACION.alcanzado).toStrictEqual({ buscar: 'abierto' });
    expect(abiertos(EN_DEMOSTRACION)).toEqual(['buscar']);
    expect(hechos(EN_DEMOSTRACION)).toEqual([]);
  });

  it('**tras «Iniciar sesión» sin haber elegido nada, no da por hecho ningun paso** (el defecto del issue)', () => {
    const detour = tras([{ tipo: 'identificarse' }]);
    expect(detour.paso).toBe('identificar');
    expect(hechos(detour)).toEqual([]);
    // «Elegir qué pago» no se alcanzo: nadie busco.
    expect(abiertos(detour)).toEqual(['buscar', 'identificar']);

    // Y dar el correo hace «Mis datos», pero sigue sin buscar ni elegir nada.
    const conCorreo = recorrido(detour, { tipo: 'continuarConCorreo', correo: 'a@example.com', avisarVencimiento: true });
    expect(hechos(conCorreo)).toEqual(['identificar']);
    expect(abiertos(conCorreo)).toEqual(['buscar', 'identificar', 'pagar']);
  });

  it('por el camino, cada paso que se deja atras queda hecho, y volver no lo deshace', () => {
    const enPagar = tras([BUSCAR, { tipo: 'confirmarEleccion' }, { tipo: 'continuarConCorreo', correo: 'a@example.com', avisarVencimiento: true }]);
    expect(hechos(enPagar)).toEqual(['buscar', 'deudas', 'identificar']);

    const atras = recorrido(enPagar, { tipo: 'irA', paso: 'deudas' });
    // El actual no se pinta como hecho; lo que se alcanzo despues sigue abierto.
    expect(hechos(atras)).toEqual(['buscar', 'identificar']);
    expect(abiertos(atras)).toEqual(['buscar', 'deudas', 'identificar', 'pagar']);

    const pagado = recorrido(recorrido(atras, { tipo: 'irA', paso: 'pagar' }), { tipo: 'confirmarPago' });
    expect(pagado.paso).toBe('comprobante');
    expect(hechos(pagado)).toEqual(['buscar', 'deudas', 'identificar', 'pagar']);
  });

  it('una busqueda nueva vuelve a empezar la eleccion (el comprobante sellado se conserva)', () => {
    const pagado = tras([
      BUSCAR,
      { tipo: 'confirmarEleccion' },
      { tipo: 'continuarConCorreo', correo: 'a@example.com', avisarVencimiento: true },
      { tipo: 'confirmarPago' },
      { tipo: 'consultarOtra' },
    ]);
    expect(abiertos(pagado)).toEqual(['buscar', 'comprobante']);
    const otra = recorrido(pagado, BUSCAR);
    expect(abiertos(otra)).toEqual(['buscar', 'deudas', 'comprobante']);
    expect(hechos(otra)).toEqual(['buscar']);
  });

  it('«Cerrar sesión» lo olvida todo, como el recibo', () => {
    const pagado = tras([
      BUSCAR,
      { tipo: 'confirmarEleccion' },
      { tipo: 'entrar' },
      { tipo: 'confirmarPago' },
      { tipo: 'cerrarSesion' },
    ]);
    expect(pagado.alcanzado).toStrictEqual({ buscar: 'abierto' });
  });

  it('con plataforma y sesion, «Entrar» esta hecho y no se vuelve a abrir', () => {
    const deuda: DeudaDelServidor = {
      id: 'predial-2024',
      concepto: 'Impuesto predial 2024',
      unidad: 'Sin detalle del predio',
      insoluto: '100.00',
      reajuste: '0.00',
      interes: '0.00',
      gastos: '0.00',
      actualizadoA: { insoluto: '2026-09-16', reajuste: '2026-09-16', interes: '2026-09-16', gastos: '2026-09-16' },
      totalDelServidor: '100.00',
      tributo: 'PREDIAL',
      ejercicio: 2024,
      cuotas: null,
      vence: null,
      estado: null,
      tono: null,
      detalle: null,
    };
    const inicial = { ...estadoInicial({ en: CON_PLATAFORMA, autenticado: true, amnistia: false }), deudas: [deuda] };
    expect(inicial.alcanzado).toStrictEqual({ entrar: 'hecho', deudas: 'abierto' });
    expect(hechos(inicial, PASOS_CON_PLATAFORMA)).toEqual(['entrar']);
    expect(abiertos(inicial, PASOS_CON_PLATAFORMA)).toEqual(['deudas']);

    const alFinal = tras([{ tipo: 'confirmarEleccion' }, { tipo: 'confirmarPago' }], inicial);
    expect(alFinal.paso).toBe('comprobante');
    expect(hechos(alFinal, PASOS_CON_PLATAFORMA)).toEqual(['entrar', 'deudas', 'pagar']);
    expect(abiertos(alFinal, PASOS_CON_PLATAFORMA)).toEqual(['deudas', 'pagar', 'comprobante']);
  });
});

describe('`alcanzadoHasta`: el progreso de quien llego a un paso por el camino', () => {
  it('todo lo anterior hecho, el paso abierto; el comprobante no se guarda (lo abre el sello)', () => {
    expect(alcanzadoHasta(EN_DEMOSTRACION, 'pagar')).toStrictEqual({
      buscar: 'hecho',
      deudas: 'hecho',
      identificar: 'hecho',
      pagar: 'abierto',
    });
    expect(alcanzadoHasta(EN_DEMOSTRACION, 'comprobante')).toStrictEqual({
      buscar: 'hecho',
      deudas: 'hecho',
      identificar: 'hecho',
      pagar: 'hecho',
    });
    // Un paso que no es de la franja (el historial): el primero, abierto.
    expect(alcanzadoHasta(EN_DEMOSTRACION, 'historial')).toStrictEqual({ buscar: 'abierto' });
  });
});
