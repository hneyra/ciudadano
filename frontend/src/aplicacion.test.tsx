import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Aplicacion } from './aplicacion.tsx';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO, IDIOMA_POR_OMISION } from './i18n/i18n.ts';

/**
 * **El marcador dice lo que dice el artboard, y lo dice por `t()`.**
 *
 * Las dos mitades hacen falta. Con el idioma `es`, un `<h1>Pago de tributos en línea</h1>` escrito
 * a pelo pasaria igual que uno traducido: el texto es el mismo. Solo con el idioma `marcado`, que
 * envuelve entre `⟦…⟧` todo lo que sale de `t()`, se distingue lo que paso por la traduccion de lo
 * que no.
 */

const TITULO = 'Pago de tributos en línea';
const ENTIDAD = 'Municipalidad Distrital de Catacaos';

const marcado = (texto: string) => `${ABRE}${texto}${CIERRA}`;

afterEach(async () => {
  // La instancia es global —la carga `vitest.setup.ts` para todas las pruebas—: si una se queda en
  // `marcado`, la siguiente veria texto envuelto y fallaria por un motivo que no es el suyo.
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

describe('el marcador del portal', () => {
  it('muestra el titulo y la entidad del artboard', () => {
    render(<Aplicacion />);

    expect(screen.getByRole('heading', { level: 1, name: TITULO })).toBeInTheDocument();
    expect(screen.getByText(ENTIDAD)).toBeInTheDocument();
  });

  it('y los dos pasan por `t()`: con el idioma marcado salen envueltos', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);

    render(<Aplicacion />);

    expect(screen.getByRole('heading', { level: 1, name: marcado(TITULO) })).toBeInTheDocument();
    expect(screen.getByText(marcado(ENTIDAD))).toBeInTheDocument();
  });
});
