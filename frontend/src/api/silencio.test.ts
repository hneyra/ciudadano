import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { crearIdentidad, type Identidad } from '@kamayuk/sesion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  callado,
  conSesion,
  contestarDesde,
  emisorFalso,
  marcosEnLaPagina,
  sinSesion,
  type EmisorFalso,
} from '../pruebas/emisorFalso.ts';
import { RAIZ } from '../../verificaciones/artboards.ts';
import { configuracionDeLaPuerta } from './identidad.ts';
import { ESPERA_DEL_EMISOR, PAGINA_DE_VUELTA, TEXTOS_DEL_SILENCIO, crearSilencio } from './silencio.ts';

/**
 * **El canje silencioso: preguntarle al emisor, sin que nadie lo vea, si ya habia entrado** (issue 35).
 *
 * Se prueba con una instancia NUEVA en cada caso —`crearSilencio`, con una puerta nueva de
 * `@kamayuk/sesion`— porque el intento es de UNO por carga y la marca vive dentro de la instancia:
 * con la de modulo, el primer caso gastaria el intento de todos los demas.
 */

/** Un JWT de mentira con un nombre: la firma la comprueba el backend, no el navegador. */
function tokenDeMentira(nombre: string): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  return `${base64url('{"alg":"RS256"}')}.${base64url(JSON.stringify({ name: nombre }))}.firma-de-mentira`;
}

const ACCESO = tokenDeMentira('Rufina Medina Medina');
const IDENTIFICACION = tokenDeMentira('Rufina Medina Medina');

/** El canje que contesta bien, o lo que se le diga. */
function canjeQueContesta(respuesta: () => Promise<Response>) {
  const red = vi.fn((_url: string, _opciones?: RequestInit) => respuesta());
  vi.stubGlobal('fetch', red);
  return red;
}

