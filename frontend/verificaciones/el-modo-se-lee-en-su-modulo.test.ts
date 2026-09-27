// @vitest-environment node
//
// Compila el arbol con el compilador de TypeScript. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  MODULO_DEL_MODO,
  archivoDeMuestra,
  archivosDelPortal,
  esDelModulo,
  lecturasDelModo,
} from './lecturas-del-modo.ts';

/**
 * **El modo —demostracion o plataforma— solo se lee en el modulo que lo define** (issue 59).
 *
 * Lo que es «leer el modo», y lo que la guarda no ve, esta en la cabecera de `lecturas-del-modo.ts`,
 * que es quien juzga. Aqui se dice DONDE se permite: en `src/modo/`, y en ningun otro sitio. Una
 * pantalla que necesita saber algo que depende del modo se lo pregunta a la politica (`useModo()`),
 * y un modo nuevo es una politica nueva, no un `if` mas en cada archivo.
 *
 * El 2026-09-27, sobre `main` (`74c1442a`), esta guarda contaba **60 lecturas** fuera del modulo,
 * todas del booleano —`conPlataforma` y `hayPlataforma`— y repartidas por **13 archivos**: el reductor
 * (14), su proveedor (9), «Pagar» (8), la barra (7), «Mis pagos» (6), el arranque (5), el montaje
 * (3), el comprobante (2), su sello, el paso 2 (2), la portada, el pie y la fuente. (Contando tambien
 * los comentarios, `grep` daba 57 `conPlataforma` y 17 `hayPlataforma`.) Despues del issue 59, 0.
 *
 * La muestra (`verificaciones/el-modo/muestra.ts`) trae una linea por forma que se senala y, al
 * lado, lo que se le parece y no es leer el modo: el `modo` del tema, escribir el discriminante en
 * un literal, preguntar a la politica.
 */

const MUESTRA = 'verificaciones/el-modo/muestra.ts';

// UN programa del compilador para todo: el portal y la muestra (los tipos se resuelven juntos).
const archivos = archivosDelPortal();
const todas = lecturasDelModo([...archivos, archivoDeMuestra(MUESTRA)]);
const delPortal = todas.filter((l) => l.ruta !== MUESTRA);
const deLaMuestra = todas.filter((l) => l.ruta === MUESTRA);

/** Las lineas de la muestra marcadas con `// senala`: las que la guarda tiene que encontrar. */
function lineasMarcadas(): number[] {
  // Se leen del propio archivo para que anadir una forma a la muestra no obligue a tocar esta lista.
  const fuente = readFileSync(archivoDeMuestra(MUESTRA).archivo, 'utf8');
  return fuente.split('\n').flatMap((linea, i) => (/\/\/ senala\b/.test(linea) ? [i + 1] : []));
}

describe('el modo se lee en su modulo', () => {
  it('mira el codigo de produccion de src/, con el modulo del modo, sin pruebas ni su andamiaje', () => {
    // El centinela de «donde se mira»: una guarda que no leyera las pantallas saldria limpia.
    const rutas = archivos.map((a) => a.ruta);
    expect(rutas).toContain('src/marco/Barra.tsx');
    expect(rutas).toContain('src/pasos/comprobante/Comprobante.tsx');
    expect(rutas).toContain('src/recorrido/recorrido.ts');
    expect(rutas.filter((r) => r.startsWith('src/pruebas/') || /\.test\.tsx?$/.test(r))).toEqual([]);
    expect(rutas.some(esDelModulo), `sin ningun archivo en ${MODULO_DEL_MODO}`).toBe(true);
  });

  it('fuera de src/modo/ no hay ni una lectura', () => {
    const fuera = delPortal.filter((l) => !esDelModulo(l.ruta)).map((l) => `  ${l.ruta}:${String(l.linea)} ${l.forma}`);
    expect(
      fuera,
      `Hay ${String(fuera.length)} lecturas del modo fuera de ${MODULO_DEL_MODO}:\n${fuera.join('\n')}\n\n` +
        '  Lo que dependa del modo se le pregunta a la politica (`useModo()` en una pantalla,\n' +
        '  `estado.politica` en el reductor). Si hace falta una pregunta nueva, es un campo nuevo de\n' +
        '  `PoliticaDelModo`, contestado en cada modo.',
    ).toEqual([]);
  });

  it('y la guarda ve cada forma de la muestra, y ninguna de las que solo se le parecen', () => {
    expect(deLaMuestra.map((l) => l.linea)).toEqual(lineasMarcadas());
  });
});
