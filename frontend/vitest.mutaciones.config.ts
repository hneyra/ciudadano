import { defineConfig } from 'vitest/config';

import configuracion from './vitest.config.ts';
import { pruebasDeLoMutado } from './verificaciones/mutaciones.ts';

/**
 * **La suite con la que Stryker mata mutantes** (issue 63): la de `vitest.config.ts`, con UN proyecto
 * en lugar de tres.
 *
 * Ese proyecto corre las pruebas que importan alguno de los modulos que `stryker.config.mjs` muta, sin
 * las que montan el portal: cada mutante vuelve a correr las que lo cubren, y un caso del portal cuesta
 * segundos donde uno de unidad cuesta milisegundos. La lista no se escribe: la deriva el grafo de
 * `import` (`verificaciones/mutaciones.ts`), asi que una prueba nueva de esos modulos entra sola.
 */
export default defineConfig({
  ...configuracion,
  test: {
    ...configuracion.test,
    projects: [
      {
        extends: true,
        test: { name: 'mutaciones', include: [...pruebasDeLoMutado()], environment: 'jsdom' },
      },
    ],
  },
});
