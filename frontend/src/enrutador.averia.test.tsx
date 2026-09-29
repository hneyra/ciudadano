import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n, { IDIOMA_MARCADO } from './i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal, plazosDelPortal } from './pruebas/portal.tsx';

/**
 * **Lo que revienta DENTRO del enrutador tambien se dice con palabras del portal** (issue 67).
 *
 * Sin un `errorElement`, lo que lanza una pantalla o el marco lo recoge el limite POR OMISION de
 * React Router: «Unexpected Application Error!», en ingles, sin el tema y con la pila del error. Es
 * el mismo agujero que el de la raiz, un nivel mas abajo. Aqui se monta el portal entero con una
 * pantalla y un pie que revientan al pulsar un boton.
 */

vi.mock('./pasos/buscar/Buscar.tsx', () => ({
  /** «Buscar mi deuda», rota a proposito: se dibuja, y revienta en el dibujo que sigue al clic. */
  Buscar() {
    const [rota, romper] = useState(false);
    if (rota) throw new Error('la pantalla revento');
    return (
      <button type="button" onClick={() => romper(true)}>
        Romper la pantalla
      </button>
    );
  },
}));

vi.mock('./marco/Pie.tsx', () => ({
  /** El pie, roto igual: lo que revienta entonces es el MARCO. */
  Pie() {
    const [roto, romper] = useState(false);
    if (roto) throw new Error('el marco revento');
    return (
      <footer>
        <button type="button" onClick={() => romper(true)}>
          Romper el marco
        </button>
      </footer>
    );
  },
}));

beforeEach(() => {
  // React y el enrutador cuentan en la consola lo que recogieron: es lo esperado aqui, y no se mide.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

const REMEDIO =
  'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.';

describe('AC2 — un error en un dibujo posterior, dentro del enrutador', () => {
  it('una PANTALLA que revienta deja el aviso dentro del marco: la barra y la franja siguen', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(await screen.findByRole('button', { name: 'Romper la pantalla' }));

    expect(document.body.textContent, 'lo recogio el limite por omision de React Router').not.toMatch(
      /Unexpected Application Error/,
    );
    const aviso = await within(screen.getByRole('main')).findByRole('alert');
    expect(aviso).toHaveTextContent('No se pudo mostrar esta pantalla');
    expect(aviso).toHaveTextContent(REMEDIO);
    expect(within(aviso).getByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
    expect(aviso).not.toHaveTextContent('la pantalla revento');
    // El marco no se fue con la pantalla: se puede ir a otro paso sin recargar.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('y moverse a otro paso deja atras el aviso: el marco en pie sirve para algo', async () => {
    montarElPortal({ hash: '#/buscar' });
    fireEvent.click(await screen.findByRole('button', { name: 'Romper la pantalla' }));
    await within(screen.getByRole('main')).findByRole('alert');

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await within(screen.getByRole('main')).findByRole('heading', {
        level: 1,
        name: '¿A dónde le enviamos el comprobante?',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('y si revienta el MARCO, el aviso ocupa la pagina, con palabras del portal', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(await screen.findByRole('button', { name: 'Romper el marco' }));

    expect(document.body.textContent, 'lo recogio el limite por omision de React Router').not.toMatch(
      /Unexpected Application Error/,
    );
    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('No se pudo mostrar esta pantalla');
    expect(within(aviso).getByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Unexpected Application Error|el marco revento/);
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('en los dos casos, lo que dice pasa por `t()`', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(await screen.findByRole('button', { name: 'Romper la pantalla' }));

    const enLaPantalla = await within(screen.getByRole('main')).findByRole('alert');
    const loQueDice = [marcado('No se pudo mostrar esta pantalla'), marcado(REMEDIO), marcado('Volver a cargar')].join('');
    expect(enLaPantalla.textContent).toBe(loQueDice);

    fireEvent.click(screen.getByRole('button', { name: 'Romper el marco' }));

    await waitFor(() => expect(screen.queryByRole('banner')).toBeNull());
    expect(screen.getByRole('alert').textContent).toBe(loQueDice);
  });
});
