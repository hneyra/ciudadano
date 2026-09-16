import type { Cliente } from '@kamayuk/api';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identidad } from '../../api/identidad.ts';
import type { SituacionDelContrato } from '../../datos/contrato.ts';
import { CONTRIBUYENTE, USUARIO } from '../../datos/demostracion.ts';
import { crearFuenteDeLaPlataforma } from '../../datos/fuenteDeLaPlataforma.ts';
import i18n, { IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from '../../pruebas/portal.tsx';

/**
 * **AC4 — pagar y el comprobante con plataforma quedan simulados, y se dice** (issue 28).
 *
 * El portal ya lee la deuda de verdad, pero **no hay endpoint de cobro**: la decision D-14 sigue
 * abierta. Las dos pantallas se recorren enteras y no envian nada a ningun sitio, asi que las dos
 * llevan un aviso permanente y el boton de confirmar lo repite.
 *
 * El recorrido se hace ENTERO desde el paso 2, con la deuda del servidor: es la unica forma de medir
 * que lo que se sella es lo que el servidor dijo y no lo del artboard.
 */

const EL_AVISO = 'El pago en línea todavía no está disponible: esta pantalla es una demostración.';

/**
 * **Las frases que afirman un hecho que con plataforma NO ocurrio** (revision del issue 28).
 *
 * Son textos del artboard, y alli describen la ficcion entera y se quedan tal cual. Con plataforma
 * cada una es una afirmacion falsa sobre la deuda de una persona: no hubo cobro, no se envio ningun
 * comprobante, no hay operacion que numerar y la deuda esta donde estaba. Un aviso al lado no
 * arregla una afirmacion falsa en el cuerpo: quien la lee se va creyendo que pago.
 *
 * Se buscan **por texto y no por clave**: lo que importa es lo que llega a la pantalla. Cada una se
 * comprueba en los dos sentidos —ausente con plataforma, presente en demostracion— para que quitarla
 * del portal de demostracion tambien salga rojo.
 */
const FRASES_QUE_AFIRMAN: readonly { readonly texto: string | RegExp; readonly donde: string }[] = [
  { texto: /Pagó S\/ [\d,.]+ con \w+\./, donde: 'la banda de exito del paso 5' },
  { texto: 'La deuda pagada ya se descontó de su cuenta.', donde: 'la banda de exito del paso 5' },
  { texto: /Le enviamos el comprobante a /, donde: 'la banda de exito del paso 5 y el aviso del 4' },
  { texto: 'Constancia de pago', donde: 'la cabecera del recibo' },
  { texto: 'Número de operación', donde: 'la meta del recibo' },
  { texto: 'Enviado a', donde: 'la meta del recibo' },
  { texto: 'Total pagado', donde: 'el pie de la tabla del recibo' },
  { texto: /Esta constancia acredita el pago/, donde: 'el cierre del recibo' },
  { texto: /El comprobante se enviará a /, donde: 'el resumen del paso 4' },
  { texto: 'Pago registrado. Le enviamos el comprobante a su correo.', donde: 'el aviso al confirmar' },
  { texto: 'Descargar comprobante', donde: 'las acciones del paso 5' },
  // Y las del selector de medios, que no son frases sino DATOS ACCIONABLES: un numero de telefono
  // al que alguien puede yapear de verdad, y un codigo de pago «valido por 72 horas».
  { texto: '969 032 194', donde: 'el numero para yapear del paso 4' },
  { texto: '2026-0025673-4418', donde: 'el codigo de pago del banco del paso 4' },
  { texto: /El pago se aplica al instante y el comprobante se emite de inmediato/, donde: 'el panel de la tarjeta' },
];

/** Lo que dice cada una en su sitio, con plataforma. */
const LA_REDACCION_NUEVA: readonly string[] = [
  'Todavía no se puede pagar en línea',
  'Aquí no se envía ningún comprobante: el portal todavía no cobra en línea.',
  'No se le pide ningún dato de pago, porque no hay ningún pago que hacer.',
  'Así se vería su comprobante',
  'Comprobante de ejemplo',
  'Total que se pagaría',
];

/** Un JWT de mentira: la firma la comprueba el backend, no el navegador (`src/api/claims.ts`). */
function tokenDeMentira(): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  const cuerpo = { name: 'Rufina Medina Medina', tipo_documento: 'DNI', numero_documento: '03593174' };
  return `${base64url('{"alg":"RS256"}')}.${base64url(JSON.stringify(cuerpo))}.firma-de-mentira`;
}

