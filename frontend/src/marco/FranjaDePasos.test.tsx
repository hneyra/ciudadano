import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { limpiarElPortal, montarElPortal } from '../pruebas/portal.tsx';

/**
 * **La franja de pasos**: dice donde se esta, deja volver y no deja saltar.
 *
 * Se monta el portal entero y se mira el hash de verdad: «navega» es que `#/…` cambia, no que se
 * llamo a una funcion.
 */

afterEach(limpiarElPortal);

const franja = () => screen.getByRole('navigation');

describe('la franja de pasos', () => {
  it('marca el actual con `aria-current="step"`, y solo el actual', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar' } });

    const pagar = within(franja()).getByRole('button', { name: 'Pagar' });
    expect(pagar).toHaveAttribute('aria-current', 'step');
    const conMarca = within(franja())
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-current'));
    expect(conMarca).toEqual([pagar]);
    expect(within(franja()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Buscar mi deuda',
      'Elegir qué pago',
      'Mis datos',
      'Pagar',
      'Comprobante',
    ]);
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
  });

  it('pulsar un paso anterior navega a el, y el actual pasa a ser ese', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar' } });

    fireEvent.click(within(franja()).getByRole('button', { name: 'Elegir qué pago' }));

    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    expect(within(franja()).getByRole('button', { name: 'Elegir qué pago' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeInTheDocument();
  });

  it('pulsar uno posterior NO navega y muestra el aviso exacto', async () => {
    montarElPortal({ hash: '#/deudas', estado: { paso: 'deudas' } });

    fireEvent.click(within(franja()).getByRole('button', { name: 'Comprobante' }));

    expect(await screen.findByText('Complete primero los pasos anteriores.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/deudas');
    expect(within(franja()).getByRole('button', { name: 'Elegir qué pago' })).toHaveAttribute('aria-current', 'step');
  });

  it('no aparece en el historial', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis pagos' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
