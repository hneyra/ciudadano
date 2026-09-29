// @ts-check
import { LO_QUE_SE_MUTA } from './mutaciones.mjs';

/**
 * **Mutaciones: que las pruebas de los modulos puros fallen cuando el codigo cambia** (issue 63).
 *
 * La tabla «rompi X → rojo» de `CLAUDE.md` era un registro de mutaciones hecho a mano, una vez, que
 * nadie vuelve a comprobar cuando el codigo cambia. Stryker las hace solo sobre `LO_QUE_SE_MUTA`
 * (`mutaciones.mjs`) y cuenta cuantos mutantes sobreviven a las pruebas: un mutante vivo es un cambio
 * de conducta que ninguna prueba nota.
 *
 * `yarn mutaciones`, y FUERA de `yarn verificar`: la corrida entera cuesta minutos (medida, con la
 * puntuacion, junto al umbral de `thresholds`). Lo que la hace valer sin correrla lo vigila
 * `verificaciones/las-mutaciones-tienen-umbral.test.ts`.
 */
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const configuracion = {
  testRunner: 'vitest',
  // Las pruebas que alcanzan lo que se muta, sin las del portal: `vitest.mutaciones.config.ts`.
  vitest: { configFile: 'vitest.mutaciones.config.ts' },
  mutate: [...LO_QUE_SE_MUTA],
  // Cada mutante corre solo las pruebas que pasaron por el: sin esto, cada uno corre la lista entera.
  coverageAnalysis: 'perTest',
  // La maquina de desarrollo tiene 4 nucleos y es compartida (`CLAUDE.md`, «Topes del entorno»).
  concurrency: 2,
  // Lo que no hace falta copiar al directorio de trabajo de Stryker: paquetes construidos e informes.
  ignorePatterns: ['dist', 'dist-*', 'playwright-report', 'test-results', 'reports'],
  tempDirName: '.stryker-tmp',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  /**
   * **`break`: por debajo, `yarn mutaciones` sale con rc=1.** Stryker lo compara con la puntuacion
   * TOTAL de todos los archivos juntos (la columna «total» de su tabla: detectados entre validos,
   * contando como vivos los mutantes sin cobertura), no con la de cada archivo ni con la de «covered».
   *
   * Medido en el issue 63: 82.53 % (596 muertos, 4 caducados, 109 vivos, 18 sin cobertura), en
   * 9 min 19 s. Un mutante caducado cuenta como detectado, y en una maquina menos cargada puede acabar
   * y sobrevivir: los cuatro juntos son 0.55 puntos. El margen hasta 80 cubre eso y un cambio pequeno
   * sin su prueba; lo que no cubre es perder un modulo entero de pruebas. Se sube al matar vivos.
   */
  thresholds: { high: 90, low: 80, break: 80 },
};

export default configuracion;