/** Una municipalidad con una obligacion: la rama «con deuda» del contrato. */
const CON_DEUDA: SituacionDelContrato = {
  tipoDocumento: 'DNI',
  numeroDocumento: '03593174',
  aLaFecha: '2026-09-16',
  municipalidadesRecorridas: 1,
  totalConsolidado: { importe: '1842.60', actualizadoA: '2026-09-16' },
  notaDelTotal: null,
  sinRegistros: false,
  municipalidades: [
    {
      ubigeo: '200104',
      nombre: 'Municipalidad Distrital de Catacaos',
      codigoContribuyente: '00000025673',
      nombreContribuyente: 'Rufina Medina Medina',
      activo: true,
      resumenDeSaldos: {
        insoluto: { importe: '1500.00', actualizadoA: '2026-09-16' },
        reajuste: { importe: '42.60', actualizadoA: '2026-09-16' },
        interes: { importe: '200.00', actualizadoA: '2026-09-16' },
        gasto: { importe: '100.00', actualizadoA: '2026-09-16' },
        total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        estadoDeLaConsulta: '1 obligacion con saldo al 16/09/2026',
      },
      obligaciones: [
        {
          tributo: 'PREDIAL',
          ejercicio: 2024,
          predioId: null,
          vehiculoId: null,
          insoluto: { importe: '1500.00', actualizadoA: '2026-09-16' },
          reajuste: { importe: '42.60', actualizadoA: '2026-09-16' },
          interes: { importe: '200.00', actualizadoA: '2026-09-16' },
          gasto: { importe: '100.00', actualizadoA: '2026-09-16' },
          total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        },
      ],
      predios: [],
    },
  ],
};

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());

/** Un cliente que contesta la situacion de arriba. */
function clienteCon(respuesta: SituacionDelContrato): Cliente {
  return {
    solicitar: vi.fn(() => Promise.resolve(respuesta)),
    solicitarRespuesta: vi.fn(),
    descargar: vi.fn(),
    subir: vi.fn(),
  } as unknown as Cliente;
}

/** Monta el portal con plataforma y sesion en el paso 2, con la deuda del servidor ya leida. */
async function enElPaso2(): Promise<void> {
  identidad.fijarToken(tokenDeMentira());
  montarElPortal({ hash: '#/deudas', fuente: crearFuenteDeLaPlataforma(clienteCon(CON_DEUDA)) });
  await enMain().findByRole('heading', { level: 1, name: /Lo que debe, por concepto|⟦Lo que debe/ });
}

/** Del paso 2 al 4, pulsando lo que pulsaria una persona. */
async function hastaPagar(): Promise<void> {
  await enElPaso2();
  // El rotulo pasa por `t()`, y en el idioma de marcado sale envuelto: se busca por las dos formas.
  fireEvent.click(enMain().getByRole('button', { name: /^(⟦)?Pagar todo(⟧)?$/ }));
  await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
}

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

