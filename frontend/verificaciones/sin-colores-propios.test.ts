// @vitest-environment node
//
// Lee archivos del disco y los parte con el compilador de TypeScript. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { EXENCIONES, type Exencion, archivosQuePintan, hallazgosDe } from './colores-propios.ts';

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
 *
 * <h2>Cada exencion, con la cadena que sin ella saldria roja</h2>
 *
 * Desde el issue 23 la guarda senala un color literal en cualquier cadena de codigo, y exime por
 * contexto lo que no pinta (`EXENCIONES`). Una exencion que no ampara nada no se puede demostrar, y
 * una que ampara de mas es un agujero: por eso cada una trae aqui un caso que sale limpio con ella
 * y ROJO sin ella —se juzga dos veces—, y `LO_QUE_NO_SE_EXIME` trae los que se le parecen y tienen
 * que seguir saliendo rojos.
 */

const SRC = join(RAIZ, 'src');
const ARCHIVOS = archivosQuePintan(SRC);

const MUESTRAS = join(RAIZ, 'verificaciones', 'colores-propios');

/** Una muestra, juzgada como si viviera en `src/`. */
const juzgarMuestra = (archivo: string, comoSi: string) =>
  hallazgosDe(join(SRC, comoSi), readFileSync(join(MUESTRAS, archivo), 'utf8'));

/**
 * Las formas del issue 23: por donde un color llega a una clase sin pasar a la vista por `className`,
 * `style` ni `cn()`. Cada una tiene que estar escrita en la muestra, marcada, y salir en su linea.
 */
const FORMAS_SIN_CLASSNAME: readonly { readonly forma: string; readonly texto: string }[] = [
  { forma: 'una prop JSX con otro nombre', texto: '<Tarjeta filo="border-t-[#A6093D]" />' },
  { forma: 'un valor JSX en llaves', texto: "<Icono tono={'#0D5FA8'} />" },
  { forma: 'una constante que luego es clase', texto: "const FILO = 'border-t-[#a6093d]';" },
  { forma: 'un objeto de tonos', texto: "const TONOS = { mal: 'bg-[rgb(169,68,66)]' } as const;" },
  { forma: 'una plantilla con interpolacion', texto: '`text-[#333] ${algo}`' },
];

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
  // Las del issue 23, fuera de `className`, `style` y `cn()`, que es donde la guarda mira ahora.
  {
    que: 'las rutas hash `#/buscar` y `#/historial` en una constante (la `/` no es cifra hexadecimal)',
    archivo: 'rutas.ts',
    fuente: "export const INICIO = '#/buscar';\nexport const HISTORIAL = '#/historial';\n",
  },
  {
    que: 'un ancla `href="#contenido"`',
    archivo: 'Saltar.tsx',
    fuente: 'export const S = () => <a href="#contenido">{t(\'Saltar al contenido\')}</a>;\n',
  },
  {
    que: 'un texto traducido `t(\'Paso #1\')`',
    archivo: 'Paso.tsx',
    fuente: "export const P = () => <p>{t('Paso #1')}</p>;\n",
  },
  {
    que: "el token por `var()` en una constante: `'var(--color-azul)'`",
    archivo: 'tonos.ts',
    fuente: "export const TONO = 'var(--color-azul)';\n",
  },
  {
    que: "la utilidad en una constante: `'bg-azul'`",
    archivo: 'tonos.ts',
    fuente: "export const FONDO = 'bg-azul';\nexport const TONOS = { bien: `bg-ok-fondo ${'text-ok-tinta'}` };\n",
  },
  {
    que: 'un hexadecimal dentro de un comentario de codigo',
    archivo: 'Granate.tsx',
    fuente:
      '// El artboard pinta el filo en #A6093D; `--mal-tinta` es el mas cercano.\n' +
      '/* y el papel, rgb(240, 246, 251) */\n' +
      "export const G = () => <div className=\"border-t-mal-tinta\">{/* #0D5FA8 */}</div>;\n",
  },
];

/**
 * **Un caso por exencion que PARECE color y sale limpio solo por ella.** Si se quita la exencion de
 * `colores-propios.ts`, su caso sale rojo aqui.
 */
const LO_QUE_SE_EXIME: readonly {
  readonly exencion: Exencion;
  readonly que: string;
  readonly archivo: string;
  readonly fuente: string;
}[] = [
  {
    exencion: 'destino',
    que: 'un ancla hexadecimal en `href`',
    archivo: 'Enlace.tsx',
    fuente: "export const E = () => <a href=\"#add\">{t('Anadir')}</a>;\n",
  },
  {
    exencion: 'destino',
    // La cola `?desde=#cafe` no empieza como un destino: lo que se mira es como empieza la plantilla.
    que: 'una ruta hash en una plantilla, con un ancla hexadecimal en la cola, en el `to` de un `Link`',
    archivo: 'Volver.tsx',
    fuente: "export const V = ({ ruta }: { ruta: string }) => <Link to={`#/${ruta}?desde=#cafe`}>{t('Volver')}</Link>;\n",
  },
  {
    exencion: 'nombre',
    que: 'un `data-testid` con un numero de recibo',
    archivo: 'Recibo.tsx',
    fuente: 'export const R = () => <li data-testid="recibo-#0042" />;\n',
  },
  {
    exencion: 'texto',
    que: 'un numero de recibo dentro de `t()`',
    archivo: 'Aviso.tsx',
    fuente: "export const A = () => <p>{i18n.t('Recibo #0042 pagado')}</p>;\n",
  },
];

