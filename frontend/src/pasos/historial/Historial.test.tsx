import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEUDAS, HISTORIAL, UNIDADES, USUARIO } from '../../datos/demostracion.ts';
import type { FuenteDelPortal } from '../../datos/fuente.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from '../../pruebas/portal.tsx';
import type { EstadoDelRecorrido } from '../../recorrido/recorrido.ts';
import { textosDeLaUnidad, textosDelPago } from './textosDelHistorial.ts';

/**
 * **Mis pagos**: el pago de esta visita, los anteriores, lo pendiente y de donde sale lo que paga.
 *
 * Al historial con un pago no se llega escribiendo un estado: se llega ENTRANDO y PAGANDO. Las pruebas
 * del pago reciente entran con la cuenta en «Mis datos», pagan en `#/pagar` y abren «Ver mis pagos» en
 * el comprobante; lo que se mide es lo que deja un pago de verdad.
 *
 * Todo se busca dentro de `main`. Los pagos anteriores y las unidades llegan de la fuente por
 * `useQuery`, asi que se esperan con `findBy…`.
 */

afterEach(async () => {
  vi.restoreAllMocks();
  await limpiarElPortal();
});

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());
const seccion = (nombre: string) => enMain().getByRole('region', { name: nombre });

/** Se busco la deuda y se llego a «Mis datos». Por omision, con los cuatro conceptos marcados. */
const CON_BUSQUEDA: Partial<EstadoDelRecorrido> = { paso: 'identificar', numero: '00000025673' };

/** Entra con la cuenta en «Mis datos» (el paso 3), paga con tarjeta y abre «Ver mis pagos». */
async function entrarPagarYVerMisPagos(estado: Partial<EstadoDelRecorrido> = {}): Promise<void> {
  montarElPortal({ hash: '#/identificar', estado: { ...CON_BUSQUEDA, ...estado } });
  const cuenta = within(enMain().getByRole('region', { name: 'Con mi cuenta' }));
  fireEvent.change(cuenta.getByRole('textbox', { name: 'Documento de identidad' }), { target: { value: '44218937' } });
  fireEvent.change(cuenta.getByLabelText('Clave'), { target: { value: 'secreta' } });
  fireEvent.click(cuenta.getByRole('button', { name: 'Entrar y pagar' }));
  await waitFor(() => expect(window.location.hash).toBe('#/pagar'));

  fireEvent.click(await enMain().findByRole('button', { name: 'Pagar ahora' }));
  await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
  fireEvent.click(await enMain().findByRole('button', { name: 'Ver mis pagos' }));
  await waitFor(() => expect(window.location.hash).toBe('#/historial'));
  await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });
}

/** Las filas del cuerpo de la tabla de pagos, celda a celda, en cuanto la fuente contesto. */
async function filasDePagos(nombre = 'Pagos realizados'): Promise<(string | null)[][]> {
  const pagos = seccion(nombre);
  await waitFor(() => expect(pagos).not.toHaveAttribute('aria-busy'));
  return [...pagos.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((celda) => celda.textContent));
}

/** Lo pendiente: el total de la cabecera y cada fila como [concepto, vence, situacion, total]. */
function pendiente() {
  const region = seccion('Lo que queda pendiente');
  return {
    total: region.querySelector('[data-total-pendiente]')?.textContent,
    filas: [...region.querySelectorAll('li')].map((li) =>
      [...li.querySelectorAll(':scope > span, :scope > span > span')]
        .filter((el) => el.children.length === 0)
        .map((el) => el.textContent),
    ),
  };
}

/** Las filas de `HISTORIAL` como las pinta la tabla: fecha, concepto, medio, comprobante, importe y boton. */
const LAS_CINCO_DEL_ARTBOARD = [
  ['12/08/2026', 'Impuesto predial 2026 — cuotas 1 y 2', 'Tarjeta', '0003-0041182', '294.84', 'Comprobante'],
  ['28/05/2026', 'Arbitrios 2025 — cuotas 1 a 12', 'Yape', '0003-0038944', '412.00', 'Comprobante'],
  ['18/02/2025', 'Impuesto predial 2025 — cuotas 1 a 4', 'BCP con código', '0003-0034118', '578.20', 'Comprobante'],
  ['04/12/2024', 'Arbitrios 2024 — cuotas 9 a 12', 'Ventanilla', '0003-0031044', '148.60', 'Comprobante'],
  ['22/02/2024', 'Impuesto predial 2024 — cuota 1', 'pagalo.pe', '0003-0028801', '460.65', 'Comprobante'],
];