describe('AC4 — el paso 4, «Pagar»', () => {
  it('lleva el aviso de pago simulado, y el boton de confirmar lo repite', async () => {
    await hastaPagar();

    expect(enMain().getByText(EL_AVISO)).toBeInTheDocument();
    expect(enMain().getByText(/no se cobra nada y su deuda no cambia/)).toBeInTheDocument();
    // El boton de confirmar, que es lo ultimo que se lee antes de pulsar.
    expect(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' })).toBeInTheDocument();
    // Y el texto del medio, que promete un cobro, ya no esta.
    expect(enMain().queryByRole('button', { name: 'Pagar ahora' })).toBeNull();
  });

  it('no ofrece ningun medio de pago: no hay ninguno que ofrecer', async () => {
    await hastaPagar();

    expect(enMain().getByRole('heading', { level: 1, name: 'Todavía no se puede pagar en línea' })).toBeInTheDocument();
    // Ni el selector, ni los campos de la tarjeta, ni los bancos.
    expect(principal().querySelector('[data-medios]')).toBeNull();
    expect(principal().querySelector('[data-codigo]')).toBeNull();
    expect(principal().querySelector('[data-bancos]')).toBeNull();
    expect(enMain().queryByRole('button', { pressed: false })).toBeNull();
    for (const medio of ['Tarjeta', 'Yape o Plin', 'pagalo.pe', 'Banco o agente']) {
      expect(enMain().queryByRole('button', { name: medio }), medio).toBeNull();
    }
  });

  it('el resumen cobra lo del SERVIDOR, y no dibuja cuotas que el contrato no trae', async () => {
    await hastaPagar();

    const resumen = principal().querySelector('[data-resumen]');
    expect(resumen).not.toBeNull();
    expect(within(resumen as HTMLElement).getByText('Impuesto predial 2024')).toBeInTheDocument();
    // 1500 + 42.60 + 100 = 1642.60: todo menos el interes, que la amnistia condona.
    expect(within(resumen as HTMLElement).getByText('S/ 1,642.60')).toBeInTheDocument();
    // Nada del artboard: ni sus conceptos ni sus cuotas.
    expect(principal().textContent).not.toMatch(/Cuota \d de \d/);
    expect(enMain().queryByText('Impuesto predial 2026')).toBeNull();
  });

  it('en demostracion el paso 4 NO cambia: ni aviso, ni boton renombrado', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', numero: '03593174' } });

    await enMain().findByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' });
    expect(enMain().queryByText(EL_AVISO)).toBeNull();
    expect(enMain().getByRole('button', { name: 'Pagar ahora' })).toBeInTheDocument();
  });
});

describe('AC4 — el paso 5, «Comprobante»', () => {
  it('lleva el mismo aviso, y el recibo es el de la deuda del servidor', async () => {
    await hastaPagar();

    fireEvent.click(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));

    expect(enMain().getByText(EL_AVISO)).toBeInTheDocument();
    // El recibo dice lo que el servidor dijo: su concepto, su contribuyente y su codigo de padron.
    expect(enMain().getByText('Impuesto predial 2024')).toBeInTheDocument();
    expect(enMain().getByText('Rufina Medina Medina')).toBeInTheDocument();
    expect(enMain().getByText('00000025673')).toBeInTheDocument();
    // Y NUNCA la persona del artboard, que es otra.
    expect(enMain().queryByText(CONTRIBUYENTE.nombre)).toBeNull();
    expect(principal().textContent).not.toContain(USUARIO.correo);
  });

  it('en demostracion el paso 5 NO cambia: sin aviso, y con el contribuyente del artboard', async () => {
    montarElPortal({
      hash: '#/comprobante',
      estado: {
        paso: 'comprobante',
        numero: '03593174',
        pagadas: { pred26: true },
        recienPagado: true,
        ultimo: {
          ids: ['pred26'],
          insoluto: '293.72',
          reajuste: '0.00',
          interes: '0.00',
          gastos: '0.00',
          total: '293.72',
          conAmnistia: '293.72',
          medio: 'tarjeta',
          destino: 'maria@correo.com',
          comprobante: { numero: '0003-0041418', operacion: '882134', fecha: '2026-09-13', hora: '14:22' },
        },
      },
    });

    await enMain().findByRole('heading', { level: 1, name: 'Su pago se registró' });
    expect(enMain().queryByText(EL_AVISO)).toBeNull();
    expect(enMain().getByText(CONTRIBUYENTE.nombre)).toBeInTheDocument();
    expect(enMain().getByText(CONTRIBUYENTE.codigo)).toBeInTheDocument();
  });
});

