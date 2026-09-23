import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  limpiarElPortal,
  montarElPortal,
  remendarJsdomParaElMenu,
  plazosDelPortal,
} from '../../pruebas/portal.tsx';

/**
 * **Tras «Cerrar sesión», el comprobante no queda a la vista** (revision del PR del issue 9).
 *
 * En un equipo compartido, el recibo sellado dice el nombre del contribuyente, el correo de la cuenta y
 * el numero de operacion. `cerrarSesion` lo olvida (`src/recorrido/recorrido.ts`), y aqui se mide en la
 * pagina: ni la franja ni la URL lo vuelven a abrir.
 *
 * Aparte de `Comprobante.test.tsx` porque el menu de la sesion es `DropdownMenu` de Radix, que bajo
 * jsdom pide sus remiendos (como `Barra.test.tsx`).
 */

beforeAll(remendarJsdomParaElMenu);
afterEach(limpiarElPortal);

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('cerrar sesion desde el comprobante', () => {
  it('vuelve a buscar, y `#/comprobante` redirige a `#/buscar` sin ensenar el recibo', async () => {
    const { enrutador } = montarElPortal({
      hash: '#/pagar',
      estado: { paso: 'pagar', numero: '00000025673', autenticado: true, marcadas: { pred26: true } },
    });
    const main = () => within(screen.getByRole('main'));
    fireEvent.click(main().getByRole('button', { name: 'Pagar ahora' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    await main().findByRole('region', { name: 'Constancia de pago' });

    const barra = within(screen.getByRole('banner'));
    const disparador = barra.getByRole('button', { expanded: false, name: /María E\. Castillo/ });
    act(() => disparador.focus());
    fireEvent.keyDown(disparador, { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));

    // La franja ya no lo abre: es un paso futuro otra vez.
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Comprobante' }));
    expect(await screen.findByText('Complete primero los pasos anteriores.')).toBeInTheDocument();

    // Y escrito en la URL, redirige con `replace`.
    await act(async () => {
      await enrutador.navigate('/comprobante');
    });
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(screen.queryByRole('region', { name: 'Constancia de pago' })).toBeNull();
    expect(document.body.textContent).not.toContain('0003-0041418');
    expect(document.body.textContent).not.toContain('86 4418 2026 0913');
  });
});