describe('tras entrar y pagar los cuatro conceptos', () => {
  it('la banda «Pago de S/ 3,149.92 registrado hoy», 6 filas con la primera resaltada y «Sin deuda pendiente»', async () => {
    await entrarPagarYVerMisPagos();

    const banda = within(seccion('Pago de S/ 3,149.92 registrado hoy'));
    expect(banda.getByRole('heading', { level: 2, name: 'Pago de S/ 3,149.92 registrado hoy' })).toBeInTheDocument();
    expect(
      banda.getByText(`Operación 86 4418 2026 0913 · Tarjeta · comprobante 0003-0041418, enviado a ${USUARIO.correo}`),
    ).toBeInTheDocument();

    const filas = await filasDePagos();
    expect(filas).toHaveLength(6);
    expect(filas[0]).toEqual([
      '13/09/2026',
      'Impuesto predial 2026 · Arbitrios municipales 2026 · Impuesto predial 2024 · Impuesto vehicular 2024',
      'Tarjeta',
      '0003-0041418',
      '3,149.92',
      'Comprobante',
    ]);
    expect(filas.slice(1)).toEqual(LAS_CINCO_DEL_ARTBOARD);
    const [primera, ...resto] = [...seccion('Pagos realizados').querySelectorAll('tbody tr')];
    expect(primera).toHaveAttribute('data-reciente', 'true');
    expect(primera?.className.split(/\s+/)).toContain('bg-ok-fondo/40');
    for (const fila of resto) {
      expect(fila).not.toHaveAttribute('data-reciente');
      expect(fila.className.split(/\s+/)).not.toContain('bg-ok-fondo/40');
    }

    expect(pendiente()).toEqual({
      total: 'Sin deuda pendiente',
      filas: [['No le queda nada pendiente', 'Puede pedir su constancia de no adeudo', 'Al día', 'S/ 0.00']],
    });
    const lo = within(seccion('Lo que queda pendiente'));
    expect(lo.queryByRole('button', { name: 'Pagar lo pendiente' })).toBeNull();
    expect(
      lo.getByText('No le queda nada pendiente. Puede pedir su constancia de no adeudo, que acredita que está al día.'),
    ).toBeInTheDocument();
    fireEvent.click(lo.getByRole('button', { name: 'Pedir mi constancia' }));
    expect(await screen.findByText('Se emitiría su constancia de no adeudo al día de hoy.')).toBeInTheDocument();
  });

  it('«Ver el comprobante» vuelve al recibo sellado', async () => {
    await entrarPagarYVerMisPagos();

    fireEvent.click(within(seccion('Pago de S/ 3,149.92 registrado hoy')).getByRole('button', { name: 'Ver el comprobante' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    expect(await enMain().findByRole('region', { name: 'Constancia de pago' })).toHaveTextContent('0003-0041418');
  });
});

describe('tras entrar y pagar SOLO el predial 2026', () => {
  it('quedan 3 conceptos por S/ 3,269.52, y «Pagar lo pendiente» lleva a `#/deudas` con esos 3', async () => {
    await entrarPagarYVerMisPagos({ marcadas: { pred26: true } });

    expect(within(seccion('Pago de S/ 293.72 registrado hoy')).getByRole('button', { name: 'Ver el comprobante' })).toBeInTheDocument();
    const filas = await filasDePagos();
    expect(filas[0]).toEqual(['13/09/2026', 'Impuesto predial 2026', 'Tarjeta', '0003-0041418', '293.72', 'Comprobante']);

    expect(pendiente()).toEqual({
      total: 'S/ 3,269.52',
      filas: [
        ['Arbitrios municipales 2026', 'La última venció el 31 de agosto', 'Vencida', 'S/ 310.04'],
        ['Impuesto predial 2024', 'Venció el 30 de noviembre de 2024', 'Vencida', 'S/ 2,067.04'],
        ['Impuesto vehicular 2024', 'En cobranza coactiva desde julio de 2026', 'En coactiva', 'S/ 892.44'],
      ],
    });
    const lo = within(seccion('Lo que queda pendiente'));
    expect(lo.getByText('Puede pagar todo o elegir solo algunos conceptos.')).toBeInTheDocument();
    expect(lo.queryByRole('button', { name: 'Pedir mi constancia' })).toBeNull();

    fireEvent.click(lo.getByRole('button', { name: 'Pagar lo pendiente' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
    expect(enMain().getAllByRole('checkbox').map((casilla) => casilla.getAttribute('aria-label'))).toEqual([
      'Pagar Arbitrios municipales 2026',
      'Pagar Impuesto predial 2024',
      'Pagar Impuesto vehicular 2024',
    ]);
  });
});

describe('sin haber pagado nada en esta visita', () => {
  it('no hay banda, y la tabla tiene las 5 filas del artboard con su nota', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });
    await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });

    expect(await filasDePagos()).toEqual(LAS_CINCO_DEL_ARTBOARD);
    expect(enMain().queryByText(/registrado hoy$/)).toBeNull();
    expect(enMain().queryByRole('button', { name: 'Ver el comprobante' })).toBeNull();
    expect(
      enMain().getByText('Todos sus pagos, con sus comprobantes. Abajo está lo que le queda pendiente.'),
    ).toBeInTheDocument();
    const pagos = within(seccion('Pagos realizados'));
    expect(pagos.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Fecha',
      'Concepto',
      'Medio',
      'Comprobante',
      'Importe S/',
      '',
    ]);
    expect(
      pagos.getByText(
        'Un pago aplicado ya descontó la cuota. Si pagó y la deuda sigue apareciendo, traiga el comprobante: se resuelve el mismo día.',
      ),
    ).toBeInTheDocument();
    // Y lo pendiente es la deuda entera: los cuatro, por S/ 3,563.24.
    expect(pendiente().total).toBe('S/ 3,563.24');
    expect(pendiente().filas.map((fila) => fila[0])).toEqual(DEUDAS.map((deuda) => deuda.concepto));
  });

  it('un sello que no es de esta visita (`recienPagado` en falso) no pone banda ni fila, como el artboard (linea 1329)', async () => {
    // Ninguna accion deja este estado (`confirmarPago` enciende los dos y `cerrarSesion` apaga los dos): se
    // escribe a mano el que deja pagar el predial 2026, con `recienPagado` apagado. La banda cuelga de el.
    montarElPortal({
      hash: '#/historial',
      estado: {
        paso: 'historial',
        autenticado: true,
        pagadas: { pred26: true },
        recienPagado: false,
        ultimo: {
          ids: ['pred26'],
          insoluto: '293.72',
          reajuste: '0.00',
          interes: '0.00',
          gastos: '0.00',
          total: '293.72',
          conAmnistia: '293.72',
          medio: 'tarjeta',
          destino: USUARIO.correo,
          comprobante: { numero: '0003-0041418', operacion: '86 4418 2026 0913', fecha: '2026-09-13', hora: '10:42' },
        },
      },
    });

    expect(await filasDePagos()).toEqual(LAS_CINCO_DEL_ARTBOARD);
    expect(enMain().queryByText(/registrado hoy$/)).toBeNull();
  });

  it('el boton «Comprobante» de cada fila avisa con su numero, y se llama por el', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });
    await filasDePagos();

    const pagos = within(seccion('Pagos realizados'));
    expect(pagos.getAllByRole('button').map((boton) => boton.getAttribute('aria-label'))).toEqual(
      HISTORIAL.map((pago) => `Comprobante ${pago.comprobante}`),
    );
    fireEvent.click(pagos.getByRole('button', { name: 'Comprobante 0003-0034118' }));
    expect(await screen.findByText('Se descargaría el comprobante 0003-0034118.')).toBeInTheDocument();
  });

  it('mientras la fuente no contesta, las secciones quedan `aria-busy`; si falla, lo dice un aviso', async () => {
    let contestar: (valor: typeof HISTORIAL) => void = () => {};
    const lenta: FuenteDelPortal = {
      // Sin plataforma no hay consulta que hacer: el historial se lee igual (issue 27).
      consulta: null,
      historial: () => new Promise((resolver) => (contestar = resolver)),
      unidades: () => Promise.reject(new Error('la fuente no contesto')),
    };
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true }, fuente: lenta });
    await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });

    expect(seccion('Pagos realizados')).toHaveAttribute('aria-busy', 'true');
    expect(await within(seccion('De dónde sale lo que paga')).findByRole('alert')).toHaveTextContent(
      'No pudimos traer sus predios y vehículos. Vuelva a intentarlo en unos minutos.',
    );
    expect(seccion('De dónde sale lo que paga')).not.toHaveAttribute('aria-busy');

    await act(async () => contestar(HISTORIAL.slice(0, 1)));
    expect(await filasDePagos()).toEqual([LAS_CINCO_DEL_ARTBOARD[0]]);
  });

  it('y si fallan los pagos, tambien', async () => {
    const rota: FuenteDelPortal = {
      // Sin plataforma no hay consulta que hacer: el historial se lee igual (issue 27).
      consulta: null,
      historial: () => Promise.reject(new Error('la fuente no contesto')),
      unidades: () => Promise.resolve(UNIDADES),
    };
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true }, fuente: rota });

    expect(await within(await enMain().findByRole('region', { name: 'Pagos realizados' })).findByRole('alert')).toHaveTextContent(
      'No pudimos traer sus pagos. Vuelva a intentarlo en unos minutos.',
    );
  });
});

