import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEUDAS, MEDIOS, USUARIO } from '../../datos/demostracion.ts';
import type { MedioDePago } from '../../datos/tipos.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';
import type { EstadoDelRecorrido } from '../../recorrido/recorrido.ts';
import { textosDelMedio } from './textosDeLosMedios.ts';

/**
 * **Paso 4 · Pagar**: los cuatro medios, el resumen de lo que se paga y el pago sellado.
 *
 * Se monta el portal entero en `#/pagar` y se mira el hash de verdad. Todo se busca DENTRO de `main`:
 * la franja de pasos tiene sus propios botones «Pagar», «Buscar mi deuda» y «Elegir qué pago». El
 * panel del medio y el resumen son regiones con el nombre de su titulo.
 *
 * Que las cifras salen de las cuentas y no de una suma de la pantalla se prueba aparte, en
 * `Pagar.cuentas.test.tsx`, porque alli se sustituyen las cuentas del modulo entero.
 */

afterEach(async () => {
  vi.restoreAllMocks();
  await limpiarElPortal();
});

/** Se busco la deuda, se dio el correo y se llego a pagar con los cuatro conceptos marcados. */
const EN_PAGAR: Partial<EstadoDelRecorrido> = { paso: 'pagar', numero: '00000025673', correo: 'maria@correo.com' };

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());
const medio = (rotulo: string) => enMain().getByRole('button', { name: rotulo });
const panel = (titulo: string) => within(enMain().getByRole('region', { name: titulo }));
const resumen = () => within(enMain().getByRole('region', { name: 'Lo que va a pagar' }));
const franja = () => within(screen.getByRole('navigation'));