describe('el aviso pasa por `t()`', () => {
  it('sale envuelto en el idioma marcado, en los dos pasos', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    await hastaPagar();

    expect(enMain().getByText(marcado(EL_AVISO))).toBeInTheDocument();

    fireEvent.click(enMain().getByRole('button', { name: marcado('Simular el pago: no se cobra nada') }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    expect(enMain().getByText(marcado(EL_AVISO))).toBeInTheDocument();
  });
});

describe('REVISION — ninguna frase afirma un hecho que no ocurrio', () => {
  it('con plataforma, ninguna de ellas llega a la pantalla, ni en el paso 4 ni en el 5', async () => {
    await hastaPagar();
    const enElPaso4 = principal().textContent ?? '';
    fireEvent.click(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    const enElPaso5 = principal().textContent ?? '';

    const dichas = FRASES_QUE_AFIRMAN.filter(({ texto }) =>
      typeof texto === 'string'
        ? enElPaso4.includes(texto) || enElPaso5.includes(texto)
        : texto.test(enElPaso4) || texto.test(enElPaso5),
    ).map(({ texto, donde }) => `  «${String(texto)}» (${donde})`);

    expect(
      dichas,
      'El portal con plataforma le esta afirmando a una persona hechos que no ocurrieron:\n' +
        `${dichas.join('\n')}\n\n` +
        '  No hubo cobro, no se envio ningun comprobante y su deuda esta donde estaba. Un aviso al\n' +
        '  lado no arregla una afirmacion falsa en el cuerpo.',
    ).toEqual([]);
  });

  it('y si aparece la redaccion nueva, que dice lo que si pasa', async () => {
    await hastaPagar();
    expect(enMain().getByRole('heading', { level: 1, name: 'Todavía no se puede pagar en línea' })).toBeInTheDocument();
    expect(enMain().getByText('Aquí no se envía ningún comprobante: el portal todavía no cobra en línea.')).toBeInTheDocument();
    expect(enMain().getByText('No se le pide ningún dato de pago, porque no hay ningún pago que hacer.')).toBeInTheDocument();

    fireEvent.click(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));

    expect(enMain().getByRole('heading', { level: 1, name: 'Así se vería su comprobante' })).toBeInTheDocument();
    expect(
      enMain().getByText(
        'Esto es lo que habría pagado: S/ 1,642.60. No se cobró nada, no se envió ningún comprobante y su deuda no ha cambiado.',
      ),
    ).toBeInTheDocument();
    expect(enMain().getByRole('heading', { level: 2, name: 'Comprobante de ejemplo' })).toBeInTheDocument();
    expect(enMain().getByText('Total que se pagaría')).toBeInTheDocument();
    expect(enMain().getByText(/Este comprobante es una vista de ejemplo y no acredita ningún pago/)).toBeInTheDocument();
    // Y el aviso se IMPRIME: sin `data-noprint`, lo que salga en papel lleva escrito que es una
    // demostracion. Lo contrario seria un recibo de aspecto oficial de un pago que no existio.
    const aviso = enMain().getByText(EL_AVISO).closest('[data-tono]');
    expect(aviso).not.toBeNull();
    expect(aviso).not.toHaveAttribute('data-noprint');
  });

  it('EL OTRO SENTIDO: en demostracion las frases del artboard siguen ahi, tal cual', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', numero: '03593174' } });
    await enMain().findByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' });

    // Se recorre el paso 4 ENTERO —los cuatro medios— y luego se paga: el numero para yapear y el
    // codigo del banco solo salen con su medio elegido, y el aviso al confirmar es un `toast`, que
    // vive fuera de `main`. Se acumula `document.body`, que es donde se lee todo eso.
    let dicho = document.body.textContent ?? '';
    for (const medio of ['Yape o Plin', 'pagalo.pe', 'Banco o agente', 'Tarjeta']) {
      // Por el nombre exacto: «Tarjeta» tambien esta dentro del panel del medio elegido.
      fireEvent.click(enMain().getByRole('button', { name: new RegExp(`^${medio}$`) }));
      dicho += document.body.textContent ?? '';
    }

    fireEvent.click(enMain().getByRole('button', { name: 'Pagar ahora' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    await screen.findByText('Pago registrado. Le enviamos el comprobante a su correo.');
    const enElPaso4 = dicho;
    const enElPaso5 = document.body.textContent ?? '';

    const faltan = FRASES_QUE_AFIRMAN.filter(({ texto }) =>
      typeof texto === 'string'
        ? !enElPaso4.includes(texto) && !enElPaso5.includes(texto)
        : !texto.test(enElPaso4) && !texto.test(enElPaso5),
    ).map(({ texto, donde }) => `  «${String(texto)}» (${donde})`);

    expect(
      faltan,
      'Estas frases del artboard desaparecieron del portal de DEMOSTRACION:\n' +
        `${faltan.join('\n')}\n\n` +
        '  Alli describen la ficcion entera y son definitivas. Lo que el issue 28 cambia es lo que\n' +
        '  se dice CON PLATAFORMA, y esta prueba es la que impide que el arreglo se lleve las dos.',
    ).toEqual([]);
    // Y ninguna de las nuevas se coló en el portal de demostracion.
    for (const nueva of LA_REDACCION_NUEVA) {
      expect(enElPaso4 + enElPaso5, nueva).not.toContain(nueva);
    }
  });
});
