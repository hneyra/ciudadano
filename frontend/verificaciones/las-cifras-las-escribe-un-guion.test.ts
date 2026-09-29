// @vitest-environment node
//
// Lee `package.json`, `CLAUDE.md` y los `.md` del repositorio, y corre `cifras.mjs` como proceso sobre
// una raiz fabricada. No es un DOM lo que necesita, y NO corre la suite de verdad: eso lo hace
// `yarn verificar`, y un vitest dentro de vitest no mediria nada que el guion no mida ya.

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CLAVES,
  DONDE_HAY_CIFRAS,
  argumentosDeVitest,
  decidir,
  describir,
  marcadoresSinMedir,
  partirOrden,
  reescribir,
  suiteDePlaywright,
  suiteDeVitest,
  textoDe,
} from '../cifras.mjs';
import { RAIZ } from './artboards.ts';

/**
 * **Las cifras de `CLAUDE.md` las escribe un guion** (issue 64), portado de kamayuk-lib#128.
 *
 * `cifras.mjs` mide con el informe de `vitest run` y `playwright test --list` y reescribe solo el texto entre sus
 * marcadores. Aqui se le pasan medidas fabricadas —una cifra cambiada a mano, un marcador que falta,
 * uno con una clave que no existe, uno sin cerrar— y se exige exactamente lo que tiene que salir. Y el
 * guion se corre COMO PROCESO, con un `vitest` y un `playwright` falsos: en kamayuk-lib#128 la revision
 * midio que `decidir()` podia estar bien y `principal()` salir con RC=0 de un fallo.
 */

const RAIZ_DEL_REPO = join(RAIZ, '..');
const manifiesto = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

const MEDIDA = { pruebas: { archivos: 3, casos: 12 }, arnes: { archivos: 2, casos: 5 } };

const BIEN = [
  '| Pieza | Estado |',
  '|---|---|',
  '| frontend | `yarn verificar`: <!-- cifras:pruebas -->**3 archivos, 12 pruebas**<!-- /cifras -->. Y el arnes: <!-- cifras:arnes -->**2 especificaciones, 5 caminos**<!-- /cifras --> |',
  '',
].join('\n');

describe('las ordenes se leen de `package.json`, no se copian', () => {
  it('`test` es `vitest run` a secas, y con esos argumentos se corre la suite al medir', () => {
    expect(partirOrden(manifiesto.scripts.test ?? '')).toEqual(['vitest', 'run']);
    expect(argumentosDeVitest(manifiesto.scripts.test)).toEqual([]);
    expect(partirOrden("vitest run --exclude '**/x y/**'")).toEqual(['vitest', 'run', '--exclude', '**/x y/**']);
  });

  it('una orden que no es `vitest run`, compuesta, con comillas abiertas o que falta sale roja diciendolo', () => {
    expect(() => argumentosDeVitest('jest --ci')).toThrow(/no empieza por «vitest run»/);
    expect(() => argumentosDeVitest('vitest run && echo hecho')).toThrow(/compuesta/);
    expect(() => argumentosDeVitest("vitest run --exclude '**/x")).toThrow(/sin cerrar/);
    expect(() => argumentosDeVitest(undefined)).toThrow(/no tiene la orden «test»/);
  });
});

describe('se mide lo que se recoge', () => {
  it('del informe de `vitest run`: un archivo por `testResults`, y `numTotalTests`', () => {
    expect(suiteDeVitest({ numTotalTests: 3, testResults: [{}, {}] })).toEqual({ archivos: 2, casos: 3 });
    expect(() => suiteDeVitest({ testResults: [] })).toThrow(/no es el de `vitest run --reporter=json`/);
  });

  it('de `playwright test --list`: un camino por test de cada spec, en suites anidadas', () => {
    const informe = {
      suites: [
        { specs: [{ file: 'a.spec.ts', tests: [{}, {}] }], suites: [{ specs: [{ file: 'a.spec.ts', tests: [{}] }] }] },
        { specs: [{ file: 'b.spec.ts', tests: [{}] }] },
      ],
    };
    expect(suiteDePlaywright(informe)).toEqual({ archivos: 2, casos: 4 });
  });
});