/** Lo que se parece a una exencion y NO lo es: tiene que seguir saliendo rojo. */
const LO_QUE_NO_SE_EXIME: readonly { readonly que: string; readonly archivo: string; readonly fuente: string }[] = [
  {
    que: 'una clase en una prop `to`, que no tiene forma de destino',
    archivo: 'Enlace.tsx',
    fuente: 'export const E = () => <Enlace to="hover:bg-[#a94442]" />;\n',
  },
  {
    que: 'un color en las opciones de `t()`, no en su texto',
    archivo: 'Aviso.tsx',
    fuente: "export const A = () => <p>{t('Aviso', { defaultValue: '#a94442' })}</p>;\n",
  },
  {
    que: 'la rama de clase de un `href` condicional',
    archivo: 'Enlace.tsx',
    fuente: "export const E = ({ x }: { x: boolean }) => <a href={x ? '#add' : 'bg-[#a94442]'}>{t('Ir')}</a>;\n",
  },
  {
    que: 'un hexadecimal suelto en una constante: mirando la cadena no se sabe que no pinte',
    archivo: 'Enlace.tsx',
    fuente: "export const ID = '#fff';\n",
  },
  {
    que: 'un color en otra prop del elemento que lleva `data-testid`',
    archivo: 'Fila.tsx',
    fuente: 'export const F = () => <Fila data-testid="fila" filo="border-l-[#a94442]" />;\n',
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
    expect(violadasEnCodigo, 'la muestra de codigo no marca ninguna violacion').toHaveLength(10);
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

  it.each(FORMAS_SIN_CLASSNAME)('LA MUESTRA: $forma sale, en su linea', ({ texto }) => {
    const lineas = readFileSync(join(MUESTRAS, 'muestra.tsx'), 'utf8').split('\n');
    const indice = lineas.findIndex((l) => l.includes(texto));
    expect(indice, `la muestra de codigo no escribe «${texto}»`).toBeGreaterThan(0);
    expect(lineas[indice - 1], `«${texto}» no lleva el \`VIOLA:\` en la linea de encima`).toContain('VIOLA:');
    const enCodigo = juzgarMuestra('muestra.tsx', 'Muestra.tsx');
    expect(
      enCodigo.map((h) => h.linea),
      `la guarda no senalo «${texto}» (linea ${indice + 1}):\n${JSON.stringify(enCodigo, null, 2)}`,
    ).toContain(indice + 1);
  });

  it.each(QUE_CUMPLE)('no senala $que', ({ que, archivo, fuente }) => {
    const hallazgos = hallazgosDe(join(SRC, archivo), fuente);
    expect(hallazgos, `la guarda senalo ${que}: ${hallazgos.map((h) => h.porQue).join(' / ')}`).toEqual([]);
  });

  it('cada exencion ampara al menos una cadena de las de abajo', () => {
    expect([...new Set(LO_QUE_SE_EXIME.map((c) => c.exencion))].sort()).toEqual(Object.keys(EXENCIONES).sort());
  });

  it.each(LO_QUE_SE_EXIME)('exime ($exencion) $que', ({ exencion, que, archivo, fuente }) => {
    const hallazgos = hallazgosDe(join(SRC, archivo), fuente);
    expect(hallazgos, `la guarda senalo ${que}: ${hallazgos.map((h) => h.porQue).join(' / ')}`).toEqual([]);
    // Y sin ESA exencion sale rojo: si no, el caso saldria limpio por otra razon y no demostraria nada.
    const sinEsta = new Set((Object.keys(EXENCIONES) as Exencion[]).filter((e) => e !== exencion));
    expect(hallazgosDe(join(SRC, archivo), fuente, sinEsta), 'sin la exencion, el caso no sale rojo').toHaveLength(1);
  });

  it.each(LO_QUE_NO_SE_EXIME)('SI senala $que', ({ que, archivo, fuente }) => {
    const hallazgos = hallazgosDe(join(SRC, archivo), fuente);
    expect(
      hallazgos,
      `${que} tiene que dar UN hallazgo, y dio: ${hallazgos.map((h) => h.porQue).join(' / ') || '(ninguno)'}`,
    ).toHaveLength(1);
  });

  it('ningun archivo de `src/` declara un token ni escribe un color', () => {
    const hallazgos = ARCHIVOS.flatMap((ruta) => hallazgosDe(ruta, readFileSync(ruta, 'utf8')));
    expect(
      hallazgos,
      'Hay colores escritos a mano en `src/`:\n' +
        `${hallazgos.map((h) => `  ${h.ruta.slice(RAIZ.length + 1)}:${h.linea} — ${h.porQue}`).join('\n')}\n\n` +
        '  La paleta es la identidad `clasico` de `@kamayuk/ui`. Si el color que hace falta no esta\n' +
        '  en ella, se pide en `kamayuk-lib`; si esta, se usa su utilidad (`bg-azul`) o su token\n' +
        '  (`var(--color-azul)`). Ver `la-paleta-cuadra-con-el-artboard.test.ts` para saber cual.\n' +
        '  Si la cadena NO pinta, las exenciones de `verificaciones/colores-propios.ts` dicen cuales\n' +
        '  contextos se eximen; uno nuevo se anade alli, con su porque y su caso en esta prueba.',
    ).toEqual([]);
  });
});
