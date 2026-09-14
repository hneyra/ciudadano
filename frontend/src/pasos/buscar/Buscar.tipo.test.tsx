import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import i18n, { IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal, remendarJsdomParaElMenu } from '../../pruebas/portal.tsx';

/**
 * **«Buscar por»**: cambiar de tipo cambia la etiqueta y el ejemplo del numero, y lo vacia.
 *
 * El desplegable es `Select` de Radix, con el mismo posicionador que el menu de la barra: vive en
 * su propio archivo, con `remendarJsdomParaElMenu` (el `:modal` que dejaba el proceso al 100 % de
 * CPU), y se abre con el TECLADO y `fireEvent`, que es lo que jsdom sabe hacer (`Barra.test.tsx`).
 */

beforeAll(remendarJsdomParaElMenu);
afterEach(limpiarElPortal);

/**
 * Escribe al final de lo que ya hay. Con `fireEvent` y no con `userEvent`: bajo carga (la suite
 * entera en paralelo) `userEvent` hacia pasar de 5 s la prueba del desplegable, y lo que se mide
 * aqui es que el `onChange` del campo borra el error, no la pulsacion tecla a tecla.
 */
function escribir(campo: HTMLElement, texto: string): void {
  fireEvent.change(campo, { target: { value: `${(campo as HTMLInputElement).value}${texto}` } });
}

const principal = () => screen.getByRole('main');

/** Abre «Buscar por» y devuelve sus opciones. */
function abrirElTipo(nombre = 'Buscar por'): HTMLElement[] {
  const disparador = within(principal()).getByRole('combobox', { name: nombre });
  act(() => disparador.focus());
  fireEvent.keyDown(disparador, { key: 'Enter' });
  expect(disparador).toHaveAttribute('aria-expanded', 'true');
  return screen.getAllByRole('option');
}

describe('cambiar de tipo', () => {
  it('a «DNI» cambia etiqueta y placeholder, vacia el campo y quita el error', async () => {
    montarElPortal();

    const codigo = within(principal()).getByRole('textbox', { name: 'Código de contribuyente' });
    escribir(codigo, '12a');
    fireEvent.click(within(principal()).getByRole('button', { name: 'Buscar mi deuda' }));
    expect(await within(principal()).findByRole('alert')).toBeInTheDocument();

    const opciones = abrirElTipo();
    expect(opciones.map((o) => o.textContent)).toEqual(['Código de contribuyente', 'DNI', 'RUC']);
    fireEvent.click(screen.getByRole('option', { name: 'DNI' }));

    expect(within(principal()).queryByRole('textbox', { name: 'Código de contribuyente' })).toBeNull();
    const dni = within(principal()).getByRole('textbox', { name: 'Número de DNI' });
    expect(dni).toHaveAttribute('placeholder', '03593174');
    expect(dni).toHaveValue('');
    expect(within(principal()).queryByRole('alert')).toBeNull();
    expect(within(principal()).getByRole('combobox', { name: 'Buscar por' })).toHaveTextContent('DNI');

    // Y a «RUC», con algo escrito: tambien lo vacia.
    escribir(dni, '4421');
    abrirElTipo();
    fireEvent.click(screen.getByRole('option', { name: 'RUC' }));
    const ruc = within(principal()).getByRole('textbox', { name: 'Número de RUC' });
    expect(ruc).toHaveAttribute('placeholder', '20525118447');
    expect(ruc).toHaveValue('');
  });

  it('con el idioma marcado, las opciones y la etiqueta del numero salen envueltas', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal();

    expect(abrirElTipo(marcado('Buscar por')).map((o) => o.textContent)).toEqual(
      ['Código de contribuyente', 'DNI', 'RUC'].map(marcado),
    );
    fireEvent.click(screen.getByRole('option', { name: marcado('RUC') }));

    expect(within(principal()).getByRole('textbox', { name: marcado('Número de RUC') })).toBeInTheDocument();
  });
});
