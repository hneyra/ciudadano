// @vitest-environment node
//
// Lee archivos del disco y los parte con el compilador de TypeScript. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { archivosQuePintan, hallazgosDe } from './colores-propios.ts';

/**
 * **Ningun archivo de `src/` escribe un color: los elige de la identidad `clasico`** (issue 2).
 *
 * <h2>El defecto que evita</h2>
 *
 * El artboard pinta con hexadecimales en linea —`background:#0D5FA8`, `color:#777`—, y la forma
 * mas corta de portar una pantalla es copiarlos: `bg-[#0D5FA8]`, `style={{ color: '#777' }}`. Todo
 * compila, pasa el lint, pasa las pruebas y **se ve igual**. Y el portal deja de tener tema: el modo
 * oscuro derivado no alcanza a esos elementos, un cambio de `clasico` en la libreria tampoco, y
 * `#777` —que no llega a AA y por eso `kamayuk-lib`#56 lo dejo fuera— vuelve a entrar sin que nadie
 * lo decida. Lo mismo, a lo grande, con un `--color-azul` declarado en `src/estilos.css`: una
 * segunda paleta que gana o pierde segun el orden en que el empaquetador junte las hojas.
 *
 * <h2>Con muestra que la viola</h2>
 *
 * `verificaciones/colores-propios/muestra.{tsx,css}` escriben cada violacion a proposito, con un
 * `VIOLA:` en la linea de encima, y aqui se exige que salgan esas lineas y ninguna otra. Una guarda
 * que no senalara nada pasaria la mitad de abajo en verde con `src/` lleno de colores; la muestra es
 * lo que lo impide. Y la mitad contraria —codigo que elige bien y NO se senala— evita la guarda que
 * lo senala todo y se desactiva a la tercera.
 */

const SRC = join(RAIZ, 'src');
const ARCHIVOS = archivosQuePintan(SRC);

const MUESTRAS = join(RAIZ, 'verificaciones', 'colores-propios');

/** Una muestra, juzgada como si viviera en `src/`. */
const juzgarMuestra = (archivo: string, comoSi: string) =>
  hallazgosDe(join(SRC, comoSi), readFileSync(join(MUESTRAS, archivo), 'utf8'));

/** Codigo que elige de la identidad, o que lleva un `#` que no pinta: nada de esto se senala. */
const QUE_CUMPLE: readonly { readonly que: string; readonly archivo: string; readonly fuente: string }[] = [
  {
    que: 'las utilidades de la identidad',
    archivo: 'Barra.tsx',
    fuente: 'export const B = () => <header className="bg-azul text-sobre-azul border-linea" />;\n',
  },
  {
    que: 'el token por `var()` en `style`',
    archivo: 'Nota.tsx',
    fuente: "export const N = () => <p style={{ color: 'var(--color-tinta-3)' }}>x</p>;\n",
  },
  {
    que: 'un ancla que parece hexadecimal, fuera de `className` y de `style`',
    archivo: 'Enlace.tsx',
    fuente: "export const E = () => <a href=\"#add\">{t('Anadir')}</a>;\nexport const ID = '#fff';\n",
  },
  {
    que: 'el color NOMBRADO en un comentario de una hoja',
    archivo: 'estilos.css',
    fuente: '/* El artboard dice `#0D5FA8`. */\nbody { background-color: var(--color-fondo); }\n',
  },
  {
    que: '`font-family: inherit`, que no es escribir una fuente',
    archivo: 'estilos.css',
    fuente: '@layer base { button { font-family: inherit; } }\n',
  },
  {
    que: 'una utilidad cuyo nombre lleva cifras, no un color',
    archivo: 'Tabla.tsx',
    fuente: "export const T = () => <td className={cn('px-[18px]', 'text-tinta-2')} />;\n",
  },
];

describe('sin colores propios en `src/`', () => {
  it('EL CENTINELA: hay archivos que juzgar, y la hoja y el marcador estan entre ellos', () => {
    // Un `src/` que no se pudiera leer daria cero hallazgos, que es exactamente lo que esta guarda
    // considera correcto.
    const leidos = ARCHIVOS.map((r) => r.slice(RAIZ.length + 1));
    expect(leidos).toContain('src/estilos.css');
    expect(leidos).toContain('src/aplicacion.tsx');
  });

  it('LA MUESTRA: cada violacion escrita a proposito sale, en su linea', () => {
    const enCodigo = juzgarMuestra('muestra.tsx', 'Muestra.tsx');
    const lineasDeCodigo = readFileSync(join(MUESTRAS, 'muestra.tsx'), 'utf8').split('\n');
    const violadasEnCodigo = lineasDeCodigo
      .map((texto, i) => ({ texto, linea: i + 2 }))
      .filter(({ texto }) => texto.includes('VIOLA:'))
      .map(({ linea }) => linea);
    expect(violadasEnCodigo, 'la muestra de codigo no marca ninguna violacion').toHaveLength(5);
    expect(
      enCodigo.map((h) => h.linea).sort((a, b) => a - b),
      `la guarda no senalo lo que la muestra de codigo viola:\n${JSON.stringify(enCodigo, null, 2)}`,
    ).toEqual(violadasEnCodigo);

    const enHoja = juzgarMuestra('muestra.css', 'estilos.css');
    const lineasDeHoja = readFileSync(join(MUESTRAS, 'muestra.css'), 'utf8').split('\n');
    const violadasEnHoja = lineasDeHoja
      .map((texto, i) => ({ texto, linea: i + 2 }))
      .filter(({ texto }) => texto.includes('VIOLA:'))
      .map(({ linea }) => linea);
    expect(violadasEnHoja, 'la muestra de hoja no marca ninguna violacion').toHaveLength(3);
    // La declaracion `--color-azul: #0d5fa8` son DOS hallazgos en la misma linea: declara el token y
    // escribe un color literal.
    expect(
      [...new Set(enHoja.map((h) => h.linea))].sort((a, b) => a - b),
      `la guarda no senalo lo que la muestra de hoja viola:\n${JSON.stringify(enHoja, null, 2)}`,
    ).toEqual(violadasEnHoja);
  });

  it.each(QUE_CUMPLE)('no senala $que', ({ archivo, fuente }) => {
    expect(hallazgosDe(join(SRC, archivo), fuente)).toEqual([]);
  });

  it('ningun archivo de `src/` declara un token ni escribe un color', () => {
    const hallazgos = ARCHIVOS.flatMap((ruta) => hallazgosDe(ruta, readFileSync(ruta, 'utf8')));
    expect(
      hallazgos,
      'Hay colores escritos a mano en `src/`:\n' +
        `${hallazgos.map((h) => `  ${h.ruta.slice(RAIZ.length + 1)}:${h.linea} — ${h.porQue}`).join('\n')}\n\n` +
        '  La paleta es la identidad `clasico` de `@kamayuk/ui`. Si el color que hace falta no esta\n' +
        '  en ella, se pide en `kamayuk-lib`; si esta, se usa su utilidad (`bg-azul`) o su token\n' +
        '  (`var(--color-azul)`). Ver `la-paleta-cuadra-con-el-artboard.test.ts` para saber cual.',
    ).toEqual([]);
  });
});
