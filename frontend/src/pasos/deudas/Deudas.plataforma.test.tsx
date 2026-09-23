import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ErrorDeLaApi, type Cliente } from '@kamayuk/api';
import { peldanoDe } from '@kamayuk/sesion';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEXTOS_DEL_PORTAL } from '../../api/escalera.ts';
import { identidad } from '../../api/identidad.ts';
import type { SituacionDelContrato } from '../../datos/contrato.ts';
import { crearFuenteDeLaPlataforma } from '../../datos/fuenteDeLaPlataforma.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';

/**
 * **El paso 2 con plataforma: la deuda que cuenta el servidor** (issues 27 y 28).
 *
 * En el PASO 2, que es donde la consulta vive desde el issue 28: con plataforma el paso 1 es
 * «Entrar», y aqui se llega con la sesion abierta. El token se pone con `identidad.fijarToken`, que
 * es lo que hace `autenticado` en el arranque de verdad.
 *
 * Se monta el portal ENTERO con la fuente de la plataforma construida sobre un **cliente falso**: la
 * peticion no sale a ningun sitio, pero pasa por `crearFuenteDeLaPlataforma`, o sea por la ruta de
 * verdad y por el adaptador de verdad. Un doble de la fuente probaria el doble; este arnes prueba la
 * cadena `pantalla → gancho → fuente → cliente`, que es donde caben los defectos.
 *
 * <h2>La regla que se mide en todas: ninguna cifra inventada</h2>
 *
 * En los tres estados que no son «con deuda» se comprueba que **no hay ni un importe en pantalla**.
 * Es el defecto que este issue viene a impedir: un «S/ 0.00» donde la consulta no se pudo completar
 * es una cifra plausible y equivocada, y quien la lea se ira a la ventanilla creyendo que no debe
 * nada. Y en «con deuda» se mide lo contrario: que **cada importe lleva su fecha** y que lo que el
 * contrato no trae —cuotas, vencimiento, estado, desglose— no se dibuja.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** La respuesta REAL de la plataforma local, leida del disco. Ver `diseno/medidas/README.md`. */
const MEDIDA = JSON.parse(
  readFileSync(join(AQUI, '../../../diseno/medidas/situacion-2026-09-16.json'), 'utf8'),
) as SituacionDelContrato;

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

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());

/**
 * Las insignias dibujadas, por la firma de clases de `Insignia` de `@kamayuk/ui`.
 *
 * **Por las clases y no por un `data-slot`**: `Insignia` no lleva ninguno (medido: la version que
 * preguntaba `[data-slot="insignia"]` contaba cero SIEMPRE, tambien con una insignia puesta a mano
 * en la pantalla — una guarda que no puede ponerse roja).
 */
function insignias(): readonly Element[] {
  return [...principal().querySelectorAll('span')].filter(
    (span) => span.className.includes('rounded-full') && span.className.includes('text-[11.5px]'),
  );
}

/** Un cliente que contesta lo que se le diga y apunta cada ruta que le pidieron. */
function clienteFalso(contesta: () => Promise<unknown>) {
  const rutas: string[] = [];
  const cliente = {
    solicitar: vi.fn((ruta: string) => {
      rutas.push(ruta);
      return contesta();
    }),
    solicitarRespuesta: vi.fn(),
    descargar: vi.fn(),
    subir: vi.fn(),
  } as unknown as Cliente;
  return { cliente, rutas };
}

/** Monta el portal con plataforma y sesion, en el paso 2, y devuelve lo que se le pidio al cliente. */
function conSesion(contesta: () => Promise<unknown>) {
  identidad.fijarToken(tokenDeMentira());
  const { cliente, rutas } = clienteFalso(contesta);
  montarElPortal({ hash: '#/deudas', fuente: crearFuenteDeLaPlataforma(cliente) });
  return { rutas };
}

/** Los importes que se ven en `main`. Vacio es lo que casi todas estas pruebas exigen. */
function importesEnPantalla(): string[] {
  return (principal().textContent ?? '').match(/S\/\s?[\d,]+\.\d{2}/g) ?? [];
}

/** Una respuesta del contrato con las ramas que la plataforma local todavia no produce. */
function respuesta(cambios: Partial<SituacionDelContrato>): SituacionDelContrato {
  return {
    tipoDocumento: 'DNI',
    numeroDocumento: '03593174',
    aLaFecha: '2026-09-16',
    municipalidadesRecorridas: 1,
    totalConsolidado: { importe: '0.00', actualizadoA: '2026-09-16' },
    notaDelTotal: null,
    sinRegistros: false,
    municipalidades: [],
    ...cambios,
  };
}

