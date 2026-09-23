// @vitest-environment node
//
// Corre un guion de shell sobre directorios del disco: no es un DOM lo que necesita.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

/**
 * **El `dist/` de la imagen no lleva el artboard, ni las capturas, ni mapas, ni nada de `src/`** (issue 37).
 *
 * La comprobacion es un guion de shell, `imagen/lo-servido-esta-limpio.sh`, y no una prueba de aqui,
 * porque tiene que correr DENTRO de la imagen: en su ultima etapa, despues del ultimo `COPY`, sobre lo
 * que nginx va a servir (rentas#44 midio que una comprobacion sobre un artefacto intermedio no afirma
 * nada del que se publica). Con eso, una imagen sucia **no se construye**.
 *
 * Este archivo demuestra que el guion MUERDE, sobre muestras que se montan en un temporal: una limpia,
 * que tiene que pasar —y con ella el escudo, que el portal SI sirve tal cual—, y una por cada forma de
 * ensuciar lo servido, que tiene que salir roja nombrando lo que encontro. Lo que dice del `dist/` de
 * verdad, construido como lo construye la imagen, lo mide `e2e/el-dist-de-la-imagen-esta-limpio.spec.ts`:
 * `yarn verificar` no construye nada, a proposito (issue 27).
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const GUION = join(FRONTEND, 'imagen', 'lo-servido-esta-limpio.sh');
const SIN_MAPAS = join(FRONTEND, 'imagen', 'sin-mapas.sh');

const ARTBOARD = join(FRONTEND, 'diseno', 'Ciudadano.dc.html');
const CAPTURA = join(FRONTEND, 'diseno', 'medidas', 'situacion-2026-09-16.json');
const ESCUDO = join(FRONTEND, 'diseno', 'escudo-catacaos.png');

const temporales: string[] = [];
afterAll(() => {
  for (const t of temporales) rmSync(t, { recursive: true, force: true });
});

/** Un directorio servido de mentira, LIMPIO: lo que un `dist/` bueno lleva, y nada mas. */
function servidoLimpio(): string {
  const raiz = mkdtempSync(join(tmpdir(), 'ciudadano-servido-'));
  temporales.push(raiz);
  const portal = join(raiz, 'portal');
  mkdirSync(join(portal, 'assets'), { recursive: true });
  writeFileSync(join(portal, 'index.html'), '<!doctype html><script src="/portal/assets/index-abc.js"></script>\n');
  writeFileSync(join(portal, 'assets', 'index-abc.js'), 'console.log("el portal");\n');
  writeFileSync(join(portal, 'assets', 'index-abc.css'), 'body{margin:0}\n');
  copyFileSync(join(FRONTEND, 'public', 'configuracion.js'), join(portal, 'configuracion.js'));
  copyFileSync(join(FRONTEND, 'public', 'silencio.html'), join(portal, 'silencio.html'));
  // El escudo SI se sirve, y byte a byte igual que en `diseno/`: lo importan la barra y el recibo.
  copyFileSync(ESCUDO, join(portal, 'assets', 'escudo-catacaos-xyz.png'));
  return raiz;
}

function comprobar(servido: string, fuente = FRONTEND) {
  const r = spawnSync('sh', [GUION, servido, fuente], { encoding: 'utf8' });
  return { rc: r.status, salida: `${r.stdout}${r.stderr}` };
}

/** Un fragmento del artboard que lleva su marca, para pegarlo dentro de un `.js` servido. */
function trozoDelArtboardCon(marca: string): string {
  const texto = readFileSync(ARTBOARD, 'utf8');
  const i = texto.indexOf(marca);
  return texto.slice(Math.max(0, i - 40), i + 80);
}

describe('EL CENTINELA: el guion y lo que compara existen', () => {
  it('los dos guiones y los tres archivos de diseno estan donde se dice', () => {
    for (const ruta of [GUION, SIN_MAPAS, ARTBOARD, CAPTURA, ESCUDO]) {
      expect(existsSync(ruta), `falta «${ruta}»`).toBe(true);
    }
  });

  it('sin fuentes con las que comparar, el guion NO pasa en verde', () => {
    // Sin esto, llamarlo con la ruta equivocada —o dentro de una imagen donde `src/` no se monto— lo
    // dejaria comparando contra nada, y «no hay ninguna copia de src/» seria verdad de la peor manera.
    const vacio = mkdtempSync(join(tmpdir(), 'ciudadano-sin-fuente-'));
    temporales.push(vacio);
    const { rc, salida } = comprobar(servidoLimpio(), vacio);
    expect(rc).toBe(2);
    expect(salida).toContain('no hay fuentes con las que comparar');
  });
});

describe('lo limpio pasa', () => {
  it('un dist bueno —con el escudo, configuracion.js y silencio.html— sale limpio', () => {
    const { rc, salida } = comprobar(servidoLimpio());
    expect(salida).toContain('lo servido esta limpio');
    expect(rc).toBe(0);
  });
});

