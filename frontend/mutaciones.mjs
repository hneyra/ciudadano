/**
 * **Los modulos que Stryker muta** (issue 63): los puros de los que cuelga el dinero, el recorrido y
 * lo que el portal le dice al ciudadano cuando algo falla, y el tope del paquete.
 *
 *   · `src/datos/cuentas.ts`: cada cifra que el portal ensena sale de aqui.
 *   · `src/recorrido/recorrido.ts`: la maquina de estados del recorrido, sin React.
 *   · `src/api/escalera.ts`: el peldano y sus textos para cada fallo de la plataforma.
 *   · `src/datos/deLaSituacion.ts`: la unica traduccion de `GET /portal/situacion` al portal.
 *   · `trozos.ts`: el reparto del paquete y el tope de 500 kB que hace fallar `vite build`.
 *
 * Vive aparte, sin un solo `import`, por lo mismo que `rutasDeMuestra.mjs`: lo leen
 * `stryker.config.mjs` (Node, sin TypeScript) y `verificaciones/mutaciones.ts`, que deriva de aqui las
 * pruebas que corre Stryker.
 */
export const LO_QUE_SE_MUTA = [
  'src/datos/cuentas.ts',
  'src/recorrido/recorrido.ts',
  'src/api/escalera.ts',
  'src/datos/deLaSituacion.ts',
  'trozos.ts',
];
