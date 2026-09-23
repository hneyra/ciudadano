import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { identidad } from './api/identidad.ts';
import type { Silencio } from './api/silencio.ts';
import { UMBRAL_DE_ESPERA, arrancar, entrar, salir, vueltaFallida } from './arranque.ts';
import { emisorFalso, marcosEnLaPagina, sinSesion } from './pruebas/emisorFalso.ts';

/**
 * **El arranque canjea si volvemos, monta SIEMPRE, y no va a la puerta** (issue 13).
 *
 * Las tres cosas se pueden romper sin que nada cambie de aspecto en el camino de todos los dias:
 *
 *   · sin el canje delante, la primera peticion despues de entrar sale sin token y recibe su 401 —
 *     y el sintoma es «la sesion caduco» justo despues de identificarse;
 *   · con una ida a la puerta al arrancar, `yarn dev`, las 400 pruebas y el arnes se encuentran el
 *     formulario de Keycloak, y el modo demostracion deja de existir;
 *   · sin la vuelta fallida a la vista, un `?error=` del emisor es una pagina normal: la libreria
 *     limpia la URL siempre, asi que no queda ni rastro de que alguien intento entrar.
 */

/** El arranque de `yarn dev` y de las pruebas: sin plataforma, y por tanto sin emisor al que preguntar. */
const EN_DEMOSTRACION = { conPlataforma: false } as const;

/** Deja la barra de direcciones con lo que traeria una vuelta del emisor. */
function laBarraDice(busqueda: string): void {
  window.history.replaceState(null, '', `/portal/${busqueda}`);
}

beforeEach(() => {
  identidad.fijarToken(null);
  sessionStorage.clear();
  laBarraDice('');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  laBarraDice('');
});

describe('el arranque normal: ni red, ni puerta, ni pantalla de error', () => {
  it('monta, y no hay vuelta fallida que contar', async () => {
    const montar = vi.fn();

    await arrancar(montar, EN_DEMOSTRACION);

    expect(montar).toHaveBeenCalledTimes(1);
    expect(vueltaFallida()).toBeNull();
  });

  it('NO va a la puerta aunque no haya token: el portal abre en demostracion', async () => {
    // Es la diferencia con `rentas` y `catastro`, y es la decision del issue: ahi sin token no hay
    // nada que ensenar; aqui el recorrido entero funciona sin plataforma.
    const aLaPuerta = vi.spyOn(identidad, 'entrar');
    const red = vi.fn();
    vi.stubGlobal('fetch', red);

    await arrancar(vi.fn(), EN_DEMOSTRACION);

    expect(identidad.token()).toBeNull();
    expect(aLaPuerta).not.toHaveBeenCalled();
    expect(red, 'el arranque salio a la red sin que nadie se lo pidiera').not.toHaveBeenCalled();
  });

  it('y sin `?code=` ni `?error=` no toca el almacenamiento', async () => {
    // `canjearSiVuelve()` mira la barra y vuelve. Si tocara `sessionStorage` en el camino normal,
    // el arnes y las pruebas estarian midiendo un portal distinto del que ven.
    await arrancar(vi.fn(), EN_DEMOSTRACION);

    expect(sessionStorage.length).toBe(0);
  });

  it('el montaje es LO ULTIMO: el canje ya termino cuando React monta', async () => {
    const orden: string[] = [];
    vi.spyOn(identidad, 'canjearSiVuelve').mockImplementation(async () => {
      await Promise.resolve();
      orden.push('canje');
      return { estado: 'sin-vuelta' };
    });

    await arrancar(() => orden.push('montar'), EN_DEMOSTRACION);

    expect(orden).toEqual(['canje', 'montar']);
  });
});

