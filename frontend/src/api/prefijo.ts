/**
 * **La raiz de la API que este portal consulta, escrita UNA vez** (issue 13).
 *
 * La leen `src/api/cliente.ts`, que compone con ella cada peticion, y `vite.config.ts`, que enruta con
 * ella el `server.proxy` de desarrollo. Es un archivo hoja, sin un solo `import`: `vite.config.ts` se
 * ejecuta en Node, donde el `import.meta.env` que arrastra el cliente no existe. Es `rentas` y no
 * `ciudadano` porque delante va el sistema que responde (infrastructure ADR-0030 §2).
 *
 * Lo que se midio y lo descartado: `docs/adr/CIU-0001-la-raiz-de-la-api-escrita-una-vez.md`.
 */
export const PREFIJO = '/rentas/api/v1';