/** Una municipalidad del contrato con una obligacion, para la rama «con deuda». */
const CON_UNA_OBLIGACION: SituacionDelContrato = respuesta({
  totalConsolidado: { importe: '1842.60', actualizadoA: '2026-09-16' },
  municipalidades: [
    {
      ubigeo: '200104',
      nombre: 'Municipalidad Distrital de Catacaos',
      codigoContribuyente: '00000025673',
      nombreContribuyente: 'Suc. Rufina Medina Medina',
      activo: true,
      resumenDeSaldos: {
        insoluto: { importe: '1842.60', actualizadoA: '2026-09-16' },
        reajuste: { importe: '0.00', actualizadoA: '2026-09-16' },
        interes: { importe: '0.00', actualizadoA: '2026-09-16' },
        gasto: { importe: '0.00', actualizadoA: '2026-09-16' },
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
          reajuste: { importe: '42.60', actualizadoA: '2026-09-15' },
          interes: { importe: '200.00', actualizadoA: '2026-09-14' },
          gasto: { importe: '100.00', actualizadoA: '2026-09-13' },
          total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        },
      ],
      predios: [],
    },
  ],
});

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('mientras la consulta viaja', () => {
  it('dice «Consultando su deuda…», sin una sola cifra', async () => {
    conSesion(() => new Promise(() => {}));

    expect(await enMain().findByRole('heading', { level: 1, name: 'Consultando su deuda…' })).toBeInTheDocument();
    expect(importesEnPantalla()).toEqual([]);
  });
});

describe('AC5 — la respuesta MEDIDA de la plataforma local (no se pudo consultar)', () => {
  it('ensena LA NOTA DEL SERVIDOR tal cual, ningun importe, y ofrece reintentar', async () => {
    const { rutas } = conSesion(() => Promise.resolve(MEDIDA));

    expect(await enMain().findByRole('heading', { level: 1, name: 'No pudimos consultar toda su deuda' })).toBeInTheDocument();
    // La frase la redacta el servidor: es el unico que sabe cual municipalidad no se pudo leer.
    expect(enMain().getByText(MEDIDA.notaDelTotal ?? '(la medida no trae nota)')).toBeInTheDocument();
    expect(
      importesEnPantalla(),
      'Un total donde falto una municipalidad es una cifra plausible y equivocada.',
    ).toEqual([]);
    // Y lo que NO se dice: que no figura en ningun padron. La medida trae `sinRegistros: true` y aun
    // asi eso no se afirma, porque no se pudo comprobar (`deLaSituacion.ts`).
    expect(enMain().queryByText(/No encontramos deuda a su nombre/)).toBeNull();
    expect(rutas).toEqual(['/portal/situacion']);

    // Reintentar es un `refetch`, no un reintento automatico: la decision es de quien lee.
    fireEvent.click(enMain().getByRole('button', { name: 'Reintentar la consulta' }));
    await waitFor(() => expect(rutas).toEqual(['/portal/situacion', '/portal/situacion']));
  });

  it('y sola se pide UNA vez: `retry: false`, porque insistir trae el mismo fallo', async () => {
    const { rutas } = conSesion(() => Promise.resolve(MEDIDA));

    await enMain().findByRole('heading', { level: 1, name: 'No pudimos consultar toda su deuda' });
    await waitFor(() => expect(rutas).toHaveLength(1));
    expect(rutas).toEqual(['/portal/situacion']);
  });
});

describe('las otras dos ramas sin deuda', () => {
  it('sin registros: «No encontramos deuda a su nombre», con el documento consultado y sin cifras', async () => {
    conSesion(() => Promise.resolve(respuesta({ sinRegistros: true })));

    expect(await enMain().findByRole('heading', { level: 1, name: 'No encontramos deuda a su nombre' })).toBeInTheDocument();
    expect(
      enMain().getByText(/Con DNI 03593174 no figura ninguna deuda en las municipalidades del sistema\./),
    ).toBeInTheDocument();
    expect(enMain().getByText(/Si cree que es un error/)).toBeInTheDocument();
    expect(importesEnPantalla()).toEqual([]);
  });

  it('sin deuda: «No le queda nada por pagar», y ni «Pagó» ni constancia (issue 49)', async () => {
    conSesion(() => Promise.resolve(respuesta({})));

    expect(await enMain().findByRole('heading', { level: 1, name: 'No le queda nada por pagar' })).toBeInTheDocument();
    expect(
      enMain().getByText('Según la consulta de hoy, no tiene deuda pendiente en las municipalidades del sistema.'),
    ).toBeInTheDocument();
    // El servidor dice que no hay saldo, no que se pagara; y el portal no emite constancias.
    expect(principal().textContent).not.toMatch(/Pagó|constancia/i);
    expect(enMain().queryByRole('button', { name: /constancia/i })).toBeNull();
  });
});

