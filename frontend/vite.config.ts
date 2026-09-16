import process from 'node:process';

import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { PREFIJO } from './src/api/prefijo.ts';
import { LO_QUE_PONE_EL_CONSUMIDOR } from './resolucion.ts';
import { ningunTrozoPasaDelTope, trozoDeProveedor } from './trozos.ts';

/**
 * A donde van las peticiones de la API en desarrollo.
 *
 * Por variable de entorno, con Traefik en el 18080 por omision —lo medido el 2026-09-16 en la
 * plataforma local—: quien levante el backend en otro sitio no tiene que editar este archivo para
 * probar, y un archivo de configuracion editado a mano acaba en un commit que nadie queria.
 */
const BACKEND = process.env.KAMAYUK_BACKEND ?? 'http://localhost:18080';

/**
 * El empaquetado de `ciudadano-web`, portado de `rentas/frontend/vite.config.ts`.
 *
 * `base` es `/portal/` y no `/`: igual que en `rentas` (ADR-0030 §2), el sistema va delante de la
 * ruta y el mismo proxy sirve varias interfaces. Con `base: '/'` el bundle pediria `/assets/…`,
 * que en el cluster es de otro — y el fallo no aparece en desarrollo, donde todo cuelga de la raiz.
 *
 * <h2>El camino a la API en desarrollo, y por que hace falta uno (issue 13)</h2>
 *
 * <b>No es comodidad: es la unica via.</b> El backend de `rentas` **no publica ninguna cabecera
 * `Access-Control-Allow-Origin`** —medido alli: cero `CorsConfiguration` y cero `@CrossOrigin` en
 * todo `backend/`—, asi que una peticion de `http://localhost:5174` a `http://localhost:18080` la
 * bloquea el navegador antes de que nadie la lea. La unica salida sin tocar el backend es que todo
 * salga del **mismo origen**: la pagina y la API por el puerto de Vite, y Vite reenviando a
 * Traefik.
 *
 * <b>Y sin esto el fallo no parece un fallo.</b> Sin `server.proxy`, `/rentas/api/v1/...` lo
 * atiende el propio servidor de Vite, que para cualquier ruta desconocida devuelve el `index.html`
 * de la aplicacion con un **200**. La pantalla pide JSON y recibe HTML con un codigo de exito: no
 * un error, una pagina.
 *
 * `rewrite` no hace falta y por eso no esta: Traefik enruta por `PathPrefix(/rentas)`, o sea que la
 * ruta que sale de aqui es exactamente la que el backend espera. Reescribirla seria quitarle el
 * prefijo por el que se enruta, y el sintoma seria un 404 de Traefik que parece un 404 del backend.
 *
 * La ruta NO se escribe aqui: es `PREFIJO`, que vive en `src/api/prefijo.ts` y que usa tambien el
 * cliente. Lo vigila `verificaciones/camino-a-la-api.test.ts`.
 */
export default defineConfig({
  base: '/portal/',
  /**
   * Tailwind **antes** que React, como en `rentas`: el complemento de Tailwind tiene que ver los
   * archivos para saber que clases se usan. Lo vigila `verificaciones/tailwind-esta-conectado.test.ts`.
   *
   * El tercero hace FALLAR la construccion si algun trozo de JavaScript pasa de 500 kB (issue 11): el
   * porque, en `trozos.ts`; que siga puesto, en `verificaciones/ningun-trozo-pasa-de-500-kb.test.ts`.
   */
  plugins: [tailwind(), react(), ningunTrozoPasaDelTope()],
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
    proxy: {
      [PREFIJO]: {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Que el bundle se pueda leer al depurarlo importa mas que su tamano, igual que en `rentas`.
    sourcemap: true,
    // SIN `chunkSizeWarningLimit`: el aviso de los 500 kB se atiende repartiendo el codigo, no subiendo
    // el liston. Cada pantalla es un `import()` (`src/pasos/pantallas.tsx`) y las dependencias grandes
    // van por familias a su trozo (`trozos.ts`).
    rollupOptions: {
      output: {
        manualChunks: trozoDeProveedor,
      },
    },
  },
});
