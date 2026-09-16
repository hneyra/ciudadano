import { afterEach, describe, expect, it } from 'vitest';

import { claimsDe, claimsDelCiudadano, haySesion } from './claims.ts';
import { identidad } from './identidad.ts';

/**
 * **Quien entro, leido del token** (issue 27).
 *
 * Los claims que se leen son los del realm `kamayuk-ciudadano` —`tipo_documento` y
 * `numero_documento`— y el nombre. Lo que esta prueba mide, ademas de que se lean, es **que nada de
 * esto pueda reventar la barra**: un token con otra forma, sin cuerpo o con basura dentro tiene que
 * contestar «no sabemos quien es», no lanzar.
 */

/** Un JWT de mentira con ese cuerpo: base64url, sin relleno, y una firma que nadie comprueba aqui. */
function tokenCon(cuerpo: Record<string, unknown>): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  return `${base64url('{"alg":"RS256"}')}.${base64url(JSON.stringify(cuerpo))}.firma-de-mentira`;
}

afterEach(() => {
  identidad.fijarToken(null);
});

describe('claimsDe', () => {
  it('lee el nombre y el documento del realm del ciudadano', () => {
    const token = tokenCon({
      name: 'María E. Castillo',
      tipo_documento: 'DNI',
      numero_documento: '44218937',
    });

    expect(claimsDe(token)).toEqual({
      nombre: 'María E. Castillo',
      tipoDeDocumento: 'DNI',
      numeroDeDocumento: '44218937',
    });
  });

  it('EL ACENTO: el nombre llega en UTF-8, y no como «MarÃ­a»', () => {
    // `atob` devuelve una cadena de BYTES. Sin `TextDecoder`, «María» sale «MarÃ­a» en la barra, que
    // es el sitio donde mas se ve y el que nadie prueba.
    expect(claimsDe(tokenCon({ name: 'María Ñañez' })).nombre).toBe('María Ñañez');
  });

  it('sin `name`, compone con `given_name` y `family_name`', () => {
    expect(claimsDe(tokenCon({ given_name: 'María', family_name: 'Castillo' })).nombre).toBe('María Castillo');
  });

  it('un claim en blanco es un claim que no vino', () => {
    expect(claimsDe(tokenCon({ name: '   ', tipo_documento: '', numero_documento: '44218937' }))).toEqual({
      nombre: null,
      tipoDeDocumento: null,
      numeroDeDocumento: '44218937',
    });
  });

  it('y lo que no es un token no revienta: contesta que no se sabe quien es', () => {
    for (const malo of [null, '', 'no-es-un-jwt', 'a.b', 'a.$$$.c', `${'a.'}${btoa('[1,2,3]')}.c`]) {
      expect(claimsDe(malo), `«${String(malo)}» deberia dar unos claims vacios`).toEqual({
        nombre: null,
        tipoDeDocumento: null,
        numeroDeDocumento: null,
      });
    }
  });
});

describe('claimsDelCiudadano y haySesion', () => {
  it('leen el token que tiene la puerta AHORA, no una copia', () => {
    expect(haySesion()).toBe(false);
    expect(claimsDelCiudadano().nombre).toBeNull();

    identidad.fijarToken(tokenCon({ name: 'Rufina Medina', tipo_documento: 'DNI', numero_documento: '03593174' }));

    expect(haySesion()).toBe(true);
    expect(claimsDelCiudadano()).toEqual({
      nombre: 'Rufina Medina',
      tipoDeDocumento: 'DNI',
      numeroDeDocumento: '03593174',
    });

    identidad.fijarToken(null);
    expect(haySesion()).toBe(false);
  });
});
