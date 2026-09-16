import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { limpiarElPortal, montarElPortal } from '../../pruebas/portal.tsx';

/**
 * **Toda cifra del paso 4 sale de las cuentas**, y ninguna de una suma de la pantalla (issue 8).
 *
 * Como `Deudas.cuentas.test.tsx`: mirar que el total «da» `S/ 3,149.92` no lo demuestra, porque una
 * pantalla que sumara por su cuenta daria lo mismo. Aqui **se sustituyen las cuentas** por unas que
 * devuelven cifras imposibles y se exige que el resumen, las instrucciones del medio y el pago sellado
 * digan ESAS.
 *
 * El reductor importa la misma `cuentaDe`, asi que `cuentaPorPagar` y lo que `confirmarPago` sella
 * salen tambien de la sustituida: lo que se mide es la pantalla entera sobre las cuentas.
 */

vi.mock('../../datos/cuentas.ts', async (original) => {
  const deVerdad = await original<typeof import('../../datos/cuentas.ts')>();
  return {
    ...deVerdad,
    totalDe: () => '1111.11',
    cuentaDe: () => ({ insoluto: '3.33', interes: '4.44', gastos: '5.55', total: '6.66', conAmnistia: '7.77' }),
  };
});

afterEach(limpiarElPortal);

describe('las cifras del paso 4 son las de `cuentas.ts`', () => {
  it('el resumen, el `{{TOTAL}}` de las instrucciones y lo que se sella pintan lo que las cuentas devuelven', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', numero: '00000025673', medio: 'yape' } });
    const main = within(screen.getByRole('main'));
    const resumen = within(main.getByRole('region', { name: 'Lo que va a pagar' }));
    const cifra = (rotulo: string) => resumen.getByText(rotulo, { selector: 'dt' }).nextElementSibling?.textContent;

    // `totalDe`: cada fila.
    expect(resumen.getAllByRole('listitem').map((fila) => fila.lastElementChild?.textContent)).toEqual([
      'S/ 1,111.11',
      'S/ 1,111.11',
      'S/ 1,111.11',
      'S/ 1,111.11',
    ]);
    // `cuentaDe`: los totales, y el importe de las instrucciones.
    expect(cifra('Impuesto y arbitrios')).toBe('S/ 3.33');
    expect(cifra('Interés condonado')).toBe('− S/ 4.44');
    expect(cifra('Gastos y costas')).toBe('S/ 5.55');
    expect(cifra('Total a pagar')).toBe('S/ 7.77');
    const yape = within(main.getByRole('region', { name: 'Pagar con Yape o Plin' }));
    expect(yape.getByText('Confirme el monto exacto de S/ 7.77 y escriba su código de contribuyente en el mensaje.')).toBeInTheDocument();

    for (const deVerdad of ['3,149.92', '3,041.92', '413.32', '108.00', '293.72', '2,067.04']) {
      expect(screen.getByRole('main').textContent, deVerdad).not.toContain(deVerdad);
    }

    // Y lo que se sella tambien: confirmar sigue funcionando sobre las cuentas sustituidas.
    fireEvent.click(yape.getByRole('button', { name: 'Ya yapeé' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
  });
});
