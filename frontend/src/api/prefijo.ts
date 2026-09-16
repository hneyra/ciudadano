/**
 * **La raiz de la API que este portal consulta, escrita UNA vez** (issue 13).
 *
 * <h2>Quien la lee, y por eso esta sola en un archivo</h2>
 *
 * Dos: `src/api/cliente.ts`, que compone con ella cada peticion, y `vite.config.ts`, que enruta
 * con ella el `server.proxy` de desarrollo. Con la cadena escrita en los dos sitios —que es como
 * esta en `rentas`— cada mitad funciona sola y el desajuste **solo aparece con las dos puestas a la
 * vez**: la peticion sale a `/rentas/api/v1/...`, el proxy espera otra ruta, y el servidor de Vite
 * contesta el `index.html` con un 200. La pantalla pide JSON y recibe HTML **con un codigo de
 * exito**: no parece un error, asi que nadie lo busca.
 *
 * <h2>Y por que no vive dentro de `cliente.ts`, que seria su sitio natural</h2>
 *
 * Porque `vite.config.ts` no puede importarlo de ahi, y esta medido. `cliente.ts` arrastra
 * `identidad.ts` y con el `configuracion.ts`, que lee `import.meta.env.VITE_*` — y **eso solo
 * existe dentro del paquete**: Vite empaqueta su configuracion con esbuild y la ejecuta en Node,
 * donde `import.meta.env` es `undefined`. `yarn build` sale con rc=1 antes de leer un solo archivo
 * de `src/`:
 *
 *     failed to load config from …/frontend/vite.config.ts
 *     error during build:
 *     TypeError: Cannot read properties of undefined (reading 'VITE_KAMAYUK_OIDC_REALM')
 *
 * Un archivo hoja —sin un solo `import`— es lo que deja que los dos consumidores lean la misma
 * constante sin que el de Node arrastre el de navegador.
 *
 * <h2>Por que `rentas` y no `ciudadano`</h2>
 *
 * ADR-0030 §2 pone delante **el sistema que responde**, no el que pregunta: el primer segmento
 * enruta sin mirar mas y dice quien contesta. `GET /portal/situacion` lo atiende el backend de
 * `rentas`; este portal no tiene backend propio.
 */
export const PREFIJO = '/rentas/api/v1';
