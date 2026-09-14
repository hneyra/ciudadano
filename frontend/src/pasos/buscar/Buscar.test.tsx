import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import i18n, { IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from '../../pruebas/portal.tsx';

/**
 * **Paso 1 · Buscar mi deuda**: los errores, la busqueda valida y los textos del artboard.
 *
 * Se monta el portal entero en `#/buscar` y se mira el hash de verdad. Todo se busca DENTRO de
 * `main`: la franja de pasos tiene otro boton llamado «Buscar mi deuda».
 *
 * Cambiar de tipo abre el `Desplegable` (Radix), que bajo jsdom pide sus remiendos y su archivo:
 * esta en `Buscar.tipo.test.tsx`.
 */

afterEach(limpiarElPortal);

/**
 * Escribe al final de lo que ya hay. Con `fireEvent` y no con `userEvent`: bajo carga (la suite
 * entera en paralelo) `userEvent` hacia pasar de 5 s la prueba del desplegable, y lo que se mide
 * aqui es que el `onChange` del campo borra el error, no la pulsacion tecla a tecla.
 */
function escribir(campo: HTMLElement, texto: string): void {
  fireEvent.change(campo, { target: { value: `${(campo as HTMLInputElement).value}${texto}` } });
}

/**
 * Deja correr lo pendiente: la validacion de `react-hook-form` es asincrona. Mirar «el error ya no
 * esta» justo despues de escribir pasaba en verde con `reValidateMode: 'onChange'`, que lo quita y
 * un instante despues lo VUELVE A PONER; solo se ve si se espera a que termine.
 */
async function queTermineLaValidacion(): Promise<void> {
  await act(async () => {
    await new Promise((listo) => setTimeout(listo, 20));
  });
}

const VACIO = 'Escriba su código de contribuyente o su documento para poder buscar.';
const NO_DIGITOS = 'El código y el documento son solo números. Revise lo que escribió.';
const AVISO = 'Encontramos 4 conceptos pendientes.';
const INTRO =
  'Escriba su código de contribuyente o su documento de identidad. Verá lo que debe, con su vencimiento, y podrá pagar todo o solo lo que elija.';
const AYUDA =
  'Su código de contribuyente figura en la cuponera del impuesto predial y en cualquier recibo anterior. Si no lo encuentra, busque por su DNI.';
const CAPACIDADES = [
  ['Ver lo que debe', 'Su impuesto predial, arbitrios y vehicular, con el vencimiento de cada cuota.'],
  ['Pagar en línea', 'Con tarjeta, Yape, pagalo.pe o un código para el banco.'],
  ['Descargar comprobantes', 'El del pago que acaba de hacer y los de años anteriores.'],
  ['Saber de dónde sale', 'El autovalúo de su predio, los metros de frontis y la tabla que se le aplica.'],
] as const;
const AMNISTIA_TITULO = 'Amnistía vigente hasta el 31 de diciembre.';
const AMNISTIA_RESTO =
  'La Ordenanza 012-2026-MPS condona el 100 % del interés moratorio. Al pagar ahora, el descuento se aplica solo: no hay que solicitarlo.';

const principal = () => screen.getByRole('main');
const botonBuscar = (nombre = 'Buscar mi deuda') => within(principal()).getByRole('button', { name: nombre });
const campoNumero = (nombre = 'Código de contribuyente') => within(principal()).getByRole('textbox', { name: nombre });

describe('los errores de la busqueda', () => {
  it('vacio muestra el primero con `role="alert"`; `12a`, el segundo; y escribir lo borra', async () => {
    montarElPortal();

    expect(within(principal()).queryByRole('alert')).toBeNull();
    fireEvent.click(botonBuscar());

    const vacio = await within(principal()).findByRole('alert');
    expect(vacio).toHaveTextContent(VACIO);
    expect(vacio.textContent).toBe(VACIO);
    // El campo se marca y apunta al mensaje: el lector lo lee al enfocarlo.
    expect(campoNumero()).toHaveAttribute('aria-invalid', 'true');
    expect(campoNumero()).toHaveAttribute('aria-describedby', vacio.id);
    expect(window.location.hash).toBe('#/buscar');

    // Escribir borra el error, sin esperar a enviar.
    escribir(campoNumero(), '12a');
    await queTermineLaValidacion();
    expect(within(principal()).queryByRole('alert')).toBeNull();
    expect(campoNumero()).not.toHaveAttribute('aria-invalid');

    fireEvent.click(botonBuscar());
    expect(await within(principal()).findByRole('alert')).toHaveTextContent(NO_DIGITOS);
    expect(within(principal()).getByRole('alert').textContent).toBe(NO_DIGITOS);
    expect(window.location.hash).toBe('#/buscar');

    // Y escribir de nuevo lo borra: no lo cambia por otro, aunque siga sin ser un numero.
    escribir(campoNumero(), 'b');
    await queTermineLaValidacion();
    expect(within(principal()).queryByRole('alert')).toBeNull();
  });

  it('solo espacios cuenta como vacio', async () => {
    montarElPortal();

    escribir(campoNumero(), '   ');
    fireEvent.click(botonBuscar());

    expect(await within(principal()).findByRole('alert')).toHaveTextContent(VACIO);
  });
});

describe('la busqueda valida', () => {
  it('`00000025673` navega a `#/deudas` y aparece el aviso exacto', async () => {
    montarElPortal();

    escribir(campoNumero(), '00000025673');
    fireEvent.click(botonBuscar());

    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    expect(await screen.findByText(AVISO)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Elegir qué pago' }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('con espacios alrededor tambien busca: se recorta, como el `trim()` del artboard', async () => {
    montarElPortal();

    escribir(campoNumero(), ' 03593174 ');
    fireEvent.click(botonBuscar());

    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
  });
});

describe('lo que la pantalla dice', () => {
  it('titulo, intro, controles, ayuda, las 4 capacidades y la amnistia, literales', () => {
    montarElPortal();
    const main = principal();

    expect(within(main).getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeInTheDocument();
    expect(within(main).getByText(INTRO)).toBeInTheDocument();
    expect(within(main).getByRole('combobox', { name: 'Buscar por' })).toHaveTextContent('Código de contribuyente');
    expect(campoNumero()).toHaveAttribute('placeholder', '00000025673');
    expect(campoNumero()).toHaveValue('');
    expect(within(main).getByText(AYUDA)).toBeInTheDocument();

    const seccion = within(main).getByRole('region', { name: 'Qué puede hacer aquí' });
    const items = within(seccion).getAllByRole('listitem');
    expect(items.map((li) => [li.querySelector('.font-bold')?.textContent, li.lastElementChild?.textContent])).toEqual(
      CAPACIDADES.map(([titulo, detalle]) => [titulo, detalle]),
    );
    // Cada capacidad con su icono en su caja de 28 px, y el icono no se lee.
    for (const li of items) {
      const svg = li.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg?.parentElement?.className).toContain('size-7');
    }

    const amnistia = within(main).getByText(AMNISTIA_TITULO);
    expect(amnistia.tagName).toBe('STRONG');
    expect(amnistia.parentElement?.textContent).toBe(`${AMNISTIA_TITULO} ${AMNISTIA_RESTO}`);
    // Esta ahi desde que se abre la pagina: no es una region viva.
    expect(amnistia.parentElement).not.toHaveAttribute('role');
  });

  it('los tres controles miden al menos 44 px de alto', () => {
    montarElPortal();
    // jsdom no maqueta: se comprueba la clase aqui y la medida en el navegador (capturas del PR).
    for (const control of [
      within(principal()).getByRole('combobox', { name: 'Buscar por' }),
      campoNumero(),
      botonBuscar(),
    ]) {
      expect(control.className.split(/\s+/)).toContain('min-h-[44px]');
    }
  });

  it('y todo pasa por `t()`: con el idioma marcado sale envuelto', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal();
    const main = principal();

    expect(within(main).getByRole('heading', { level: 1, name: marcado('Consulte y pague sus tributos') })).toBeInTheDocument();
    expect(within(main).getByText(marcado(INTRO))).toBeInTheDocument();
    const tipo = within(main).getByRole('combobox', { name: marcado('Buscar por') });
    expect(tipo).toHaveTextContent(marcado('Código de contribuyente'));
    // El placeholder es dato —el mismo numero en todo idioma— y no se marca.
    const numero = campoNumero(marcado('Código de contribuyente'));
    expect(numero).toHaveAttribute('placeholder', '00000025673');
    expect(within(main).getByText(marcado(AYUDA))).toBeInTheDocument();

    const seccion = within(main).getByRole('region', { name: marcado('Qué puede hacer aquí') });
    for (const [titulo, detalle] of CAPACIDADES) {
      expect(within(seccion).getByText(marcado(titulo))).toBeInTheDocument();
      expect(within(seccion).getByText(marcado(detalle))).toBeInTheDocument();
    }
    const amnistia = within(main).getByText(marcado(AMNISTIA_TITULO));
    expect(amnistia.parentElement?.textContent).toBe(`${marcado(AMNISTIA_TITULO)} ${marcado(AMNISTIA_RESTO)}`);

    // Los dos errores y el aviso.
    fireEvent.click(within(main).getByRole('button', { name: marcado('Buscar mi deuda') }));
    expect((await within(main).findByRole('alert')).textContent).toBe(marcado(VACIO));
    escribir(numero, 'x');
    fireEvent.click(within(main).getByRole('button', { name: marcado('Buscar mi deuda') }));
    await waitFor(() => expect(within(main).getByRole('alert').textContent).toBe(marcado(NO_DIGITOS)));
    fireEvent.change(numero, { target: { value: '' } });
    escribir(numero, '1');
    fireEvent.click(within(main).getByRole('button', { name: marcado('Buscar mi deuda') }));
    expect(await screen.findByText(marcado(AVISO))).toBeInTheDocument();
  });
});