describe('reescribe solo entre marcadores, y dice lo que cambio', () => {
  it('el texto es la forma que `CLAUDE.md` escribia a mano, y el singular cuando toca', () => {
    expect(textoDe('pruebas', MEDIDA)).toBe('**3 archivos, 12 pruebas**');
    expect(textoDe('arnes', { pruebas: MEDIDA.pruebas, arnes: { archivos: 1, casos: 1 } })).toBe(
      '**1 especificacion, 1 camino**',
    );
  });

  it('con las cifras bien, no cambia ni un caracter', () => {
    expect(reescribir(BIEN, MEDIDA, 'CLAUDE.md')).toEqual({ texto: BIEN, diferencias: [], problemas: [] });
  });

  it('LA MUESTRA: una cifra cambiada a mano se nombra, con su linea, lo escrito y lo medido', () => {
    const tocado = BIEN.replace('12 pruebas', '13 pruebas');
    const { diferencias, texto } = reescribir(tocado, MEDIDA, 'CLAUDE.md');
    expect(diferencias).toHaveLength(1);
    const dicho = describir(diferencias[0]!);
    expect(dicho).toContain('CLAUDE.md:3, «cifras:pruebas»');
    expect(dicho).toContain('escrito: **3 archivos, 13 pruebas**');
    expect(dicho).toContain('medido:  **3 archivos, 12 pruebas**');
    expect(texto).toBe(BIEN);
  });

  it('lo de fuera de los marcadores no lo toca aunque lleve numeros', () => {
    const conProsa = `${BIEN}\nmedido en el issue 42: 27 archivos\n`;
    expect(reescribir(conProsa, MEDIDA, 'CLAUDE.md').texto).toBe(conProsa);
  });

  it('una clave sin marcador, una que no existe o un marcador sin cerrar salen rojos', () => {
    const sinArnes = BIEN.replace(/<!-- cifras:arnes -->.*?<!-- \/cifras -->/, 'cinco caminos');
    expect(reescribir(sinArnes, MEDIDA, 'CLAUDE.md').problemas).toEqual([
      expect.stringContaining('falta el marcador «cifras:arnes»'),
    ]);
    const errata = `${BIEN}\n<!-- cifras:prueba -->**3 archivos**<!-- /cifras -->`;
    expect(reescribir(errata, MEDIDA, 'CLAUDE.md').problemas).toEqual([
      expect.stringMatching(/CLAUDE\.md:5: «cifras:prueba» no es ninguna clave.*pruebas, arnes/),
    ]);
    const abierto = `${BIEN}\n<!-- cifras:pruebas -->**3 archivos`;
    expect(reescribir(abierto, MEDIDA, 'CLAUDE.md').problemas).toEqual([
      expect.stringContaining('CLAUDE.md:5: un marcador «cifras» abre y no cierra'),
    ]);
  });
});

describe('`decidir`: lo que decide el codigo de salida', () => {
  const archivos = (texto: string) => [{ archivo: 'CLAUDE.md', texto }];
  const tocado = BIEN.replace('5 caminos', '4 caminos');

  it('con `--comprobar`, UNA cifra tocada a mano es RC=1 y no se escribe nada', () => {
    const { codigo, informe, porEscribir } = decidir({ comprobar: true, medida: MEDIDA, archivos: archivos(tocado) });
    expect(codigo).toBe(1);
    expect(porEscribir).toEqual([]);
    expect(informe).toContain('FALLO: las cifras escritas no son las medidas.');
  });

  it('con `--comprobar` y las cifras bien, RC=0', () => {
    expect(decidir({ comprobar: true, medida: MEDIDA, archivos: archivos(BIEN) }).codigo).toBe(0);
  });

  it('sin `--comprobar`, reescribe lo que difiere y sale RC=0', () => {
    const { codigo, porEscribir } = decidir({ comprobar: false, medida: MEDIDA, archivos: archivos(tocado) });
    expect(codigo).toBe(0);
    expect(porEscribir).toEqual([{ archivo: 'CLAUDE.md', texto: BIEN }]);
  });

  it('una cifra que no se puede leer es RC=1 en los dos modos, y no escribe nada', () => {
    const sinPruebas = tocado.replace(/<!-- cifras:pruebas -->.*?<!-- \/cifras -->/, '12');
    for (const comprobar of [true, false]) {
      const { codigo, porEscribir } = decidir({ comprobar, medida: MEDIDA, archivos: archivos(sinPruebas) });
      expect(codigo).toBe(1);
      expect(porEscribir).toEqual([]);
    }
  });

  it('una medida vacia es RC=2 y no escribe: reescribir seria escribir ceros', () => {
    const vacia = { pruebas: { archivos: 0, casos: 0 }, arnes: MEDIDA.arnes };
    expect(decidir({ comprobar: false, medida: vacia, archivos: archivos(BIEN) })).toMatchObject({
      codigo: 2,
      porEscribir: [],
    });
  });
});

