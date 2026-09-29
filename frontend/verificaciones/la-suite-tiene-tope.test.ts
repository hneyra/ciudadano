// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configDefaults } from 'vitest/config';
import { createVitest } from 'vitest/node';

import { PLAZO_DEL_PORTAL } from '../src/pruebas/plazos.ts';
import configuracion from '../vitest.config.ts';
import { RAIZ } from './artboards.ts';

/**
 * **La suite no cae por la carga de la maquina** (issue 42).
 *
 * `yarn verificar` caia con 5-10 casos caducados cuando la maquina —4 nucleos, compartida con
 * `k3s-server` y otras suites— estaba ocupada, y en aislado esos casos pasaban. Un rojo que depende de
 * la carga no distingue un defecto de ruido, y ensena a repetir la corrida hasta que salga verde.
 *
 * Lo arreglan dos cosas, las dos de una linea y las dos faciles de perder sin que nada se ponga rojo:
 *
 *   · el tope de procesos de `vitest.config.ts`. Quitarlo devuelve «uno por nucleo»; y escribirlo como
 *     tope de HILOS (`poolOptions.threads.maxThreads`, o `VITEST_MAX_THREADS`) no hace nada, porque el
 *     `pool` es `forks`: parece un tope y no lo es. Aqui se calcula el tope que Vitest APLICA, con su
 *     misma precedencia, y no el que la configuracion dice.
 *   · los plazos de los casos que montan el portal entero, que declara el proyecto `portal` de
 *     `vitest.config.ts` (issue 63; hasta entonces, una llamada en cada archivo). Un archivo que monte
 *     el portal fuera de ese proyecto vuelve a 5 s el caso y 1 s cada espera: pasa en la maquina libre
 *     y cae en la cargada.
 */

/** El tope medido: el porque, con la tabla de tiempos y cargas, esta en `vitest.config.ts`. */
const TOPE_MEDIDO = 2;

/**
 * Los procesos que Vitest levanta de verdad con esta configuracion, sin variables de entorno.
 *
 * La misma precedencia que `createForksPool`/`createThreadsPool` de Vitest 3.2: el tope del `pool` que
 * se usa (`poolOptions.forks.maxForks` o `poolOptions.threads.maxThreads`), y si no, `maxWorkers`, y si
 * no, `nucleos - 1`, que aqui se devuelve como `undefined`: no hay tope.
 */
function topeQueSeAplica(test: typeof configuracion.test): unknown {
  const pool = test?.pool ?? configDefaults.pool;
  // Las opciones de cada `pool` se tipan por separado; aqui solo interesan sus dos topes.
  const opciones = test?.poolOptions as
    | Partial<Record<string, { readonly maxForks?: unknown; readonly maxThreads?: unknown }>>
    | undefined;
  const delPool =
    pool === 'forks' || pool === 'vmForks'
      ? opciones?.[pool]?.maxForks
      : pool === 'threads' || pool === 'vmThreads'
        ? opciones?.[pool]?.maxThreads
        : undefined;
  return delPool ?? test?.maxWorkers;
}

describe('el tope de procesos de la suite', () => {
  it(`es ${String(TOPE_MEDIDO)}, un numero fijo que no depende de los nucleos de la maquina`, () => {
    const tope = topeQueSeAplica(configuracion.test);

    expect(
      tope,
      'vitest.config.ts no pone un tope que Vitest aplique al `pool` que usa: sin el, levanta un proceso ' +
        'por nucleo (menos uno) y `yarn verificar` vuelve a caducar con la maquina ocupada',
    ).toBe(TOPE_MEDIDO);
  });

  it('y la suite no se ha vuelto secuencial por otro lado', () => {
    // `fileParallelism: false` fuerza UN proceso aunque el tope diga otra cosa: 410 s en vez de 212.
    expect(configuracion.test?.fileParallelism ?? true).toBe(true);
  });
});

/**
 * Los proyectos como los resuelve VITEST, y no como los escribe la configuracion (issue 63).
 *
 * Con `extends: true` cada proyecto hereda la raiz, y Vite FUSIONA las listas: un `include` escrito
 * tambien en la raiz se suma al de cada proyecto, y los tres acaban corriendo todos los archivos —el
 * que monta el portal, tambien en `unidad`, con los plazos por omision—. Leido del objeto, cada
 * proyecto diria solo lo suyo. Por eso se le pregunta a Vitest, con su propio emparejador.
 */
async function resolverLosProyectos(): Promise<ReadonlyMap<string, ProyectoResuelto>> {
  const vitest = await createVitest('test', { watch: false, config: join(RAIZ, 'vitest.config.ts') });
  try {
    const proyectos = new Map<string, ProyectoResuelto>();
    for (const proyecto of vitest.projects) {
      const { testFiles } = await proyecto.globTestFiles();
      proyectos.set(proyecto.name, {
        archivos: testFiles.map((ruta) => relative(RAIZ, ruta)).sort(),
        plazo: proyecto.config.testTimeout,
        preparacion: proyecto.config.setupFiles.map((ruta) => relative(RAIZ, ruta)),
        paralelo: proyecto.config.fileParallelism,
      });
    }
    return proyectos;
  } finally {
    await vitest.close();
  }
}

