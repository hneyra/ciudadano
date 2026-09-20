/**
 * **El rojo que nombra el `git clone`, en `.mjs` para que lo pueda leer tambien ESLint.**
 *
 * Portado de `rentas/frontend/verificaciones/remedio.mjs` (rentas#137). Vive en `.mjs` y no dentro
 * de `enlace.ts` porque hace falta **antes de que exista TypeScript**: `eslint.config.js` carga
 * `eslint.prohibiciones.mjs`, que importa `@kamayuk/verificaciones` del clon hermano, y eso lo
 * ejecuta Node a secas al arrancar ESLint. Un `import` de `./enlace.ts` desde ahi revienta con
 * `ERR_UNKNOWN_FILE_EXTENSION` —Node 22 no quita los tipos sin bandera—, asi que la parte que
 * ESLint necesita vive aqui y la unica copia del mensaje sigue siendo una.
 *
 * Ese motivo CADUCO con el issue 39, y se deja escrito porque explica por que el archivo es como
 * es: medido el 2026-09-20, un `.mjs` que importa un `.ts` funciona en Node 24.19.0 —que quita los
 * tipos sin bandera— y sigue reventando con `ERR_UNKNOWN_FILE_EXTENSION` en Node 22.14.0. El
 * reparto se queda igual: juntarlo otra vez seria tocar el arranque de ESLint por una comodidad, y
 * lo que este archivo tiene que hacer —decir el `git clone`— lo hace desde aqui.
 *
 * El motivo de que el mensaje diga el `git clone` y no «Cannot find module» esta en `enlace.ts`:
 * `yarn install --frozen-lockfile` con el hermano ausente sale con **codigo 0** y no enlaza nada
 * (medido en `rentas`#113), de modo que el primer sintoma aparece dos pasos despues y no se parece
 * a su causa.
 */

/** El repositorio que declara los `link:`. Lo nombra el mensaje: «clonado al lado de …». */
const ESTE_REPOSITORIO = 'ciudadano';

/**
 * De un `link:` a la raiz del clon hermano que da por puesta.
 *
 * `../../kamayuk-lib/paquetes/formato` -> `../../kamayuk-lib`. Se deriva de la ruta en vez de
 * escribirse: un mensaje escrito a mano nombra el repositorio de ayer.
 *
 * @param {string} declarada
 * @returns {string | null}
 */
export function raizDelClon(declarada) {
  const partes = declarada.split('/');
  const hasta = partes.findIndex((parte) => parte !== '..' && parte !== '.');
  return hasta === -1 ? null : partes.slice(0, hasta + 1).join('/');
}

/**
 * Y de ahi, el nombre del repositorio: `../../kamayuk-lib` -> `kamayuk-lib`.
 *
 * @param {string} declarada
 * @returns {string | null}
 */
function clonDe(declarada) {
  const raiz = raizDelClon(declarada);
  return raiz === null ? null : (raiz.split('/').at(-1) ?? null);
}

/**
 * Que hacer cuando un `link:` no esta puesto, nombrando el `git clone` que lo haria existir.
 *
 * Hace falta en tres sitios y dos no miran el disco: `resolucion.ts` lo necesita cuando
 * `require.resolve` revienta, que es DOS pasos antes de que nadie llegue a preguntar por el
 * directorio, y `eslint.prohibiciones.mjs` cuando el `import` de `@kamayuk/verificaciones` no
 * resuelve, que es el PRIMER paso de `yarn verificar`.
 *
 * @param {string} paquete
 * @param {string} declarada
 * @returns {string}
 */
export function remedioDelEnlace(paquete, declarada) {
  const clon = clonDe(declarada);
  return clon === null
    ? `Revisa la ruta declarada para «${paquete}».`
    : `Este frontend NO funciona sin «${clon}» clonado al lado de «${ESTE_REPOSITORIO}»:\n` +
        `    git clone https://github.com/hneyra/${clon} ${raizDelClon(declarada) ?? ''}\n` +
        '  Y no basta con que yarn haya salido en verde: un `link:` a un directorio que no ' +
        'existe se instala con codigo 0 y sin avisar.';
}
