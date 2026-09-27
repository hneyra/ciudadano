/**
 * **Las rutas reservadas donde las guardas de ESLint juzgan sus muestras** (issue 55, y su
 * revision, ronda 1 del PR #65).
 *
 * `reglas-de-eslint.test.ts` y `los-datos-no-cuentan-a-mano.test.ts` lintan sus muestras con
 * `eslint.lintText`, con la RUTA de un archivo que no existe en el disco, para que la regla se
 * evalue en el sitio donde tiene que aplicar de verdad. Sin un proyecto que lo reclame, el
 * «project service» de `typescript-eslint` no PARSEA el archivo (`eslint.config.js`, que exceptua
 * estas rutas con `allowDefaultProject`, es lo que lo arregla) — pero la primera version de esa
 * lista escribia nombres corrientes (`src/pantallas/*`, `src/datos/recibos.ts`,
 * `src/datos/calentamiento.ts`): un archivo REAL futuro con ese nombre exacto habria caido en el
 * mismo `allowDefaultProject` y perdido el chequeo de tipos **en silencio**, sin que nada lo dijera.
 *
 * El nombre `__no_existe_de_verdad__` es la marca reservada: nadie escribe asi un archivo de
 * produccion, asi que la colision practicamente no puede ocurrir. Y por si ocurre de todos modos,
 * `verificaciones/las-rutas-de-muestra-no-existen.test.ts` comprueba que estas rutas NO existen en
 * el disco — importando las MISMAS constantes que aqui, para que la comprobacion no pueda divergir
 * de lo que `allowDefaultProject` de verdad exceptua.
 *
 * **Este archivo vive APARTE de `eslint.config.js`, y no dentro** (revision del PR #65, ronda 1):
 * la primera version las declaraba ahi mismo y las exportaba, y `reglas-de-eslint.test.ts` las
 * importaba de vuelta desde el config. Eso metia `eslint.config.js` —que referencia objetos de
 * complementos sin tipos completos, como `eslint-plugin-jsx-a11y`— en el grafo de modulos que
 * `tsc` compila con `checkJs: true`, y `yarn typecheck` salia en rojo: «Could not find a
 * declaration file for module 'eslint-plugin-jsx-a11y'». Este archivo no importa nada —dos
 * cadenas sueltas—, asi que `eslint.config.js` y las pruebas pueden importarlo sin arrastrarse el
 * uno al otro.
 */

/**
 * El directorio generico: las nueve muestras de prohibiciones y las de
 * «reglas no senalan codigo correcto» se juzgan aqui dentro.
 */
export const DIRECTORIO_DE_MUESTRAS = 'src/__no_existe_de_verdad__';

/**
 * Dentro de `src/datos/`, y NO del directorio de arriba: el caso del `fetch` exceptuado
 * (`reglas-de-eslint.test.ts`) prueba que la excepcion de `src/api/` no se derrama a OTRO
 * directorio REAL de la aplicacion —no a uno inventado—, y por eso necesita su propio nombre
 * reservado DENTRO de un directorio que si existe. El mismo archivo sirve de precalentamiento en
 * `los-datos-no-cuentan-a-mano.test.ts`: los dos usos son texto suelto que pasa por `lintText`, sin
 * relacion con lo que haya de verdad en `src/datos/`.
 */
export const ARCHIVO_RESERVADO_EN_DATOS = 'src/datos/__no_existe_de_verdad__.ts';