describe('AC2 — con deuda: los conceptos y sus importes salen de la SITUACION', () => {
  it('el contribuyente, el total del servidor y el concepto, con la fecha de cada importe', async () => {
    conSesion(() => Promise.resolve(CON_UNA_OBLIGACION));

    expect(await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeInTheDocument();
    // Quien es: el nombre y el codigo de padron que dijo el servidor, no los del artboard.
    expect(enMain().getByText('Suc. Rufina Medina Medina')).toBeInTheDocument();
    expect(enMain().getByText('Código 00000025673 · DNI 03593174')).toBeInTheDocument();
    expect(enMain().queryByText('Rufina Medina Medina', { exact: true })).toBeNull();
    // El total es el del servidor, tal cual, con la frase que el servidor redacto.
    expect(enMain().getByText(/1 obligacion con saldo al 16\/09\/2026/)).toBeInTheDocument();
    // El concepto viene del adaptador: tributo en castellano + ejercicio.
    expect(enMain().getByText('Impuesto predial 2024')).toBeInTheDocument();
    // Y su total lo suma `cuentas.ts` sobre los cuatro componentes: 1500 + 42.60 + 200 + 100. Las
    // tres cifras de la pantalla son: el total del servidor, el total del concepto y lo elegido.
    // **Ninguna «con amnistia»** (issue 49): el contrato no trae ninguna, y hasta el issue 49 la barra
    // decia «Con la amnistía paga S/ 1,642.60: se descuentan S/ 200.00 de interés».
    expect(importesEnPantalla()).toEqual(['S/ 1,842.60', 'S/ 1,842.60', 'S/ 1,842.60']);
    expect(principal().textContent).not.toMatch(/amnist[ií]a/i);

    // Cada importe con SU fecha: la del total del servidor y la del concepto.
    expect(enMain().getAllByText('al 16/09/2026').length).toBeGreaterThanOrEqual(2);
  });

  it('el desglose ensena los CUATRO componentes, cada uno con la fecha que el servidor le puso', async () => {
    conSesion(() => Promise.resolve(CON_UNA_OBLIGACION));

    fireEvent.click(await enMain().findByRole('button', { name: 'Ver el detalle' }));

    expect(enMain().getByText('S/ 1,500.00')).toBeInTheDocument();
    expect(enMain().getByText('S/ 42.60')).toBeInTheDocument();
    expect(enMain().getByText('S/ 200.00')).toBeInTheDocument();
    expect(enMain().getByText('S/ 100.00')).toBeInTheDocument();
    // Las cuatro fechas son las del contrato, y no una fecha de corte comun inventada por la pantalla.
    expect(enMain().getByText('al 15/09/2026')).toBeInTheDocument();
    expect(enMain().getByText('al 14/09/2026')).toBeInTheDocument();
    expect(enMain().getByText('al 13/09/2026')).toBeInTheDocument();
  });
});

describe('AC3 — lo que el contrato no da, no se dibuja', () => {
  it('el detalle dice la ausencia, y no hay insignia de estado ni vencimiento inventado', async () => {
    conSesion(() => Promise.resolve(CON_UNA_OBLIGACION));

    // Ni una insignia: `Insignia` de `@kamayuk/ui` es lo que pintaria «Vencida» o «Por vencer», y el
    // contrato no dice el estado de nada (issue 26).
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
    expect(insignias()).toEqual([]);
    expect(principal().textContent).not.toMatch(/Vencida|Por vencer|En coactiva|Vence /);

    fireEvent.click(enMain().getByRole('button', { name: 'Ver el detalle' }));

    expect(enMain().getByText('El portal no publica el desglose de este concepto.')).toBeInTheDocument();
    expect(enMain().getByText(/cuántas cuotas son, cuándo vence cada una/)).toBeInTheDocument();
    // Y sigue sin haber insignia con el detalle abierto: la tabla del artboard pinta una por cuota.
    expect(insignias()).toEqual([]);
  });
});

describe('cuando la peticion falla', () => {
  it('un 401 dice lo del ciudadano y ofrece ENTRAR, que va a la puerta de verdad', async () => {
    const ida = vi.spyOn(identidad, 'entrar').mockResolvedValue(null);
    conSesion(() => Promise.reject(new ErrorDeLaApi(401, 'GET /portal/situacion', { codigo: 'NO_AUTENTICADO' })));

    expect(await enMain().findByRole('heading', { level: 1, name: 'Su sesión ya no está abierta' })).toBeInTheDocument();
    expect(enMain().getByText('Vuelva a entrar con su cuenta del portal y podrá seguir donde estaba.')).toBeInTheDocument();
    // Volver a pedir traeria el mismo 401: lo que se ofrece es entrar, no reintentar.
    expect(enMain().queryByRole('button', { name: 'Reintentar la consulta' })).toBeNull();

    fireEvent.click(enMain().getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(ida).toHaveBeenCalledTimes(1));
  });

  it('un 403 SIN_DOCUMENTO usa el texto PROPIO del portal, y no ofrece volver a la puerta', async () => {
    conSesion(() => Promise.reject(new ErrorDeLaApi(403, 'GET /portal/situacion', { codigo: 'SIN_DOCUMENTO' })));

    expect(
      await enMain().findByRole('heading', { level: 1, name: 'Su cuenta no dice con qué documento consultar' }),
    ).toBeInTheDocument();
    expect(enMain().getByText(/Acérquese con su DNI o su carné de extranjería a la ventanilla/)).toBeInTheDocument();
    // Lo que el texto de la libreria diria, y que a quien paga su predial no le sirve de nada.
    expect(principal().textContent).not.toMatch(/soporte|administrador|perfiles/i);
    // Volver a entrar traeria el mismo token y el mismo 403: no se ofrece.
    expect(enMain().queryByRole('button', { name: 'Entrar' })).toBeNull();
    expect(importesEnPantalla()).toEqual([]);
  });

  it('y un corte de red es la unica averia de verdad', async () => {
    conSesion(() => Promise.reject(new TypeError('Failed to fetch')));

    expect(await enMain().findByRole('heading', { level: 1, name: 'El portal no está respondiendo' })).toBeInTheDocument();
    expect(importesEnPantalla()).toEqual([]);
  });

  /**
   * Los dos estados de fallo que trae el issue 33, en la pantalla de verdad.
   *
   * El titulo esperado se PIDE a la escalera en vez de escribirse: mientras kamayuk-lib#96 siga
   * abierto, la libreria enlazada manda el 409 a `averia` y el 422 `ORDEN_NO_ADMITIDO` a
   * `no-valido`, y escribir aqui «Eso ya no se puede hacer ahora» seria afirmar un final que hoy no
   * ocurre. Lo que se mide es lo que no cambia con el pareado: que sale **un texto de la tabla del
   * portal** —ni el de la libreria, ni `undefined`— y que no hay ni una cifra.
   */
  it.each([
    [409, 'CONFLICTO'],
    [422, 'ORDEN_NO_ADMITIDO'],
  ])('un %s %s sale con un texto del portal y sin una sola cifra', async (estado, codigo) => {
    const fallo = () => new ErrorDeLaApi(estado, 'GET /portal/situacion', { codigo });
    const textos = TEXTOS_DEL_PORTAL[peldanoDe(fallo()).clave];
    conSesion(() => Promise.reject(fallo()));

    expect(await enMain().findByRole('heading', { level: 1, name: textos.titulo })).toBeInTheDocument();
    expect(enMain().getByText(textos.remedio)).toBeInTheDocument();
    // Lo que diria la libreria, que a quien entra a pagar su predial no le sirve de nada.
    expect(principal().textContent).not.toMatch(/soporte|administrador|perfiles/i);
    expect(
      importesEnPantalla(),
      'Un importe en un estado de fallo es una cifra plausible y equivocada.',
    ).toEqual([]);
  });
});

/**
 * **AC4 del issue 34 — una respuesta que no tiene la forma del contrato.**
 *
 * La cadena entera: el cliente falso contesta un 200 con algo roto, la fuente lo pasa por la
 * frontera, la frontera lanza `RespuestaQueNoEntiendo` y la pantalla dibuja SU peldano. Los textos
 * se escriben aqui, y no se piden a la escalera: este peldano lo decide el portal, sin pareado con
 * ninguna libreria, y lo que se mide es lo que el ciudadano lee.
 */
describe('cuando la respuesta no tiene la forma del contrato (issue 34)', () => {
  /** La obligacion con su `insoluto` como NUMERO, que es la rotura que mas se parece a un dato. */
  function conImporteNumero(): unknown {
    const rota = structuredClone(CON_UNA_OBLIGACION) as unknown as {
      municipalidades: { obligaciones: { insoluto: { importe: unknown } }[] }[];
    };
    rota.municipalidades[0]!.obligaciones[0]!.insoluto.importe = 1500;
    return rota;
  }

  it.each<[string, () => unknown]>([
    ['un `importe` que llega como numero', conImporteNumero],
    ['`municipalidades` que no es una lista', () => ({ ...CON_UNA_OBLIGACION, municipalidades: {} })],
    ['una respuesta sin `aLaFecha`', () => ({ ...CON_UNA_OBLIGACION, aLaFecha: undefined })],
  ])('%s: su titulo y su remedio, y NI UN importe', async (_caso, respuestaRota) => {
    conSesion(() => Promise.resolve(respuestaRota()));

    expect(
      await enMain().findByRole('heading', { level: 1, name: 'No pudimos leer lo que nos contestó el sistema' }),
    ).toBeInTheDocument();
    expect(enMain().getByText(/acérquese con su documento a la ventanilla de la municipalidad: allí le consultan su deuda/)).toBeInTheDocument();
    expect(enMain().getByText(/Por eso no le mostramos ninguna cifra/)).toBeInTheDocument();
    // Ni `S/`, ni una cifra con decimales, ni un cero de consuelo: el total del servidor venia
    // BIEN en la respuesta rota, y aun asi no se ensena, porque lo que lo rodea no se pudo leer.
    expect(importesEnPantalla(), 'Una respuesta ilegible no puede dejar ni una cifra en pantalla.').toEqual([]);
    expect(principal().textContent).not.toMatch(/S\/|\d+[.,]\d{2}\b/);
    // Lo que encontro el esquema es para quien depura: ni rutas del JSON ni «expected».
    expect(principal().textContent).not.toMatch(/municipalidades\.|obligaciones|expected|Invalid/);
    // Y no es un corte de red: decir «el portal no esta respondiendo» seria falso.
    expect(enMain().queryByRole('heading', { name: 'El portal no está respondiendo' })).toBeNull();
    // Volver a entrar traeria el mismo token y la misma respuesta: lo que se ofrece es reintentar.
    expect(enMain().queryByRole('button', { name: 'Entrar' })).toBeNull();
    expect(enMain().getByRole('button', { name: 'Reintentar la consulta' })).toBeInTheDocument();
  });
});

describe('todo lo que se lee pasa por `t()`', () => {
  /** Cada nodo de texto de `main` que no esta marcado. El dato del servidor se pasa aparte. */
  function escapados(datos: ReadonlySet<string>): string[] {
    const salida: string[] = [];
    const recorrido = document.createTreeWalker(principal(), NodeFilter.SHOW_TEXT);
    for (let nodo = recorrido.nextNode(); nodo !== null; nodo = recorrido.nextNode()) {
      const texto = (nodo.textContent ?? '').trim();
      if (texto === '' || datos.has(texto)) continue;
      if (texto.startsWith(ABRE) && texto.endsWith(CIERRA)) continue;
      salida.push(texto);
    }
    return salida;
  }

  it('en el idioma `marcado`, la rama medida sale envuelta salvo la nota del servidor', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    conSesion(() => Promise.resolve(MEDIDA));

    await enMain().findByRole('heading', { level: 1, name: marcado('No pudimos consultar toda su deuda') });
    // La nota es DATO: la escribio el servidor y se ensena tal cual. Pasarla por `t()` la buscaria en
    // un inventario donde no esta, y saldria igual — por accidente.
    expect(escapados(new Set([MEDIDA.notaDelTotal ?? '']))).toEqual([]);
  });

  it('y la lista de conceptos tambien: lo unico sin marcar es lo que dijo el servidor', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    conSesion(() => Promise.resolve(CON_UNA_OBLIGACION));

    await enMain().findByRole('heading', { level: 1, name: marcado('Lo que debe, por concepto') });
    const delServidor = new Set([
      'Suc. Rufina Medina Medina',
      'Impuesto predial 2024',
      'Municipalidad Distrital de Catacaos · 1 obligacion con saldo al 16/09/2026',
      'Municipalidad Distrital de Catacaos',
      '· 1 obligacion con saldo al 16/09/2026',
      'S/ 1,842.60',
    ]);
    expect(escapados(delServidor)).toEqual([]);
  });
});
