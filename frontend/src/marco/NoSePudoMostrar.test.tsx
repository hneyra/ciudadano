import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NoSePudoMostrar } from './NoSePudoMostrar.tsx';

/**
 * **«Volver a cargar» recarga** (issue 67). Que el aviso salga cuando algo revienta lo miden
 * `src/montaje.test.tsx` (la raiz) y `src/enrutador.averia.test.tsx` (el enrutador); aqui, el boton.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('«Volver a cargar»', () => {
  it('llama a lo que recarga, una vez', () => {
    const recargar = vi.fn();
    render(<NoSePudoMostrar recargar={recargar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));

    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('y lo que recarga, por omision, es la pagina', () => {
    // `location.reload` no se deja espiar en jsdom (propiedad no configurable), pero jsdom avisa por
    // la consola de que no navega: ese aviso es la prueba de que se pidio recargar.
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<NoSePudoMostrar />);

    fireEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));

    expect(consola.mock.calls.flat().map(String).join('\n')).toMatch(/Not implemented: navigation/);
  });
});
