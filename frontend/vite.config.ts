import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { LO_QUE_PONE_EL_CONSUMIDOR } from './resolucion.ts';

/**
 * El empaquetado de `ciudadano-web`, portado de `rentas/frontend/vite.config.ts`.
 *
 * `base` es `/portal/` y no `/`: igual que en `rentas` (ADR-0030 §2), el sistema va delante de la
 * ruta y el mismo proxy sirve varias interfaces. Con `base: '/'` el bundle pediria `/assets/…`,
 * que en el cluster es de otro — y el fallo no aparece en desarrollo, donde todo cuelga de la raiz.
 *
 * <h2>Lo que `rentas` tiene y aqui NO, a proposito</h2>
 *
 * **Sin `server.proxy`.** En `rentas` existe porque su backend no publica CORS y la unica via es
 * el mismo origen. Este portal es solo demostracion: no hay backend al que reenviar, y los datos
 * saldran de `src/datos/`. Un proxy hacia ninguna parte seria una promesa que nadie cumple.
 */
export default defineConfig({
  base: '/portal/',
  /**
   * Tailwind **antes** que React, como en `rentas`: el complemento de Tailwind tiene que ver los
   * archivos para saber que clases se usan. Lo vigila `verificaciones/tailwind-esta-conectado.test.ts`.
   */
  plugins: [tailwind(), react()],
  /**
   * **UNA sola copia de lo que los paquetes enlazados dan por puesto.**
   *
   * La lista NO se escribe: se deriva de las `peerDependencies` de cada `@kamayuk/*` enlazado.
   * El porque entero —con los dos rojos que le costo a `rentas`, `Cannot read properties of null
   * (reading 'useId')` en local y `Cannot find module 'react'` en CI— esta en `resolucion.ts`.
   */
  resolve: {
    dedupe: [...LO_QUE_PONE_EL_CONSUMIDOR],
  },
  /**
   * 5174 y no el 5173 por omision de Vite: el 5173 es el de `rentas`, y con los dos portales
   * abiertos a la vez el segundo saltaria a otro puerto en silencio. `strictPort` lo convierte en
   * un error que se lee, en vez de una URL que ya no es la que dice `CLAUDE.md`.
   */
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    // Que el bundle se pueda leer al depurarlo importa mas que su tamano, igual que en `rentas`.
    sourcemap: true,
  },
});