describe('de donde sale lo que paga', () => {
  it('las 3 unidades, con su base (S/ 132,196.75, S/ 38,420.00, S/ 61,400.00), sus datos y su origen', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });
    const region = await enMain().findByRole('region', { name: 'De dónde sale lo que paga' });
    await waitFor(() => expect(region).not.toHaveAttribute('aria-busy'));

    expect(
      within(region).getByText(
        'Sus predios y vehículos, con los datos sobre los que se calcula cada tributo. Si algo no coincide con la realidad, puede pedir que se rectifique.',
      ),
    ).toBeInTheDocument();
    const unidades = [...region.querySelectorAll(':scope > ul > li')].map((li) => ({
      titulo: li.querySelector('.font-bold')?.textContent,
      base: [...li.querySelectorAll('.tabular-nums')].map((el) => el.textContent),
      etiqueta: li.querySelector('.uppercase')?.textContent,
      datos: within(li as HTMLElement).getAllByRole('listitem').map((chip) => chip.textContent),
      origen: li.querySelector('p')?.textContent,
    }));
    expect(unidades).toEqual([
      {
        titulo: 'Casa habitación · Calle Santa Rosa 116',
        base: ['S/ 132,196.75'],
        etiqueta: 'Autovalúo 2026',
        datos: ['210.00 m² de terreno', '164.50 m² construidos', '8.20 m de frontis', 'Usted es propietaria al 100 %'],
        origen: 'Ficha catastral 200601-02-014-014, actualizada el 12 de marzo de 2026.',
      },
      {
        titulo: 'Terreno sin construir · Mz. B Lt. 7 — Bellavista',
        base: ['S/ 38,420.00'],
        etiqueta: 'Autovalúo 2026',
        datos: ['184.00 m² de terreno', 'Sin construcciones', 'Usted es copropietaria al 50 %'],
        origen: 'Ficha catastral 200601-04-021-007. El 50 % restante figura a nombre de otro titular.',
      },
      {
        titulo: 'Automóvil Toyota Yaris GLI 2018 · placa T2G-418',
        base: ['S/ 61,400.00'],
        etiqueta: 'Base imponible',
        datos: ['Afecto de 2019 a 2021', 'Dado de baja por vencimiento del plazo'],
        origen: 'Padrón vehicular de Rentas, con la tabla referencial del MEF para su año de fabricación.',
      },
    ]);
    for (const unidad of UNIDADES) {
      expect(within(region).getByText(unidad.detalle)).toBeInTheDocument();
    }
    expect(
      within(region).getByText(
        'El autovalúo lo determina Catastro con el arancel de su calle y los valores unitarios del año; la deuda y las cuotas las lleva Rentas; los pagos se registran en Caja.',
      ),
    ).toBeInTheDocument();
  });
});

