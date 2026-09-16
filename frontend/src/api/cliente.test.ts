import { ErrorDeLaApi } from '@kamayuk/api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PREFIJO, cliente } from './cliente.ts';
import { identidad } from './identidad.ts';
import { PREFIJO as DEL_ARCHIVO_HOJA } from './prefijo.ts';

/**
 * **El cliente del portal: el prefijo, el token y nada mas** (issue 13).
 *
 * El transporte es de `@kamayuk/api` y tiene su prueba alli. Lo que se mide aqui es **lo que sale
 * por el cable con la configuracion de ESTE portal**, que es lo unico que este archivo decide — y
 * lo que se puede romper sin que ninguna pantalla cambie de aspecto:
 *
 *   · que la ruta lleve delante `/rentas/api/v1`, que es por donde enruta Traefik;
 *   · que el token viaje, y que se lea **en cada peticion** y no al construir el cliente;
 *   · que sin token no salga cabecera, en vez de un «Bearer null» que el backend contesta con el
 *     401 equivocado;
 *   · y que no se componga nada mas: ni el inquilino, ni parametros de consulta.
 */

/** Lo que el cable vio: la ruta pedida y sus cabeceras. */
function espiarLaRed(estado = 200, cuerpo: unknown = { ok: true }) {
  const espia = vi.fn(
    (_ruta: string, _opciones: RequestInit) =>
      new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', espia);
  return espia;
}

const cabecerasDe = (espia: ReturnType<typeof espiarLaRed>): Record<string, string> =>
  (espia.mock.calls[0]?.[1].headers ?? {}) as Record<string, string>;

afterEach(() => {
  identidad.fijarToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('el prefijo es uno, y es el que enruta el proxy', () => {
  it('vale `/rentas/api/v1` y sale del archivo hoja', () => {
    // `/rentas/` y no `/ciudadano/`: ADR-0030 §2 pone delante el sistema que RESPONDE. Quien
    // contesta `GET /portal/situacion` es el backend de `rentas`; este portal no tiene backend.
    expect(PREFIJO).toBe('/rentas/api/v1');
    // Reexportado, no escrito dos veces: dos cadenas se separan y cada mitad funciona sola.
    expect(PREFIJO).toBe(DEL_ARCHIVO_HOJA);
  });

  it('y cada peticion sale con el delante', async () => {
    const espia = espiarLaRed();

    await cliente.solicitar('/portal/situacion');

    expect(espia.mock.calls[0]?.[0]).toBe('/rentas/api/v1/portal/situacion');
  });
});

describe('el token viaja, y se lee en cada peticion', () => {
  it('sin token NO se manda cabecera de autorizacion', async () => {
    // Un «Bearer null» es un token invalido: el backend contesta 401 igual, pero ese 401 diria «el
    // token no vale» donde la verdad es «no hay token». Son dos peldanos distintos de la escalera,
    // y este es el unico sitio donde se pueden separar sin adivinar.
    const espia = espiarLaRed();

    await cliente.solicitar('/portal/situacion');

    expect(cabecerasDe(espia)['Authorization']).toBeUndefined();
  });

  it('con token, sale como `Bearer`', async () => {
    const espia = espiarLaRed();
    identidad.fijarToken('el-token-de-la-pestana');

    await cliente.solicitar('/portal/situacion');

    expect(cabecerasDe(espia)['Authorization']).toBe('Bearer el-token-de-la-pestana');
  });

  it('y un token que llega DESPUES de construir el cliente tambien', async () => {
    // Es la razon de que el token entre como funcion. El cliente se construye al cargar el modulo,
    // o sea antes del canje: leido como valor, seria `null` para siempre y la primera peticion
    // despues de entrar saldria sin cabecera — con un 401 que parece de sesion caducada.
    const primera = espiarLaRed();
    await cliente.solicitar('/portal/situacion');
    expect(cabecerasDe(primera)['Authorization']).toBeUndefined();

    identidad.fijarToken('canjeado-recien');
    const segunda = espiarLaRed();
    await cliente.solicitar('/portal/situacion');

    expect(cabecerasDe(segunda)['Authorization']).toBe('Bearer canjeado-recien');
  });
});

describe('no se compone nada mas que la ruta', () => {
  it('ni inquilino, ni parametros: el sujeto sale del claim del token', async () => {
    // Regla 2 de ADR-0005. `GET /portal/situacion` no lleva NINGUN parametro —lo retiro el
    // ADR-0020, porque `?doc=` era una enumeracion de contribuyentes—, y `OpcionesDeSolicitud` no
    // tiene ninguna cabecera libre por donde colar el inquilino.
    const espia = espiarLaRed();
    identidad.fijarToken('con-claims');

    await cliente.solicitar('/portal/situacion');

    const [ruta, opciones] = espia.mock.calls[0] ?? [];
    expect(ruta).toBe('/rentas/api/v1/portal/situacion');
    expect(ruta).not.toContain('?');
    expect(Object.keys(cabecerasDe(espia)).sort()).toEqual(['Accept', 'Authorization']);
    expect(opciones?.method).toBe('GET');
    expect(opciones?.body).toBeUndefined();
  });
});

describe('lo que contesta el backend llega con su estado y su codigo', () => {
  it('un 401 `NO_AUTENTICADO` es un `ErrorDeLaApi` que lo dice', async () => {
    // Es lo que la escalera necesita para separar los peldanos: sin el `codigo`, los tres primeros
    // serian indistinguibles desde la pantalla.
    espiarLaRed(401, { status: 401, codigo: 'NO_AUTENTICADO', mensaje: 'Falta el token.' });

    const fallo: unknown = await cliente.solicitar('/portal/situacion').catch((e: unknown) => e);

    expect(fallo).toBeInstanceOf(ErrorDeLaApi);
    expect((fallo as ErrorDeLaApi).estado).toBe(401);
    expect((fallo as ErrorDeLaApi).codigo).toBe('NO_AUTENTICADO');
  });

  it('y un 403 `SIN_DOCUMENTO` tambien, que es el otro que este portal puede recibir', () => {
    // Medido: `GET /portal/situacion` contesta 401 `NO_AUTENTICADO` sin token y 403
    // `SIN_DOCUMENTO` si el token no identifica documento.
    espiarLaRed(403, { status: 403, codigo: 'SIN_DOCUMENTO' });

    return expect(cliente.solicitar('/portal/situacion')).rejects.toMatchObject({
      estado: 403,
      codigo: 'SIN_DOCUMENTO',
    });
  });
});