let resueltos: Promise<ReadonlyMap<string, ProyectoResuelto>> | undefined;

/** Una sola resolucion por archivo: cada una levanta un servidor de Vite por proyecto. */
function proyectosResueltos(): Promise<ReadonlyMap<string, ProyectoResuelto>> {
  return (resueltos ??= resolverLosProyectos());
}

interface ProyectoResuelto {
  readonly archivos: readonly string[];
  readonly plazo: number;
  readonly preparacion: readonly string[];
  readonly paralelo: boolean;
}

/** Los `*.test.ts(x)` del arbol, con su ruta relativa a la raiz del frontend; sin las muestras. */
function pruebasDelArbol(): string[] {
  return ['src', 'verificaciones']
    .flatMap((directorio) =>
      readdirSync(join(RAIZ, directorio), { recursive: true, encoding: 'utf8' }).map((ruta) => join(directorio, ruta)),
    )
    .filter((ruta) => /\.test\.tsx?$/.test(ruta) && !ruta.startsWith('verificaciones/muestras/'))
    .sort();
}

/**
 * Quien monta el portal entero: por el arnes (`montarElPortal(`), o a mano, con la aplicacion
 * (`<Aplicacion`) o su enrutador (`crearEnrutador(`). Lo que NO ve: un archivo que monte el portal por
 * otra pieza que los envuelva (una funcion propia que llame a `montarElPortal` desde otro modulo de
 * pruebas); si aparece, se anade aqui su nombre.
 */
const MONTA_EL_PORTAL = /montarElPortal\(|<Aplicacion\b|crearEnrutador\(/;

/** El proyecto que declara los plazos del portal, y el archivo que pone su espera. */
const PORTAL = 'portal';
const PONE_LA_ESPERA = 'src/pruebas/esperaDelPortal.ts';

describe('los proyectos de la suite (issue 63)', () => {
  it('cada archivo de prueba corre en UN proyecto, ni en dos ni en ninguno', async () => {
    const proyectos = await proyectosResueltos();
    const enCuantos = new Map<string, string[]>();
    for (const [nombre, { archivos }] of proyectos) {
      for (const archivo of archivos) enCuantos.set(archivo, [...(enCuantos.get(archivo) ?? []), nombre]);
    }

    const mal = pruebasDelArbol()
      .map((archivo) => ({ archivo, proyectos: enCuantos.get(archivo) ?? [] }))
      .filter(({ proyectos: donde }) => donde.length !== 1)
      .map(({ archivo, proyectos: donde }) => `${archivo}: ${donde.length === 0 ? 'ninguno' : donde.join(', ')}`);

    // El centinela: sin archivos que mirar, «ninguno mal repartido» saldria verde.
    expect([...enCuantos.keys()].length).toBeGreaterThanOrEqual(90);
    expect(
      mal,
      'Estos archivos corren en mas de un proyecto (o en ninguno). Un `include` escrito en la raiz se ' +
        'SUMA al de cada proyecto con `extends: true`:\n  ' +
        mal.join('\n  '),
    ).toEqual([]);
  });

  it('el proyecto del portal declara sus plazos: el del caso y el que pone la espera de Testing Library', async () => {
    const portal = (await proyectosResueltos()).get(PORTAL);

    expect(portal, `no hay proyecto «${PORTAL}» en vitest.config.ts`).toBeDefined();
    expect(portal?.plazo).toBe(PLAZO_DEL_PORTAL);
    expect(portal?.preparacion).toContain(PONE_LA_ESPERA);
  });

  it('cada archivo que monta el portal (`montarElPortal`, `<Aplicacion` o `crearEnrutador`) cae en ese proyecto', async () => {
    const proyectos = await proyectosResueltos();
    const delPortal = new Set(proyectos.get(PORTAL)?.archivos ?? []);
    const montan = pruebasDelArbol()
      .filter((ruta) => ruta.startsWith('src/'))
      .filter((ruta) => MONTA_EL_PORTAL.test(readFileSync(join(RAIZ, ruta), 'utf8')));
    const fuera = montan.filter((ruta) => !delPortal.has(ruta));

    // El centinela: si la busqueda dejara de encontrar los archivos, «ninguno fuera» saldria verde.
    expect(montan.length).toBeGreaterThanOrEqual(27);
    expect(
      fuera,
      'Estos archivos montan el portal fuera del proyecto «portal», con los plazos por omision (5 s el ' +
        'caso, 1 s cada espera), que con la maquina ocupada no alcanzan:\n  ' +
        fuera.join('\n  '),
    ).toEqual([]);
  });

  it('y ningun proyecto se ha vuelto secuencial por su cuenta', async () => {
    const secuenciales = [...(await proyectosResueltos())].filter(([, { paralelo }]) => !paralelo).map(([n]) => n);
    expect(secuenciales).toEqual([]);
  });
});
