import { afterEach, describe, expect, it, vi } from 'vitest';

import { identidad } from './api/identidad.ts';
import { arrancar } from './arranque.ts';
import { emisorFalso, marcosEnLaPagina, sinSesion } from './pruebas/emisorFalso.ts';

/**
 * **AC3 — el canje silencioso ocurre UNA vez por carga, y ninguna carga encadena otra** (issue 35).
 *
 * En su propio archivo, y con el canje silencioso DEL PORTAL —el de modulo, sin inyectar—, porque lo
 * que se mide es justo esa instancia: Vitest evalua los modulos de nuevo en cada archivo, asi que
 * este archivo ES una carga. En `arranque.test.ts` cada caso inyecta uno nuevo y esto no se veria.
 *
 * El bucle que se teme es el de las redirecciones: arrancar → ir al emisor → volver → arrancar → ir…
 * Con el marco no puede haberlo, porque la pagina no se va; lo que queda por medir es que dos pasadas
 * del arranque en la misma carga no abran dos marcos, y que ninguna cambie la barra de direcciones.
 */

afterEach(() => {
  identidad.fijarToken(null);
  vi.unstubAllGlobals();
});

describe('una pregunta por carga', () => {
  it('dos pasadas del arranque abren UN marco, y la barra de direcciones no se mueve', async () => {
    window.history.replaceState(null, '', '/portal/#/deudas');
    const antes = window.location.href;
    const emisor = emisorFalso(sinSesion());
    const montar = vi.fn();

    await arrancar(montar, { conPlataforma: true });
    await arrancar(montar, { conPlataforma: true });
    emisor.soltar();

    expect(emisor.pedidas, 'el arranque volvio a preguntar en la misma carga').toHaveLength(1);
    expect(montar).toHaveBeenCalledTimes(2);
    expect(marcosEnLaPagina()).toBe(0);
    expect(window.location.href).toBe(antes);
  });
});