describe('cada forma de ensuciar lo servido sale roja, y dice cual', () => {
  /** Ensucia un servido limpio con lo que se le diga y devuelve lo que contesta el guion. */
  function ensuciado(ensuciar: (portal: string) => void) {
    const raiz = servidoLimpio();
    ensuciar(join(raiz, 'portal'));
    return comprobar(raiz);
  }

  const casos: [string, (portal: string) => void, string][] = [
    ['un mapa de simbolos', (p) => writeFileSync(join(p, 'assets', 'index-abc.js.map'), '{}'), 'mapa de simbolos: portal/assets/index-abc.js.map'],
    [
      'un comentario que apunta a un mapa',
      (p) => writeFileSync(join(p, 'assets', 'otro-abc.js'), 'x();\n//# sourceMappingURL=otro-abc.js.map\n'),
      'apunta a un mapa: portal/assets/otro-abc.js',
    ],
    [
      'un archivo de src/, con su nombre',
      (p) => {
        mkdirSync(join(p, 'src'), { recursive: true });
        copyFileSync(join(FRONTEND, 'src', 'main.tsx'), join(p, 'src', 'main.tsx'));
      },
      'codigo fuente: portal/src/main.tsx',
    ],
    [
      'un archivo de src/, RENOMBRADO',
      (p) => copyFileSync(join(FRONTEND, 'src', 'estilos.css'), join(p, 'assets', 'estilos-abc.css')),
      'copia de src/estilos.css: portal/assets/estilos-abc.css',
    ],
    [
      'un directorio src/, aunque este vacio de .ts',
      (p) => mkdirSync(join(p, 'src', 'i18n'), { recursive: true }),
      'directorio que no se sirve: portal/src',
    ],
    ['el artboard, tal cual', (p) => copyFileSync(ARTBOARD, join(p, 'diseno.html')), 'copia de diseno/Ciudadano.dc.html: portal/diseno.html'],
    [
      'el artboard, METIDO dentro de un .js',
      (p) => writeFileSync(join(p, 'assets', 'crudo-abc.js'), `export default ${JSON.stringify(trozoDelArtboardCon('<x-dc'))};\n`),
      'contenido de diseno/Ciudadano.dc.html',
    ],
    [
      'la captura del backend, tal cual',
      (p) => copyFileSync(CAPTURA, join(p, 'assets', 'situacion.json')),
      'copia de diseno/medidas/situacion-2026-09-16.json: portal/assets/situacion.json',
    ],
    [
      'la captura del backend, METIDA dentro de un .js',
      (p) => writeFileSync(join(p, 'assets', 'captura-abc.js'), `export default ${readFileSync(CAPTURA, 'utf8')};\n`),
      'contenido de diseno/medidas/situacion-2026-09-16.json',
    ],
    [
      'otro archivo de diseno/ que no es el escudo',
      (p) => copyFileSync(join(FRONTEND, 'diseno', 'medidas', 'README.md'), join(p, 'LEEME.md')),
      'copia de diseno/medidas/README.md: portal/LEEME.md',
    ],
  ];

  it.each(casos)('%s', (_nombre, ensuciar, esperado) => {
    const { rc, salida } = ensuciado(ensuciar);
    expect(salida).toContain(esperado);
    expect(rc).toBe(1);
  });
});

describe('la exencion del escudo es la unica, y el portal la usa de verdad', () => {
  it('lo que el guion exime lo importa algun archivo de src/', () => {
    // Una exencion que ya nadie usa es una puerta abierta: el dia que el escudo deje de dibujarse, su
    // linea en el guion tiene que irse con el.
    const eximidos = [...readFileSync(GUION, 'utf8').matchAll(/^exime '([^']+)'/gm)].map((m) => m[1] ?? '');
    expect(eximidos).toEqual(['diseno/escudo-catacaos.png']);

    const fuentes = (desde: string): string[] =>
      readdirSync(desde, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? fuentes(join(desde, e.name)) : /\.tsx?$/.test(e.name) ? [readFileSync(join(desde, e.name), 'utf8')] : [],
      );
    const todo = fuentes(join(FRONTEND, 'src')).join('\n');
    for (const eximido of eximidos) {
      const nombre = eximido.split('/').pop() ?? '';
      expect(todo, `nadie en src/ importa «${eximido}»: la exencion sobra`).toMatch(new RegExp(`from '[^']*${nombre}'`));
    }
  });
});

describe('sin-mapas.sh: lo que la imagen hace antes de servir', () => {
  it('quita los mapas y los comentarios que apuntan a ellos, y deja el resto igual', () => {
    const raiz = servidoLimpio();
    const assets = join(raiz, 'portal', 'assets');
    writeFileSync(join(assets, 'a-abc.js'), 'a();\n//# sourceMappingURL=a-abc.js.map\n');
    writeFileSync(join(assets, 'a-abc.js.map'), '{}');
    writeFileSync(join(assets, 'b-abc.css'), 'b{}\n/*# sourceMappingURL=b-abc.css.map */\n');
    writeFileSync(join(assets, 'b-abc.css.map'), '{}');

    // Antes, rojo: es la mitad que demuestra que lo de despues no es verde por no mirar.
    expect(comprobar(raiz).rc).toBe(1);

    const r = spawnSync('sh', [SIN_MAPAS, raiz], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(readdirSync(assets).filter((f) => f.endsWith('.map'))).toEqual([]);
    expect(readFileSync(join(assets, 'a-abc.js'), 'utf8')).toBe('a();\n');
    expect(readFileSync(join(assets, 'b-abc.css'), 'utf8')).toBe('b{}\n');

    const despues = comprobar(raiz);
    expect(despues.salida).toContain('lo servido esta limpio');
    expect(despues.rc).toBe(0);
  });
});
