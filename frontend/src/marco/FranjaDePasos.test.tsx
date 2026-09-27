import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { limpiarElPortal, montarElPortal, plazosDelPortal } from '../pruebas/portal.tsx';

/**
 * **La franja de pasos**: dice donde se esta, deja volver y no deja saltar.
 *
 * Se monta el portal entero y se mira el hash de verdad: «navega» es que `#/…` cambia, no que se
 * llamo a una funcion.
 */

afterEach(limpiarElPortal);

const franja = () => screen.getByRole('navigation');

/**
 * Los pasos que la franja pinta como HECHOS: su disco lleva el verde de lo hecho (`bg-ok-fondo`). Es
 * lo que ve quien mira la franja; el nombre accesible del paso no cambia.
 */
const pasosHechos = (): string[] =>
  within(franja())
    .getAllByRole('button')
    .filter((boton) => boton.querySelector('[aria-hidden="true"]')?.classList.contains('bg-ok-fondo') === true)
    .map((boton) => boton.getAttribute('aria-label') ?? '');

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

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

  /**
   * **Issue 61, primer criterio.** «Iniciar sesión» desde `#/buscar` abre «Mis datos» sin que nadie
   * haya buscado ni elegido nada. Hasta el issue 61 la franja marcaba como hechos los pasos anteriores
   * por su POSICION (`i < actual`): «Buscar mi deuda» y «Elegir qué pago» salian con el disco verde,
   * y «Elegir qué pago» se podia abrir. Ahora lo hecho sale del progreso (`alcanzado`).
   */
  it('tras «Iniciar sesión» sin haber elegido nada, no marca como hechos los pasos que nadie hizo', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));

    expect(pasosHechos()).toEqual([]);
    fireEvent.click(within(franja()).getByRole('button', { name: 'Elegir qué pago' }));
    expect(await screen.findByText('Complete primero los pasos anteriores.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/identificar');
  });

  it('y recorrido por el camino, marca hechos justo los que se dejaron atras', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar' } });
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));

    expect(pasosHechos()).toEqual(['Buscar mi deuda', 'Elegir qué pago', 'Mis datos']);
  });

  it('no aparece en el historial', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis pagos' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
