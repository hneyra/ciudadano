import { describe, expect, it } from 'vitest';

import { DECISIONES_INICIALES, type EstadoDelRecorrido, SIN_DATOS, pasoAlcanzable, primerPaso, ultimoAlcanzable } from '../recorrido/recorrido.ts';
import { POLITICAS, type PoliticaDelModo } from './modo.ts';

/**
 * **Cada politica se sostiene sola** (revision del PR #70): el primer paso de cada modo, con sesion y
 * sin ella, esta en su franja y se puede alcanzar; y con sesion no es `entrar`, que no se repite.
 *
 * Recorre TODAS las de `POLITICAS`, no las dos de hoy escritas a mano: un modo nuevo entra aqui solo.
 * Es lo que evita que el enrutador redirija en circulo —`primerPaso` es a donde manda lo que no es
 * alcanzable (`ultimoAlcanzable`)— en un modo que nadie ha recorrido todavia.
 */

/** El estado de partida de una politica, sin nada leido, en su primer paso. */
function alEmpezar(politica: PoliticaDelModo, autenticado: boolean): EstadoDelRecorrido {
  const base: EstadoDelRecorrido = { ...DECISIONES_INICIALES, ...SIN_DATOS, politica, autenticado };
  return { ...base, paso: primerPaso(base) };
}

describe.each(Object.entries(POLITICAS))('la politica de «%s»', (_modo, politica) => {
  it('empieza, sin sesion y con ella, por un paso de su franja', () => {
    expect(politica.pasos).toContain(politica.primerPaso.sinSesion);
    expect(politica.pasos).toContain(politica.primerPaso.conSesion);
  });

  it('y ese paso es alcanzable: el enrutador no redirige en circulo', () => {
    for (const autenticado of [false, true]) {
      const estado = alEmpezar(politica, autenticado);
      expect(pasoAlcanzable(estado, estado.paso), `con sesion: ${String(autenticado)}`).toBe(true);
      expect(ultimoAlcanzable(estado)).toBe(estado.paso);
    }
  });

  it('con sesion no vuelve a `entrar`, que no se repite', () => {
    expect(politica.primerPaso.conSesion).not.toBe('entrar');
  });
});
