import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { limpiarElPortal, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';

/**
 * **Toda cifra del historial sale de `src/datos/cuentas.ts`**, y ninguna de una suma de la pantalla
 * (issue 10), con el mismo metodo que `Deudas.cuentas.test.tsx`.
 *
 * Que el total pendiente «da» `S/ 3,563.24` no lo demuestra: una pantalla que sumara por su cuenta con
 * `sumarImportes` daria lo mismo. Aqui **se sustituyen las cuentas** por unas que devuelven cifras
 * imposibles y se exige que la pantalla pinte ESAS: el total de lo pendiente (`cuentaDe`, por
 * `cuentaPendiente` del reductor), el de cada concepto (`totalDe`) y la columna «Importe S/»
 * (`cifraSinSimbolo`).
 */

vi.mock('../../datos/cuentas.ts', async (original) => {
  const deVerdad = await original<typeof import('../../datos/cuentas.ts')>();
  return {
    ...deVerdad,
    totalDe: () => '1111.11',
    cuentaDe: () => ({ insoluto: '3.33', interes: '4.44', gastos: '5.55', total: '6.66', conAmnistia: '7.77' }),
    cifraSinSimbolo: (importe: string) => `cifra de ${importe}`,
  };
});

afterEach(limpiarElPortal);

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('las cifras del historial son las de `cuentas.ts`', () => {
  it('el total pendiente, cada concepto y la columna «Importe S/» pintan lo que las cuentas devuelven', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });
    const main = within(screen.getByRole('main'));

    const pendiente = main.getByRole('region', { name: 'Lo que queda pendiente' });
    expect(pendiente.querySelector('[data-total-pendiente]')).toHaveTextContent('S/ 6.66');
    expect(within(pendiente).getAllByText('S/ 1,111.11')).toHaveLength(4);

    const pagos = main.getByRole('region', { name: 'Pagos realizados' });
    await waitFor(() => expect(pagos).not.toHaveAttribute('aria-busy'));
    expect([...pagos.querySelectorAll('tbody tr')].map((tr) => tr.children[4]?.textContent)).toEqual([
      'cifra de 294.84',
      'cifra de 412.00',
      'cifra de 578.20',
      'cifra de 148.60',
      'cifra de 460.65',
    ]);

    // Y ninguna cifra de verdad se colo por otro camino.
    for (const deVerdad of ['S/ 3,563.24', 'S/ 293.72', 'S/ 310.04', 'S/ 2,067.04', 'S/ 892.44', '294.84']) {
      expect(main.queryByText(deVerdad), deVerdad).toBeNull();
    }
  });
});