describe('el arbol de verdad', () => {
  it('`CLAUDE.md` lleva un marcador por clave, y todos se leen', () => {
    expect(DONDE_HAY_CIFRAS).toEqual(['CLAUDE.md']);
    const texto = readFileSync(join(RAIZ_DEL_REPO, 'CLAUDE.md'), 'utf8');
    expect(reescribir(texto, MEDIDA, 'CLAUDE.md').problemas).toEqual([]);
    expect(CLAVES).toEqual(['pruebas', 'arnes']);
  });

  it('ningun `.md` del repositorio lleva un marcador sin estar en la lista', () => {
    const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], {
      cwd: RAIZ_DEL_REPO,
      encoding: 'utf8',
    });
    const markdowns = r.stdout
      .split('\n')
      .filter((ruta) => ruta !== '')
      .map((archivo) => ({ archivo, texto: readFileSync(join(RAIZ_DEL_REPO, archivo), 'utf8') }));
    // EL CENTINELA: sin esto, un barrido roto recorreria la lista vacia en verde.
    expect(markdowns.map((m) => m.archivo)).toEqual(expect.arrayContaining(['CLAUDE.md', 'docs/adr/README.md']));
    expect(marcadoresSinMedir(markdowns)).toEqual([]);
    expect(marcadoresSinMedir([{ archivo: 'docs/otro.md', texto: 'a\n<!-- cifras:pruebas -->x<!-- /cifras -->' }])).toEqual([
      'docs/otro.md:2',
    ]);
  });

  it('`yarn verificar` comprueba, como eslabon propio, con el informe que acaba de escribir su `yarn test`', () => {
    // Por eslabones y no por subcadena: `(yarn cifras --comprobar || true)` contiene el texto y no para
    // nada (medido en kamayuk-lib#128). Y el informe es el de ESA corrida: la misma ruta en los dos.
    const eslabones = (manifiesto.scripts.verificar ?? '').split(' && ').map((eslabon) => partirOrden(eslabon));
    const prueba = eslabones.find((palabras) => palabras[0] === 'yarn' && palabras[1] === 'test');
    const cifras = eslabones.find((palabras) => palabras[0] === 'yarn' && palabras[1] === 'cifras');
    expect(prueba).toEqual(expect.arrayContaining(['--reporter=default', '--reporter=json']));
    const informe = prueba?.find((palabra) => palabra.startsWith('--outputFile.json='))?.slice('--outputFile.json='.length);
    expect(informe, 'el `yarn test` de `verificar` no escribe su informe JSON').toBeDefined();
    expect(cifras).toEqual(['yarn', 'cifras', '--comprobar', '--informe', informe]);
    expect(eslabones.indexOf(cifras!)).toBeGreaterThan(eslabones.indexOf(prueba!));
    expect(manifiesto.scripts.cifras).toBe('node cifras.mjs');
  });
});

