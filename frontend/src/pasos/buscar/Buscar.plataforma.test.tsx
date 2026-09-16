import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ErrorDeLaApi, type Cliente } from '@kamayuk/api';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identidad } from '../../api/identidad.ts';
import type { SituacionDelContrato } from '../../datos/contrato.ts';
import { crearFuenteDeLaPlataforma } from '../../datos/fuenteDeLaPlataforma.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from '../../pruebas/portal.tsx';
import type { EstadoDelRecorrido } from '../../recorrido/recorrido.ts';

/**
 * **Los cinco estados de la consulta, en la pantalla** (issue 27).
 *
 * En el PASO 1, que es donde la pieza se monta con plataforma: no hay que buscar para consultar —el
 * sujeto sale del token—, asi que la consulta sale en cuanto la pagina abre. Debajo sigue estando el
 * formulario de siempre; que el recorrido de la demostracion no se mueve lo comprueba la ultima
 * prueba de este archivo, y el arnes contra el bundle.
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
 * nada.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** La respuesta REAL de la plataforma local, leida del disco. Ver `diseno/medidas/README.md`. */
const MEDIDA = JSON.parse(
  readFileSync(join(AQUI, '../../../diseno/medidas/situacion-2026-09-16.json'), 'utf8'),
) as SituacionDelContrato;

/** El primer paso, que es donde se dibuja la consulta: con plataforma no hay nada que buscar antes. */
const EN_BUSCAR: Partial<EstadoDelRecorrido> = { paso: 'buscar' };

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());

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

/** Monta el portal con plataforma, y devuelve lo que se le pidio al cliente. */
function conPlataforma(contesta: () => Promise<unknown>, estado: Partial<EstadoDelRecorrido> = EN_BUSCAR) {
  const { cliente, rutas } = clienteFalso(contesta);
  montarElPortal({ hash: '#/buscar', estado, fuente: crearFuenteDeLaPlataforma(cliente) });
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
          insoluto: { importe: '1842.60', actualizadoA: '2026-09-16' },
          reajuste: { importe: '0.00', actualizadoA: '2026-09-16' },
          interes: { importe: '0.00', actualizadoA: '2026-09-16' },
          gasto: { importe: '0.00', actualizadoA: '2026-09-16' },
          total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        },
      ],
      predios: [],
    },
  ],
});

afterEach(limpiarElPortal);

describe('mientras la consulta viaja', () => {
  it('dice «Consultando su deuda…», sin una sola cifra', async () => {
    conPlataforma(() => new Promise(() => {}));

    expect(await enMain().findByRole('heading', { level: 2, name: 'Consultando su deuda…' })).toBeInTheDocument();
    expect(importesEnPantalla()).toEqual([]);
  });
});

describe('la respuesta MEDIDA de la plataforma local (no se pudo consultar)', () => {
  it('ensena LA NOTA DEL SERVIDOR tal cual, y ningun importe', async () => {
    const { rutas } = conPlataforma(() => Promise.resolve(MEDIDA));

    expect(await enMain().findByRole('heading', { level: 2, name: 'No pudimos consultar toda su deuda' })).toBeInTheDocument();
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
  });

  it('y se pide UNA sola vez: `retry: false`, porque insistir trae el mismo fallo', async () => {
    const { rutas } = conPlataforma(() => Promise.resolve(MEDIDA));

    await enMain().findByRole('heading', { level: 2, name: 'No pudimos consultar toda su deuda' });
    await waitFor(() => expect(rutas).toHaveLength(1));
    expect(rutas).toEqual(['/portal/situacion']);
  });
});

describe('las otras tres ramas', () => {
  it('sin registros: «No encontramos deuda a su nombre», con el documento consultado y sin cifras', async () => {
    conPlataforma(() => Promise.resolve(respuesta({ sinRegistros: true })));

    expect(await enMain().findByRole('heading', { level: 2, name: 'No encontramos deuda a su nombre' })).toBeInTheDocument();
    expect(
      enMain().getByText(/Con DNI 03593174 no figura ninguna deuda en las municipalidades del sistema\./),
    ).toBeInTheDocument();
    expect(enMain().getByText(/Si cree que es un error/)).toBeInTheDocument();
    expect(importesEnPantalla()).toEqual([]);
  });

  it('sin deuda: «No le queda nada por pagar», con su constancia', async () => {
    conPlataforma(() => Promise.resolve(respuesta({})));

    expect(await enMain().findByRole('heading', { level: 2, name: 'No le queda nada por pagar' })).toBeInTheDocument();
    fireEvent.click(enMain().getByRole('button', { name: 'Pedir mi constancia de no adeudo' }));
    expect(await screen.findByText('Se emitiría su constancia de no adeudo al día de hoy.')).toBeInTheDocument();
  });

  it('con deuda: el total DEL SERVIDOR con su fecha, y la frase que el servidor redacto', async () => {
    conPlataforma(() => Promise.resolve(CON_UNA_OBLIGACION));

    expect(await enMain().findByRole('heading', { level: 2, name: 'Lo que encontramos a su nombre' })).toBeInTheDocument();
    // El total es el del servidor, no una suma de la pantalla, y lleva su fecha pegada.
    expect(importesEnPantalla()).toEqual(['S/ 1,842.60']);
    expect(enMain().getByText(/1 obligacion con saldo al 16\/09\/2026/)).toBeInTheDocument();
    // Lo que NO se dibuja: los conceptos de la demostracion. Ensenarlos al lado de un total de
    // verdad seria lo unico peor que no ensenar nada. La lista llega con el issue 28.
    expect(enMain().queryByText('Impuesto predial 2026')).toBeNull();
    expect(enMain().queryByRole('checkbox')).toBeNull();
  });
});

