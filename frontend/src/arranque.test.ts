import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { identidad } from './api/identidad.ts';
import { TEXTOS_DEL_EMISOR } from './api/emisor.ts';
import type { Silencio } from './api/silencio.ts';
import { UMBRAL_DE_ESPERA, arrancar, entrar, preguntaFallida, salir, vueltaFallida } from './arranque.ts';
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
const EN_DEMOSTRACION = { conEmisor: false } as const;

/** Un canje silencioso que contesta lo que se le diga, cuando se le diga. */
function silencioQueContesta(resultado: Silencio, tarda = 0) {
  return {
    intentar: vi.fn(
      () => new Promise<Silencio>((listo) => (tarda === 0 ? listo(resultado) : setTimeout(() => listo(resultado), tarda))),
    ),
  };
}

const CON_PLATAFORMA = { conEmisor: true } as const;

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

  it('cuando falla, se monta IGUAL y se dice por que, con claves del portal (issue 56)', async () => {
    // El emisor contesta con `?error=` en la barra; la libreria limpia la URL.
    laBarraDice('?error=server_error&error_description=Unexpected+error');

    const montar = vi.fn();
    await arrancar(montar, EN_DEMOSTRACION);

    expect(montar, 'sin montar, la pagina se queda en blanco y sin una linea que leer').toHaveBeenCalledTimes(1);
    // Claves que la pantalla pasa por `t()`, y no el castellano de la libreria («El emisor tuvo un
    // problema»).
    expect(vueltaFallida()).toEqual({
      estado: 'fallo',
      motivo: { clave: TEXTOS_DEL_EMISOR.problema },
      // Ni el codigo ni la descripcion: viajan en la barra y cualquiera los fabrica (revision del PR #66).
      detalle: { clave: TEXTOS_DEL_EMISOR.problemaDetalle },
    });
    // Y la URL queda limpia: un codigo usado no vale dos veces, y recargar daria otro error que no
    // tiene nada que ver con lo que paso.
    expect(window.location.search).toBe('');
  });

  it.each(['access_denied', 'login_required', 'interaction_required', 'consent_required', 'account_selection_required'])(
    'AC3 — «%s» es que la persona no quiso entrar: se monta ANONIMO, sin nada que explicar (issue 56)',
    async (error) => {
      laBarraDice(`?error=${error}&error_description=User+cancelled`);
      const silencio = silencioQueContesta({ estado: 'identificado' });
      const montar = vi.fn();

      await arrancar(montar, { ...CON_PLATAFORMA, silencio });

      expect(montar).toHaveBeenCalledTimes(1);
      expect(vueltaFallida(), 'cancelar en el formulario acabo en «No se pudo abrir su sesión»').toBeNull();
      expect(preguntaFallida()).toBeNull();
      // Acaba de decir que no: preguntarle en silencio a continuacion seria no hacerle caso.
      expect(silencio.intentar).not.toHaveBeenCalled();
      expect(window.location.search).toBe('');
    },
  );

  it('AC2 — si el canje REVIENTA en vez de contestar, se monta IGUAL y se dice (issue 56)', async () => {
    laBarraDice('?code=un-codigo&state=un-estado');
    vi.spyOn(identidad, 'canjearSiVuelve').mockRejectedValue(new Error('sessionStorage no disponible'));
    const montar = vi.fn();

    await arrancar(montar, EN_DEMOSTRACION);

    expect(montar, 'la excepcion del canje dejo la pagina en blanco').toHaveBeenCalledTimes(1);
    expect(vueltaFallida()).toEqual({
      estado: 'fallo',
      motivo: { clave: TEXTOS_DEL_EMISOR.vueltaInesperada },
      detalle: { clave: TEXTOS_DEL_EMISOR.vueltaInesperadaDetalle, valores: { mensaje: 'sessionStorage no disponible' } },
    });
    // La libreria no llego a limpiar la barra: con el `?code=` puesto, recargar reventaria igual.
    expect(window.location.search).toBe('');
  });

  it('y si revienta, tampoco se pregunta en silencio: se volvia del emisor', async () => {
    vi.spyOn(identidad, 'canjearSiVuelve').mockRejectedValue(new Error('x'));
    const silencio = silencioQueContesta({ estado: 'identificado' });

    await arrancar(vi.fn(), { ...CON_PLATAFORMA, silencio });

    expect(silencio.intentar).not.toHaveBeenCalled();
  });

  /** El canje de la libreria contestando lo que se le diga, con la ida guardada como la guarda ella. */
  function vueltaConCodigo(): void {
    sessionStorage.setItem('kamayuk.ciudadano.pkce.verificador', 'un-verificador');
    sessionStorage.setItem('kamayuk.ciudadano.pkce.estado', 'un-estado');
    laBarraDice('?code=un-codigo&state=un-estado');
  }

  it.each([
    [
      'la vuelta no cuadra con la ida',
      () => laBarraDice('?code=un-codigo&state=otro-estado'),
      { motivo: { clave: TEXTOS_DEL_EMISOR.vueltaNoCuadra }, detalle: { clave: TEXTOS_DEL_EMISOR.vueltaNoCuadraDetalle } },
    ],
    [
      'el canje no llega',
      () => {
        vueltaConCodigo();
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
      },
      { motivo: { clave: TEXTOS_DEL_EMISOR.noContesto }, detalle: { clave: TEXTOS_DEL_EMISOR.canjeNoLlego } },
    ],
    [
      'el emisor rechaza el canje',
      () => {
        vueltaConCodigo();
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 400 }))));
      },
      { motivo: { clave: TEXTOS_DEL_EMISOR.rechazo }, detalle: { clave: TEXTOS_DEL_EMISOR.rechazoDetalle, valores: { estado: '400' } } },
    ],
    [
      'el canje vuelve sin token',
      () => {
        vueltaConCodigo();
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"id_token":"x"}', { status: 200 }))));
      },
      { motivo: { clave: TEXTOS_DEL_EMISOR.sinToken }, detalle: { clave: TEXTOS_DEL_EMISOR.sinTokenDetalle } },
    ],
  ])('una vuelta fallida de la libreria —%s— sale con claves del portal (issue 56)', async (_caso, preparar, esperado) => {
    preparar();

    await arrancar(vi.fn(), EN_DEMOSTRACION);

    expect(vueltaFallida()).toEqual({ estado: 'fallo', ...esperado });
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
    const fallo = {
      estado: 'fallo',
      motivo: { clave: TEXTOS_DEL_EMISOR.noContesto },
      detalle: { clave: TEXTOS_DEL_EMISOR.noContestoDetalle, valores: { segundos: '8' } },
    } as const;

    await arrancar(montar, { ...CON_PLATAFORMA, silencio: silencioQueContesta(fallo) });

    expect(montar, 'sin montar, la pagina se queda en blanco').toHaveBeenCalledTimes(1);
    expect(preguntaFallida()).toEqual(fallo);
    // Y no es una vuelta fallida: nadie volvio de ningun sitio (revision del PR #45).
    expect(vueltaFallida()).toBeNull();
  });

  it('si preguntar REVIENTA en vez de contestar, se monta IGUAL y se dice (revision del PR #45)', async () => {
    // `crypto.subtle` que lanza, un `appendChild` que falla, un `id_token` raro: sin el `catch`, la
    // excepcion saltaba el `montar()` y la pagina se quedaba en blanco.
    const montar = vi.fn();
    const silencio = { intentar: vi.fn(() => Promise.reject(new Error('digest no disponible'))) };

    await arrancar(montar, { ...CON_PLATAFORMA, silencio });

    expect(montar, 'la excepcion dejo la pagina en blanco').toHaveBeenCalledTimes(1);
    expect(preguntaFallida()).toEqual({
      estado: 'fallo',
      motivo: { clave: TEXTOS_DEL_EMISOR.inesperado },
      detalle: { clave: TEXTOS_DEL_EMISOR.inesperadoDetalle, valores: { mensaje: 'digest no disponible' } },
    });
  });

  it('cada pasada vuelve a fijar la pregunta fallida: no se arrastra la de antes', async () => {
    await arrancar(vi.fn(), { ...CON_PLATAFORMA, silencio: { intentar: vi.fn(() => Promise.reject(new Error('x'))) } });
    expect(preguntaFallida()).not.toBeNull();

    await arrancar(vi.fn(), EN_DEMOSTRACION);

    expect(preguntaFallida()).toBeNull();
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
