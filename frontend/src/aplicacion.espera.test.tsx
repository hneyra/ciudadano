import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ComprobandoLaSesion } from './aplicacion.tsx';
import i18n, { IDIOMA_MARCADO, IDIOMA_POR_OMISION } from './i18n/i18n.ts';
import { marcado } from './pruebas/portal.tsx';

/**
 * **La espera mientras se le pregunta al emisor** (issue 35).
 *
 * Solo se dibuja si el canje silencioso tarda mas que `UMBRAL_DE_ESPERA` (`src/arranque.ts`), y es
 * lo que el issue pide en lugar de la pagina en blanco o de un salto a la puerta. Nadie la ve en un
 * recorrido normal —el emisor contesta antes—, asi que si no se prueba aqui se rompe sin ruido.
 */

afterEach(async () => {
  document.documentElement.removeAttribute('data-tema');
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

describe('comprobando la sesion', () => {
  it('dice que se esta comprobando, como estado que se anuncia y ocupado', () => {
    render(<ComprobandoLaSesion />);

    const estado = screen.getByRole('status');
    expect(estado).toHaveTextContent('Comprobando su sesión…');
    expect(estado).toHaveAttribute('aria-busy', 'true');
  });

  it('con el tema del portal: la espera no puede parecer de otro programa', () => {
    render(<ComprobandoLaSesion />);

    expect(document.documentElement).toHaveAttribute('data-tema', 'clasico');
  });

  it('y lo que dice pasa por `t()`', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    render(<ComprobandoLaSesion />);

    expect(screen.getByRole('status')).toHaveTextContent(marcado('Comprobando su sesión…'));
  });
});