/** Lo que dice la cifra de una fila de los totales del resumen, por su rotulo. */
function totalDelResumen(rotulo: string): string {
  const dt = resumen().getByText(rotulo, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '(sin cifra)';
}

const nombreDelMedio = (m: MedioDePago) => m.rotulo;

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('el selector de medio y su panel', () => {
  it('por omision, «Tarjeta» activa con sus 4 campos; «Yape o Plin» muestra «969 032 194» y el paso 3 con S/ 3,149.92', () => {
    montarElPortal({ hash: '#/pagar', estado: EN_PAGAR });

    expect(enMain().getByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' })).toBeInTheDocument();
    expect(medio('Tarjeta')).toHaveAttribute('aria-pressed', 'true');
    for (const otro of ['Yape o Plin', 'pagalo.pe', 'Banco o agente']) {
      expect(medio(otro), otro).toHaveAttribute('aria-pressed', 'false');
    }
    // La nota describe el boton, sin entrar en su nombre.
    expect(medio('Tarjeta')).toHaveAccessibleDescription('Visa, Mastercard, débito o crédito');

    const tarjeta = panel('Pagar con tarjeta');
    expect(tarjeta.getAllByRole('textbox')).toHaveLength(4);
    expect(tarjeta.getByRole('textbox', { name: 'Número de la tarjeta' })).toHaveAttribute('placeholder', '0000 0000 0000 0000');
    expect(tarjeta.getByRole('textbox', { name: 'Nombre como figura en la tarjeta' })).toHaveAttribute(
      'placeholder',
      'MARIA E CASTILLO P',
    );
    expect(tarjeta.getByRole('textbox', { name: 'Vence' })).toHaveAttribute('placeholder', 'MM/AA');
    const cvv = tarjeta.getByRole('textbox', { name: 'Código de seguridad' });
    expect(cvv).toHaveAttribute('placeholder', '123');
    expect(cvv).toHaveAccessibleDescription('Los tres dígitos del reverso');
    expect(tarjeta.getByRole('button', { name: 'Pagar ahora' })).toBeInTheDocument();
    expect(tarjeta.getByText('Al continuar acepta el cargo en su tarjeta. La operación va cifrada.')).toBeInTheDocument();

    fireEvent.click(medio('Yape o Plin'));

    expect(medio('Yape o Plin')).toHaveAttribute('aria-pressed', 'true');
    expect(medio('Tarjeta')).toHaveAttribute('aria-pressed', 'false');
    expect(enMain().queryByRole('region', { name: 'Pagar con tarjeta' })).toBeNull();
    const yape = panel('Pagar con Yape o Plin');
    expect(yape.queryAllByRole('textbox')).toEqual([]);
    expect(yape.getByText('Número para yapear')).toBeInTheDocument();
    expect(yape.getByText('969 032 194')).toBeInTheDocument();
    const pasos = yape.getAllByRole('listitem').map((li) => li.textContent);
    expect(pasos).toHaveLength(4);
    expect(pasos[2]).toBe('Confirme el monto exacto de S/ 3,149.92 y escriba su código de contribuyente en el mensaje.');
    expect(yape.getByRole('button', { name: 'Ya yapeé' })).toBeInTheDocument();
  });

  it('«Banco o agente» muestra «2026-0025673-4418», los 6 bancos y «Ya pagué en el banco»; pagalo.pe, su codigo y su boton', () => {
    montarElPortal({ hash: '#/pagar', estado: EN_PAGAR });

    fireEvent.click(medio('Banco o agente'));
    const banco = panel('Pagar en un banco o agente');
    expect(banco.getByText('2026-0025673-4418')).toBeInTheDocument();
    const bancos = within(banco.getByRole('list', { name: 'Dónde puede pagarlo' })).getAllByRole('listitem');
    expect(bancos.map((b) => b.firstElementChild?.textContent)).toEqual([
      'BCP',
      'Interbank',
      'BBVA',
      'Scotiabank',
      'Caja Piura',
      'Banco de la Nación',
    ]);
    expect(bancos[0]?.lastElementChild?.textContent).toBe('Banca por internet, app y agentes');
    expect(banco.getByText('Escriba el código de pago y confirme el monto de S/ 3,149.92.')).toBeInTheDocument();
    expect(banco.getByRole('button', { name: 'Ya pagué en el banco' })).toBeInTheDocument();

    fireEvent.click(medio('pagalo.pe'));
    const pagalo = panel('Pagar por pagalo.pe');
    expect(pagalo.getByText('8 4 1 6 2')).toBeInTheDocument();
    expect(pagalo.queryByRole('list', { name: 'Dónde puede pagarlo' })).toBeNull();
    expect(pagalo.getAllByRole('listitem')).toHaveLength(3);
    expect(pagalo.getByRole('button', { name: 'Ir a pagalo.pe' })).toBeInTheDocument();
  });

  it('el importe de las instrucciones sigue a lo seleccionado: solo el vehicular, S/ 710.00', () => {
    montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, medio: 'banco', marcadas: { veh24: true } } });

    expect(
      panel('Pagar en un banco o agente').getByText('Escriba el código de pago y confirme el monto de S/ 710.00.'),
    ).toBeInTheDocument();
  });
});

