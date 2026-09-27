import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { fuenteDeMuestra, fuentesDelPortal, textoEnElDom } from './texto-en-el-dom.ts';

/**
 * **Fuera de React no se escribe texto en la pagina, salvo donde se dice** (issue 56).
 *
 * La regla «todo texto visible pasa por `t()`» la vigilan, para lo que se dibuja con React, las
 * pruebas con el idioma `marcado` e `i18next-cli`. Lo que ninguna de las dos ve es el texto escrito
 * **con el DOM a pelo** —`textContent`, `append('x')`, `new Text(…)`, `setAttribute('aria-label', …)`…—:
 * no es JSX, no es un `t()`, y una prueba de pantalla solo lo encuentra si alguien se acuerda de
 * montarlo.
 *
 * Hasta el issue 56 no habia ninguno. Desde entonces hay uno, y a proposito: el aviso de
 * `src/inicio.ts`, que se dibuja cuando el portal no llego a cargar y por tanto **no puede contar con
 * i18next**, que puede ser justo lo que no llego. Esta guarda lo nombra como excepcion, con su
 * motivo, en vez de dejar que la regla lo ignore sin decirlo; y se pone roja si aparece otro.
 *
 * **Que formas ve, donde mira y lo que NO ve** esta escrito en la cabecera de `texto-en-el-dom.ts`,
 * que es quien juzga: con el arbol y los tipos del compilador (revision del PR #66; la primera
 * version era una expresion regular por linea y no veia ni `append('x')` ni `new Text('x')`). Cada
 * forma tiene su linea en `texto-en-el-dom/muestra.ts`, y la muestra tambien trae lo que se les
 * parece y no escribe texto (`URLSearchParams.append`, `append(nodo)`, `setAttribute('role', …)`).
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

const MUESTRA = 'verificaciones/texto-en-el-dom/muestra.ts';

// UN programa del compilador para todo: el portal y la muestra (los tipos se resuelven juntos).
const fuentes = fuentesDelPortal();
const todos = textoEnElDom([...fuentes, fuenteDeMuestra(MUESTRA)]);
const delPortal = todos.filter((h) => h.ruta !== MUESTRA);
const deLaMuestra = todos.filter((h) => h.ruta === MUESTRA);

describe('el texto que se escribe fuera de React', () => {
  it('mira src/ de produccion, public/ y los guiones en linea de los .html', () => {
    // El centinela de «donde se mira»: sin esto, una guarda que no leyera `public/` saldria limpia.
    const rutas = new Set(fuentes.map((f) => f.ruta));
    expect(rutas).toContain('src/inicio.ts');
    expect(rutas).toContain('public/configuracion.js');
    expect(rutas).toContain('public/silencio.html');
    expect([...rutas].filter((r) => r.startsWith('src/pruebas/') || /\.test\.tsx?$/.test(r))).toEqual([]);
  });

  it('solo se escribe en las excepciones declaradas', () => {
    const fuera = delPortal.filter((h) => !(h.ruta in EXCEPCIONES)).map((h) => `${h.ruta}:${String(h.linea)} ${h.forma}`);

    expect(
      fuera,
      'Estos archivos escriben texto en la pagina con el DOM, sin React y sin `t()`. Si de verdad no ' +
        'pueden usar `t()`, declaralos en EXCEPCIONES con su motivo',
    ).toEqual([]);
  });

  it('y cada excepcion sigue haciendo falta: una que ya no escribe nada se quita', () => {
    const conHallazgo = new Set(delPortal.map((h) => h.ruta));
    expect(Object.keys(EXCEPCIONES).filter((ruta) => !conHallazgo.has(ruta))).toEqual([]);
  });

  it('la guarda senala en la muestra EXACTAMENTE las lineas marcadas con `// SENALA`', () => {
    const marcadas = readFileSync(join(RAIZ, MUESTRA), 'utf8')
      .split('\n')
      .flatMap((linea, i) => (/\/\/ SENALA$/.test(linea) ? [i + 1] : []));
    const senaladas = [...new Set(deLaMuestra.map((h) => h.linea))].sort((a, b) => a - b);

    expect(marcadas.length, 'la muestra se quedo sin lineas marcadas').toBeGreaterThan(20);
    expect(senaladas, 'la guarda y la muestra no coinciden').toEqual(marcadas);
  });
});
