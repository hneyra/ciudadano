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
    expect(politica.recorrido.pasos).toContain(politica.recorrido.primerPaso.sinSesion);
    expect(politica.recorrido.pasos).toContain(politica.recorrido.primerPaso.conSesion);
  });

  it('y ese paso es alcanzable: el enrutador no redirige en circulo', () => {
    for (const autenticado of [false, true]) {
      const estado = alEmpezar(politica, autenticado);
      expect(pasoAlcanzable(estado, estado.paso), `con sesion: ${String(autenticado)}`).toBe(true);
      expect(ultimoAlcanzable(estado)).toBe(estado.paso);
    }
  });

  it('con sesion no vuelve a `entrar`, que no se repite', () => {
    expect(politica.recorrido.primerPaso.conSesion).not.toBe('entrar');
  });
});

/**
 * **La politica pregunta; no nombra el modo** (revision del PR #70, issue 60).
 *
 * Hasta el issue 60, `deuda: 'de-la-consulta'`, `sesion: 'del-emisor'` y `capacidades:
 * 'las-de-la-plataforma'` eran el nombre del modo escrito en un valor: preguntar por ellos era
 * preguntar el modo con otras palabras, y `deuda` contestaba a la vez preguntas distintas (la fila
 * «Reajuste», las secciones de «Mis pagos»). Ahora la politica se agrupa por de que trata y cada campo
 * es una pregunta con su respuesta.
 */
describe('la politica se nombra por las preguntas que contesta', () => {
  /** Las hojas de un valor, con su camino: `contenido.capacidades.0 = 'pagar-en-linea'`. */
  function hojas(valor: unknown, camino: string): [string, unknown][] {
    if (valor !== null && typeof valor === 'object') {
      return Object.entries(valor).flatMap(([clave, dentro]) => hojas(dentro, camino === '' ? clave : `${camino}.${clave}`));
    }
    return [[camino, valor]];
  }

  it.each(Object.entries(POLITICAS))('«%s» se agrupa en recorrido, sesion, cobro y contenido', (_modo, politica) => {
    expect(Object.keys(politica).sort()).toEqual(['cobro', 'contenido', 'recorrido', 'sesion']);
  });

  it.each(Object.entries(POLITICAS))('y ningun valor de «%s» es el nombre de un modo', (_modo, politica) => {
    // Un valor que dice «artboard», «plataforma», «demostracion», «consulta» o «emisor» no contesta
    // una pregunta: dice en que modo se esta. Los pasos y las capacidades son otra cosa y pasan.
    const conNombreDeModo = hojas(politica, '')
      .filter(([, valor]) => typeof valor === 'string' && /artboard|plataforma|demostraci|consulta|emisor/i.test(valor))
      .map(([camino, valor]) => `${camino} = ${String(valor)}`);
    expect(conNombreDeModo).toEqual([]);
  });
});