describe('el resumen', () => {
  it('con los 4 marcados: una fila por concepto y los totales S/ 3,041.92, − S/ 413.32, S/ 108.00 y S/ 3,149.92', () => {
    montarElPortal({ hash: '#/pagar', estado: EN_PAGAR });

    const filas = resumen().getAllByRole('listitem');
    expect(filas.map((fila) => fila.textContent)).toEqual([
      'Impuesto predial 2026Cuotas 3 y 4 de 4S/ 293.72',
      'Arbitrios municipales 2026Cuotas 1 a 8 de 12S/ 310.04',
      'Impuesto predial 2024Cuotas 1 a 4 de 4S/ 2,067.04',
      'Impuesto vehicular 2024Cuota 1 de 4S/ 892.44',
    ]);

    expect(totalDelResumen('Impuesto y arbitrios')).toBe('S/ 3,041.92');
    expect(totalDelResumen('Interés condonado')).toBe('− S/ 413.32');
    expect(totalDelResumen('Gastos y costas')).toBe('S/ 108.00');
    expect(totalDelResumen('Total a pagar')).toBe('S/ 3,149.92');
    // El condonado en verde y el total en azul: la tinta es de la cifra, no del rotulo.
    const condonado = resumen().getByText('Interés condonado', { selector: 'dt' });
    expect(condonado.nextElementSibling?.className).toContain('text-ok-tinta');
    expect(condonado.className).not.toContain('text-ok-tinta');
    const total = resumen().getByText('Total a pagar', { selector: 'dt' });
    expect(total.nextElementSibling?.className).toContain('text-azul');
    expect(total.parentElement?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['text-[19px]', 'font-bold', 'bg-sup', 'border-t-2', 'border-linea']),
    );

    expect(resumen().getByText('El comprobante se enviará a maria@correo.com.')).toBeInTheDocument();
  });

  it('con sesion, el comprobante va al correo de la cuenta; sin correo, a «su correo»', async () => {
    const conSesion = montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, autenticado: true } });
    expect(resumen().getByText(`El comprobante se enviará a ${USUARIO.correo}.`)).toBeInTheDocument();
    conSesion.unmount();
    await limpiarElPortal();

    montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, correo: '' } });
    expect(resumen().getByText('El comprobante se enviará a su correo.')).toBeInTheDocument();
  });

  it('«Cambiar lo que voy a pagar» vuelve a `#/deudas` conservando la seleccion', async () => {
    montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, marcadas: { pred26: true, veh24: true } } });
    expect(resumen().getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(resumen().getByRole('button', { name: 'Cambiar lo que voy a pagar' }));

    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
    const marcadas = DEUDAS.map((deuda) => [
      deuda.id,
      (enMain().getByRole('checkbox', { name: `Pagar ${deuda.concepto}` }) as HTMLButtonElement).getAttribute(
        'aria-checked',
      ),
    ]);
    expect(marcadas).toEqual([
      ['pred26', 'true'],
      ['arb26', 'false'],
      ['pred24', 'false'],
      ['veh24', 'true'],
    ]);
  });
});

