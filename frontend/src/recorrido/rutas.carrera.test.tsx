import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type EscuchaDelNavegador,
  esperarAlNavegador,
  limpiarElPortal,
  montarElPortal,
  moverElNavegador,
  oirAlNavegador,
  plazosDelPortal,
} from '../pruebas/portal.tsx';
import type { AccionDelRecorrido } from './recorrido.ts';

/**
 * **La URL cambia otra vez mientras el recorrido todavia no ha dibujado el paso que siguio** (issue
 * 74). Determinista: no depende de la carga, sino de PONER a proposito el cambio de URL en el hueco.
 *
 * `useLaUrlYElPaso` sigue a la URL despachando `irA`, y el dibujo con el paso nuevo llega DESPUES, en
 * otra tarea. Si entre las dos la URL vuelve a cambiar —la persona pulsa Atras dos veces seguidas con
 * la maquina ocupada, o un enlace—, el dibujo siguiente ve «cambio el paso» y hasta el issue 74 lo
 * tomaba por una ACCION de la persona (regla 1): empujaba la ruta del paso que el mismo gancho habia
 * pedido, con una entrada NUEVA, encima de la URL que la persona acababa de poner. Su segundo Atras
 * se perdia y el historial ganaba una entrada que nadie dio.
 *
 * El hueco se pone con un `despachar` envuelto: cuando el gancho despacha el `irA` que sigue al
 * primer Atras, la URL cambia en el acto, antes de que React dibuje. El segundo cambio es un
 * `location.hash` y no otro `history.back()` porque en jsdom `back()` no mueve la URL hasta dos
 * `setTimeout` despues, y dentro de `act` React ya habria dibujado; en un navegador el segundo Atras
 * cae en el mismo hueco (una tarea de la historia entre la del efecto y la del dibujo), y lo que el
 * gancho ve es lo mismo: la URL en otro paso y el suyo recien cambiado.
 */

const trampa = vi.hoisted(() => ({ alSeguir: null as null | ((accion: AccionDelRecorrido) => void) }));

vi.mock('./ProveedorDelRecorrido.tsx', async (importarElOriginal) => {
  const original = await importarElOriginal<typeof import('./ProveedorDelRecorrido.tsx')>();
  // La MISMA funcion para el mismo `despachar`: con una nueva en cada dibujo, el efecto del gancho
  // (que la tiene entre sus dependencias) correria en cada dibujo y la prueba mediria otra cosa.
  const envueltos = new WeakMap<object, (accion: AccionDelRecorrido) => void>();
  return {
    ...original,
    useRecorrido: () => {
      const valor = original.useRecorrido();
      let envuelto = envueltos.get(valor.despachar);
      if (envuelto === undefined) {
        envuelto = (accion) => {
          valor.despachar(accion);
          const alSeguir = trampa.alSeguir;
          if (accion.tipo === 'irA' && alSeguir !== null) {
            trampa.alSeguir = null;
            alSeguir(accion);
          }
        };
        envueltos.set(valor.despachar, envuelto);
      }
      return { ...valor, despachar: envuelto };
    },
  };
});

afterEach(async () => {
  trampa.alSeguir = null;
  await limpiarElPortal();
});

plazosDelPortal();

describe('la URL cambia otra vez antes de que se dibuje el paso que el recorrido siguio', () => {
  it('manda la ultima URL, y el gancho no mete en el historial una entrada que nadie dio', async () => {
    // El historial de quien llego hasta pagar: buscar, deudas, identificar, pagar.
    window.history.replaceState(null, '', '/#/buscar');
    window.history.pushState(null, '', '/#/deudas');
    window.history.pushState(null, '', '/#/identificar');
    window.history.pushState(null, '', '/#/pagar');
    montarElPortal({
      hash: '#/pagar',
      estado: { paso: 'pagar', numero: '00000025673', correo: 'maria@example.com' },
    });
    const franja = () => within(screen.getByRole('navigation'));
    expect(franja().getByRole('button', { name: 'Pagar' })).toHaveAttribute('aria-current', 'step');
    const largo = window.history.length;

    // Primer Atras, a «Mis datos». En cuanto el gancho despacha el `irA` que lo sigue —antes del
    // dibujo—, la URL pasa a «Elegir qué pago».
    const seguidos: AccionDelRecorrido[] = [];
    const escuchas: EscuchaDelNavegador[] = [];
    trampa.alSeguir = (accion) => {
      seguidos.push(accion);
      // El oyente del `popstate` de este cambio, puesto ANTES de hacerlo: jsdom lo encola un
      // `setTimeout` despues, y no debe poder llegar antes que quien lo espera.
      escuchas.push(oirAlNavegador());
      window.location.hash = '#/deudas';
    };
    await moverElNavegador(() => window.history.back());

    // La trampa salto donde tenia que saltar: al seguir el primer Atras.
    expect(seguidos).toEqual([{ tipo: 'irA', paso: 'identificar' }]);
    // Y que llegue el `popstate` del segundo cambio.
    expect(escuchas).toHaveLength(1);
    for (const escucha of escuchas) await esperarAlNavegador(escucha);
    // Manda lo ULTIMO que dijo la URL. Hasta el issue 74: «expected '#/identificar' to be '#/deudas'».
    expect(window.location.hash).toBe('#/deudas');
    expect(franja().getByRole('button', { name: 'Elegir qué pago' })).toHaveAttribute('aria-current', 'step');
    // Atras (-1) y un enlace (+1): el mismo largo. El gancho no empujo nada.
    expect(window.history.length).toBe(largo);
  });
});
