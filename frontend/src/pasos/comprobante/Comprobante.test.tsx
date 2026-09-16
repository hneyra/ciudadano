import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONTRIBUYENTE, DEUDAS, USUARIO } from '../../datos/demostracion.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from '../../pruebas/portal.tsx';
import type { EstadoDelRecorrido } from '../../recorrido/recorrido.ts';

/**
 * **Paso 5 · Comprobante**: el recibo sellado, lo que se ofrece despues y lo que se imprime.
 *
 * Al comprobante no se llega escribiendo un estado: se llega PAGANDO. Cada prueba monta el portal en
 * `#/pagar` y pulsa el boton del medio, que es lo que sella `ultimo`; asi lo que se mide es el recibo
 * que deja un pago de verdad y no uno inventado para la prueba.
 *
 * Todo se busca dentro de `main` o del recibo: la franja tiene su propio boton «Comprobante».
 */

afterEach(async () => {
  vi.restoreAllMocks();
  await limpiarElPortal();
});

/** Se busco la deuda, se dio el correo y se llego a pagar. Por omision, con los cuatro marcados. */
const EN_PAGAR: Partial<EstadoDelRecorrido> = { paso: 'pagar', numero: '00000025673', correo: 'maria@correo.com' };

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());
const franja = () => within(screen.getByRole('navigation'));
const recibo = (nombre = 'Constancia de pago') => enMain().getByRole('region', { name: nombre });

/** Monta `#/pagar` con `estado`, pulsa el boton de pagar del medio y espera al comprobante. */
async function pagar(estado: Partial<EstadoDelRecorrido> = {}, boton = 'Pagar ahora', titulo = 'Su pago se registró') {
  montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, ...estado } });
  fireEvent.click(enMain().getByRole('button', { name: boton }));
  await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
  await enMain().findByRole('heading', { level: 1, name: titulo });
}

/** Las filas del cuerpo de la tabla del recibo, celda a celda. */
const filas = (contenedor: HTMLElement = recibo()) =>
  [...contenedor.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((celda) => celda.textContent));

/** El pie de la tabla del recibo, fila a fila: rotulo y cifra. */
const pie = (contenedor: HTMLElement = recibo()) =>
  [...contenedor.querySelectorAll('tfoot tr')].map((tr) => [...tr.children].map((celda) => celda.textContent));

/** La meta del recibo, como pares rotulo → valor. */
const meta = (contenedor: HTMLElement = recibo()) =>
  Object.fromEntries(
    [...contenedor.querySelectorAll('[data-meta] dt')].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  );

