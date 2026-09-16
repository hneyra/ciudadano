import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VueltaFallida } from './arranque.ts';

/**
 * **La pantalla de «no se pudo abrir su sesion»** (issue 13).
 *
 * Es la unica pantalla que esta entrega anade, y **no se ve en ningun recorrido**: solo aparece
 * cuando el portal vuelve del emisor de identidad y el canje falla. Sin esta prueba no la ejercita
 * nadie — ni las 427 del recorrido, ni el arnes, que corren en demostracion y nunca vuelven de
 * ningun sitio—, y una pantalla que no dibuja nadie se rompe sin que nada lo diga.
 *
 * `vi.mock` del arranque y no una vuelta de verdad: lo que se mide aqui es la pantalla. Que la
 * vuelta fallida se detecte y se guarde lo mide `src/arranque.test.ts`, con la barra de direcciones
 * de verdad.
 */

const LA_FALLA: VueltaFallida = {
  motivo: 'El emisor no dejo entrar',
  detalle: 'El usuario cancelo la entrada.',
};

let fallaDeLaVuelta: VueltaFallida | null = null;

vi.mock('./arranque.ts', () => ({
  vueltaFallida: () => fallaDeLaVuelta,
}));

// Dinamicos y no estaticos: `vi.mock` se iza por encima de los `import`, asi que un
// `import './aplicacion.tsx'` estatico evaluaria la fabrica de arriba ANTES de que
// `fallaDeLaVuelta` exista, y el rojo seria un `ReferenceError` de zona muerta que no habla de
// nada de esto.
const { montarElPortal, limpiarElPortal, marcado } = await import('./pruebas/portal.tsx');
const i18n = (await import('./i18n/i18n.ts')).default;
const { IDIOMA_MARCADO } = await import('./i18n/i18n.ts');

/** El portal entero, con los tres remiendos de jsdom que `pruebas/portal.tsx` explica. */
const montar = () => montarElPortal();

beforeEach(() => {
  fallaDeLaVuelta = null;
});

afterEach(limpiarElPortal);

describe('sin vuelta fallida, el portal es el de siempre', () => {
  it('se dibuja el recorrido y no hay ningun aviso de sesion', () => {
    montar();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.queryByText(/No se pudo abrir su sesión/)).toBeNull();
  });
});

describe('con vuelta fallida, se explica y NO se monta el recorrido', () => {
  beforeEach(() => {
    fallaDeLaVuelta = LA_FALLA;
  });

  it('dice que paso, con lo que dijo el emisor dentro', () => {
    montar();

    expect(screen.getByText('No se pudo abrir su sesión')).toBeInTheDocument();
    // El motivo y el detalle van TAL CUAL: sin ellos el aviso diria «algo fallo» y habria que
    // mirar la consola del navegador de quien lo sufrio.
    expect(
      screen.getByText(
        'Volvimos del sistema de identidad sin poder entrar: El emisor no dejo entrar. El usuario cancelo la entrada.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/ventanilla de la municipalidad/)).toBeInTheDocument();
  });

  it('y el recorrido no se monta: la barra y la franja no estan', () => {
    // Montarlo debajo enseñaria el portal de demostracion a quien acaba de intentar entrar de
    // verdad, que es la peor manera posible de contestar «no se pudo».
    montar();

    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('el tema sigue puesto: el aviso no se dibuja con la paleta de otro programa', () => {
    // El `ProveedorDeTema` envuelve TODO, tambien esto. Quien eligio oscuro y se encuentra con que
    // no pudo entrar leeria, si no, el unico momento en que el portal de verdad no esta con los
    // colores de `institucional`.
    montar();

    expect(document.documentElement.getAttribute('data-tema')).toBe('clasico');
  });

  it('y los tres textos pasan por `t()`', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);

    montar();

    expect(screen.getByText(marcado('No se pudo abrir su sesión'))).toBeInTheDocument();
    expect(
      screen.getByText(
        marcado(
          'Volvimos del sistema de identidad sin poder entrar: El emisor no dejo entrar. El usuario cancelo la entrada.',
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        marcado(
          'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
        ),
      ),
    ).toBeInTheDocument();
  });
});
