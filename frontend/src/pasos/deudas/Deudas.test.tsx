import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CONTRIBUYENTE, DEUDAS } from '../../datos/demostracion.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from '../../pruebas/portal.tsx';
import type { EstadoDelRecorrido } from '../../recorrido/recorrido.ts';

/**
 * **Paso 2 · Elegir qué pago**: el total arriba, lo marcado abajo, el desglose de cada concepto y a
 * donde lleva pagar.
 *
 * Se monta el portal entero en `#/deudas` y se mira el hash de verdad. Todo se busca DENTRO de
 * `main`: la franja de pasos tiene su propio boton «Pagar».
 *
 * Que las cifras salen de `cuentas.ts` y no de una suma de la pantalla se prueba aparte, en
 * `Deudas.cuentas.test.tsx`, porque alli se sustituyen las cuentas del modulo entero.
 */

afterEach(limpiarElPortal);

const EN_DEUDAS: Partial<EstadoDelRecorrido> = { paso: 'deudas' };

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());

/** La banda azul del total: el bloque que empieza por «Deuda total al …». */
const banda = () => {
  const elemento = enMain().getByText(/^Deuda total al /).closest('[data-banda-del-total]');
  if (!(elemento instanceof HTMLElement)) throw new Error('No se encontro la banda del total');
  return elemento;
};

/** La fila de un concepto, por el nombre accesible de su casilla. */
const filaDe = (concepto: string, pagar = `Pagar ${concepto}`) => {
  const fila = enMain().getByRole('checkbox', { name: pagar }).closest('li');
  if (fila === null) throw new Error(`No se encontro la fila de «${concepto}»`);
  return fila;
};

/** La barra de pago: la que lleva el boton de pagar. */
const barraDePago = (boton: string) => {
  const barra = enMain().getByRole('button', { name: boton }).parentElement;
  if (barra === null) throw new Error('No se encontro la barra de pago');
  return barra;
};