describe('confirmar', () => {
  it('«Pagar ahora» deja pagado lo seleccionado, navega a `#/comprobante` y avisa con el correo del paso 3', async () => {
    montarElPortal({
      hash: '#/identificar',
      estado: { paso: 'identificar', numero: '00000025673', marcadas: { pred26: true, arb26: true } },
    });

    // El correo se da en el paso 3, de verdad.
    fireEvent.change(enMain().getByRole('textbox', { name: 'Correo electrónico' }), {
      target: { value: 'maria@correo.com' },
    });
    fireEvent.click(enMain().getByRole('button', { name: 'Continuar al pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    // El hash cambia antes de que el enrutador dibuje la pantalla: se espera a que este.
    await enMain().findByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' });

    fireEvent.click(panel('Pagar con tarjeta').getByRole('button', { name: 'Pagar ahora' }));

    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    expect(await screen.findByText('Pago registrado. Le enviamos el comprobante a maria@correo.com.')).toBeInTheDocument();

    // Lo pagado ya no es deuda: en «Elegir qué pago» solo quedan los dos que no se seleccionaron.
    fireEvent.click(franja().getByRole('button', { name: 'Elegir qué pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
    expect(enMain().getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual([
      'Pagar Impuesto predial 2024',
      'Pagar Impuesto vehicular 2024',
    ]);
  });

  it('con sesion, el aviso nombra el correo de la cuenta; y cada medio confirma con su boton', async () => {
    montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, autenticado: true, medio: 'yape' } });

    fireEvent.click(panel('Pagar con Yape o Plin').getByRole('button', { name: 'Ya yapeé' }));

    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    expect(await screen.findByText(`Pago registrado. Le enviamos el comprobante a ${USUARIO.correo}.`)).toBeInTheDocument();
  });
});

describe('sin nada que pagar (llegar por «Solo con mi correo» sin haber buscado)', () => {
  it('no hay resumen que pagar: confirmar avisa «No hay nada que pagar.», no sella, y ofrece buscar', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    fireEvent.change(enMain().getByRole('textbox', { name: 'Correo electrónico' }), {
      target: { value: 'maria@correo.com' },
    });
    fireEvent.click(enMain().getByRole('button', { name: 'Continuar al pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    // El hash cambia antes de que el enrutador dibuje la pantalla: se espera a que este.
    await enMain().findByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' });

    // Ni filas, ni totales, ni la cifra de lo marcado por omision.
    expect(resumen().getByText('No hay nada que pagar.')).toBeInTheDocument();
    expect(resumen().queryAllByRole('listitem')).toEqual([]);
    expect(resumen().queryByText('Total a pagar')).toBeNull();
    expect(principal().textContent).not.toContain('3,149.92');
    expect(resumen().queryByRole('button', { name: 'Cambiar lo que voy a pagar' })).toBeNull();

    const pagar = panel('Pagar con tarjeta').getByRole('button', { name: 'Pagar ahora' });
    expect(pagar).toHaveAttribute('aria-disabled', 'true');
    expect(pagar.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-linea', 'text-tinta-2']));
    expect(pagar.className.split(/\s+/)).not.toContain('bg-ok-tinta');

    fireEvent.click(pagar);

    // El aviso sale (ademas del texto del resumen), y no se sello nada ni se cambio de paso.
    await waitFor(() => expect(screen.getAllByText('No hay nada que pagar.')).toHaveLength(2));
    expect(window.location.hash).toBe('#/pagar');
    expect(screen.queryByText(/^Pago registrado/)).toBeNull();
    fireEvent.click(franja().getByRole('button', { name: 'Comprobante' }));
    expect(await screen.findByText('Complete primero los pasos anteriores.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/pagar');

    // Volver a elegir: sin busqueda, a buscar (a `deudas` se volveria aqui sin haber buscado).
    fireEvent.click(resumen().getByRole('button', { name: 'Buscar mi deuda' }));
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
  });

  it('con busqueda pero todo lo seleccionado ya pagado, ofrece «Elegir qué pago» y lleva a `#/deudas`', async () => {
    montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, marcadas: { pred26: true }, pagadas: { pred26: true } } });

    expect(resumen().getByText('No hay nada que pagar.')).toBeInTheDocument();
    fireEvent.click(resumen().getByRole('button', { name: 'Elegir qué pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
  });
});

describe('lo tecleado en la tarjeta', () => {
  it('vive en el estado del recorrido: sobrevive a cambiar de medio y no llega al almacenamiento del navegador', () => {
    const guardado = vi.spyOn(Storage.prototype, 'setItem');
    montarElPortal({ hash: '#/pagar', estado: EN_PAGAR });

    const valores: Readonly<Record<string, string>> = {
      'Número de la tarjeta': '4111 1111 1111 1111',
      'Nombre como figura en la tarjeta': 'ANA TITULAR SECRETA',
      Vence: '12/29',
      'Código de seguridad': '987',
    };
    for (const [rotulo, valor] of Object.entries(valores)) {
      fireEvent.change(panel('Pagar con tarjeta').getByRole('textbox', { name: rotulo }), { target: { value: valor } });
    }

    // El panel de la tarjeta se desmonta y se vuelve a montar: lo que muestra sale del estado.
    fireEvent.click(medio('Banco o agente'));
    fireEvent.click(medio('Tarjeta'));
    for (const [rotulo, valor] of Object.entries(valores)) {
      expect(panel('Pagar con tarjeta').getByRole('textbox', { name: rotulo }), rotulo).toHaveValue(valor);
    }

    const escrito = guardado.mock.calls.flat().join('\n');
    const almacenado = [window.localStorage, window.sessionStorage]
      .flatMap((almacen) => Object.keys(almacen).map((k) => `${k}=${almacen.getItem(k) ?? ''}`))
      .join('\n');
    for (const valor of Object.values(valores)) {
      expect(escrito, valor).not.toContain(valor);
      expect(almacenado, valor).not.toContain(valor);
    }
  });
});

describe('todo lo que se lee pasa por `t()`', () => {
  /**
   * Las hojas de texto de un contenedor y sus `placeholder`: lo que se ve. Un texto que pasa por `t()`
   * llega entero entre `⟦` y `⟧`; lo que no, sin marcar.
   */
  function loQueSeLee(contenedor: HTMLElement): string[] {
    const hojas = [...contenedor.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '')
      .map((el) => el.textContent ?? '');
    const ejemplos = [...contenedor.querySelectorAll('[placeholder]')].map((el) => el.getAttribute('placeholder') ?? '');
    return [...hojas, ...ejemplos];
  }

  const desmarcar = (texto: string): string | null =>
    texto.startsWith(ABRE) && texto.endsWith(CIERRA) ? texto.slice(ABRE.length, -CIERRA.length) : null;

  it('cada medio: su boton y su panel dicen EXACTAMENTE `textosDelMedio`, marcado; solo el codigo, los bancos y los ejemplos de cifras son dato', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/pagar', estado: EN_PAGAR });

    for (const m of MEDIOS) {
      fireEvent.click(enMain().getByRole('button', { name: marcado(nombreDelMedio(m)) }));
      const region = enMain().getByRole('region', { name: marcado(m.titulo) });
      const boton = enMain().getByRole('button', { name: marcado(m.rotulo) });
      expect(boton).toHaveAttribute('aria-pressed', 'true');

      const dato = new Set([
        ...(m.codigo === undefined ? [] : [m.codigo]),
        ...(m.bancos ?? []).map((banco) => banco.nombre),
        ...(m.campos ?? []).map((campo) => campo.ejemplo),
      ]);
      // Lo de la pantalla que no es del medio: el rotulo de los bancos.
      const dePantalla = new Set([...(m.bancos === undefined ? [] : ['Dónde puede pagarlo'])]);

      const escapados: string[] = [];
      const dichos = new Set<string>();
      for (const texto of [...loQueSeLee(boton), ...loQueSeLee(region)]) {
        const dentro = desmarcar(texto);
        if (dentro === null) {
          if (!dato.has(texto)) escapados.push(texto);
          continue;
        }
        // Los pasos llevan el importe puesto; la clave, su hueco.
        const clave = dentro.replace('3,149.92', '{{TOTAL}}');
        if (!dePantalla.has(clave)) dichos.add(clave);
      }

      expect(escapados, `${m.id}: texto que no paso por \`t()\``).toEqual([]);
      expect([...dichos].sort(), `${m.id}: lo que la pantalla traduce no es \`textosDelMedio\``).toEqual(
        [...new Set(textosDelMedio(m))].sort(),
      );
    }
  });

  it('la entrada, el resumen y el aviso del pago', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/pagar', estado: EN_PAGAR });

    expect(
      enMain().getByText(
        marcado(
          'Elija un medio de pago. Con tarjeta, Yape o pagalo.pe el pago se aplica al instante; con código de banco se aplica al día siguiente hábil.',
        ),
      ),
    ).toBeInTheDocument();
    const region = within(enMain().getByRole('region', { name: marcado('Lo que va a pagar') }));
    for (const rotulo of ['Impuesto y arbitrios', 'Interés condonado', 'Gastos y costas', 'Total a pagar']) {
      expect(region.getByText(marcado(rotulo), { selector: 'dt' })).toBeInTheDocument();
    }
    expect(region.getByText(marcado('El comprobante se enviará a maria@correo.com.'))).toBeInTheDocument();
    expect(region.getByRole('button', { name: marcado('Cambiar lo que voy a pagar') })).toBeInTheDocument();

    fireEvent.click(enMain().getByRole('button', { name: marcado('Pagar ahora') }));
    expect(
      await screen.findByText(marcado('Pago registrado. Le enviamos el comprobante a maria@correo.com.')),
    ).toBeInTheDocument();
  });

  it('sin nada que pagar, sin correo: «su correo», «No hay nada que pagar.» y «Buscar mi deuda»', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar' } });

    const region = within(enMain().getByRole('region', { name: marcado('Lo que va a pagar') }));
    expect(region.getByText(marcado(`El comprobante se enviará a ${marcado('su correo')}.`))).toBeInTheDocument();
    expect(region.getByText(marcado('No hay nada que pagar.'))).toBeInTheDocument();
    expect(region.getByRole('button', { name: marcado('Buscar mi deuda') })).toBeInTheDocument();
  });
});

describe('las medidas del artboard', () => {
  const clases = (el: Element | null | undefined) => (el?.className ?? '').toString().split(/\s+/);

  // `max-[821px]` y `max-[521px]`, y no `max-[820px]`/`max-[520px]`: Tailwind v4 emite `max-[820px]` como
  // `width < 820px`, que a 820 px justos no aplica y el `max-width: 820px` del artboard si. Lo destapo
  // el arnes (`e2e/se-ve.spec.ts`: «a 820 px el resumen tiene que ir ENCIMA de los medios»).
  it('dos columnas que a ≤ 820 px son una con el resumen arriba y sin pegar; medios y bancos a una columna a ≤ 520 px', () => {
    montarElPortal({ hash: '#/pagar', estado: { ...EN_PAGAR, medio: 'banco' } });

    expect(clases(principal().querySelector('[data-pagar]'))).toEqual(
      expect.arrayContaining([
        'grid',
        'grid-cols-[minmax(0,1fr)_minmax(0,320px)]',
        'gap-[18px]',
        'max-[821px]:grid-cols-[minmax(0,1fr)]',
      ]),
    );
    expect(clases(principal().querySelector('[data-resumen]'))).toEqual(
      expect.arrayContaining(['sticky', 'top-[14px]', 'max-[821px]:static', 'max-[821px]:-order-1']),
    );
    expect(clases(principal().querySelector('[data-medios]'))).toEqual(
      expect.arrayContaining(['grid-cols-[repeat(auto-fit,minmax(218px,1fr))]', 'max-[521px]:grid-cols-[minmax(0,1fr)]']),
    );
    expect(clases(principal().querySelector('[data-bancos]'))).toEqual(
      expect.arrayContaining(['grid-cols-[repeat(auto-fit,minmax(186px,1fr))]', 'max-[521px]:grid-cols-[minmax(0,1fr)]']),
    );
    expect(clases(principal().querySelector('[data-codigo]'))).toEqual(
      expect.arrayContaining([
        'text-[31px]',
        'font-bold',
        'tracking-[0.1em]',
        'max-[821px]:text-[24px]',
        'max-[521px]:text-[21px]',
      ]),
    );
  });

  it('el medio activo con filo de 2 px `azul` y papel `azul-suave`, su icono sobre `azul`; confirmar, verde de 48 px', () => {
    montarElPortal({ hash: '#/pagar', estado: EN_PAGAR });

    const activo = medio('Tarjeta');
    expect(clases(activo)).toEqual(expect.arrayContaining(['min-h-[88px]', 'border-2', 'border-azul', 'bg-azul-suave']));
    expect(clases(activo.querySelector('svg')?.parentElement)).toEqual(
      expect.arrayContaining(['size-[30px]', 'bg-azul', 'text-sobre-azul']),
    );
    expect(clases(medio('Yape o Plin'))).not.toContain('bg-azul-suave');

    const pagar = panel('Pagar con tarjeta').getByRole('button', { name: 'Pagar ahora' });
    expect(pagar).toHaveAttribute('aria-disabled', 'false');
    expect(clases(pagar)).toEqual(expect.arrayContaining(['min-h-[48px]', 'bg-ok-tinta', 'text-sobre-azul']));
    expect(clases(pagar)).not.toContain('bg-azul');
    expect(clases(pagar.parentElement)).toContain('bg-sup');
  });
});