const bien = () =>
  Promise.resolve(
    new Response(JSON.stringify({ access_token: ACCESO, id_token: IDENTIFICACION }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

/**
 * El reto S256 lo calcula `crypto.subtle`, que contesta en tiempo REAL y no en el del reloj falso:
 * hasta que el marco no esta en la pagina, el tope todavia no se ha armado y adelantar el reloj no
 * mide nada. Se espera a que este, cediendo el turno con `setImmediate`, que el reloj falso no toca.
 */
async function hastaQueHayaMarco(): Promise<void> {
  while (marcosEnLaPagina() === 0) await new Promise((listo) => setImmediate(listo));
}

/** Solo los temporizadores: `setImmediate` tiene que seguir siendo de verdad (ver arriba). */
const relojFalso = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

let puerta: Identidad;
let emisor: EmisorFalso | null = null;

function nuevo(espera?: number) {
  return crearSilencio({ configuracion: configuracionDeLaPuerta(), identidad: puerta, espera });
}

beforeEach(() => {
  puerta = crearIdentidad(configuracionDeLaPuerta());
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  emisor?.soltar();
  emisor = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.querySelectorAll('iframe').forEach((marco) => marco.remove());
});

describe('lo que se le pregunta al emisor', () => {
  it('abre UN marco oculto a la autorizacion, con `prompt=none` y la vuelta a `silencio.html`', async () => {
    emisor = emisorFalso(sinSesion());

    await nuevo().intentar();

    expect(emisor.pedidas).toHaveLength(1);
    const pedida = emisor.pedidas[0];
    expect(`${pedida?.origin ?? ''}${pedida?.pathname ?? ''}`).toBe(
      `${configuracionDeLaPuerta().realm}/protocol/openid-connect/auth`,
    );
    expect(Object.fromEntries(pedida?.searchParams ?? [])).toMatchObject({
      response_type: 'code',
      response_mode: 'query',
      client_id: configuracionDeLaPuerta().cliente,
      scope: configuracionDeLaPuerta().alcance,
      prompt: 'none',
      code_challenge_method: 'S256',
      // Bajo la raiz de la aplicacion: es lo que el realm ya admite (`/portal/*`) sin tocarlo.
      redirect_uri: `${window.location.origin}/portal/${PAGINA_DE_VUELTA}`,
    });
    expect(pedida?.searchParams.get('state')).toMatch(/^[\w-]{20,}$/);
    expect(pedida?.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
  });

  it('el marco esta oculto mientras pregunta, y se quita al terminar', async () => {
    let oculto: boolean | null = null;
    emisor = emisorFalso((pedida) => {
      const marco = document.querySelector('iframe');
      oculto = marco?.style.display === 'none';
      return sinSesion()(pedida);
    });

    await nuevo().intentar();

    expect(oculto, 'el marco del emisor se veia en la pagina').toBe(true);
    expect(marcosEnLaPagina()).toBe(0);
  });

  it('no deja NADA en el almacenamiento: el verificador y el `state` viven en memoria', async () => {
    emisor = emisorFalso(conSesion);
    canjeQueContesta(bien);

    await nuevo().intentar();

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});

describe('AC1 — con la sesion del emisor viva, se entra sin pulsar nada', () => {
  it('canjea el codigo y la puerta queda con el token y con quien entro', async () => {
    emisor = emisorFalso(conSesion);
    canjeQueContesta(bien);

    await expect(nuevo().intentar()).resolves.toEqual({ estado: 'identificado' });

    expect(puerta.token()).toBe(ACCESO);
    expect(puerta.quienEntro()?.nombre).toBe('Rufina Medina Medina');
    expect(marcosEnLaPagina()).toBe(0);
  });

  it('el canje lleva el verificador del reto que se mando, y la misma vuelta', async () => {
    emisor = emisorFalso(conSesion);
    const red = canjeQueContesta(bien);

    await nuevo().intentar();

    expect(red).toHaveBeenCalledTimes(1);
    const [url, opciones] = red.mock.calls[0] ?? [];
    expect(url).toBe(`${configuracionDeLaPuerta().realm}/protocol/openid-connect/token`);
    expect(opciones?.method).toBe('POST');
    const cuerpo = new URLSearchParams(String(opciones?.body));
    expect(Object.fromEntries(cuerpo)).toMatchObject({
      grant_type: 'authorization_code',
      client_id: configuracionDeLaPuerta().cliente,
      code: 'un-codigo-de-mentira',
      redirect_uri: `${window.location.origin}/portal/${PAGINA_DE_VUELTA}`,
    });
    // RFC 7636 §4.2: el reto es BASE64URL(SHA256(verificador)). Si no cuadra, el emisor rechaza.
    const resumen = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cuerpo.get('code_verifier') ?? '')),
    );
    const reto = btoa(String.fromCharCode(...resumen)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    expect(reto).toBe(emisor.pedidas[0]?.searchParams.get('code_challenge'));
  });
});

describe('AC2 — sin sesion en el emisor, anonimo y sin ir a ningun sitio', () => {
  it.each(['login_required', 'interaction_required', 'consent_required', 'account_selection_required'])(
    '«%s» es «no hay sesion»: anonimo, sin canje y sin token',
    async (error) => {
      emisor = emisorFalso(sinSesion(error));
      const red = canjeQueContesta(bien);
      const antes = window.location.href;

      await expect(nuevo().intentar()).resolves.toEqual({ estado: 'anonimo' });

      expect(puerta.token()).toBeNull();
      expect(red).not.toHaveBeenCalled();
      expect(window.location.href).toBe(antes);
      expect(marcosEnLaPagina()).toBe(0);
    },
  );
});

describe('AC3 — una vez por carga', () => {
  it('el segundo intento de la misma instancia no abre otro marco', async () => {
    emisor = emisorFalso(sinSesion());
    const silencio = nuevo();

    await silencio.intentar();
    await expect(silencio.intentar()).resolves.toEqual({ estado: 'anonimo' });

    expect(emisor.pedidas).toHaveLength(1);
  });

  it('y tampoco si el primero todavia no habia terminado', async () => {
    emisor = emisorFalso(sinSesion());
    const silencio = nuevo();

    await Promise.all([silencio.intentar(), silencio.intentar()]);

    expect(emisor.pedidas).toHaveLength(1);
  });
});

describe('AC4 — el emisor que no contesta es un fallo con su motivo, no una espera eterna', () => {
  it('pasado el tope, falla diciendolo, y quita el marco', async () => {
    relojFalso();
    emisor = emisorFalso(callado);

    const intento = nuevo().intentar();
    await hastaQueHayaMarco();
    await vi.advanceTimersByTimeAsync(ESPERA_DEL_EMISOR - 1);
    expect(marcosEnLaPagina(), 'se rindio antes del tope').toBe(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(intento).resolves.toEqual({
      estado: 'fallo',
      motivo: { clave: TEXTOS_DEL_SILENCIO.noContesto },
      detalle: { clave: TEXTOS_DEL_SILENCIO.noContestoDetalle, valores: { segundos: '8' } },
    });
    expect(marcosEnLaPagina()).toBe(0);
  });

  it('el tope es UNO para todo el intento: el canje no estrena otro despues de esperar al marco', async () => {
    // Revision del PR #45: con un tope para el marco y otro para el canje, un marco que contesta en
    // el ultimo momento y un canje colgado sumaban el doble.
    relojFalso();
    emisor = emisorFalso(callado);
    const red = vi.fn(
      (_url: string, opciones?: RequestInit) =>
        new Promise<Response>((_listo, falla) =>
          opciones?.signal?.addEventListener('abort', () => falla(new DOMException('abortado', 'AbortError'))),
        ),
    );
    vi.stubGlobal('fetch', red);

    const intento = nuevo().intentar();
    await hastaQueHayaMarco();
    await vi.advanceTimersByTimeAsync(ESPERA_DEL_EMISOR - 100);
    const marco = document.querySelector('iframe');
    const pedida = emisor.pedidas[0];
    if (marco === null || pedida === undefined) throw new Error('no hay marco');
    contestarDesde(marco, conSesion(pedida));
    while (red.mock.calls.length === 0) await new Promise((listo) => setImmediate(listo));

    let resuelto = false;
    void intento.then(() => (resuelto = true));
    await vi.advanceTimersByTimeAsync(100);

    expect(resuelto, 'el canje siguio esperando despues del tope del intento').toBe(true);
    await expect(intento).resolves.toMatchObject({ estado: 'fallo', motivo: { clave: TEXTOS_DEL_SILENCIO.noContesto } });
  });

  it('un error que no es «no hay sesion» es un fallo, con lo que dijo el emisor', async () => {
    emisor = emisorFalso((pedida) => `?error=unauthorized_client&error_description=Cliente+desconocido&state=${pedida.searchParams.get('state') ?? ''}`);

    await expect(nuevo().intentar()).resolves.toEqual({
      estado: 'fallo',
      motivo: { clave: 'El sistema de identidad no reconoce a este portal' },
      detalle: {
        clave: 'Contestó «{{error}}»: {{descripcion}}',
        valores: { error: 'unauthorized_client', descripcion: 'Cliente desconocido' },
      },
    });
  });

  it('un canje que no llega es un fallo', async () => {
    emisor = emisorFalso(conSesion);
    canjeQueContesta(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(nuevo().intentar()).resolves.toEqual({
      estado: 'fallo',
      motivo: { clave: TEXTOS_DEL_SILENCIO.noContesto },
      detalle: { clave: TEXTOS_DEL_SILENCIO.canjeNoLlego },
    });
    expect(puerta.token()).toBeNull();
  });

  it('un canje rechazado es un fallo', async () => {
    emisor = emisorFalso(conSesion);
    canjeQueContesta(() => Promise.resolve(new Response('{}', { status: 400 })));

    await expect(nuevo().intentar()).resolves.toMatchObject({
      estado: 'fallo',
      motivo: { clave: 'El sistema de identidad rechazó el canje' },
      detalle: { clave: TEXTOS_DEL_SILENCIO.rechazoDetalle, valores: { estado: '400' } },
    });
    expect(puerta.token()).toBeNull();
  });

  it('un canje sin `access_token` es un fallo', async () => {
    emisor = emisorFalso(conSesion);
    canjeQueContesta(() => Promise.resolve(new Response('{"id_token":"x"}', { status: 200 })));

    await expect(nuevo().intentar()).resolves.toMatchObject({
      estado: 'fallo',
      motivo: { clave: 'El sistema de identidad no devolvió ningún token' },
    });
    expect(puerta.token()).toBeNull();
  });
});

describe('lo que no es la contestacion NUESTRA se ignora', () => {
  /** Contesta primero con algo ajeno y, un momento despues, con lo de verdad. */
  function primeroAjenoYLuego(ajeno: (marco: HTMLIFrameElement, pedida: URL) => void) {
    emisor = emisorFalso((pedida) => {
      const marco = document.querySelector('iframe');
      if (marco === null) return null;
      ajeno(marco, pedida);
      setTimeout(() => contestarDesde(marco, sinSesion()(pedida)), 10);
      return null;
    });
  }

  it('un `state` ajeno: no se canjea el codigo que alguien nos hizo llegar', async () => {
    const red = canjeQueContesta(bien);
    primeroAjenoYLuego((marco) => contestarDesde(marco, '?code=codigo-ajeno&state=otro-estado'));

    await expect(nuevo().intentar()).resolves.toEqual({ estado: 'anonimo' });

    expect(red).not.toHaveBeenCalled();
    expect(puerta.token()).toBeNull();
  });

  it('un origen ajeno, aunque traiga nuestro `state`', async () => {
    const red = canjeQueContesta(bien);
    primeroAjenoYLuego((marco, pedida) => contestarDesde(marco, conSesion(pedida), 'https://otro.example'));

    await expect(nuevo().intentar()).resolves.toEqual({ estado: 'anonimo' });

    expect(red).not.toHaveBeenCalled();
  });

  it('una ventana que no es el marco, aunque sea del mismo origen y traiga nuestro `state`', async () => {
    const red = canjeQueContesta(bien);
    primeroAjenoYLuego((_marco, pedida) =>
      window.dispatchEvent(
        new MessageEvent('message', { data: conSesion(pedida), origin: window.location.origin, source: window }),
      ),
    );

    await expect(nuevo().intentar()).resolves.toEqual({ estado: 'anonimo' });

    expect(red).not.toHaveBeenCalled();
  });

  it('y si solo llega lo ajeno, se espera al tope y se falla', async () => {
    relojFalso();
    emisor = emisorFalso((pedida) => `?code=codigo-ajeno&state=no-${pedida.searchParams.get('state') ?? ''}`);

    const intento = nuevo().intentar();
    await hastaQueHayaMarco();
    await vi.advanceTimersByTimeAsync(ESPERA_DEL_EMISOR);

    await expect(intento).resolves.toMatchObject({ estado: 'fallo', motivo: { clave: TEXTOS_DEL_SILENCIO.noContesto } });
  });
});

describe('`public/silencio.html`, la pagina de vuelta del marco', () => {
  const pagina = readFileSync(join(RAIZ, 'public', PAGINA_DE_VUELTA), 'utf8');
  const guiones = [...pagina.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];

  /** Ejecuta su guion con una ventana de mentira y devuelve lo que mando a la de arriba. */
  function loQueManda(dentroDeUnMarco: boolean): unknown[][] {
    const enviados: unknown[][] = [];
    const arriba = { postMessage: (...argumentos: unknown[]) => enviados.push(argumentos) };
    const ventana: Record<string, unknown> = {
      location: { search: '?code=abc&state=xyz', origin: 'http://localhost:3000' },
    };
    ventana['parent'] = dentroDeUnMarco ? arriba : ventana;
    new Function('window', guiones[0]?.[2] ?? '')(ventana);
    return enviados;
  }

  it('tiene UN guion, en linea y sin `src`: nada de terceros ni del paquete del portal', () => {
    expect(guiones).toHaveLength(1);
    expect(guiones[0]?.[1]).not.toMatch(/\bsrc=/);
  });

  it('le pasa su busqueda a la ventana de arriba, y SOLO a una de su mismo origen', () => {
    expect(loQueManda(true)).toEqual([['?code=abc&state=xyz', 'http://localhost:3000']]);
  });

  it('abierta sola, sin ventana de arriba, no manda nada', () => {
    expect(loQueManda(false)).toEqual([]);
  });

  it('y no toca el almacenamiento ni pide nada a la red', () => {
    expect(pagina).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest/);
  });
});

describe('lo que el canje silencioso dice en pantalla', () => {
  it('son textos del portal, con sus tildes, y no palabras sin acentuar', () => {
    // Revision del PR #45: los primeros motivos copiaban el castellano sin tildes de la libreria
    // («El emisor no contesto»), y esos llegan a la pantalla de un contribuyente.
    const sinTilde = /\b(contesto|pregunto|habia|devolvio|rechazo|completo|dejo|peticion|codigo|volvio|ningun)\b/;
    expect(Object.values(TEXTOS_DEL_SILENCIO).filter((t) => sinTilde.test(t))).toEqual([]);
  });
});