describe('el recorrido de la nota del revisor', () => {
  it('«Iniciar sesión» → entrar sin buscar → historial → «Pagar lo pendiente» → solo el predial 2026 → pagar → «Ver mis pagos»', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    const cuenta = within(await enMain().findByRole('region', { name: 'Con mi cuenta' }));
    fireEvent.change(cuenta.getByRole('textbox', { name: 'Documento de identidad' }), { target: { value: '44218937' } });
    fireEvent.change(cuenta.getByLabelText('Clave'), { target: { value: 'secreta' } });
    fireEvent.click(cuenta.getByRole('button', { name: 'Entrar y pagar' }));

    // Sin buscar, entrar lleva al historial: sin banda y con los cuatro pendientes.
    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
    await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });
    expect(await filasDePagos()).toHaveLength(5);
    expect(pendiente().total).toBe('S/ 3,563.24');

    fireEvent.click(within(seccion('Lo que queda pendiente')).getByRole('button', { name: 'Pagar lo pendiente' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    for (const concepto of ['Arbitrios municipales 2026', 'Impuesto predial 2024', 'Impuesto vehicular 2024']) {
      fireEvent.click(await enMain().findByRole('checkbox', { name: `Pagar ${concepto}` }));
    }
    expect(enMain().getByText('Va a pagar 1 concepto de 4')).toBeInTheDocument();
    fireEvent.click(enMain().getByRole('button', { name: 'Pagar lo marcado' }));

    // Con sesion va directo a pagar, y hay algo que pagar aunque no se buscara.
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    const resumen = within(await enMain().findByRole('region', { name: 'Lo que va a pagar' }));
    expect(resumen.queryByText('No hay nada que pagar.')).toBeNull();
    expect(resumen.getByText('Impuesto predial 2026')).toBeInTheDocument();
    fireEvent.click(enMain().getByRole('button', { name: 'Pagar ahora' }));

    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    expect(await enMain().findByRole('region', { name: 'Constancia de pago' })).toHaveTextContent('Impuesto predial 2026');
    fireEvent.click(enMain().getByRole('button', { name: 'Ver mis pagos' }));

    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
    await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });
    const filas = await filasDePagos();
    expect(filas).toHaveLength(6);
    expect(filas[0]).toEqual(['13/09/2026', 'Impuesto predial 2026', 'Tarjeta', '0003-0041418', '293.72', 'Comprobante']);
    expect(pendiente().total).toBe('S/ 3,269.52');
    expect(pendiente().filas).toHaveLength(3);
  });
});

