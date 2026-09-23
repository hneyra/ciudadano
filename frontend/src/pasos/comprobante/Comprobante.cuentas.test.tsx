import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { limpiarElPortal, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';

/**
 * **El importe de cada fila del comprobante sale de las cuentas**, y no de una suma de la pantalla
 * (issue 9).
 *
 * Como `Pagar.cuentas.test.tsx`: que la fila del predial 2024 «de» `1,854.60` no lo demuestra, porque
 * una pantalla que sumara insoluto + gastos por su cuenta daria lo mismo. Aqui **se sustituye
 * `conAmnistiaDe`** por una que devuelve una cifra imposible y se exige que las cuatro filas digan ESA.
 * El condonado y el total no cambian: son los del sello, que sale de `cuentaDe` (la de verdad aqui).
 */

vi.mock('../../datos/cuentas.ts', async (original) => {
  const deVerdad = await original<typeof import('../../datos/cuentas.ts')>();
  return { ...deVerdad, conAmnistiaDe: () => '1111.11' };
});

afterEach(limpiarElPortal);

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('las filas del comprobante son las de `cuentas.ts`', () => {
  it('cada fila pinta lo que `conAmnistiaDe` devuelve', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', numero: '00000025673', correo: 'maria@correo.com' } });
    const main = within(screen.getByRole('main'));
    fireEvent.click(main.getByRole('button', { name: 'Pagar ahora' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));

    const recibo = await main.findByRole('region', { name: 'Constancia de pago' });
    expect([...recibo.querySelectorAll('tbody tr')].map((tr) => tr.lastElementChild?.textContent)).toEqual([
      '1,111.11',
      '1,111.11',
      '1,111.11',
      '1,111.11',
    ]);
    for (const deVerdad of ['293.72', '291.60', '1,854.60', '710.00']) {
      expect(recibo.querySelector('tbody')?.textContent, deVerdad).not.toContain(deVerdad);
    }
    expect([...recibo.querySelectorAll('tfoot td')].map((td) => td.textContent)).toEqual(['− 413.32', '3,149.92']);
  });
});