describe('el recibo, tras pagar los cuatro conceptos con tarjeta', () => {
  it('4 filas con insoluto + gastos (293.72, 291.60, 1,854.60, 710.00) y el pie − 413.32 / 3,149.92', async () => {
    await pagar();

    expect(filas()).toEqual([
      ['Impuesto predial 2026', 'Casa habitación · Calle Santa Rosa 116', 'Cuotas 3 y 4 de 4', '293.72'],
      ['Arbitrios municipales 2026', 'Casa habitación · Calle Santa Rosa 116', 'Cuotas 1 a 8 de 12', '291.60'],
      ['Impuesto predial 2024', 'Casa habitación · Calle Santa Rosa 116', 'Cuotas 1 a 4 de 4', '1,854.60'],
      ['Impuesto vehicular 2024', DEUDAS[3]?.unidad, 'Cuota 1 de 4', '710.00'],
    ]);
    expect(pie()).toEqual([
      ['Interés condonado por la Ordenanza 012-2026-MPS', '− 413.32'],
      ['Total pagado', '3,149.92'],
    ]);
    const columnas = within(recibo()).getAllByRole('columnheader').map((th) => th.textContent);
    expect(columnas).toEqual(['Concepto', 'Unidad', 'Cuotas', 'Importe S/']);
    // El pie se lee por filas: cada rotulo es la cabecera de la suya.
    expect(within(recibo()).getAllByRole('rowheader').map((th) => th.textContent)).toEqual([
      'Interés condonado por la Ordenanza 012-2026-MPS',
      'Total pagado',
    ]);
  });

  it('la cabecera, la meta, la nota y la banda de exito dicen lo sellado', async () => {
    await pagar();
    const constancia = within(recibo());

    expect(constancia.getByRole('heading', { level: 2, name: 'Constancia de pago' })).toBeInTheDocument();
    expect(constancia.getByText('0003-0041418')).toBeInTheDocument();
    expect(constancia.getByText('Municipalidad Distrital de Catacaos')).toBeInTheDocument();
    expect(constancia.getByText('Gerencia de Administración Tributaria')).toBeInTheDocument();
    // El escudo es el mismo recurso que el de la barra.
    const escudos = [screen.getByRole('banner'), recibo()].map((donde) => donde.querySelector('img')?.getAttribute('src'));
    expect(escudos[1]).toBeTruthy();
    expect(escudos[1]).toBe(escudos[0]);

    expect(meta()).toEqual({
      'Número de operación': '86 4418 2026 0913',
      'Fecha y hora': '13/09/2026 · 10:42',
      'Medio de pago': 'Tarjeta',
      Contribuyente: CONTRIBUYENTE.nombre,
      Código: '00000025673',
      'Enviado a': 'maria@correo.com',
    });
    expect(
      constancia.getByText(
        'Esta constancia acredita el pago de los conceptos detallados. Consérvela: es lo que hay que presentar si la deuda volviera a aparecer. El pago con tarjeta, Yape o pagalo.pe se aplica de inmediato; el pago con código de banco, al día siguiente hábil.',
      ),
    ).toBeInTheDocument();

    expect(
      enMain().getByText(
        'Pagó S/ 3,149.92 con tarjeta. Le enviamos el comprobante a maria@correo.com, y puede descargarlo aquí mismo. La deuda pagada ya se descontó de su cuenta.',
      ),
    ).toBeInTheDocument();
  });

  it('con otro medio y con sesion, el recibo dice ese medio y el correo de la cuenta', async () => {
    await pagar({ autenticado: true, medio: 'yape', marcadas: { veh24: true } }, 'Ya yapeé');

    expect(meta()).toMatchObject({ 'Medio de pago': 'Yape o Plin', 'Enviado a': USUARIO.correo });
    expect(filas()).toEqual([['Impuesto vehicular 2024', DEUDAS[3]?.unidad, 'Cuota 1 de 4', '710.00']]);
    expect(pie()).toEqual([
      ['Interés condonado por la Ordenanza 012-2026-MPS', '− 182.44'],
      ['Total pagado', '710.00'],
    ]);
    expect(enMain().getByText(/^Pagó S\/ 710\.00 con yape o plin\. Le enviamos el comprobante a /)).toHaveTextContent(
      USUARIO.correo,
    );
  });
});