describe('todo lo que se lee pasa por `t()`', () => {
  const desmarcar = (texto: string): string | null =>
    texto.startsWith(ABRE) && texto.endsWith(CIERRA) ? texto.slice(ABRE.length, -CIERRA.length) : null;

  /** Lo que no es dato y llego al DOM sin marcar. */
  function escapados(dato: ReadonlySet<string>): string[] {
    return [...principal().querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '')
      .map((el) => el.textContent ?? '')
      .filter((texto) => desmarcar(texto) === null && !dato.has(texto));
  }

  it('con pago reciente y deuda viva, en el idioma `marcado`: lo demas es dato', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({
      hash: '#/pagar',
      estado: { paso: 'pagar', numero: '00000025673', autenticado: true, marcadas: { pred26: true } },
    });
    fireEvent.click(enMain().getByRole('button', { name: marcado('Pagar ahora') }));
    fireEvent.click(await enMain().findByRole('button', { name: marcado('Ver mis pagos') }));
    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
    await enMain().findByRole('heading', { level: 1, name: marcado('Mis pagos') });
    await filasDePagos(marcado('Pagos realizados'));
    await waitFor(() => expect(seccion(marcado('De dónde sale lo que paga'))).not.toHaveAttribute('aria-busy'));

    // El dato: fechas, numeros, importes y lo que dice la deuda (como en los pasos 2 y 5).
    const dato = new Set([
      '13/09/2026',
      '0003-0041418',
      '293.72',
      ...HISTORIAL.flatMap((pago) => [pago.comprobante, pago.importe]),
      '12/08/2026',
      '28/05/2026',
      '18/02/2025',
      '04/12/2024',
      '22/02/2024',
      ...DEUDAS.flatMap((deuda) => [deuda.concepto, deuda.vence, deuda.estado]),
      'S/ 3,269.52',
      'S/ 310.04',
      'S/ 2,067.04',
      'S/ 892.44',
      'S/ 132,196.75',
      'S/ 38,420.00',
      'S/ 61,400.00',
    ]);
    expect(escapados(dato)).toEqual([]);

    // Cada texto de los pagos y de las unidades llega marcado: la pantalla traduce ESTA lista.
    const textos = [...HISTORIAL.flatMap(textosDelPago), ...UNIDADES.flatMap(textosDeLaUnidad)];
    for (const texto of new Set(textos)) {
      expect(enMain().getAllByText(marcado(texto)).length, texto).toBeGreaterThan(0);
    }
    expect(
      enMain().getByText(
        marcado(
          `Operación 86 4418 2026 0913 · ${marcado('Tarjeta')} · comprobante 0003-0041418, enviado a ${USUARIO.correo}`,
        ),
      ),
    ).toBeInTheDocument();
    expect(enMain().getByRole('heading', { level: 2, name: marcado('Pago de S/ 293.72 registrado hoy') })).toBeInTheDocument();
    for (const boton of ['Ver el comprobante', 'Pagar lo pendiente']) {
      expect(enMain().getByRole('button', { name: marcado(boton) }), boton).toBeInTheDocument();
    }
    expect(enMain().getByRole('button', { name: marcado('Comprobante 0003-0041182') })).toHaveTextContent(marcado('Comprobante'));
    fireEvent.click(enMain().getByRole('button', { name: marcado('Comprobante 0003-0041182') }));
    expect(await screen.findByText(marcado('Se descargaría el comprobante 0003-0041182.'))).toBeInTheDocument();
  });

  it('sin deuda viva: la fila «No le queda nada pendiente», «Al día» y la constancia', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({
      hash: '#/historial',
      estado: { paso: 'historial', autenticado: true, pagadas: { pred26: true, arb26: true, pred24: true, veh24: true } },
    });
    await enMain().findByRole('heading', { level: 1, name: marcado('Mis pagos') });
    await filasDePagos(marcado('Pagos realizados'));
    await waitFor(() => expect(seccion(marcado('De dónde sale lo que paga'))).not.toHaveAttribute('aria-busy'));

    const dato = new Set([
      ...HISTORIAL.flatMap((pago) => [pago.comprobante, pago.importe]),
      '12/08/2026',
      '28/05/2026',
      '18/02/2025',
      '04/12/2024',
      '22/02/2024',
      'S/ 0.00',
      'S/ 132,196.75',
      'S/ 38,420.00',
      'S/ 61,400.00',
    ]);
    expect(escapados(dato)).toEqual([]);
    const lo = within(seccion(marcado('Lo que queda pendiente')));
    expect(lo.getByText(marcado('Sin deuda pendiente'))).toBeInTheDocument();
    expect(lo.getByText(marcado('Al día'))).toBeInTheDocument();
    fireEvent.click(lo.getByRole('button', { name: marcado('Pedir mi constancia') }));
    expect(await screen.findByText(marcado('Se emitiría su constancia de no adeudo al día de hoy.'))).toBeInTheDocument();
  });
});

describe('las medidas del artboard', () => {
  const clases = (el: Element | null | undefined) => (el?.className ?? '').toString().split(/\s+/);

  it('la tabla de pagos mide 760 px como minimo y se desplaza en su propio marco', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });
    await filasDePagos();

    const tabla = seccion('Pagos realizados').querySelector('table');
    expect(clases(tabla)).toContain('min-w-[760px]');
    expect(clases(tabla?.parentElement)).toContain('overflow-x-auto');
  });

  it('los botones con el alto del artboard: 46 px los del pie de lo pendiente, 36 px los de cada fila', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'historial', autenticado: true } });
    await filasDePagos();

    expect(clases(enMain().getByRole('button', { name: 'Pagar lo pendiente' }))).toContain('min-h-[46px]');
    for (const boton of within(seccion('Pagos realizados')).getAllByRole('button')) {
      expect(clases(boton)).toContain('min-h-[36px]');
    }
    expect(clases(seccion('Lo que queda pendiente').querySelector('[data-total-pendiente]'))).toEqual(
      expect.arrayContaining(['text-mal-tinta', 'font-bold', 'tabular-nums']),
    );
  });
});
