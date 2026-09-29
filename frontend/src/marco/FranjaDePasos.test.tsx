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

/**
 * Los pasos que la franja pinta como HECHOS: su disco lleva el verde de lo hecho (`bg-ok-fondo`). Es
 * lo que ve quien mira la franja; el nombre accesible del paso no cambia.
 */
const pasosHechos = (): string[] =>
  within(franja())
    .getAllByRole('button')
    .filter((boton) => boton.querySelector('[aria-hidden="true"]')?.classList.contains('bg-ok-fondo') === true)
    .map((boton) => boton.getAttribute('aria-label') ?? '');

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

  /**
   * Por el camino de verdad, con las pantallas (revision del PR #72): empezar en `paso: 'pagar'` mediria
   * `alcanzadoHasta`, que es lo que `montarElPortal` supone para esa partida, y no el reductor.
   */
  it('y recorrido por el camino, marca hechos justo los que se dejaron atras', async () => {
    montarElPortal({ hash: '#/buscar' });
    const principal = () => within(screen.getByRole('main'));

    fireEvent.change(principal().getByRole('textbox', { name: 'Código de contribuyente' }), {
      target: { value: '00000025673' },
    });
    fireEvent.click(principal().getByRole('button', { name: 'Buscar mi deuda' }));
    fireEvent.click(await principal().findByRole('button', { name: 'Pagar todo' }));
    const correo = within(await principal().findByRole('region', { name: 'Solo con mi correo' }));
    fireEvent.change(correo.getByRole('textbox', { name: 'Correo electrónico' }), { target: { value: 'maria@example.com' } });
    fireEvent.click(correo.getByRole('button', { name: 'Continuar al pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));

    expect(pasosHechos()).toEqual(['Buscar mi deuda', 'Elegir qué pago', 'Mis datos']);
  });

  /** «No soy yo» (revision del PR #72): la deuda de otra persona no queda a un clic en la franja. */
  it('tras «No soy yo», «Elegir qué pago» ya no se abre', async () => {
    montarElPortal({ hash: '#/deudas', estado: { paso: 'deudas', numero: '00000025673' } });

    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'No soy yo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    fireEvent.click(within(franja()).getByRole('button', { name: 'Elegir qué pago' }));

    expect(await screen.findByText('Complete primero los pasos anteriores.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/buscar');
  });

  it('no aparece en el historial', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis pagos' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
