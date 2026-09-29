import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { createVitest } from 'vitest/node';

import { LO_QUE_SE_MUTA } from '../mutaciones.mjs';
import configuracion from '../stryker.config.mjs';
import { RAIZ } from './artboards.ts';
import { importacionesDe, seCarga } from './grafo-de-imports.ts';
import { pruebasDeLoMutado } from './mutaciones.ts';

/**
 * **Las mutaciones miden algo, y su umbral hace fallar la corrida** (issue 63).
 *
 * `yarn mutaciones` no corre en `yarn verificar` —cuesta minutos—, asi que lo que la hace valer no se
 * nota hasta que alguien la corre: un umbral quitado (`break: null`) la deja salir en verde con
 * cualquier puntuacion; un modulo que sale de `mutate` sube la puntuacion sin matar un mutante; una
 * prueba del portal en su lista multiplica la corrida; y su directorio de trabajo sin ignorar mete en
 * `yarn lint` y en `git status` copias del arbol con el codigo mutado. Esto lo mira en cada
 * `yarn verificar`, sin correr Stryker.
 */

const scripts = (JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { scripts: Record<string, string> })
  .scripts;

/** Las ordenes que corre un script, siguiendo los `yarn <script>` y `npm run <script>` que llama. */
function loQueCorre(nombre: string, vistos: Set<string> = new Set()): string[] {
  const orden = scripts[nombre];
  if (orden === undefined || vistos.has(nombre)) return [];
  vistos.add(nombre);
  const llamados = [...orden.matchAll(/\b(?:yarn(?: run)?|npm run)\s+([\w:-]+)/g)].map(([, llamado]) => llamado ?? '');
  return [orden, ...llamados.flatMap((llamado) => loQueCorre(llamado, vistos))];
}

/** `PartialStrykerOptions` no tipa las opciones de cada runner: las del de Vitest, `unknown`, se leen asi. */
const deVitest = configuracion.vitest as { readonly configFile?: string } | undefined;

/** Las pruebas que Vitest corre con la configuracion de Stryker, resueltas por Vitest y no leidas del objeto. */
async function pruebasQueCorreStryker(): Promise<string[]> {
  const archivo = deVitest?.configFile ?? '(ninguno)';
  const vitest = await createVitest('test', { watch: false, config: join(RAIZ, archivo) });
  try {
    const archivos: string[] = [];
    for (const proyecto of vitest.projects) {
      const { testFiles } = await proyecto.globTestFiles();
      archivos.push(...testFiles.map((ruta) => relative(RAIZ, ruta)));
    }
    return archivos.sort();
  } finally {
    await vitest.close();
  }
}

/** Lo que Stryker deja en el arbol: su directorio de trabajo y cada informe que escribe. */
const LO_QUE_DEJA = [
  join(configuracion.tempDirName ?? '.stryker-tmp', 'src', 'datos', 'cuentas.ts'),
  configuracion.htmlReporter?.fileName ?? '(sin informe html)',
  configuracion.jsonReporter?.fileName ?? '(sin informe json)',
];

describe('las mutaciones', () => {
  it('se corren con `yarn mutaciones`, y NO dentro de `yarn verificar`', () => {
    expect(scripts['mutaciones']).toBe('stryker run');

    const deVerificar = loQueCorre('verificar');
    // El centinela: si la expansion no siguiera los `yarn <script>`, no veria la orden de `test`.
    expect(deVerificar).toContain(scripts['test']);
    expect(
      deVerificar.filter((orden) => /\bstryker\b|\bmutaciones\b/.test(orden)),
      '`yarn verificar` corre Stryker: la corrida entera cuesta minutos y se corre aparte',
    ).toEqual([]);
  });

  it('tienen un umbral que hace fallar la corrida si la puntuacion baja', () => {
    const umbral = configuracion.thresholds?.break;
    expect(
      typeof umbral,
      `\`thresholds.break\` de stryker.config.mjs vale «${String(umbral)}»: Stryker sale en verde con cualquier puntuacion`,
    ).toBe('number');
    expect(umbral).toBeGreaterThan(0);
  });

  it('mutan exactamente `LO_QUE_SE_MUTA`, archivo a archivo', () => {
    expect(configuracion.mutate, '`mutate` de stryker.config.mjs no es `LO_QUE_SE_MUTA` de mutaciones.mjs').toEqual([
      ...LO_QUE_SE_MUTA,
    ]);
  });

  it.each(LO_QUE_SE_MUTA)('`%s` existe, y alguna prueba de las que corre Stryker lo importa', (modulo) => {
    expect(existsSync(join(RAIZ, modulo)), `«${modulo}» no existe: Stryker no mutaria nada ahi`).toBe(true);
    const loImportan = pruebasDeLoMutado().filter((prueba) =>
      importacionesDe(prueba).some((i) => seCarga(i) && i.archivo === modulo),
    );
    expect(loImportan, `Ninguna prueba de las que corre Stryker importa «${modulo}»`).not.toEqual([]);
  });

  it('corren las pruebas que importan lo mutado, y ninguna que monte el portal', async () => {
    expect(
      deVitest?.configFile,
      'Stryker no corre `vitest.mutaciones.config.ts`: correria la suite entera, con el portal',
    ).toBe('vitest.mutaciones.config.ts');

    const corre = await pruebasQueCorreStryker();
    // El centinela: la lista no esta vacia.
    expect(corre.length).toBeGreaterThan(LO_QUE_SE_MUTA.length);
    // Lo que monta el portal es un `.test.tsx`: lo exige `la-suite-tiene-tope.test.ts` (proyecto `portal`).
    expect(
      corre.filter((prueba) => prueba.endsWith('.tsx')),
      'Stryker correria pruebas que montan el portal: cada mutante las repite, y cada caso cuesta segundos',
    ).toEqual([]);
    expect(corre, 'Vitest no corre, con la configuracion de Stryker, las pruebas que deriva el grafo').toEqual([
      ...pruebasDeLoMutado(),
    ]);
  });

  it('y lo que deja Stryker no lo versiona git ni lo lee ESLint', async () => {
    const eslint = new ESLint({ cwd: RAIZ });
    const leeEslint: string[] = [];
    for (const ruta of LO_QUE_DEJA) if (!(await eslint.isPathIgnored(join(RAIZ, ruta)))) leeEslint.push(ruta);

    const git = spawnSync('git', ['check-ignore', '--no-index', '--verbose', '--non-matching', ...LO_QUE_DEJA], {
      cwd: RAIZ,
      encoding: 'utf8',
    });
    const versiona = git.stdout
      .split('\n')
      .filter((linea) => linea.startsWith('::'))
      .map((linea) => linea.replace(/^::\s*/, ''));

    // El centinela: `git check-ignore` contesto por cada ruta.
    expect(git.stdout.split('\n').filter((linea) => linea.length > 0)).toHaveLength(LO_QUE_DEJA.length);
    expect(versiona, 'git no ignora lo que deja Stryker (`.gitignore` de la raiz)').toEqual([]);
    expect(leeEslint, 'ESLint lee lo que deja Stryker (`ignores` de eslint.config.js)').toEqual([]);
  });
});