describe('el sello', () => {
  it('volver a `#/deudas`, cambiar la seleccion y regresar a `#/comprobante` NO cambia el recibo', async () => {
    await pagar({ marcadas: { pred26: true, arb26: true } });
    const antes = { filas: filas(), pie: pie(), meta: meta() };
    expect(antes.filas.map((fila) => fila[0])).toEqual(['Impuesto predial 2026', 'Arbitrios municipales 2026']);
    expect(antes.pie).toEqual([
      ['Interés condonado por la Ordenanza 012-2026-MPS', '− 18.44'],
      ['Total pagado', '585.32'],
    ]);

    fireEvent.click(franja().getByRole('button', { name: 'Elegir qué pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
    // Quedan dos vivos, marcados por omision: se desmarca uno.
    fireEvent.click(enMain().getByRole('checkbox', { name: 'Pagar Impuesto vehicular 2024' }));
    expect(enMain().getByText('Va a pagar 1 concepto de 2')).toBeInTheDocument();

    // Con un pago sellado, el comprobante se sigue pudiendo abrir desde la franja.
    fireEvent.click(franja().getByRole('button', { name: 'Comprobante' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    await enMain().findByRole('heading', { level: 1, name: 'Su pago se registró' });

    expect({ filas: filas(), pie: pie(), meta: meta() }).toEqual(antes);
    expect(principal().textContent).not.toContain('1,854.60');
  });
});

describe('las acciones', () => {
  it('«Imprimir» llama a `window.print`; «Descargar comprobante» avisa con el numero', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    await pagar();

    fireEvent.click(enMain().getByRole('button', { name: 'Imprimir' }));
    expect(imprimir).toHaveBeenCalledTimes(1);

    fireEvent.click(enMain().getByRole('button', { name: 'Descargar comprobante' }));
    expect(await screen.findByText('Se descargaría el comprobante 0003-0041418 en PDF.')).toBeInTheDocument();
    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  it('sin sesion: «Consultar otra deuda» y «Crear mi cuenta», que lleva a `#/identificar`', async () => {
    await pagar();

    expect(enMain().queryByRole('button', { name: 'Ver mis pagos' })).toBeNull();
    expect(enMain().queryByRole('button', { name: 'Pagar otra deuda' })).toBeNull();
    expect(enMain().getByRole('button', { name: 'Consultar otra deuda' })).toBeInTheDocument();

    const invitacion = within(enMain().getByRole('region', { name: 'Guarde este pago en una cuenta' }));
    expect(
      invitacion.getByText(
        'Si crea una cuenta con maria@correo.com, este comprobante y los anteriores quedan guardados: no tendrá que volver a buscarlos.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(invitacion.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    await enMain().findByRole('heading', { level: 1, name: '¿A dónde le enviamos el comprobante?' });
  });

  it('«Consultar otra deuda» vuelve a buscar con el numero vacio: lo que quedo marcado ya no es un pago de nadie', async () => {
    await pagar({ marcadas: { pred26: true } });
    // Se marca otro concepto vivo y se vuelve al comprobante: queda algo marcado sin pagar.
    fireEvent.click(franja().getByRole('button', { name: 'Elegir qué pago' }));
    fireEvent.click(await enMain().findByRole('checkbox', { name: 'Pagar Impuesto vehicular 2024' }));
    fireEvent.click(franja().getByRole('button', { name: 'Comprobante' }));

    fireEvent.click(await enMain().findByRole('button', { name: 'Consultar otra deuda' }));
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    const campo = await enMain().findByRole('textbox', { name: 'Código de contribuyente' });
    expect(campo).toHaveValue('');

    // El numero se vacio EN EL RECORRIDO, no solo en el campo: sin buscar otra vez, entrar por «Solo con
    // mi correo» no ofrece pagar el vehicular que quedo marcado.
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Iniciar sesión' }));
    fireEvent.change(await enMain().findByRole('textbox', { name: 'Correo electrónico' }), {
      target: { value: 'maria@correo.com' },
    });
    fireEvent.click(enMain().getByRole('button', { name: 'Continuar al pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    const resumen = within(await enMain().findByRole('region', { name: 'Lo que va a pagar' }));
    expect(resumen.getByText('No hay nada que pagar.')).toBeInTheDocument();
  });

  it('con sesion y deuda viva: «Ver mis pagos» (a `#/historial`) y «Pagar otra deuda» (a `#/deudas`), sin invitacion', async () => {
    await pagar({ autenticado: true, marcadas: { pred26: true } });

    expect(enMain().queryByRole('button', { name: 'Consultar otra deuda' })).toBeNull();
    expect(enMain().queryByRole('region', { name: 'Guarde este pago en una cuenta' })).toBeNull();
    expect(enMain().queryByRole('button', { name: 'Crear mi cuenta' })).toBeNull();

    fireEvent.click(enMain().getByRole('button', { name: 'Pagar otra deuda' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });

    fireEvent.click(franja().getByRole('button', { name: 'Comprobante' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    fireEvent.click(await enMain().findByRole('button', { name: 'Ver mis pagos' }));
    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
    await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });
  });

  it('con sesion y SIN deuda viva: «Ver mis pagos», y ya no «Pagar otra deuda»', async () => {
    await pagar({ autenticado: true });

    expect(enMain().getByRole('button', { name: 'Ver mis pagos' })).toBeInTheDocument();
    expect(enMain().queryByRole('button', { name: 'Pagar otra deuda' })).toBeNull();
  });
});

describe('«Consultar otra deuda» y el aviso de la busqueda (nota del revisor)', () => {
  /** Desde el comprobante: consultar otra, buscar el mismo codigo y devolver el aviso que salga. */
  async function consultarOtraYBuscar(): Promise<void> {
    fireEvent.click(enMain().getByRole('button', { name: 'Consultar otra deuda' }));
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    fireEvent.change(await enMain().findByRole('textbox', { name: 'Código de contribuyente' }), {
      target: { value: '00000025673' },
    });
    fireEvent.click(enMain().getByRole('button', { name: 'Buscar mi deuda' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
  }

  it('pagado todo, volver a buscar avisa «No encontramos conceptos pendientes.»', async () => {
    await pagar();
    await consultarOtraYBuscar();

    expect(await screen.findByText('No encontramos conceptos pendientes.')).toBeInTheDocument();
    expect(screen.queryByText(/^Encontramos /)).toBeNull();
    await enMain().findByRole('heading', { level: 1, name: 'No le queda nada por pagar' });
  });

  it('pagado uno, volver a buscar avisa «Encontramos 3 conceptos pendientes.»', async () => {
    await pagar({ marcadas: { arb26: true } });
    await consultarOtraYBuscar();

    expect(await screen.findByText('Encontramos 3 conceptos pendientes.')).toBeInTheDocument();
  });
});

describe('en papel, solo el recibo', () => {
  /**
   * Lo que se VE de la pagina entera: cada texto, imagen, icono o control. Todo tiene que estar dentro de
   * algo marcado `data-noprint` —que la regla `@media print` de `src/estilos.css` oculta, lo mide
   * `verificaciones/lo-no-imprimible-no-se-imprime.test.ts`— o dentro del recibo.
   */
  function loQueSeImprimiria(): string[] {
    const sueltos: string[] = [];
    const recorrer = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let nodo = recorrer.nextNode(); nodo !== null; nodo = recorrer.nextNode()) {
      const elemento = nodo instanceof Element ? nodo : nodo.parentElement;
      if (elemento === null) continue;
      const seVe =
        nodo instanceof Element
          ? ['IMG', 'svg', 'BUTTON', 'INPUT', 'A'].includes(nodo.tagName)
          : (nodo.textContent ?? '').trim() !== '';
      if (!seVe) continue;
      if (elemento.closest('[data-noprint]') !== null || elemento.closest('[data-recibo]') !== null) continue;
      sueltos.push(nodo instanceof Element ? `<${nodo.tagName.toLowerCase()}>` : (nodo.textContent ?? ''));
    }
    return sueltos;
  }

  it('sin sesion: la barra, la franja, el pie, los avisos, la banda, las acciones y la invitacion no se imprimen', async () => {
    await pagar();
    // Hay un aviso abierto («Pago registrado…»): tambien tiene que quedar fuera del papel.
    await screen.findByText('Pago registrado. Le enviamos el comprobante a maria@correo.com.');

    expect(loQueSeImprimiria()).toEqual([]);

    const noImprimible = (el: Element | null) => el?.closest('[data-noprint]') ?? null;
    expect(noImprimible(screen.getByRole('banner'))).not.toBeNull();
    expect(noImprimible(screen.getByRole('navigation'))).not.toBeNull();
    expect(noImprimible(screen.getByRole('contentinfo'))).not.toBeNull();
    expect(noImprimible(screen.getByRole('region', { name: /^Avisos/ }))).not.toBeNull();
    expect(noImprimible(enMain().getByRole('heading', { level: 1, name: 'Su pago se registró' }))).not.toBeNull();
    expect(noImprimible(enMain().getByRole('button', { name: 'Imprimir' }))).not.toBeNull();
    expect(noImprimible(enMain().getByRole('region', { name: 'Guarde este pago en una cuenta' }))).not.toBeNull();
    // Y el recibo no cuelga de nada que no se imprima.
    expect(noImprimible(recibo())).toBeNull();
  });

  it('con sesion, igual', async () => {
    await pagar({ autenticado: true, marcadas: { pred26: true } });

    expect(loQueSeImprimiria()).toEqual([]);
    expect(recibo().closest('[data-noprint]')).toBeNull();
  });
});

describe('todo lo que se lee pasa por `t()`', () => {
  const desmarcar = (texto: string): string | null =>
    texto.startsWith(ABRE) && texto.endsWith(CIERRA) ? texto.slice(ABRE.length, -CIERRA.length) : null;

  it('la banda, el recibo, las acciones y la invitacion, en el idioma `marcado`; lo demas es dato', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    await pagar({}, marcado('Pagar ahora'), marcado('Su pago se registró'));

    // Lo que es dato y no se traduce: los numeros del sello, el contribuyente, el correo y los conceptos.
    const dato = new Set([
      '0003-0041418',
      '86 4418 2026 0913',
      '13/09/2026 · 10:42',
      CONTRIBUYENTE.nombre,
      CONTRIBUYENTE.codigo,
      'maria@correo.com',
      ...DEUDAS.flatMap((deuda) => [deuda.concepto, deuda.unidad, deuda.cuotas]),
      '293.72',
      '291.60',
      '1,854.60',
      '710.00',
      '− 413.32',
      '3,149.92',
    ]);
    const escapados = [...principal().querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '')
      .map((el) => el.textContent ?? '')
      .filter((texto) => desmarcar(texto) === null && !dato.has(texto));
    expect(escapados).toEqual([]);

    const constancia = within(recibo(marcado('Constancia de pago')));
    expect(meta(recibo(marcado('Constancia de pago')))).toEqual({
      [marcado('Número de operación')]: '86 4418 2026 0913',
      [marcado('Fecha y hora')]: '13/09/2026 · 10:42',
      [marcado('Medio de pago')]: marcado('Tarjeta'),
      [marcado('Contribuyente')]: CONTRIBUYENTE.nombre,
      [marcado('Código')]: '00000025673',
      [marcado('Enviado a')]: 'maria@correo.com',
    });
    expect(constancia.getByText(marcado('Municipalidad Distrital de Catacaos'))).toBeInTheDocument();
    expect(constancia.getByText(marcado('Total pagado'))).toBeInTheDocument();
    expect(constancia.getByText(marcado('Interés condonado por la Ordenanza 012-2026-MPS'))).toBeInTheDocument();
    // El medio de la banda pasa por `t()` (va en minusculas, marcado dentro de la frase marcada).
    expect(
      enMain().getByText(
        marcado(
          `Pagó S/ 3,149.92 con ${marcado('tarjeta')}. Le enviamos el comprobante a maria@correo.com, y puede descargarlo aquí mismo. La deuda pagada ya se descontó de su cuenta.`,
        ),
      ),
    ).toBeInTheDocument();
    for (const boton of ['Descargar comprobante', 'Imprimir', 'Consultar otra deuda', 'Crear mi cuenta']) {
      expect(enMain().getByRole('button', { name: marcado(boton) }), boton).toBeInTheDocument();
    }

    fireEvent.click(enMain().getByRole('button', { name: marcado('Descargar comprobante') }));
    expect(await screen.findByText(marcado('Se descargaría el comprobante 0003-0041418 en PDF.'))).toBeInTheDocument();
  });

  it('sin correo, «su correo» en la meta y en la invitacion', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    await pagar({ correo: '', marcadas: { pred26: true } }, marcado('Pagar ahora'), marcado('Su pago se registró'));

    expect(meta(recibo(marcado('Constancia de pago')))[marcado('Enviado a')]).toBe(marcado('su correo'));
    expect(
      enMain().getByText(
        marcado(`Si crea una cuenta con ${marcado('su correo')}, este comprobante y los anteriores quedan guardados: no tendrá que volver a buscarlos.`),
      ),
    ).toBeInTheDocument();
  });

  it('con sesion, «Ver mis pagos» y «Pagar otra deuda»', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    await pagar({ autenticado: true, marcadas: { pred26: true } }, marcado('Pagar ahora'), marcado('Su pago se registró'));
    expect(enMain().getByRole('button', { name: marcado('Ver mis pagos') })).toBeInTheDocument();
    expect(enMain().getByRole('button', { name: marcado('Pagar otra deuda') })).toBeInTheDocument();
  });
});

describe('las medidas del artboard', () => {
  const clases = (el: Element | null | undefined) => (el?.className ?? '').toString().split(/\s+/);

  it('la meta en rejilla de 206 px, a 2 columnas a ≤ 700 px y a 1 a ≤ 520 px; la tabla de 660 px, sin minimo a ≤ 700 px', async () => {
    await pagar();

    expect(clases(recibo().querySelector('[data-meta]'))).toEqual(
      expect.arrayContaining([
        'grid-cols-[repeat(auto-fit,minmax(206px,1fr))]',
        'max-[701px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        'max-[521px]:grid-cols-[minmax(0,1fr)]',
      ]),
    );
    expect(clases(recibo().querySelector('table'))).toEqual(expect.arrayContaining(['min-w-[660px]', 'max-[701px]:min-w-0']));
    expect(clases(recibo().querySelector('th'))).toEqual(
      expect.arrayContaining(['px-[18px]', 'max-[701px]:px-[14px]', 'max-[701px]:whitespace-normal', 'max-[521px]:px-3']),
    );
  });

  it('la cabecera con filo inferior de 2 px `azul`; el condonado en verde; el total en negrita sobre `sup`', async () => {
    await pagar();

    const cabecera = within(recibo()).getByRole('heading', { level: 2, name: 'Constancia de pago' }).closest('.border-b-2');
    expect(clases(cabecera)).toEqual(expect.arrayContaining(['border-b-2', 'border-azul']));
    const [condonado, total] = [...recibo().querySelectorAll('tfoot tr')];
    expect(clases(condonado)).toContain('text-ok-tinta');
    expect(clases(total)).toEqual(expect.arrayContaining(['bg-sup', 'font-bold']));
    expect(clases(recibo().querySelector('img'))).toContain('h-[46px]');
  });

  it('las acciones, en columna y a todo el ancho a ≤ 700 px', async () => {
    await pagar();

    const acciones = principal().querySelector('[data-acciones]');
    expect(clases(acciones)).toEqual(
      expect.arrayContaining(['flex', 'flex-wrap', 'max-[701px]:flex-col', 'max-[701px]:items-stretch']),
    );
    for (const boton of within(acciones as HTMLElement).getAllByRole('button')) {
      expect(clases(boton), boton.textContent ?? '').toEqual(expect.arrayContaining(['min-h-[46px]', 'max-[701px]:w-full']));
    }
  });
});
