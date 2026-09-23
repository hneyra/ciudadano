import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { limpiarElPortal, montarElPortal, plazosDelPortal } from './pruebas/portal.tsx';

/**
 * **Las rutas hash obedecen al recorrido**: lo que no es alcanzable redirige, con `replace`, al
 * ultimo paso que si lo es.
 *
 * Se entra por el hash como entraria el navegador —`montarElPortal` pone la URL antes de crear el
 * enrutador— y se mira `window.location.hash`, que es lo que ve quien comparte el enlace.
 */

afterEach(limpiarElPortal);

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('entrar por hash', () => {
  it('`#/pagar` sin haber buscado redirige a `#/buscar`', async () => {
    montarElPortal({ hash: '#/pagar' });

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(screen.getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '¿Cómo quiere pagar?' })).toBeNull();
  });

  it('`#/historial` sin sesion redirige a `#/buscar`', async () => {
    montarElPortal({ hash: '#/historial' });

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(screen.queryByRole('heading', { name: 'Mis pagos' })).toBeNull();
  });

  it('y la redireccion REEMPLAZA: el hash no alcanzable no queda en el historial del navegador', async () => {
    window.history.replaceState(null, '', '/#/buscar');
    const antes = window.history.length;

    montarElPortal({ hash: '#/comprobante' });

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(window.history.length).toBe(antes);
  });

  it('la raiz y lo que no es una ruta llevan al paso en que se esta', async () => {
    montarElPortal({ hash: '#/', estado: { paso: 'deudas' } });
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await limpiarElPortal();

    montarElPortal({ hash: '#/no-existe' });
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
  });

  it('un paso anterior alcanzable se abre, y el recorrido lo sigue', async () => {
    montarElPortal({ hash: '#/deudas', estado: { paso: 'pagar' } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/deudas');
    const franja = screen.getByRole('navigation');
    await waitFor(() =>
      expect(within(franja).getByRole('button', { name: 'Elegir qué pago' })).toHaveAttribute('aria-current', 'step'),
    );
  });

  it('con sesion, el historial se abre y la franja no esta', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'buscar', autenticado: true } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis pagos' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/historial');
    await waitFor(() => expect(screen.queryByRole('navigation')).toBeNull());
  });
});

describe('atras y adelante del navegador', () => {
  /** Mueve el historial del navegador y deja que el `popstate` llegue y el enrutador responda. */
  async function moverElHistorial(mover: () => void): Promise<void> {
    await act(async () => {
      mover();
      await new Promise((listo) => setTimeout(listo, 50));
    });
  }

  it('atras vuelve a un paso ya hecho, y adelante ya no lleva al que dejo de ser alcanzable', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    const franja = screen.getByRole('navigation');
    expect(within(franja).getByRole('button', { name: 'Mis datos' })).toHaveAttribute('aria-current', 'step');

    // Atras: `#/buscar` es anterior, se abre y el recorrido lo sigue.
    await moverElHistorial(() => window.history.back());
    expect(window.location.hash).toBe('#/buscar');
    expect(within(franja).getByRole('button', { name: 'Buscar mi deuda' })).toHaveAttribute('aria-current', 'step');

    // Adelante: `#/identificar` ya no es alcanzable desde buscar, y se vuelve a buscar.
    await moverElHistorial(() => window.history.forward());
    expect(window.location.hash).toBe('#/buscar');
    expect(screen.queryByRole('heading', { name: '¿A dónde le enviamos el comprobante?' })).toBeNull();
  });
});
