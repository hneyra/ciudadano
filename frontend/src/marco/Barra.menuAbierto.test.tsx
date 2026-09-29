import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { limpiarElPortal, montarElPortal, plazosDelPortal, remendarJsdomParaElMenu } from '../pruebas/portal.tsx';

/**
 * **Con el menu de la sesion abierto, el resto de la pagina sigue en el arbol de accesibilidad** (issue 75).
 *
 * `DropdownMenu` de Radix es modal por omision: mientras la lista esta abierta, `hideOthers` pone
 * `aria-hidden="true"` a todo lo que no es el menu, y lo oculto sigue siendo enfocable —la barra, la
 * franja, `main` y el pie—. axe lo da como `aria-hidden-focus` (serious) en los cuatro, en los dos
 * modos y a todas las anchuras. `Barra.tsx` abre el menu **no modal** (`modal={false}`), y esto lo
 * fija por rol: Testing Library no encuentra por rol lo que esta dentro de un `aria-hidden`, asi que
 * con el menu modal ninguna de estas regiones aparece.
 *
 * Que axe no encuentre nada grave con el menu abierto, y que Tab no saque el foco del menu, lo mide
 * el arnes en Chromium (`seVeBienConLaListaAbierta` de `e2e/portal.ts`).
 */

beforeAll(remendarJsdomParaElMenu);
afterEach(limpiarElPortal);

/** Abre el menu de la sesion con el teclado y devuelve su disparador. */
function abrirElMenu(): HTMLElement {
  const disparador = within(screen.getByRole('banner')).getByRole('button', { expanded: false, name: /María E\. Castillo/ });
  act(() => disparador.focus());
  fireEvent.keyDown(disparador, { key: 'Enter' });
  expect(screen.getByRole('menu')).toBeInTheDocument();
  return disparador;
}

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('el menu de la sesion abierto', () => {
  it('no oculta la pagina: la barra, la franja, `main` y el pie se siguen encontrando por su rol', () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    const disparador = abrirElMenu();

    expect(screen.getByRole('banner')).toContainElement(disparador);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' })).toBeInTheDocument();
  });

  it('Escape lo cierra y devuelve el foco a su disparador', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    const disparador = abrirElMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(disparador));
    expect(disparador).toHaveAttribute('aria-expanded', 'false');
  });
});
