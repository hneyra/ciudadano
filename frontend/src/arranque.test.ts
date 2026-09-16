import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { identidad } from './api/identidad.ts';
import { arrancar, entrar, salir, vueltaFallida } from './arranque.ts';

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

    await arrancar(montar);

    expect(montar).toHaveBeenCalledTimes(1);
    expect(vueltaFallida()).toBeNull();
  });

  it('NO va a la puerta aunque no haya token: el portal abre en demostracion', async () => {
    // Es la diferencia con `rentas` y `catastro`, y es la decision del issue: ahi sin token no hay
    // nada que ensenar; aqui el recorrido entero funciona sin plataforma.
    const aLaPuerta = vi.spyOn(identidad, 'entrar');
    const red = vi.fn();
    vi.stubGlobal('fetch', red);

    await arrancar(vi.fn());

    expect(identidad.token()).toBeNull();
    expect(aLaPuerta).not.toHaveBeenCalled();
    expect(red, 'el arranque salio a la red sin que nadie se lo pidiera').not.toHaveBeenCalled();
  });

  it('y sin `?code=` ni `?error=` no toca el almacenamiento', async () => {
    // `canjearSiVuelve()` mira la barra y vuelve. Si tocara `sessionStorage` en el camino normal,
    // el arnes y las pruebas estarian midiendo un portal distinto del que ven.
    await arrancar(vi.fn());

    expect(sessionStorage.length).toBe(0);
  });

  it('el montaje es LO ULTIMO: el canje ya termino cuando React monta', async () => {
    const orden: string[] = [];
    vi.spyOn(identidad, 'canjearSiVuelve').mockImplementation(async () => {
      await Promise.resolve();
      orden.push('canje');
      return { estado: 'sin-vuelta' };
    });

    await arrancar(() => orden.push('montar'));

    expect(orden).toEqual(['canje', 'montar']);
  });
});

describe('la vuelta del emisor', () => {
  it('cuando se canja, deja el token y no hay nada que explicar', async () => {
    vi.spyOn(identidad, 'canjearSiVuelve').mockResolvedValue({ estado: 'canjeado' });
    const montar = vi.fn();

    await arrancar(montar);

    expect(vueltaFallida()).toBeNull();
    expect(montar).toHaveBeenCalledTimes(1);
  });

  it('cuando falla, se monta IGUAL y se dice por que', async () => {
    // El emisor contesta con `?error=` en la barra; la libreria lo traduce y limpia la URL.
    laBarraDice('?error=access_denied&error_description=El+usuario+cancelo');

    const montar = vi.fn();
    await arrancar(montar);

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
    await arrancar(vi.fn());
    expect(vueltaFallida()).not.toBeNull();

    laBarraDice('');
    await arrancar(vi.fn());

    expect(vueltaFallida()).toBeNull();
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
