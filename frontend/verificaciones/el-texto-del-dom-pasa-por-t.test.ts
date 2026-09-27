import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';

/**
 * **Fuera de React no se escribe texto en la pagina, salvo donde se dice** (issue 56).
 *
 * La regla «todo texto visible pasa por `t()`» la vigilan, para lo que se dibuja con React, las
 * pruebas con el idioma `marcado` y `i18next-cli`. Lo que ninguna de las dos ve es el texto escrito
 * **con el DOM a pelo** —`textContent`, `innerHTML`, `createTextNode`…—: no es JSX, no es un `t()`, y
 * una prueba de pantalla solo lo encuentra si alguien se acuerda de montarlo.
 *
 * Hasta el issue 56 no habia ninguno. Desde entonces hay uno, y a proposito: el aviso de
 * `src/inicio.ts`, que se dibuja cuando el portal no llego a cargar y por tanto **no puede contar con
 * i18next**, que puede ser justo lo que no llego. Esta guarda lo nombra como excepcion, con su
 * motivo, en vez de dejar que la regla lo ignore sin decirlo; y se pone roja si aparece otro.
 */

/**
 * **Las excepciones, cada una con su motivo.** Anadir una es una decision que se escribe aqui, no un
 * descuido que pasa en verde.
 */
const EXCEPCIONES: Readonly<Record<string, string>> = {
  'src/inicio.ts':
    'el aviso de «No se pudo cargar el portal»: se dibuja cuando el trozo del portal —React, i18next— ' +
    'no llego, asi que no puede depender de `t()`. Va en castellano, el idioma del portal y de sus claves.',
};

/** Las formas de escribir texto en la pagina sin pasar por React. */
const ESCRIBE_TEXTO: readonly RegExp[] = [
  /\.(textContent|innerText|innerHTML|outerHTML)\s*=(?!=)/,
  /\bcreateTextNode\s*\(/,
  /\binsertAdjacent(HTML|Text)\s*\(/,
  /\bdocument\.write(ln)?\s*\(/,
];

/** Las lineas que escriben texto en la pagina, sin los comentarios (que lo nombran para explicarlo). */
function lineasQueEscribenTexto(fuente: string): readonly number[] {
  return fuente
    .split('\n')
    .map((linea, i) => [linea, i + 1] as const)
    .filter(([linea]) => !/^\s*(\*|\/\/|\/\*)/.test(linea))
    .filter(([linea]) => ESCRIBE_TEXTO.some((forma) => forma.test(linea)))
    .map(([, numero]) => numero);
}

/** El codigo de produccion de `src/`: sin pruebas y sin el andamiaje con que se montan. */
function deProduccion(desde = join(RAIZ, 'src')): readonly string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return entrada === 'pruebas' ? [] : deProduccion(ruta);
    return /\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada) ? [relative(RAIZ, ruta)] : [];
  });
}

const hallazgos = deProduccion()
  .map((ruta) => [ruta, lineasQueEscribenTexto(readFileSync(join(RAIZ, ruta), 'utf8'))] as const)
  .filter(([, lineas]) => lineas.length > 0);

describe('el texto que se escribe fuera de React', () => {
  it('solo se escribe en las excepciones declaradas', () => {
    const fuera = hallazgos.filter(([ruta]) => !(ruta in EXCEPCIONES)).map(([ruta, lineas]) => `${ruta}:${lineas.join(',')}`);

    expect(
      fuera,
      'Estos archivos escriben texto en la pagina con el DOM, sin React y sin `t()`. Si de verdad no ' +
        'pueden usar `t()`, declaralos en EXCEPCIONES con su motivo',
    ).toEqual([]);
  });

  it('y cada excepcion sigue haciendo falta: una que ya no escribe nada se quita', () => {
    const conHallazgo = new Set(hallazgos.map(([ruta]) => ruta));
    expect(Object.keys(EXCEPCIONES).filter((ruta) => !conHallazgo.has(ruta))).toEqual([]);
  });

  it('el detector ve cada forma, y no las menciones en un comentario', () => {
    const MUESTRA = [
      "caja.textContent = 'hola';",
      "caja.innerHTML = '<b>hola</b>';",
      "caja.append(document.createTextNode('hola'));",
      "caja.insertAdjacentText('beforeend', 'hola');",
      "document.write('hola');",
      '// caja.textContent = lo que sea: solo se nombra',
      ' * `innerHTML = …` en un docblock',
      "if (caja.textContent === 'hola') {}",
    ].join('\n');

    expect(lineasQueEscribenTexto(MUESTRA)).toEqual([1, 2, 3, 4, 5]);
  });
});
