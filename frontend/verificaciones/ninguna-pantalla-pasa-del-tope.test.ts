// @vitest-environment node
//
// Lee archivos del disco y cuenta lineas. No es un DOM lo que necesita.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';

/**
 * **Ninguna pantalla pasa de 300 lineas** (issue 60).
 *
 * El 2026-09-27, sobre `main` (`8bbeec58`), las pantallas del recorrido median `Historial.tsx` 704
 * lineas, `Pagar.tsx` 598, `LaConsulta.tsx` 566, `Deudas.tsx` 473, `Comprobante.tsx` 444 e
 * `Identificar.tsx` 361; y `Deudas.tsx` y `LaConsulta.tsx` repetian 106 lineas de codigo literales
 * —quien es, el concepto, la barra de pago, la cabecera de la lista—, que ya habian empezado a decir
 * cosas distintas (la amnistia de la barra se preguntaba de dos formas). Un archivo de 700 lineas no
 * se lee de una vez, y lo que no se lee de una vez se copia en vez de reutilizarse.
 *
 * <h2>Que se mide</h2>
 *
 * Las lineas de cada archivo de PRODUCCION de `src/pasos/` —las pantallas y lo que se parte de ellas:
 * sus piezas, sus ganchos y sus modelos de vista— y de `src/piezas/`, que es a donde va lo que dos
 * pantallas comparten. Sin `src/piezas/`, partir una pantalla podria ser mudar sus 700 lineas a una
 * «pieza» y dejar la guarda verde. Las lineas se cuentan como `wc -l`, comentarios incluidos: la
 * cabecera de cada pantalla es parte de lo que hay que leer.
 *
 * <h2>Las excepciones</h2>
 *
 * Se escriben en `EXCEPCIONES`, con su porque, y **caducan solas**: una excepcion de un archivo que
 * ya no existe, o que ya no pasa del tope, pone la guarda roja hasta que se quita. Asi la lista no
 * se queda de adorno el dia que el archivo se parte.
 */

/** El tope, en lineas. El issue dice «~300»: se toma al pie de la letra. */
const TOPE = 300;

/** Donde viven las pantallas y lo que comparten. */
const DIRECTORIOS = ['src/pasos', 'src/piezas'] as const;

/**
 * **Los archivos que pueden pasar del tope, y por que.** Crecer esta lista es una decision que se
 * justifica aqui, no un descuido.
 */
/** Mientras se parten, pantalla a pantalla. */
const PARTIENDOSE = 'Se parte en el issue 60, en este mismo PR: la excepcion caduca sola cuando baje del tope.';

const EXCEPCIONES: Readonly<Record<string, string>> = {
  'src/pasos/comprobante/Comprobante.tsx': PARTIENDOSE,
  'src/pasos/historial/Historial.tsx': PARTIENDOSE,
  'src/pasos/identificar/Identificar.tsx': PARTIENDOSE,
};

/** Los `.ts`/`.tsx` de produccion de un directorio, con su ruta relativa al frontend. */
function deProduccion(directorio: string): string[] {
  return readdirSync(join(RAIZ, directorio)).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(join(RAIZ, ruta)).isDirectory()) return deProduccion(ruta);
    return /\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada) ? [ruta] : [];
  });
}

/** Las lineas de un archivo, como las cuenta `wc -l`: los saltos de linea. */
function lineasDe(texto: string): number {
  return (texto.match(/\n/g) ?? []).length;
}

const ARCHIVOS = DIRECTORIOS.flatMap((directorio) => deProduccion(directorio));
const LINEAS = new Map(ARCHIVOS.map((ruta) => [ruta, lineasDe(readFileSync(join(RAIZ, ruta), 'utf8'))]));

describe('ninguna pantalla pasa del tope', () => {
  it('EL CENTINELA: se leen las pantallas y sus piezas, y se cuentan como `wc -l`', () => {
    // Sin esto, un directorio movido dejaria la lista vacia y la guarda verde sobre la nada.
    expect(ARCHIVOS).toContain('src/pasos/deudas/Deudas.tsx');
    expect(ARCHIVOS).toContain('src/pasos/historial/Historial.tsx');
    expect(ARCHIVOS).toContain('src/piezas/AvisoConFilo.tsx');
    expect(ARCHIVOS.filter((ruta) => /\.test\.tsx?$/.test(ruta))).toEqual([]);
    expect(lineasDe('una\ndos\n')).toBe(2);
    expect(lineasDe('sin salto final')).toBe(0);
  });

  it(`ningun archivo pasa de ${String(TOPE)} lineas, salvo los de EXCEPCIONES`, () => {
    const largos = [...LINEAS]
      .filter(([ruta, lineas]) => lineas > TOPE && !(ruta in EXCEPCIONES))
      .map(([ruta, lineas]) => `  ${ruta}: ${String(lineas)} lineas`);
    expect(
      largos,
      `Hay archivos de mas de ${String(TOPE)} lineas:\n${largos.join('\n')}\n\n` +
        '  Se parten: un modelo de vista puro (lo que se dibuja, sin React) y su presentacion, y lo que\n' +
        '  dos pantallas repiten, a una pieza comun. Si de verdad no se puede, va a EXCEPCIONES con su porque.',
    ).toEqual([]);
  });

  it('y cada excepcion sigue haciendo falta, y dice por que', () => {
    const caducadas = Object.entries(EXCEPCIONES).flatMap(([ruta, porque]) => {
      if (!existsSync(join(RAIZ, ruta))) return [`  ${ruta}: ya no existe`];
      const lineas = LINEAS.get(ruta) ?? 0;
      if (lineas <= TOPE) return [`  ${ruta}: mide ${String(lineas)} lineas, ya no pasa del tope`];
      if (porque.trim().length < 40) return [`  ${ruta}: la excepcion no dice por que`];
      return [];
    });
    expect(caducadas, `Excepciones que hay que quitar o justificar:\n${caducadas.join('\n')}`).toEqual([]);
  });
});
