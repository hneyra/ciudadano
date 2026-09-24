import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { HISTORIAL, UNIDADES } from '../../datos/demostracion.ts';
import type { FuenteDelPortal } from '../../datos/fuente.ts';
import {
  limpiarElPortal,
  montarElPortal,
  remendarJsdomParaElMenu,
  plazosDelPortal,
} from '../../pruebas/portal.tsx';

/**
 * **«Mis pagos» y «Mis predios y vehículos» del menu de la sesion** llevan al historial (issue 10).
 *
 * Los dos a `#/historial`, como el artboard (lineas 1052-1053). «Mis predios y vehículos», ademas, deja
 * el foco en «De dónde sale lo que paga» y lo trae a la vista; «Mis pagos», no.
 *
 * Aparte de `Historial.test.tsx` porque el menu es `DropdownMenu` de Radix, que bajo jsdom pide sus
 * remiendos (como `Barra.test.tsx`). `scrollIntoView` es uno de ellos: aqui se espia.
 */

beforeAll(remendarJsdomParaElMenu);
afterEach(async () => {
  vi.restoreAllMocks();
  await limpiarElPortal();
});

/** Abre el menu de la sesion con el teclado, elige una opcion y devuelve cuantas veces recibio el foco su disparador despues. */
function elegirEnElMenu(opcion: string): { readonly vecesQueElDisparadorTomoElFoco: () => number } {
  const disparador = within(screen.getByRole('banner')).getByRole('button', { expanded: false, name: /María E\. Castillo/ });
  act(() => disparador.focus());
  fireEvent.keyDown(disparador, { key: 'Enter' });
  let veces = 0;
  disparador.addEventListener('focus', () => (veces += 1));
  fireEvent.click(screen.getByRole('menuitem', { name: opcion }));
  return { vecesQueElDisparadorTomoElFoco: () => veces };
}

/** Deja correr los temporizadores con que Radix devuelve el foco al cerrar el menu. */
async function queSeCierreElMenu(): Promise<void> {
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  await act(async () => {
    await new Promise((listo) => setTimeout(listo, 20));
  });
}

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('el menu de la sesion lleva al historial', () => {
  it('«Mis predios y vehículos»: `#/historial`, con el foco y la vista en «De dónde sale lo que paga»', async () => {
    const aLaVista = vi.spyOn(Element.prototype, 'scrollIntoView');
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    const menu = elegirEnElMenu('Mis predios y vehículos');
    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
    const titulo = await within(screen.getByRole('main')).findByRole('heading', {
      level: 2,
      name: 'De dónde sale lo que paga',
    });
    await queSeCierreElMenu();

    await waitFor(() => expect(document.activeElement).toBe(titulo));
    expect(aLaVista.mock.contexts).toEqual([titulo]);
    // El menu no devuelve el foco a su disparador de camino: un lector lo anunciaria antes que la seccion.
    expect(menu.vecesQueElDisparadorTomoElFoco()).toBe(0);
    // Con la seccion ya cargada: las tres unidades estan debajo del titulo enfocado.
    expect(screen.getByRole('region', { name: 'De dónde sale lo que paga' }).querySelectorAll(':scope > ul > li')).toHaveLength(3);

    // Una vez: volver a dibujar el historial no le vuelve a quitar el foco a quien lo tenga.
    const pagarLoPendiente = screen.getByRole('button', { name: 'Pagar lo pendiente' });
    act(() => pagarLoPendiente.focus());
    fireEvent.click(within(screen.getByRole('region', { name: 'Pagos realizados' })).getByRole('button', { name: 'Comprobante 0003-0041182' }));
    await screen.findByText('Se descargaría el comprobante 0003-0041182.');
    expect(aLaVista).toHaveBeenCalledTimes(1);
  });

  it('«Mis predios y vehículos» estando ya en el historial, tambien', async () => {
    const aLaVista = vi.spyOn(Element.prototype, 'scrollIntoView');
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });
    await screen.findByRole('heading', { level: 1, name: 'Mis pagos' });

    elegirEnElMenu('Mis predios y vehículos');
    await queSeCierreElMenu();

    const titulo = screen.getByRole('heading', { level: 2, name: 'De dónde sale lo que paga' });
    await waitFor(() => expect(document.activeElement).toBe(titulo));
    expect(aLaVista.mock.contexts).toEqual([titulo]);
  });

  it('espera a que la fuente conteste: con los pagos aun por llegar, la seccion todavia no esta en su sitio', async () => {
    const aLaVista = vi.spyOn(Element.prototype, 'scrollIntoView');
    let contestar: (valor: typeof HISTORIAL) => void = () => {};
    const lenta: FuenteDelPortal = {
      // Sin plataforma no hay consulta que hacer: el historial se lee igual (issue 27).
      consulta: null,
      amnistia: true,
      historial: () => new Promise((resolver) => (contestar = resolver)),
      unidades: () => Promise.resolve(UNIDADES),
    };
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true }, fuente: lenta });
    await screen.findByText('8.20 m de frontis');

    elegirEnElMenu('Mis predios y vehículos');
    await queSeCierreElMenu();
    const titulo = screen.getByRole('heading', { level: 2, name: 'De dónde sale lo que paga' });
    expect(aLaVista.mock.contexts).not.toContain(titulo);
    expect(document.activeElement).not.toBe(titulo);

    await act(async () => contestar(HISTORIAL));
    await waitFor(() => expect(document.activeElement).toBe(titulo));
    expect(aLaVista.mock.contexts).toEqual([titulo]);
  });

  it('«Mis pagos»: `#/historial` sin mover el foco a las unidades', async () => {
    const aLaVista = vi.spyOn(Element.prototype, 'scrollIntoView');
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    elegirEnElMenu('Mis pagos');
    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
    const titulo = await screen.findByRole('heading', { level: 2, name: 'De dónde sale lo que paga' });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Pagos realizados' })).not.toHaveAttribute('aria-busy'));
    await queSeCierreElMenu();

    expect(document.activeElement).not.toBe(titulo);
    expect(aLaVista.mock.contexts).not.toContain(titulo);
  });
});
