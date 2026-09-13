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
