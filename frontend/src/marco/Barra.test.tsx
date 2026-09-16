import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import i18n, { IDIOMA_MARCADO } from '../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal, remendarJsdomParaElMenu } from '../pruebas/portal.tsx';
import { ICONO_SOLO_EN_EL_CELULAR } from './Barra.tsx';

/**
 * **La barra**: la marca, «Iniciar sesión» sin sesion, y el menu de la sesion con ella.
 *
 * El menu es `DropdownMenu` de Radix, la pieza cara bajo jsdom (`capa-del-menu.test.tsx` de
 * `@kamayuk/ui`: el gasto esta en desmontar el posicionador). Por eso vive en su propio archivo, se
 * abre con el TECLADO —jsdom no captura punteros— y con `fireEvent`, que alli se midio 550 veces mas
 * rapido que `userEvent`.
 */

beforeAll(remendarJsdomParaElMenu);
afterEach(limpiarElPortal);

const barra = () => screen.getByRole('banner');

/** Abre el menu de la sesion con el teclado y devuelve sus opciones. */
function abrirElMenu(): HTMLElement[] {
  const disparador = within(barra()).getByRole('button', { expanded: false, name: /María E\. Castillo/ });
  act(() => disparador.focus());
  fireEvent.keyDown(disparador, { key: 'Enter' });
  expect(disparador).toHaveAttribute('aria-expanded', 'true');
  return screen.getAllByRole('menuitem');
}

describe('la barra sin sesion', () => {
  it('ofrece «Iniciar sesión», que lleva a «Mis datos»', async () => {
    montarElPortal();

    expect(within(barra()).queryByRole('button', { name: /María/ })).toBeNull();
    fireEvent.click(within(barra()).getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
  });

  it('la marca lleva a buscar', async () => {
    montarElPortal({ hash: '#/deudas', estado: { paso: 'deudas' } });

    fireEvent.click(
      within(barra()).getByRole('button', { name: 'Pago de tributos en línea Municipalidad Distrital de Catacaos' }),
    );

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
  });
});

/**
 * **A ≤ 880 px, «Iniciar sesión» se queda con su icono** (nota del revisor del issue 11).
 *
 * El artboard lo oculta entero (`data-sm-hide`), y en un celular no quedaba forma de entrar a la cuenta
 * salvo en mitad de un pago. jsdom no aplica CSS, asi que aqui se mide lo que el navegador va a
 * recibir —el nombre accesible, que clase oculta que, y que nada oculta el boton—; que se VEA a 400 px,
 * con 44×44 px de area tactil, y que por el se llegue al historial, lo mide
 * `e2e/recorrido-con-sesion.spec.ts` en Chromium.
 */
describe('«Iniciar sesión» a ≤ 880 px', () => {
  const iniciarSesion = (nombre = 'Iniciar sesión') => within(barra()).getByRole('button', { name: nombre });

  it('se sigue llamando «Iniciar sesión»', () => {
    montarElPortal();
    expect(iniciarSesion()).toBeInTheDocument();
  });

  it('y ese nombre sale del texto, que pasa por `t()`', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal();
    expect(iniciarSesion(marcado('Iniciar sesión'))).toBeInTheDocument();
  });

  it('el boton NO se oculta: ninguna de sus clases lo quita a ninguna anchura', () => {
    montarElPortal();
    const clases = [...iniciarSesion().classList];

    expect(clases.filter((clase) => /(^|:)(hidden|sr-only|invisible)$/.test(clase))).toEqual([]);
    expect(clases).toEqual(expect.arrayContaining(ICONO_SOLO_EN_EL_CELULAR.split(' ')));
  });

  it('a esa anchura mide 44×44 px y lo que se oculta es SOLO el texto, no el icono', () => {
    montarElPortal();
    const boton = iniciarSesion();

    // El area tactil: los dos lados, no solo el alto.
    expect([...boton.classList]).toContain('max-[881px]:size-[44px]');

    const [icono, ...resto] = [...boton.children];
    expect(icono?.tagName.toLowerCase()).toBe('svg');
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(icono?.getAttribute('class') ?? '').not.toMatch(/hidden|sr-only/);

    expect(resto).toHaveLength(1);
    expect(resto[0]).toHaveTextContent(/^Iniciar sesión$/);
    expect([...(resto[0]?.classList ?? [])]).toEqual(['max-[881px]:sr-only']);
  });
});

describe('la barra con sesion', () => {
  it('muestra a quien entro y no «Iniciar sesión»; la marca lleva al historial', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    const disparador = within(barra()).getByRole('button', { name: /María E\. Castillo/ });
    expect(disparador).toHaveAttribute('aria-expanded', 'false');
    expect(disparador).toHaveTextContent('MCMaría E. CastilloDNI 44218937');
    expect(within(barra()).queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();

    fireEvent.click(within(barra()).getByRole('button', { name: /^Pago de tributos en línea/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
  });

  it('el menu abre con su cabecera y las 4 opciones; «Cerrar sesión» cierra y vuelve a `#/buscar`', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    const opciones = abrirElMenu();
    expect(opciones.map((o) => o.textContent)).toEqual([
      'Mis pagos',
      'Mis predios y vehículos',
      'Cambiar mi clave',
      'Cerrar sesión',
    ]);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Contribuyente 00000025673')).toBeInTheDocument();
    expect(within(menu).getByText('fruiz159@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toHaveAttribute('data-peligrosa', '1');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(await screen.findByText('Sesión cerrada.')).toBeInTheDocument();
    expect(within(barra()).getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(within(barra()).queryByRole('button', { name: /María/ })).toBeNull();
  });
});

describe('y todo el texto del menu pasa por `t()`', () => {
  it('con el idioma marcado, la cabecera y las 4 opciones salen envueltas', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    expect(abrirElMenu().map((o) => o.textContent)).toEqual(
      ['Mis pagos', 'Mis predios y vehículos', 'Cambiar mi clave', 'Cerrar sesión'].map(marcado),
    );
    expect(within(screen.getByRole('menu')).getByText(marcado('Contribuyente 00000025673'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: marcado('Cambiar mi clave') }));
    expect(await screen.findByText(marcado('Abriría el cambio de clave.'))).toBeInTheDocument();
  });
});