describe('la vuelta del emisor', () => {
  it('cuando se canja, deja el token y no hay nada que explicar', async () => {
    vi.spyOn(identidad, 'canjearSiVuelve').mockResolvedValue({ estado: 'canjeado' });
    const montar = vi.fn();

    await arrancar(montar, EN_DEMOSTRACION);

    expect(vueltaFallida()).toBeNull();
    expect(montar).toHaveBeenCalledTimes(1);
  });

  it('cuando falla, se monta IGUAL y se dice por que', async () => {
    // El emisor contesta con `?error=` en la barra; la libreria lo traduce y limpia la URL.
    laBarraDice('?error=access_denied&error_description=El+usuario+cancelo');

    const montar = vi.fn();
    await arrancar(montar, EN_DEMOSTRACION);

    expect(montar, 'sin montar, la pagina se queda en blanco y sin una linea que leer').toHaveBeenCalledTimes(1);
    expect(vueltaFallida()).toEqual({
      motivo: 'No se completo la entrada',
      detalle: 'El usuario cancelo',
    });
    // Y la URL queda limpia: un codigo usado no vale dos veces, y recargar daria otro error que no
    // tiene nada que ver con lo que paso.
    expect(window.location.search).toBe('');
  });

  it('cada pasada vuelve a fijar la vuelta: no se arrastra la de antes', async () => {
    laBarraDice('?error=server_error');
    await arrancar(vi.fn(), EN_DEMOSTRACION);
    expect(vueltaFallida()).not.toBeNull();

    laBarraDice('');
    await arrancar(vi.fn(), EN_DEMOSTRACION);

    expect(vueltaFallida()).toBeNull();
  });
});

/** Un canje silencioso que contesta lo que se le diga, cuando se le diga. */
function silencioQueContesta(resultado: Silencio, tarda = 0) {
  return {
    intentar: vi.fn(
      () => new Promise<Silencio>((listo) => (tarda === 0 ? listo(resultado) : setTimeout(() => listo(resultado), tarda))),
    ),
  };
}

const CON_PLATAFORMA = { conPlataforma: true } as const;

describe('el canje silencioso (issue 35): cuando se pregunta al emisor, y cuando no', () => {
  it('en DEMOSTRACION no se habla con ningun emisor: cero peticiones y cero marcos', async () => {
    // Con el canje silencioso DE VERDAD, no uno falso: si se colara en demostracion, el emisor falso
    // contestaria y se veria la pregunta.
    const emisor = emisorFalso(sinSesion());
    const red = vi.fn();
    vi.stubGlobal('fetch', red);

    await arrancar(vi.fn(), EN_DEMOSTRACION);
    await new Promise((listo) => setTimeout(listo, 20));
    emisor.soltar();

    expect(emisor.pedidas, 'el portal de demostracion le pregunto al emisor').toEqual([]);
    expect(marcosEnLaPagina()).toBe(0);
    expect(red).not.toHaveBeenCalled();
  });

  it('con plataforma y sin token, se pregunta UNA vez, y antes de montar', async () => {
    const orden: string[] = [];
    const silencio = {
      intentar: vi.fn(async () => {
        await Promise.resolve();
        orden.push('silencio');
        return { estado: 'anonimo' } as const;
      }),
    };

    await arrancar(() => orden.push('montar'), { ...CON_PLATAFORMA, silencio });

    expect(silencio.intentar).toHaveBeenCalledTimes(1);
    // Montar antes seria dibujar la puerta y, un instante despues, la deuda: el parpadeo que el
    // issue prohibe, y una primera consulta sin token.
    expect(orden).toEqual(['silencio', 'montar']);
  });

  it('AC1 — si el emisor tenia sesion, se monta sin nada que explicar y sin ir a la puerta', async () => {
    const aLaPuerta = vi.spyOn(identidad, 'entrar');
    const montar = vi.fn();

    await arrancar(montar, { ...CON_PLATAFORMA, silencio: silencioQueContesta({ estado: 'identificado' }) });

    expect(montar).toHaveBeenCalledTimes(1);
    expect(vueltaFallida()).toBeNull();
    expect(aLaPuerta).not.toHaveBeenCalled();
  });

  it('AC2 — si no la tenia, se monta ANONIMO: ni pantalla de error, ni puerta, ni otra URL', async () => {
    const aLaPuerta = vi.spyOn(identidad, 'entrar');
    const antes = window.location.href;
    const montar = vi.fn();

    await arrancar(montar, { ...CON_PLATAFORMA, silencio: silencioQueContesta({ estado: 'anonimo' }) });

    expect(montar).toHaveBeenCalledTimes(1);
    expect(vueltaFallida()).toBeNull();
    expect(aLaPuerta).not.toHaveBeenCalled();
    expect(window.location.href).toBe(antes);
  });

  it('AC4 — si el emisor no contesto, se monta la pantalla que lo explica, con su motivo', async () => {
    const montar = vi.fn();
    const fallo = { estado: 'fallo', motivo: 'El emisor no contesto', detalle: 'No contesto en 8 s.' } as const;

    await arrancar(montar, { ...CON_PLATAFORMA, silencio: silencioQueContesta(fallo) });

    expect(montar, 'sin montar, la pagina se queda en blanco').toHaveBeenCalledTimes(1);
    expect(vueltaFallida()).toEqual({ motivo: 'El emisor no contesto', detalle: 'No contesto en 8 s.' });
  });

  it.each([
    [
      'con la vuelta del emisor recien canjeada: ya hay token',
      () => vi.spyOn(identidad, 'canjearSiVuelve').mockResolvedValue({ estado: 'canjeado' }),
    ],
    ['con una vuelta fallida: ya hay algo que explicar', () => laBarraDice('?error=server_error')],
    ['con el token ya puesto', () => identidad.fijarToken('un.token.de.mentira')],
    // Quien acaba de cerrar sesion y recarga no puede volver a encontrarse dentro sin teclear nada:
    // en un equipo compartido es lo unico que no puede pasar.
    ['recien salido de la sesion', () => vi.spyOn(identidad, 'vieneDeSalir').mockReturnValue(true)],
    ['sin `crypto.subtle`: sin S256 no hay puerta', () => vi.spyOn(identidad, 'hayPuerta').mockReturnValue(false)],
  ])('NO se pregunta %s', async (_caso, preparar) => {
    preparar();
    const silencio = silencioQueContesta({ estado: 'identificado' });

    await arrancar(vi.fn(), { ...CON_PLATAFORMA, silencio });

    expect(silencio.intentar).not.toHaveBeenCalled();
  });
});

