// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configDefaults } from 'vitest/config';

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
 *   · los plazos de los casos que montan el portal entero (`plazosDelPortal()`). Un archivo nuevo que
 *     monte el portal sin pedirlos vuelve a 5 s el caso y 1 s cada espera: pasa en la maquina libre y
 *     cae en la cargada.
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

/** Los `*.test.ts(x)` de `src/`, con su ruta relativa a la raiz del frontend. */
function pruebasDeSrc(): string[] {
  return readdirSync(join(RAIZ, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((ruta) => /\.test\.tsx?$/.test(ruta))
    .map((ruta) => join('src', ruta))
    .sort();
}

/**
 * Quien monta el portal entero: por el arnes (`montarElPortal(`), o a mano, con la aplicacion
 * (`<Aplicacion`) o su enrutador (`crearEnrutador(`). Lo que NO ve: un archivo que monte el portal por
 * otra pieza que los envuelva (una funcion propia que llame a `montarElPortal` desde otro modulo de
 * pruebas); si aparece, se anade aqui su nombre.
 */
const MONTA_EL_PORTAL = /montarElPortal\(|<Aplicacion\b|crearEnrutador\(/;

// En el nivel superior (la linea empieza por la llamada): dentro de un caso ya no cambiaria su plazo.
const DECLARA_EL_PLAZO = /^plazosDelPortal\(\);$/m;

describe('los plazos de los casos que montan el portal entero', () => {
  it('los pide cada archivo que monta el portal: `montarElPortal`, `<Aplicacion` o `crearEnrutador`', () => {
    const montan = pruebasDeSrc().filter((ruta) => MONTA_EL_PORTAL.test(readFileSync(join(RAIZ, ruta), 'utf8')));
    const sinPlazo = montan.filter((ruta) => !DECLARA_EL_PLAZO.test(readFileSync(join(RAIZ, ruta), 'utf8')));

    // El centinela: si la busqueda dejara de encontrar los archivos, «ninguno sin plazo» saldria verde.
    expect(montan.length).toBeGreaterThanOrEqual(27);
    expect(
      sinPlazo,
      'Estos archivos montan el portal con los plazos por omision (5 s el caso, 1 s cada espera), que con ' +
        'la maquina ocupada no alcanzan. Pidelos en el nivel superior del archivo: ' +
        `\`plazosDelPortal();\`\n  ${sinPlazo.join('\n  ')}\n`,
    ).toEqual([]);
  });
});
