import { defineConfig, devices } from '@playwright/test';

import { PUERTO, URL_DEL_ARNES } from './puerto-del-arnes.mjs';

/**
 * **El arnes que mide lo que jsdom no puede: que el portal se VEA** (issue 11). Portado de
 * `rentas/frontend/playwright.config.ts` (rentas#107, rentas#148).
 *
 * <h2>Por que este arnes existe, si ya hay pruebas de `vitest`</h2>
 *
 * Porque todas comparan `className` **como texto** y jsdom no aplica CSS. Ninguna dice que Tailwind
 * emita las clases de `@kamayuk/ui` —en `rentas`, el primer arnes encontro que mas de la mitad no
 * generaban regla—, que una rejilla se reacomode a 400 px, que una tabla no desplace la pagina, que la
 * barra sea azul, ni que al imprimir quede solo el recibo. Las especificaciones de `e2e/` lo miden en
 * Chromium.
 *
 * <h2>Contra el BUNDLE y no contra `yarn dev`</h2>
 *
 * `vite preview` sirve lo que `vite build` produjo — el artefacto de verdad, con sus trozos repartidos
 * (`trozos.ts`) y su CSS ya emitido. Con el servidor de desarrollo se mediria un arbol de modulos sin
 * empaquetar, con su CSS inyectado por otra via: verde aqui y roto en produccion es exactamente lo que
 * un arnes tiene que impedir.
 *
 * <h2>Y por que el puerto NO esta escrito aqui</h2>
 *
 * Porque en `rentas` estaba escrito TRES veces —`baseURL`, `webServer.url` y el `--port`— y el arnes de
 * una rama midio el bundle de otra (rentas#140). Sale de `puerto-del-arnes.mjs`, que lo deriva del
 * ARBOL —el mismo siempre para la misma copia de trabajo, distinto para cada una— y en CI es el de
 * `vite preview`. Lo vigila `verificaciones/el-puerto-del-arnes-sale-del-arbol.test.ts`.
 */
export default defineConfig({
  testDir: './e2e',
  // Sin paralelo: son pocos caminos y comparten el mismo servidor. El paralelo aqui compra
  // segundos y paga con rojos que dependen del orden.
  fullyParallel: false,
  workers: 1,
  // El informe HTML siempre: en CI viaja como artefacto (`playwright-report/`), y en local es donde se
  // abren las trazas de un rojo.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: URL_DEL_ARNES,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  /**
   * Que lo servido sea el `dist/` de este arbol y no el de otro (rentas#148). Corre DESPUES del
   * `webServer` —los complementos van delante de los `globalSetup`— y detiene la corrida entera, que es
   * lo que un camino suelto no puede hacer.
   */
  globalSetup: './e2e/el-bundle-servido-es-el-mio.ts',
  webServer: {
    // `build` delante, porque `preview` sin `dist` sirve un 404 con codigo 200. Y `--strictPort` SE
    // QUEDA: sin el, Vite se mueve de puerto en silencio y el `baseURL` se queda donde estaba, que es
    // medir el servidor de otro.
    //
    // La comprobacion de que el puerto esta libre NO esta aqui: esta en el script `e2e` de
    // `package.json`, DELANTE de `playwright test`. Medido en rentas#148: puesta en este comando,
    // Playwright ya ha hablado antes con su propio aviso («… is already used»), que no dice quien tiene
    // el puerto ni desde que directorio.
    //
    // <h3>`build:arnes` y no `build`: el arnes mide el bundle EN MODO DEMOSTRACION (issue 27)</h3>
    //
    // `build:arnes` es `NODE_ENV=development vite build --mode development`, y hacen falta LAS DOS
    // mitades. Medido, una por una:
    //
    //   · sin `NODE_ENV=development`, `vite build` lo fija a `production` por su cuenta e
    //     `import.meta.env.DEV` sale `false` **tambien con `--mode development`**: la primera
    //     condicion corta y el `import()` de la demostracion se pliega igual;
    //   · sin `--mode development`, el modo es `production` y Vite **no carga `.env.development`**,
    //     asi que la bandera llega `undefined` y corta la segunda condicion. (El paquete sale con
    //     React de desarrollo y en modo plataforma, que es lo peor de los dos mundos.)
    //
    // Y hace falta porque lo que este arnes recorre es **el recorrido de la demostracion**: buscar
    // por documento, entrar con la cuenta del artboard, pagar y ver el comprobante. Con plataforma
    // nada de eso existe —el paso 1 consulta al servidor y «Iniciar sesión» se va a Keycloak—, asi
    // que un arnes contra el paquete de produccion mediria un portal que pide a un backend que en CI
    // no esta. El recorrido con plataforma es del issue 28, y lo cubrira con su propio backend falso.
    //
    // Lo que esto NO deja de medir es que la demostracion se caiga del paquete de PRODUCCION:
    // `e2e/la-demostracion-no-viaja-al-bundle.spec.ts` construye ese aparte y compara los dos.
    command: `yarn build:arnes && yarn preview --port ${PUERTO} --strictPort`,
    url: URL_DEL_ARNES,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
