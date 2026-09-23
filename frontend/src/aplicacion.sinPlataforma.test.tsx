import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { identidad } from './api/identidad.ts';
import { laFuente } from './datos/laFuente.ts';
import { limpiarElPortal, montarElPortal, plazosDelPortal } from './pruebas/portal.tsx';

/**
 * **Con la bandera encendida, el portal no habla con nadie** (issue 27).
 *
 * Es la mitad del doble modo que no se ve mirando la pantalla: en modo demostracion el portal se
 * dibuja igual **saliera o no** a la red. Si saliera, `yarn dev` sin plataforma levantada llenaria la
 * consola de fallos, el arnes dependeria de que Keycloak este arriba y las pruebas irian a la red de
 * quien las corre.
 *
 * Por eso se cuenta lo que sale por los dos caminos que existen:
 *
 *   · **`fetch`**, que es por donde iria cualquier peticion del cliente de la API;
 *   · **la puerta**, que no usa `fetch` para irse: `entrar()` navega, y una navegacion no se cuenta
 *     como peticion. Se espia el metodo de la identidad.
 *
 * La fuente NO se escribe aqui: se pide a `laFuente()`, o sea a la misma eleccion que hace
 * `main.tsx`. Con una fuente de demostracion puesta a mano, esta prueba seguiria verde el dia que la
 * eleccion se invirtiera.
 */

let pedidas: string[] = [];

beforeEach(() => {
  pedidas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((entrada) => {
      pedidas.push(String(entrada));
      // Nadie contesta, que es el estado de un puesto sin plataforma levantada.
      return Promise.reject(new TypeError('Failed to fetch'));
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('el recorrido entero en modo demostracion', () => {
  it('EL CENTINELA: la fuente elegida es la de demostracion, y no tiene consulta', async () => {
    // Sin esto, lo de abajo pasaria en verde con una fuente de plataforma que nadie llegara a usar.
    expect((await laFuente()).consulta).toBeNull();
  });

  it('se busca, se elige y se llega a pagar sin UNA sola peticion ni una ida a la puerta', async () => {
    const ida = vi.spyOn(identidad, 'entrar').mockResolvedValue(null);
    const salida = vi.spyOn(identidad, 'salir').mockImplementation(() => {});
    montarElPortal({ fuente: await laFuente() });

    const principal = () => within(screen.getByRole('main'));
    fireEvent.change(principal().getByRole('textbox', { name: 'Código de contribuyente' }), {
      target: { value: '00000025673' },
    });
    fireEvent.click(principal().getByRole('button', { name: 'Buscar mi deuda' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));

    // La deuda de la demostracion, dibujada entera: no hay «Consultando su deuda…» que esperar.
    expect(await principal().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeInTheDocument();
    expect(principal().getByText('Impuesto predial 2026')).toBeInTheDocument();

    fireEvent.click(principal().getByRole('button', { name: 'Pagar todo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));

    expect(pedidas, `El portal en modo demostracion pidio: ${pedidas.join(', ')}`).toEqual([]);
    expect(ida, 'fue a la puerta de identidad estando en modo demostracion').not.toHaveBeenCalled();
    expect(salida).not.toHaveBeenCalled();
  });

  it('y «Iniciar sesión» sigue llevando al paso «Mis datos», no a Keycloak', async () => {
    const ida = vi.spyOn(identidad, 'entrar').mockResolvedValue(null);
    montarElPortal({ fuente: await laFuente() });

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    expect(ida).not.toHaveBeenCalled();
    expect(pedidas).toEqual([]);
  });
});