describe('cuando la peticion falla', () => {
  it('un 401 dice lo del ciudadano y ofrece ENTRAR, que va a la puerta de verdad', async () => {
    const ida = vi.spyOn(identidad, 'entrar').mockResolvedValue(null);
    conPlataforma(() => Promise.reject(new ErrorDeLaApi(401, 'GET /portal/situacion', { codigo: 'NO_AUTENTICADO' })));

    expect(await enMain().findByRole('heading', { level: 2, name: 'Su sesión ya no está abierta' })).toBeInTheDocument();
    expect(enMain().getByText('Vuelva a entrar con su cuenta del portal y podrá seguir donde estaba.')).toBeInTheDocument();

    fireEvent.click(enMain().getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(ida).toHaveBeenCalledTimes(1));
    ida.mockRestore();
  });

  it('un 403 SIN_DOCUMENTO usa el texto PROPIO del portal, y no ofrece volver a la puerta', async () => {
    conPlataforma(() => Promise.reject(new ErrorDeLaApi(403, 'GET /portal/situacion', { codigo: 'SIN_DOCUMENTO' })));

    expect(
      await enMain().findByRole('heading', { level: 2, name: 'Su cuenta no dice con qué documento consultar' }),
    ).toBeInTheDocument();
    expect(enMain().getByText(/Acérquese con su DNI o su carné de extranjería a la ventanilla/)).toBeInTheDocument();
    // Lo que el texto de la libreria diria, y que a quien paga su predial no le sirve de nada.
    expect(principal().textContent).not.toMatch(/soporte|administrador|perfiles/i);
    // Volver a entrar traeria el mismo token y el mismo 403: no se ofrece.
    expect(enMain().queryByRole('button', { name: 'Entrar' })).toBeNull();
    expect(importesEnPantalla()).toEqual([]);
  });

  it('y un corte de red es la unica averia de verdad', async () => {
    conPlataforma(() => Promise.reject(new TypeError('Failed to fetch')));

    expect(await enMain().findByRole('heading', { level: 2, name: 'El portal no está respondiendo' })).toBeInTheDocument();
    expect(importesEnPantalla()).toEqual([]);
  });
});

describe('el recorrido de la demostracion NO se mueve', () => {
  it('debajo de la consulta sigue estando el paso 1 entero, y lleva al paso 2', async () => {
    // Es lo que el issue 27 promete y el 28 se lleva: aqui se ANADE la consulta, no se sustituye la
    // pantalla. Si esto se rompiera, se caerian con ello el arnes y media docena de pruebas del
    // recorrido — pero se caerian lejos de aqui y diciendo otra cosa.
    conPlataforma(() => Promise.resolve(MEDIDA));

    expect(await enMain().findByRole('heading', { level: 2, name: 'No pudimos consultar toda su deuda' })).toBeInTheDocument();
    expect(enMain().getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeInTheDocument();

    fireEvent.change(enMain().getByRole('textbox', { name: 'Código de contribuyente' }), {
      target: { value: '00000025673' },
    });
    fireEvent.click(enMain().getByRole('button', { name: 'Buscar mi deuda' }));

    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
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
    conPlataforma(() => Promise.resolve(MEDIDA));

    await enMain().findByRole('heading', { level: 2, name: marcado('No pudimos consultar toda su deuda') });
    // La nota es DATO: la escribio el servidor y se ensena tal cual. Pasarla por `t()` la buscaria en
    // un inventario donde no esta, y saldria igual — por accidente.
    expect(escapados(new Set([MEDIDA.notaDelTotal ?? '']))).toEqual([]);
  });

  it('y las otras ramas tambien', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    conPlataforma(() => Promise.resolve(respuesta({ sinRegistros: true })));

    expect(
      await enMain().findByText(marcado('Con DNI 03593174 no figura ninguna deuda en las municipalidades del sistema.')),
    ).toBeInTheDocument();
    expect(escapados(new Set())).toEqual([]);
  });
});
