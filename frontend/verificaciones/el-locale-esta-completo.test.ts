import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';

/**
 * **El locale tiene todas las claves, y ninguna se aparta de la suya** (rentas#103, AC5).
 *
 * Portada de `rentas/frontend/verificaciones/el-locale-esta-completo.test.ts`.
 *
 * <h2>Las dos direcciones, y por que hacen falta las dos</h2>
 *
 * · **Ninguna clave usada falta del locale.** Sin esto, un segundo idioma se haria copiando un
 *   archivo incompleto y la pantalla saldria **a medias**: unas frases traducidas y otras en
 *   castellano, que parece un defecto de la traduccion y es del inventario.
 * · **Ningun valor se aparta de su clave.** El castellano esta en dos sitios —el codigo y el
 *   locale— y el artboard manda sobre el primero. Cada valor **tiene que ser igual a su clave**,
 *   asi que el locale no puede decir algo distinto del artboard sin ponerse rojo.
 *
 * <h2>Lo que cambia respecto a `rentas`: de donde salen las claves</h2>
 *
 * En `rentas` la mayoria sale DERIVADA de las 40 definiciones de pantalla (`catalogo-de-claves.ts`)
 * y el resto es una lista de literales. Aqui no hay definiciones todavia: **todas son literales**,
 * las que el codigo escribe como `t('…')`. Que el codigo no use una clave que esta lista no tiene lo
 * dice `i18next-cli status` —`yarn i18n`, dentro de `yarn verificar`—; que la lista y el locale
 * cuadren, esta guarda. Cuando lleguen las pantallas con sus datos, la lista se derivara como alli.
 *
 * <h2>Y por que el locale se REGENERA en vez de escribirse</h2>
 *
 * Porque sale de esta lista: a mano se queda viejo a la primera frase nueva.
 * `yarn i18n:regenerar` lo vuelve a escribir.
 */

const LOCALE = join(RAIZ, 'src/i18n/locales/es.json');

/** Las claves que el codigo escribe como `t('…')`. Los textos son los del artboard, tal cual. */
const LITERALES = [
  // `diseno/Ciudadano.dc.html`, linea 65: el titulo de la barra.
  'Pago de tributos en línea',
  // `diseno/Ciudadano.dc.html`, linea 692: el valor por omision de la prop `entidad`.
  'Municipalidad Distrital de Catacaos',
] as const;

/** Lo que tiene que decir cada forma plural. Hoy no hay ninguna; el mecanismo es el de `rentas`. */
const PLURALES: Readonly<Record<string, string>> = {};

function elQueDeberiaSer(): Readonly<Record<string, string>> {
  const claves = [...new Set(LITERALES)].sort((a, b) => a.localeCompare(b, 'es'));
  return Object.fromEntries(claves.map((c) => [c, PLURALES[c] ?? c]));
}

describe('el locale `es` esta completo y no se aparta', () => {
  const esperado = elQueDeberiaSer();

  if (process.env.KAMAYUK_REGENERAR === '1') {
    writeFileSync(LOCALE, `${JSON.stringify(esperado, null, 2)}\n`, 'utf8');
  }

  const enDisco = JSON.parse(readFileSync(LOCALE, 'utf8')) as Record<string, string>;

  it('EL CENTINELA: la lista trae las claves del marcador', () => {
    // Sin esto, una lista vaciada haria que «no falta ninguna» pasara en verde sobre la nada.
    expect(Object.keys(esperado), 'la lista de claves vino corta').toEqual(
      expect.arrayContaining(['Pago de tributos en línea', 'Municipalidad Distrital de Catacaos']),
    );
  });

  it('no falta ninguna clave, y no sobra ninguna', () => {
    const faltan = Object.keys(esperado).filter((c) => !(c in enDisco));
    const sobran = Object.keys(enDisco).filter((c) => !(c in esperado));
    expect(
      { faltan: faltan.slice(0, 8), sobran: sobran.slice(0, 8) },
      'El locale `es` dejo de cuadrar con lo que el portal dice.\n' +
        '  Se regenera con:  yarn i18n:regenerar',
    ).toEqual({ faltan: [], sobran: [] });
  });

  it('y NINGUN valor se aparta de su clave, salvo los plurales', () => {
    const apartados = Object.entries(enDisco)
      .filter(([clave, valor]) => valor !== (PLURALES[clave] ?? clave))
      .map(([clave, valor]) => `  «${clave}» dice «${valor}»`);
    expect(
      apartados,
      'Hay entradas del locale que dicen algo distinto de su clave:\n' +
        `${apartados.join('\n')}\n\n` +
        '  El castellano esta en dos sitios —el codigo y el locale— y el artboard manda sobre el\n' +
        '  primero. Si el locale puede decir otra cosa, la pantalla se aparta del artboard.',
    ).toEqual([]);
  });
});
