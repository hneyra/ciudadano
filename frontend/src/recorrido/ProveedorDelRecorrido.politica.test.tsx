import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { POLITICA_CON_PLATAFORMA } from '../modo/modo.ts';
import { limpiarElPortal, montarElPortal } from '../pruebas/portal.tsx';
import type { DecisionesDePartida } from './recorrido.ts';

/**
 * **La politica tiene UNA fuente de verdad: la fuente inyectada** (revision del PR #70).
 *
 * El proveedor la fija siempre con `politicaDe(fuente)`. Lo que una prueba ponga de partida
 * (`inicial`, `montarElPortal({ estado })`) no la trae —el tipo no lo deja— y, si llega de todos modos,
 * no la pisa: si la pisara, el portal dibujaria el recorrido de un modo con los datos del otro.
 */

afterEach(limpiarElPortal);

describe('la politica la fija la fuente', () => {
  it('pisarla desde las decisiones de partida no compila', () => {
    // @ts-expect-error — `DecisionesDePartida` no tiene `politica`.
    const pisada: Partial<DecisionesDePartida> = { politica: POLITICA_CON_PLATAFORMA };
    expect(pisada).toBeDefined();
  });

  it('y si llega de todos modos, la fuente manda: con la de demostracion, los cinco pasos del artboard', async () => {
    // A la fuerza, por encima del tipo: lo que se mide es el proveedor, no el compilador.
    const aLaFuerza = { politica: POLITICA_CON_PLATAFORMA } as unknown as Partial<DecisionesDePartida>;
    montarElPortal({ hash: '#/buscar', estado: aLaFuerza });

    await screen.findByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' });
    const franja = screen.getByRole('navigation');
    expect(within(franja).getAllByRole('button').map((boton) => boton.getAttribute('aria-label'))).toEqual([
      'Buscar mi deuda',
      'Elegir qué pago',
      'Mis datos',
      'Pagar',
      'Comprobante',
    ]);
  });
});
