// @vitest-environment node
//
// Lee el DISCO y nada mas. Y NO importa ni una sola cosa que pueda faltar: es su unico trabajo
// poder hablar cuando algo falta.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ARTBOARDS, rutaDe } from './artboards.ts';

/**
 * **Los artboards vendorizados estan, son de verdad y son los entregados** (rentas#78).
 *
 * Portada de `rentas`. Alli nacio porque cuatro barreras leian el artboard en el top-level del
 * modulo: el dia que el archivo no estuviera, morian durante la RECOLECCION con un `ENOENT` y sus
 * 77 `it` no llegaban a existir. Aqui todavia no hay barreras que lo lean —llegan con las
 * pantallas—, y por eso esta guarda va primero: cuando lleguen, el rojo que diga que falta el
 * artboard ya estara escrito.
 *
 * <h2>Por que este archivo no importa nada que pueda faltar</h2>
 *
 * Es la leccion de rentas#74: la guarda que avisa de que algo falta **no puede depender de ese
 * algo**, o muere con el y se calla justo cuando tiene que hablar.
 */

describe('los artboards vendorizados estan', () => {
  it('EL CENTINELA: hay artboards declarados que comprobar', () => {
    // Sin esto, todo lo de abajo pasaria sobre la lista vacia el dia que alguien la vacie — que
    // es como una guarda se queda sin sujeto y sigue en verde.
    expect(ARTBOARDS.map((a) => a.archivo)).toEqual([
      'diseno/Ciudadano.dc.html',
      'diseno/escudo-catacaos.png',
    ]);
  });

  it.each(ARTBOARDS.map((a) => [a.archivo, a] as const))('%s esta, y no esta vacio', (_n, a) => {
    const ruta = rutaDe(a);

    expect(
      existsSync(ruta),
      `FALTA UN ARTBOARD VENDORIZADO: ${a.archivo}\n\n` +
        `  Que dibuja: ${a.que}\n` +
        `  De donde se trae: ${a.deDonde}\n\n` +
        '  Sin el, las barreras que lo lean mueren durante la RECOLECCION y sus pruebas no\n' +
        '  llegan a existir. Este mensaje es lo que se pone en su lugar.',
    ).toBe(true);

    // Y que no este vacio: un archivo de cero bytes existe, pasa el `existsSync`, y deja cualquier
    // analizador devolviendo listas vacias, en verde.
    expect(statSync(ruta).size, `${a.archivo} esta vacio`).toBeGreaterThan(1024);
  });

  it('y el `.dc.html` es un artboard de verdad, no una pagina cualquiera', () => {
    // La forma minima de un artboard de Claude Design: el bloque `<x-dc>` con la plantilla y el
    // guion `text/x-dc` con la clase `Component`. Un archivo que exista, pese algo y no sea un
    // artboard dejaria a cualquier guarda que lo lea devolviendo vacio, en verde.
    for (const a of ARTBOARDS.filter((x) => x.archivo.endsWith('.dc.html'))) {
      const html = readFileSync(rutaDe(a), 'utf8');
      expect(html, `${a.archivo} no trae el bloque <x-dc>`).toContain('<x-dc>');
      expect(html, `${a.archivo} no trae su guion`).toContain('type="text/x-dc"');
    }
  });

  it.each(ARTBOARDS.map((a) => [a.archivo, a] as const))(
    '%s es BYTE A BYTE la copia entregada',
    (_n, a) => {
      const huella = createHash('sha256').update(readFileSync(rutaDe(a))).digest('hex');

      expect(
        huella,
        `${a.archivo} ya no es la copia que se vendorizo.\n` +
          '  Un artboard retocado a mano deja de ser la referencia sin que nada mas lo diga. Si el\n' +
          `  diseno cambio de verdad, se trae la version nueva de ${a.deDonde}\n` +
          '  y se actualiza su `huella` en `verificaciones/artboards.ts` en el mismo commit.',
      ).toBe(a.huella);
    },
  );
});