describe('mientras se pregunta: nada que parpadee', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('si tarda, se dibuja la espera ANTES de montar el portal', async () => {
    vi.useFakeTimers();
    const orden: string[] = [];

    const arranque = arrancar(() => orden.push('montar'), {
      ...CON_PLATAFORMA,
      esperando: () => orden.push('esperando'),
      silencio: silencioQueContesta({ estado: 'anonimo' }, UMBRAL_DE_ESPERA + 700),
    });
    await vi.advanceTimersByTimeAsync(UMBRAL_DE_ESPERA + 700);
    await arranque;

    expect(orden).toEqual(['esperando', 'montar']);
  });

  it('si contesta enseguida, NO se dibuja la espera: seria un destello entre la pagina en blanco y el portal', async () => {
    vi.useFakeTimers();
    const esperando = vi.fn();

    const arranque = arrancar(vi.fn(), {
      ...CON_PLATAFORMA,
      esperando,
      silencio: silencioQueContesta({ estado: 'anonimo' }, UMBRAL_DE_ESPERA - 100),
    });
    await vi.advanceTimersByTimeAsync(UMBRAL_DE_ESPERA * 4);
    await arranque;

    expect(esperando).not.toHaveBeenCalled();
  });

  it('y sin pregunta, tampoco: en demostracion no hay nada que esperar', async () => {
    vi.useFakeTimers();
    const esperando = vi.fn();

    await arrancar(vi.fn(), { ...EN_DEMOSTRACION, esperando });
    await vi.advanceTimersByTimeAsync(UMBRAL_DE_ESPERA * 4);

    expect(esperando).not.toHaveBeenCalled();
  });
});

describe('lo que el arranque expone para el marco (issue 16)', () => {
  it('`entrar()` lleva a la puerta de la libreria', async () => {
    const puerta = vi.spyOn(identidad, 'entrar').mockResolvedValue(null);

    await expect(entrar()).resolves.toBeNull();
    expect(puerta).toHaveBeenCalledTimes(1);
  });

  it('y devuelve la falla cuando no se pudo ni llegar al emisor', async () => {
    const falla = {
      emisor: 'http://localhost:18180/realms/kamayuk-ciudadano',
      url: 'http://localhost:18180/realms/kamayuk-ciudadano/.well-known/openid-configuration',
      motivo: 'Failed to fetch',
    };
    vi.spyOn(identidad, 'entrar').mockResolvedValue(falla);

    await expect(entrar()).resolves.toEqual(falla);
  });

  it('`salir()` cierra tambien en el emisor', () => {
    // Sin `id_token_hint` la sesion del emisor sigue viva y el siguiente arranque entraria solo con
    // la misma cuenta. En un equipo compartido —que es donde se paga un tributo— eso no es un
    // detalle.
    const cierre = vi.spyOn(identidad, 'salir').mockImplementation(() => undefined);

    salir();

    expect(cierre).toHaveBeenCalledTimes(1);
  });
});
