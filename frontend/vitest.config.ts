import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { LO_QUE_PONE_EL_CONSUMIDOR } from './resolucion.ts';

export default defineConfig({
  /**
   * La MISMA base que `vite.config.ts`, y no por simetria: de aqui sale
   * `import.meta.env.BASE_URL`, que es la raiz de la aplicacion.
   *
   * En `rentas`, con la base por omision —`/`— el entorno de pruebas no se parecia al real **justo
   * en lo que fallaba**: un `redirect_uri` volvia a la raiz del SITIO y la prueba que lo fijaba
   * afirmaba lo mismo, en verde. El defecto llego a produccion. Aqui se evita desde el principio.
   */
  base: '/portal/',
  plugins: [react()],
  /**
   * **UNA sola copia de lo que los paquetes enlazados dan por puesto.** Derivada, no escrita: el
   * porque esta en `resolucion.ts`.
   */
  resolve: {
    dedupe: [...LO_QUE_PONE_EL_CONSUMIDOR],
  },
  test: {
    environment: 'jsdom',
    /**
     * **Dos procesos de prueba, y no uno por nucleo** (issue 42).
     *
     * Sin esto Vitest levanta `nucleos - 1` procesos (`forks`, su `pool` por omision): 3 en la maquina
     * de desarrollo, de 4 nucleos, que ademas corre `k3s-server` y otras suites. Medido el 2026-09-23
     * con `yarn verificar` entero:
     *
     *     procesos   carga      tiempo    resultado
     *     3          7.5        222 s     verde
     *     2          4.2        212 s     verde
     *     1          6.6        410 s     verde
     *
     * Con la maquina libre, 2 cuesta lo mismo que 3 —la CPU ya estaba repartida— y 1 casi dobla el
     * tiempo. 2 deja un nucleo a lo demas de la maquina en vez de quitarselo. Lo que NO arregla el tope
     * por si solo: con carga 15 puesta desde fuera, los casos que montan el portal caducaban igual con 2
     * que con 3 (10 y 7 rojos). Eso lo arreglan sus plazos, dichos en cada archivo
     * (`PLAZO_DEL_PORTAL`, `src/pruebas/portal.tsx`).
     *
     * `maxWorkers` y no `poolOptions.threads.maxThreads`: el `pool` es `forks`, y el tope de hilos
     * —como la variable `VITEST_MAX_THREADS`— **no se aplica a los procesos**. Medido: con
     * `VITEST_MAX_THREADS=1` seguian corriendo 3. `VITEST_MAX_FORKS=<n>` (o `--maxWorkers=<n>`) si
     * gana a esta linea, para medir otro tope sin tocarla. El tope lo vigila
     * `verificaciones/la-suite-tiene-tope.test.ts`.
     */
    maxWorkers: 2,
    /**
     * **La bandera de `.env.development`, puesta a mano** (issue 27).
     *
     * Vitest corre en modo `test`, y Vite carga `.env.development` **solo** en modo `development`:
     * sin esta linea, `import.meta.env.VITE_KAMAYUK_SIN_PLATAFORMA` seria `undefined` en las
     * pruebas y el portal montado por ellas elegiria la fuente de la plataforma — o sea, las 427
     * pruebas saldrian a la red y a Keycloak, que es justo lo que este issue promete que no pasa.
     *
     * No se declara `mode: 'development'` en su lugar porque eso cambiaria ademas `NODE_ENV` y el
     * modo de React; lo que hace falta es una variable, y aqui se pone una.
     *
     * Que diga lo MISMO que `.env.development` no se confia a la vista: lo compara
     * `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts`.
     */
    env: { VITE_KAMAYUK_SIN_PLATAFORMA: 'true' },
    // Sin globales: un `describe` que aparece de la nada no dice de donde sale, y el
    // compilador tampoco. Aqui cada cosa se importa.
    globals: false,
    // Las pruebas del codigo viven JUNTO al codigo; las de las barreras, en
    // `verificaciones/`, porque no prueban una unidad sino una propiedad del arbol.
    include: ['{src,verificaciones}/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'verificaciones/muestras/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
