// @vitest-environment node
//
// Lee archivos del disco y los analiza con el compilador de TypeScript. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { archivosDe, frasesTemporales, frasesTemporalesDe } from './frases-temporales.ts';

/**
 * **Ningun comentario de `src/` dice «hoy», «todavia» ni «ya no»** (issue 64).
 *
 * Un comentario con tiempo describe el arbol del dia en que se escribio. Al dia siguiente puede ser
 * falso y nada se pone rojo: el issue 64 encontro mas de una docena asi (un issue de la libreria dado
 * por abierto cuando ya estaba mezclado, una funcion que «no llama nadie» con tres llamadas). Lo
 * operativo se escribe en presente o sin tiempo; la historia va a `docs/adr/`.
 *
 * Mira todo `.ts`/`.tsx` de `src/`, pruebas y andamiaje de pruebas incluidos. Que frases, como se leen
 * los comentarios y lo que no ve esta en la cabecera de `frases-temporales.ts`.
 */

/**
 * **Los comentarios que pueden decir una frase temporal, y por que.** Por archivo y frase; cada una
 * **caduca sola**: si la frase deja de estar en el archivo, la exencion sobra y la prueba lo dice.
 */
const EXCEPCIONES: readonly { readonly ruta: string; readonly frase: string; readonly porque: string }[] = [
  {
    ruta: 'src/pasos/identificar/Identificar.tsx',
    frase: 'todavia',
    porque:
      'cita literal del parrafo de la pantalla («Todavía no ha elegido qué pagar…»), que es texto definitivo ' +
      'del artboard y es como lo buscan las pruebas: no es el tiempo del comentario, es el de la persona.',
  },
];

const MUESTRA = 'verificaciones/frases-temporales/muestra.tsx';

const ARCHIVOS = archivosDe('src');
const HALLAZGOS = frasesTemporales(ARCHIVOS);

const exime = (h: { ruta: string; frase: string }): boolean =>
  EXCEPCIONES.some((e) => e.ruta === h.ruta && e.frase === h.frase);

describe('los comentarios no dicen en que dia se escribieron', () => {
  it('EL CENTINELA: se lee todo `src/`, pruebas incluidas, y nada de fuera', () => {
    // Sin esto, un directorio mal escrito dejaria la lista vacia y la guarda verde sobre la nada.
    expect(ARCHIVOS).toContain('src/recorrido/recorrido.ts');
    expect(ARCHIVOS).toContain('src/pruebas/portal.tsx');
    expect(ARCHIVOS).toContain('src/recorrido/recorrido.test.ts');
    expect(ARCHIVOS).toContain('src/pasos/deudas/Deudas.test.tsx');
    expect(ARCHIVOS.filter((ruta) => !ruta.startsWith('src/'))).toEqual([]);
    expect(ARCHIVOS.length).toBeGreaterThan(150);
  });

  it('ningun comentario de `src/` lleva una frase temporal, salvo las de EXCEPCIONES', () => {
    const fuera = HALLAZGOS.filter((h) => !exime(h)).map((h) => `  ${h.ruta}:${String(h.linea)} «${h.frase}»`);
    expect(
      fuera,
      `Hay comentarios que dicen en que dia se escribieron:\n${fuera.join('\n')}\n\n` +
        '  Se escriben en presente o sin tiempo («el servidor no publica X», no «hoy no publica X»).\n' +
        '  Lo que es historia —que se midio, que se descarto— va a un ADR de `docs/adr/`, enlazado desde el\n' +
        '  comentario. Si la frase es una cita que no se puede cambiar, va a EXCEPCIONES con su porque.',
    ).toEqual([]);
  });

  it('y cada excepcion sigue haciendo falta, y dice por que', () => {
    const caducadas = EXCEPCIONES.flatMap((e) => {
      const donde = `  ${e.ruta} «${e.frase}»`;
      if (!HALLAZGOS.some((h) => h.ruta === e.ruta && h.frase === e.frase)) return [`${donde}: ya no la dice`];
      if (e.porque.trim().length < 40) return [`${donde}: la excepcion no dice por que`];
      return [];
    });
    expect(caducadas, `Excepciones que hay que quitar o justificar:\n${caducadas.join('\n')}`).toEqual([]);
  });

  it('la guarda senala en la muestra EXACTAMENTE las lineas marcadas con `// SENALA`', () => {
    const marcadas = readFileSync(join(RAIZ, MUESTRA), 'utf8')
      .split('\n')
      .flatMap((linea, i) => (/\/\/ SENALA$/.test(linea) ? [i + 1] : []));
    const senaladas = [...new Set(frasesTemporales([MUESTRA]).map((h) => h.linea))].sort((a, b) => a - b);

    expect(marcadas.length, 'la muestra se quedo sin lineas marcadas').toBeGreaterThanOrEqual(15);
    expect(senaladas, 'la guarda y la muestra no coinciden').toEqual(marcadas);
  });

  it('una frase partida entre dos lineas de un bloque se senala en la linea donde empieza', () => {
    // En la muestra no cabe: el marcador al final de la primera linea partiria la frase.
    const bloque = ['/**', ' * el portal ya', ' * no lo hace; y esta', ' * entrega tampoco', ' */', 'export {};'].join('\n');
    expect(frasesTemporalesDe('x.ts', bloque)).toEqual([
      { ruta: 'x.ts', linea: 2, frase: 'ya no' },
      { ruta: 'x.ts', linea: 3, frase: 'esta entrega' },
    ]);
  });

  it('y lo mismo entre dos `//` seguidos, que se leen como un solo comentario', () => {
    const lineas = ['// el campo ya', '// no se usa; y aun', '// asi se lee', 'export {};'].join('\n');
    expect(frasesTemporalesDe('x.ts', lineas)).toEqual([{ ruta: 'x.ts', linea: 1, frase: 'ya no' }]);
    // Separados por una linea de codigo, no: son dos comentarios.
    expect(frasesTemporalesDe('x.ts', ['// ya', 'const a = 1;', '// no', 'export { a };'].join('\n'))).toEqual([]);
  });
});