describe('con los cuatro conceptos marcados', () => {
  it('el total, lo que queda con la amnistia y lo que se descuenta; la barra dice «Pagar todo»', () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    const total = within(banda());
    expect(total.getByText('S/ 3,563.24')).toBeInTheDocument();
    expect(total.getByText('Con la amnistía')).toBeInTheDocument();
    expect(total.getByText('S/ 3,149.92')).toBeInTheDocument();
    expect(total.getByText('se descuenta S/ 413.32 de interés')).toBeInTheDocument();
    expect(total.getByText('3 de 4 conceptos están vencidos. El interés corre cada día que pasa.')).toBeInTheDocument();

    const barra = within(barraDePago('Pagar todo'));
    expect(barra.getByText('Va a pagar los 4 conceptos')).toBeInTheDocument();
    expect(barra.getByText('S/ 3,563.24')).toBeInTheDocument();
    expect(barra.getByText('Con la amnistía paga S/ 3,149.92: se descuentan S/ 413.32 de interés')).toBeInTheDocument();
    expect(enMain().getByRole('button', { name: 'Pagar todo' })).toHaveAttribute('aria-disabled', 'false');
    expect(enMain().getByRole('button', { name: 'Quitar todo' })).toBeInTheDocument();
  });

  it('la banda dice la fecha de corte con año y «setiembre», nunca «septiembre»', () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    expect(enMain().getByText(/^Deuda total al /).textContent).toBe('Deuda total al 13 de setiembre de 2026');
    expect(principal().textContent).not.toMatch(/septiembre/i);
  });

  it('quien es, las cuatro cifras y cada concepto con su total, su recargo y su insignia', () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    expect(enMain().getByText('Contribuyente')).toBeInTheDocument();
    expect(enMain().getByText(CONTRIBUYENTE.nombre)).toBeInTheDocument();
    expect(enMain().getByText('Código 00000025673 · DNI 03593174 · 2 predios y 1 vehículo')).toBeInTheDocument();
    expect(enMain().getByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeInTheDocument();

    const cifras = within(principal().querySelector('[data-cifras]') as HTMLElement).getAllByRole('listitem');
    expect(cifras.map((c) => Array.from(c.children).map((hijo) => hijo.textContent))).toEqual([
      ['Impuesto y arbitrios', 'S/ 3,041.92', 'Lo que no se condona'],
      ['Interés moratorio', 'S/ 413.32', 'La amnistía lo condona entero'],
      ['Gastos y costas', 'S/ 108.00', 'Emisión y cobranza coactiva'],
      ['Conceptos', '4', 'Predial, arbitrios y vehicular'],
    ]);

    const esperado = [
      ['Impuesto predial 2026', 'S/ 293.72', null, 'Por vencer', 'bg-atencion-fondo', 'text-atencion-tinta'],
      ['Arbitrios municipales 2026', 'S/ 310.04', 'incluye S/ 18.44 de recargo', 'Vencida', 'bg-mal-fondo', 'text-mal-tinta'],
      ['Impuesto predial 2024', 'S/ 2,067.04', 'incluye S/ 224.44 de recargo', 'Vencida', 'bg-mal-fondo', 'text-mal-tinta'],
      ['Impuesto vehicular 2024', 'S/ 892.44', 'incluye S/ 278.44 de recargo', 'En coactiva', 'bg-mal-fondo', 'text-mal-tinta'],
    ] as const;
    for (const [concepto, total, recargo, estado, papel, tinta] of esperado) {
      const deuda = DEUDAS.find((d) => d.concepto === concepto);
      const fila = within(filaDe(concepto));
      expect(fila.getByRole('checkbox', { name: `Pagar ${concepto}` })).toBeChecked();
      expect(fila.getByText(`${deuda?.unidad ?? ''} · ${deuda?.cuotas ?? ''}`)).toBeInTheDocument();
      expect(fila.getByText(total)).toBeInTheDocument();
      if (recargo === null) expect(fila.queryByText(/de recargo$/)).toBeNull();
      else expect(fila.getByText(recargo).className).toContain('text-mal-tinta');
      // La insignia de `@kamayuk/ui`, con el tono del estado; y el vencimiento, en la tinta del tono.
      expect(fila.getByText(estado).className).toContain(papel);
      expect(fila.getByText(deuda?.vence ?? '').className).toContain(tinta);
      expect(fila.getByRole('button', { name: 'Ver el detalle' })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('la fila marcada lleva papel `sup` y el filo izquierdo `azul`; desmarcada, no', () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    const fila = filaDe('Impuesto vehicular 2024');
    expect(fila.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-sup', 'border-l-4', 'border-l-azul']));

    fireEvent.click(within(fila).getByRole('checkbox'));

    expect(within(fila).getByRole('checkbox')).not.toBeChecked();
    expect(fila.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-superficie', 'border-l-transparent']));
    expect(fila.className.split(/\s+/)).not.toContain('border-l-azul');
  });
});

describe('lo marcado', () => {
  it('desmarcar el vehicular: «Va a pagar 3 conceptos de 4», `S/ 2,670.80` y «Pagar lo marcado»', () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    fireEvent.click(enMain().getByRole('checkbox', { name: 'Pagar Impuesto vehicular 2024' }));

    const barra = within(barraDePago('Pagar lo marcado'));
    expect(barra.getByText('Va a pagar 3 conceptos de 4')).toBeInTheDocument();
    expect(barra.getByText('S/ 2,670.80')).toBeInTheDocument();
    expect(barra.getByText('Con la amnistía paga S/ 2,439.92: se descuentan S/ 230.88 de interés')).toBeInTheDocument();
    expect(enMain().queryByRole('button', { name: 'Pagar todo' })).toBeNull();
    expect(enMain().getByRole('button', { name: 'Marcar todo' })).toBeInTheDocument();
    // La banda es la deuda viva, no lo marcado: no se mueve.
    expect(within(banda()).getByText('S/ 3,563.24')).toBeInTheDocument();
  });

  it('uno solo: «Va a pagar 1 concepto de 4»; y sin interes marcado no se dice el ahorro', () => {
    montarElPortal({
      hash: '#/deudas',
      estado: { ...EN_DEUDAS, marcadas: { pred26: true, arb26: false, pred24: false, veh24: false } },
    });

    const barra = within(barraDePago('Pagar lo marcado'));
    expect(barra.getByText('Va a pagar 1 concepto de 4')).toBeInTheDocument();
    expect(barra.getByText('S/ 293.72')).toBeInTheDocument();
    expect(barra.queryByText(/^Con la amnistía paga/)).toBeNull();
  });

  it('con un solo concepto vivo y marcado: «Va a pagar 1 concepto», y la nota en singular', () => {
    montarElPortal({
      hash: '#/deudas',
      estado: { ...EN_DEUDAS, pagadas: { pred26: true, pred24: true, veh24: true } },
    });

    expect(within(barraDePago('Pagar todo')).getByText('Va a pagar 1 concepto')).toBeInTheDocument();
    expect(within(banda()).getByText('1 de 1 conceptos está vencido. El interés corre cada día que pasa.')).toBeInTheDocument();
    expect(enMain().getAllByRole('checkbox')).toHaveLength(1);
  });

  it('«Quitar todo»: nada marcado, el boton con `aria-disabled` avisa y no navega; «Marcar todo» lo restablece', async () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    fireEvent.click(enMain().getByRole('button', { name: 'Quitar todo' }));

    for (const casilla of enMain().getAllByRole('checkbox')) expect(casilla).not.toBeChecked();
    const pagar = enMain().getByRole('button', { name: 'Pagar lo marcado' });
    expect(within(barraDePago('Pagar lo marcado')).getByText('No ha marcado ningún concepto')).toBeInTheDocument();
    expect(within(barraDePago('Pagar lo marcado')).getByText('S/ 0.00')).toBeInTheDocument();
    expect(pagar).toHaveAttribute('aria-disabled', 'true');
    // Gris, y no el azul de pagar.
    expect(pagar.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-linea', 'text-tinta-2']));
    expect(pagar.className.split(/\s+/)).not.toContain('bg-azul');
    expect(
      enMain().getByText(
        'Marque al menos un concepto para continuar. Puede pagar todo de una vez o solo lo que le venza primero.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(pagar);

    expect(await screen.findByText('Marque al menos un concepto para poder pagar.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/deudas');

    fireEvent.click(enMain().getByRole('button', { name: 'Marcar todo' }));

    for (const casilla of enMain().getAllByRole('checkbox')) expect(casilla).toBeChecked();
    expect(within(barraDePago('Pagar todo')).getByText('Va a pagar los 4 conceptos')).toBeInTheDocument();
    expect(enMain().getByRole('button', { name: 'Pagar todo' })).toHaveAttribute('aria-disabled', 'false');
    expect(enMain().queryByText(/^Marque al menos un concepto para continuar/)).toBeNull();
  });
});

describe('el desglose de un concepto', () => {
  it('«Ver el detalle» del predial 2026: la tabla de 4 cuotas con sus insignias, y pasa a «Ocultar el detalle»', () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });
    const fila = within(filaDe('Impuesto predial 2026'));
    expect(fila.queryByRole('table')).toBeNull();

    fireEvent.click(fila.getByRole('button', { name: 'Ver el detalle' }));

    const ocultar = fila.getByRole('button', { name: 'Ocultar el detalle' });
    expect(ocultar).toHaveAttribute('aria-expanded', 'true');
    const tabla = fila.getByRole('table', { name: 'Cuotas del impuesto predial 2026' });
    // El boton dice que region abre, y esa region es la que lleva la tabla.
    expect(document.getElementById(ocultar.getAttribute('aria-controls') ?? '')).toContainElement(tabla);

    const [cabecera, ...filas] = within(tabla).getAllByRole('row');
    expect(within(cabecera as HTMLElement).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Cuota',
      'Vence',
      'Importe S/',
      'Situación',
    ]);
    expect(filas.map((f) => within(f).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['1 de 4', '28/02/2026', '147.98', 'Pagada'],
      ['2 de 4', '31/05/2026', '146.86', 'Pagada'],
      ['3 de 4', '30/09/2026', '146.86', 'Por vencer'],
      ['4 de 4', '30/11/2026', '146.86', 'Por vencer'],
    ]);
    // La situacion es `Insignia` con su tono; la columna de la cifra, `cifra`; la primera, `identifica`.
    expect(within(tabla).getAllByText('Pagada').map((s) => s.className)).toEqual([
      expect.stringContaining('bg-ok-fondo'),
      expect.stringContaining('bg-ok-fondo'),
    ]);
    expect(within(tabla).getAllByText('Por vencer').map((s) => s.className)).toEqual([
      expect.stringContaining('bg-atencion-fondo'),
      expect.stringContaining('bg-atencion-fondo'),
    ]);
    expect(within(tabla).getAllByRole('columnheader')[2]?.className).toContain('text-right');
    expect(within(filas[0] as HTMLElement).getAllByRole('cell')[2]?.className).toContain('tabular-nums');
    expect(within(filas[0] as HTMLElement).getAllByRole('cell')[0]?.className).toContain('whitespace-nowrap');
    // El ancho minimo del dato, y el desplazamiento dentro de su contenedor.
    expect(tabla.style.minWidth).toBe('580px');
    expect(tabla.parentElement?.className).toContain('overflow-x-auto');
    expect(
      fila.getByText(
        'El impuesto del año sale del autovalúo de todos sus predios: S/ 151,406.75 de base, con la escala progresiva. Se reparte en cuatro cuotas iguales.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(ocultar);

    expect(fila.getByRole('button', { name: 'Ver el detalle' })).toHaveAttribute('aria-expanded', 'false');
    expect(fila.queryByRole('table')).toBeNull();
  });

  it('abrir otro cierra el primero: solo hay un desglose abierto', () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    fireEvent.click(within(filaDe('Impuesto predial 2026')).getByRole('button', { name: 'Ver el detalle' }));
    fireEvent.click(within(filaDe('Arbitrios municipales 2026')).getByRole('button', { name: 'Ver el detalle' }));

    expect(enMain().getAllByRole('table')).toHaveLength(1);
    expect(enMain().getByRole('table', { name: 'Servicios que componen el arbitrio' })).toBeInTheDocument();
    // Sin columna de insignia, sin insignias en la tabla.
    expect(within(enMain().getByRole('table')).queryByText('Pagada')).toBeNull();
  });
});

describe('sin deuda viva', () => {
  it('con todo pagado sale «No le queda nada por pagar», y ni la lista, ni el total, ni la barra', async () => {
    montarElPortal({
      hash: '#/deudas',
      estado: { ...EN_DEUDAS, pagadas: { pred26: true, arb26: true, pred24: true, veh24: true } },
    });

    expect(enMain().getByRole('heading', { level: 1, name: 'No le queda nada por pagar' })).toBeInTheDocument();
    expect(
      enMain().getByText(
        'Pagó todos sus conceptos pendientes. Puede pedir su constancia de no adeudo, que acredita que está al día.',
      ),
    ).toBeInTheDocument();
    expect(enMain().queryByText('Lo que debe, por concepto')).toBeNull();
    expect(enMain().queryAllByRole('checkbox')).toEqual([]);
    expect(enMain().queryByText(/^Deuda total al /)).toBeNull();
    expect(enMain().queryByRole('button', { name: /^Pagar/ })).toBeNull();
    expect(enMain().queryByText(/^Marque al menos un concepto/)).toBeNull();
    // Quien es sigue: tambien sin deuda hay que saber de quien se habla.
    expect(enMain().getByText(CONTRIBUYENTE.nombre)).toBeInTheDocument();

    fireEvent.click(enMain().getByRole('button', { name: 'Pedir mi constancia de no adeudo' }));
    expect(await screen.findByText('Se emitiría su constancia de no adeudo al día de hoy.')).toBeInTheDocument();
  });
});

describe('a donde lleva', () => {
  it('«Pagar todo» sin sesion navega a `#/identificar`', async () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    fireEvent.click(enMain().getByRole('button', { name: 'Pagar todo' }));

    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
  });

  it('«Pagar todo» con sesion navega a `#/pagar`', async () => {
    montarElPortal({ hash: '#/deudas', estado: { ...EN_DEUDAS, autenticado: true } });

    fireEvent.click(enMain().getByRole('button', { name: 'Pagar todo' }));

    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
  });

  it('«No soy yo» vuelve a buscar', async () => {
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    fireEvent.click(enMain().getByRole('button', { name: 'No soy yo' }));

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
  });
});

describe('todo pasa por `t()`', () => {
  /**
   * Los textos que NO pasan por `t()` porque son dato: el nombre, los conceptos y su desglose, los
   * importes ya formateados y el numero de conceptos. Todo lo demas tiene que salir envuelto.
   */
  const DATOS = new Set<string>([
    CONTRIBUYENTE.nombre,
    ...DEUDAS.flatMap((d) => [
      d.concepto,
      `${d.unidad} · ${d.cuotas}`,
      d.estado,
      d.vence,
      d.detalle.titulo,
      d.detalle.nota,
      ...d.detalle.columnas.map((c) => c.rotulo),
      ...d.detalle.filas.flat(),
    ]),
    '4',
  ]);
  const esImporte = (texto: string) => /^S\/ [\d,]+\.\d{2}$/.test(texto);

  /** Cada nodo de texto de `main` que ni esta marcado ni es dato. */
  function escapados(raiz: HTMLElement): string[] {
    const salida: string[] = [];
    const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let nodo = recorrido.nextNode(); nodo !== null; nodo = recorrido.nextNode()) {
      const texto = (nodo.textContent ?? '').trim();
      if (texto === '' || DATOS.has(texto) || esImporte(texto)) continue;
      if (texto.startsWith(ABRE) && texto.endsWith(CIERRA)) continue;
      salida.push(texto);
    }
    return salida;
  }

  it('con el idioma marcado, ningun texto de la pantalla sale sin envolver, ni los nombres accesibles', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/deudas', estado: EN_DEUDAS });

    // Con un desglose abierto, para que su tabla tambien entre en el barrido.
    const predial = filaDe('Impuesto predial 2026', marcado('Pagar Impuesto predial 2026'));
    fireEvent.click(within(predial).getByRole('button', { name: marcado('Ver el detalle') }));
    expect(enMain().getByRole('table')).toBeInTheDocument();
    expect(escapados(principal())).toEqual([]);

    // Lo que no es un nodo de texto: el nombre accesible de cada casilla.
    expect(enMain().getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(
      DEUDAS.map((d) => marcado(`Pagar ${d.concepto}`)),
    );
    // Y los textos con hueco, enteros: la fecha y el importe dentro de la frase marcada.
    expect(enMain().getByText(marcado('Deuda total al 13 de setiembre de 2026'))).toBeInTheDocument();
    expect(
      enMain().getByText(marcado(`Código 00000025673 · DNI 03593174 · ${marcado('2 predios')} y ${marcado('1 vehículo')}`)),
    ).toBeInTheDocument();
    expect(enMain().getByText(marcado('Va a pagar los 4 conceptos'))).toBeInTheDocument();

    // Lo que solo sale sin nada marcado, y el aviso.
    fireEvent.click(enMain().getByRole('button', { name: marcado('Quitar todo') }));
    expect(escapados(principal())).toEqual([]);
    expect(enMain().getByText(marcado('No ha marcado ningún concepto'))).toBeInTheDocument();
    fireEvent.click(enMain().getByRole('button', { name: marcado('Pagar lo marcado') }));
    expect(await screen.findByText(marcado('Marque al menos un concepto para poder pagar.'))).toBeInTheDocument();
  });

  it('y sin deuda viva, lo mismo', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({
      hash: '#/deudas',
      estado: { ...EN_DEUDAS, pagadas: { pred26: true, arb26: true, pred24: true, veh24: true } },
    });

    expect(enMain().getByText(marcado('No le queda nada por pagar'))).toBeInTheDocument();
    expect(escapados(principal())).toEqual([]);
    fireEvent.click(enMain().getByRole('button', { name: marcado('Pedir mi constancia de no adeudo') }));
    expect(await screen.findByText(marcado('Se emitiría su constancia de no adeudo al día de hoy.'))).toBeInTheDocument();
  });
});
