// En jsdom, que es el entorno por omision de este proyecto, y no en `node`: este archivo importa
// `fuenteDeLaPlataforma.ts`, que arrastra el cliente y con el `src/api/identidad.ts`, y esa puerta se
// construye al evaluar el modulo leyendo `window.location.origin`. En `node` no llega ni a la
// primera prueba. Nada de lo que se mide aqui necesita un DOM; lo necesita el arbol de importes.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ErrorDeLaApi, type Cliente, type OpcionesDeSolicitud } from '@kamayuk/api';
import { describe, expect, it, vi } from 'vitest';

import type { SituacionDelContrato } from './contrato.ts';
import { deLaSituacion } from './deLaSituacion.ts';
import { NO_LO_PUBLICA_EL_PORTAL, RUTA_DE_LA_SITUACION, crearFuenteDeLaPlataforma } from './fuenteDeLaPlataforma.ts';
import { RespuestaQueNoEntiendo } from './respuestaQueNoEntiendo.ts';

// El adaptador de VERDAD, envuelto en un espia: las pruebas de siempre siguen midiendo lo que hace,
// y la de la frontera (issue 34) puede contar si alguien le paso algo.
vi.mock('./deLaSituacion.ts', async (original) => {
  const modulo = await original<typeof import('./deLaSituacion.ts')>();
  return { ...modulo, deLaSituacion: vi.fn(modulo.deLaSituacion) };
});

/**
 * **La fuente de la plataforma pide `GET /portal/situacion` y pasa lo que llega por el adaptador.**
 *
 * Lo que aqui se mide, y no se puede medir en ningun otro sitio:
 *
 *   · **la ruta exacta**, porque una ruta mal escrita no da un error que se lea: el proxy de Vite
 *     contesta el `index.html` con un 200, y la pantalla recibe HTML donde esperaba JSON;
 *   · **que se pide UNA vez** por lectura;
 *   · **que la respuesta pasa por `deLaSituacion`** y no llega cruda a las pantallas;
 *   · **que un fallo sube tal cual**, con su `estado` y su `codigo`, que es de lo que vive la
 *     escalera de peldanos.
 *
 * El cliente entra como argumento (`crearFuenteDeLaPlataforma`) justo para esto: sin eso habria que
 * sustituir el modulo del cliente entero con `vi.mock`, y entonces lo que se probaria seria el doble.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** La respuesta REAL de la plataforma local, leida del disco. Ver `diseno/medidas/README.md`. */
const MEDIDA = JSON.parse(
  readFileSync(join(AQUI, '../../diseno/medidas/situacion-2026-09-16.json'), 'utf8'),
) as SituacionDelContrato;

/** Un cliente que contesta lo que se le diga y apunta lo que le pidieron. */
function clienteFalso(contesta: () => Promise<unknown>) {
  const pedidas: { ruta: string; opciones: OpcionesDeSolicitud | undefined }[] = [];
  const cliente = {
    solicitar: vi.fn((ruta: string, opciones?: OpcionesDeSolicitud) => {
      pedidas.push({ ruta, opciones });
      return contesta();
    }),
    solicitarRespuesta: vi.fn(),
    descargar: vi.fn(),
    subir: vi.fn(),
  } as unknown as Cliente;
  return { cliente, pedidas };
}

describe('la consulta', () => {
  it('pide `/portal/situacion`, SIN parametros y una sola vez', async () => {
    const { cliente, pedidas } = clienteFalso(() => Promise.resolve(MEDIDA));
    const fuente = crearFuenteDeLaPlataforma(cliente);

    await fuente.consulta?.();

    expect(pedidas).toHaveLength(1);
    expect(pedidas[0]?.ruta).toBe('/portal/situacion');
    expect(RUTA_DE_LA_SITUACION).toBe('/portal/situacion');
    // Ni parametros de consulta ni cuerpo: el sujeto sale del token (ADR-0020). Un `?doc=` aqui
    // volveria a abrir la enumeracion de contribuyentes que el ADR cerro.
    expect(pedidas[0]?.ruta).not.toContain('?');
    expect(pedidas[0]?.opciones?.cuerpo).toBeUndefined();
  });

  it('pasa la respuesta por el adaptador: la MEDIDA sale como «no se pudo consultar»', async () => {
    const { cliente } = clienteFalso(() => Promise.resolve(MEDIDA));
    const fuente = crearFuenteDeLaPlataforma(cliente);

    const situacion = await fuente.consulta?.();

    // Si la respuesta llegara cruda, `estado` no existiria y `notaDelTotal` vendria igual: por eso
    // se comprueban las dos cosas.
    expect(situacion?.estado).toBe('no-se-pudo-consultar');
    expect(situacion?.notaDelTotal).toBe(MEDIDA.notaDelTotal);
    expect(situacion?.totalConsolidado).toBeNull();
    expect(situacion?.deudas).toEqual([]);
  });

  it('y un fallo sube tal cual, con su estado y su codigo', async () => {
    const fallo = new ErrorDeLaApi(403, 'GET /portal/situacion', { codigo: 'SIN_DOCUMENTO' });
    const { cliente } = clienteFalso(() => Promise.reject(fallo));
    const fuente = crearFuenteDeLaPlataforma(cliente);

    await expect(fuente.consulta?.()).rejects.toBe(fallo);
  });
});

describe('la frontera (issue 34): lo que no tiene la forma del contrato no llega al adaptador', () => {
  it('una respuesta rota rechaza con `RespuestaQueNoEntiendo`, y `deLaSituacion` no ve nada', async () => {
    // `municipalidades` que no es una lista: sin la frontera, el adaptador la recorreria y reventaria
    // con un `TypeError` suelto —o la daria por vacia—, que es justo lo que el issue quita.
    const rota = { ...MEDIDA, municipalidades: {} };
    const { cliente } = clienteFalso(() => Promise.resolve(rota));
    const fuente = crearFuenteDeLaPlataforma(cliente);
    vi.mocked(deLaSituacion).mockClear();

    await expect(fuente.consulta?.()).rejects.toBeInstanceOf(RespuestaQueNoEntiendo);
    expect(deLaSituacion, 'El adaptador recibio una respuesta que nadie valido').not.toHaveBeenCalled();
  });

  it('y una valida SI le llega, ya leida', async () => {
    const { cliente } = clienteFalso(() => Promise.resolve(MEDIDA));
    vi.mocked(deLaSituacion).mockClear();

    await crearFuenteDeLaPlataforma(cliente).consulta?.();

    expect(deLaSituacion).toHaveBeenCalledTimes(1);
    expect(deLaSituacion).toHaveBeenCalledWith(MEDIDA);
  });
});

describe('lo que el servidor todavia no publica', () => {
  it('el historial y las unidades rechazan diciendo por que, y no devuelven listas vacias', async () => {
    // Una lista vacia diria «no tiene pagos», que es una afirmacion sobre su historia que nadie ha
    // comprobado, y la pantalla la dibujaria como un hecho.
    const { cliente, pedidas } = clienteFalso(() => Promise.resolve(MEDIDA));
    const fuente = crearFuenteDeLaPlataforma(cliente);

    await expect(fuente.historial()).rejects.toThrow(NO_LO_PUBLICA_EL_PORTAL);
    await expect(fuente.unidades()).rejects.toThrow(NO_LO_PUBLICA_EL_PORTAL);
    expect(pedidas, 'pidio algo al backend para una lectura que no existe').toEqual([]);
  });
});