describe('el guion, como proceso, hace lo que `decidir` dice', () => {
  const raices: string[] = [];
  afterEach(() => {
    for (const raiz of raices.splice(0)) rmSync(raiz, { recursive: true, force: true });
  });

  /**
   * Una raiz fabricada: el guion de verdad, un `vitest` y un `playwright` falsos, y un `CLAUDE.md`. El
   * `vitest` falso escribe su informe solo si le llegan `run` y los argumentos de medir, y deja una
   * marca de que lo llamaron.
   */
  function fabricar(claude: string, casosDeVitest = 12): string {
    const raiz = mkdtempSync(join(tmpdir(), 'ciudadano-cifras-prueba-'));
    raices.push(raiz);
    const frontend = join(raiz, 'frontend');
    mkdirSync(join(frontend, 'node_modules', 'vitest'), { recursive: true });
    mkdirSync(join(frontend, 'node_modules', '@playwright', 'test'), { recursive: true });
    copyFileSync(join(RAIZ, 'cifras.mjs'), join(frontend, 'cifras.mjs'));
    writeFileSync(join(frontend, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
    writeFileSync(join(raiz, 'CLAUDE.md'), claude);
    const informeDeVitest = { numTotalTests: casosDeVitest, testResults: casosDeVitest === 0 ? [] : [{}, {}, {}] };
    writeFileSync(join(frontend, 'node_modules', 'vitest', 'package.json'), JSON.stringify({ name: 'vitest', bin: { vitest: 'vitest.mjs' } }));
    writeFileSync(
      join(frontend, 'node_modules', 'vitest', 'vitest.mjs'),
      [
        "import { writeFileSync } from 'node:fs';",
        "const [orden, reportero, salida, ...resto] = process.argv.slice(2);",
        "if (orden !== 'run' || reportero !== '--reporter=json' || !salida.startsWith('--outputFile.json=') || resto.length > 0) process.exit(3);",
        "writeFileSync(new URL('llamado', import.meta.url), 'si');",
        `writeFileSync(salida.slice('--outputFile.json='.length), ${JSON.stringify(JSON.stringify(informeDeVitest))});`,
      ].join('\n'),
    );
    writeFileSync(
      join(frontend, 'node_modules', '@playwright', 'test', 'package.json'),
      JSON.stringify({ name: '@playwright/test', bin: { playwright: 'cli.mjs' } }),
    );
    const informeDelArnes = { suites: [{ specs: [{ file: 'a.spec.ts', tests: [{}, {}, {}] }, { file: 'b.spec.ts', tests: [{}, {}] }] }] };
    writeFileSync(
      join(frontend, 'node_modules', '@playwright', 'test', 'cli.mjs'),
      [
        "import { writeFileSync } from 'node:fs';",
        "if (process.argv.slice(2).join(' ') !== 'test --list --reporter=json') process.exit(3);",
        `writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME, ${JSON.stringify(JSON.stringify(informeDelArnes))});`,
      ].join('\n'),
    );
    return raiz;
  }

  const correr = (raiz: string, ...argumentos: string[]) =>
    spawnSync(process.execPath, [join(raiz, 'frontend', 'cifras.mjs'), ...argumentos], { encoding: 'utf8' });

  it('con `--comprobar`, una cifra tocada a mano sale con RC=1 y no se escribe', () => {
    const tocado = BIEN.replace('12 pruebas', '13 pruebas');
    const raiz = fabricar(tocado);
    const r = correr(raiz, '--comprobar');
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain('FALLO: las cifras escritas no son las medidas.');
    expect(readFileSync(join(raiz, 'CLAUDE.md'), 'utf8')).toBe(tocado);
  });

  it('sin `--comprobar`, la reescribe y sale con RC=0; y despues `--comprobar` tambien sale con 0', () => {
    const raiz = fabricar(BIEN.replace('12 pruebas', '13 pruebas'));
    expect(correr(raiz).status).toBe(0);
    expect(readFileSync(join(raiz, 'CLAUDE.md'), 'utf8')).toBe(BIEN);
    expect(correr(raiz, '--comprobar').status).toBe(0);
  });

  it('una medida vacia sale con RC=2, y una opcion desconocida o incompleta tambien', () => {
    expect(correr(fabricar(BIEN, 0), '--comprobar').status).toBe(2);
    expect(correr(fabricar(BIEN), '--arreglar').status).toBe(2);
    expect(correr(fabricar(BIEN), '--comprobar', '--informe').status).toBe(2);
  });

  it('con `--informe`, lee ese informe y NO vuelve a correr la suite', () => {
    const raiz = fabricar(BIEN);
    writeFileSync(join(raiz, 'frontend', 'informe.json'), JSON.stringify({ numTotalTests: 13, testResults: [{}, {}, {}] }));
    const r = correr(raiz, '--comprobar', '--informe', 'informe.json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('medido:  **3 archivos, 13 pruebas**');
    expect(() => readFileSync(join(raiz, 'frontend', 'node_modules', 'vitest', 'llamado'))).toThrow();
  });
});
