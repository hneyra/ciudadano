/**
 * Las prohibiciones de ESTE frontend: **las del producto, con las rutas de ESTE arbol**.
 *
 * Portado de `rentas/frontend/eslint.prohibiciones.mjs`, que las deriva de `@kamayuk/verificaciones`
 * desde rentas#137. Alli hubo antes una copia escrita a mano y, cuando se midio, **ya habia
 * divergido** —ocho de nueve identicas, y la novena con otra ruta y otra forma—, sin ningun rojo
 * que lo dijera. Este portal nace derivando, y
 * `verificaciones/las-prohibiciones-son-las-de-la-libreria.test.ts` vigila que siga asi.
 *
 * <h2>Que sigue siendo verdad de este archivo</h2>
 *
 * Que no esta escrito dentro de `eslint.config.js` a proposito. Lo leen dos consumidores y tienen
 * que leer lo mismo:
 *
 *   1. `eslint.config.js`, que las convierte en opciones de `no-restricted-syntax`, y
 *   2. `verificaciones/reglas-de-eslint.test.ts`, que exige de cada una su muestra.
 *
 * Si la prueba tuviera su propia lista, seria una copia: se anade una regla al config, la lista de
 * la prueba no se toca, y la regla nueva queda sin muestra **en verde**. Derivadas de aqui las dos,
 * una prohibicion sin muestra sale roja sola.
 *
 * El `clave` no es decorativo: **es el nombre de su muestra**. La prueba no tiene un mapa de
 * «regla -> archivo» que alguien pueda dejar desactualizado; compone la ruta.
 */

import { remedioDelEnlace } from './verificaciones/remedio.mjs';

/**
 * La lista del producto, o un rojo que nombra el `git clone`.
 *
 * **El `import` va dinamico y envuelto**, y es el hallazgo de rentas#113. Este archivo lo carga
 * `eslint.config.js`, o sea el PRIMER paso de `yarn verificar`, antes que `tsc` y antes que
 * `enlace-con-kamayuk-lib.test.ts` —que es la guarda que sabe explicar que falta el clon hermano y
 * que vive dos pasos mas tarde—. Con un `import` estatico, lo que se lee al clonar este repositorio
 * a secas es
 *
 *     Error: Cannot find package '@kamayuk/verificaciones' imported from …/eslint.prohibiciones.mjs
 *
 * que habla de un modulo y no de un repositorio que falta. Envuelto, dice el `git clone`.
 */
async function delProducto() {
  const declarada = '../../kamayuk-lib/paquetes/verificaciones';
  try {
    return await import('@kamayuk/verificaciones/prohibiciones');
  } catch (causa) {
    throw new Error(
      'No se pudo cargar «@kamayuk/verificaciones/prohibiciones», de donde salen las nueve\n' +
        `prohibiciones de ESLint de todo el producto (kamayuk-lib#4).\n  ${remedioDelEnlace('@kamayuk/verificaciones', declarada)}`,
      { cause: causa },
    );
  }
}

const { PROHIBICIONES: DEL_PRODUCTO, REGLAS_EXIGIDAS: EXIGIDAS } = await delProducto();

/**
 * Donde `fetch` es legitimo AQUI: **en ningun sitio**.
 *
 * En `rentas` es `['src/api/']`, porque alli viven el cliente HTTP y la puerta PKCE. Este portal
 * es solo demostracion —sin backend y sin login real—, sus datos salen de `src/datos/` y no hay
 * nada a lo que pedir. La lista vacia no apaga la regla: la deja **encendida en todo el arbol**,
 * que es exactamente lo que se quiere. Un `fetch` que aparezca en una pantalla sale rojo, y el dia
 * que haga falta un cliente de verdad, se decide aqui donde vive y con su porque.
 *
 * @type {readonly string[]}
 */
export const DONDE_SE_LLAMA_A_FETCH = [];

/**
 * Lo UNICO que este arbol pone de su parte: donde cae cada excepcion.
 *
 * Va por **clave de prohibicion** y no por ruta de la libreria. Traducir `paquetes/api/` a una ruta
 * de aqui seria un mapa de directorios de otro repositorio, que se queda viejo el dia que alla
 * muevan uno; la clave, en cambio, es el identificador estable de la regla.
 *
 * Una prohibicion con `salvo` que no este aqui **para el proceso**: dejarla pasar tendria dos
 * salidas y las dos malas —aplicarle la ruta de otra, o quitarle la excepcion sin decidirlo—.
 *
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const SALVO_EN_ESTE_ARBOL = {
  'fetch-fuera-del-cliente': DONDE_SE_LLAMA_A_FETCH,
};

const sinTraducir = DEL_PRODUCTO.filter(
  (p) => p.salvo !== undefined && SALVO_EN_ESTE_ARBOL[p.clave] === undefined,
).map((p) => `  · ${p.clave}, exceptuada en la libreria de: ${[...(p.salvo ?? [])].join(', ')}`);

if (sinTraducir.length > 0) {
  throw new Error(
    '`@kamayuk/verificaciones` trae prohibiciones con excepcion que este arbol no ha situado:\n' +
      `${sinTraducir.join('\n')}\n` +
      'Anade su entrada a SALVO_EN_ESTE_ARBOL en `frontend/eslint.prohibiciones.mjs`, diciendo\n' +
      'que directorio de ESTE arbol hace lo que alli hace el suyo — o la lista vacia, si aqui no\n' +
      'hay ninguno.',
  );
}

const huerfanas = Object.keys(SALVO_EN_ESTE_ARBOL).filter(
  (clave) => !DEL_PRODUCTO.some((p) => p.clave === clave && p.salvo !== undefined),
);

if (huerfanas.length > 0) {
  throw new Error(
    `SALVO_EN_ESTE_ARBOL situa excepciones que ya nadie pide: ${huerfanas.join(', ')}.\n` +
      'O la prohibicion dejo de exceptuar nada, o cambio de clave. Una excepcion que no cuelga de\n' +
      'ninguna regla no exceptua: solo se queda ahi pareciendo que si.',
  );
}

/**
 * Las nueve del producto, cada una con la ruta que le toca en este arbol.
 *
 * @type {readonly {
 *   clave: string;
 *   regla: string;
 *   selector: string;
 *   message: string;
 *   salvo?: readonly string[];
 * }[]}
 */
export const PROHIBICIONES = DEL_PRODUCTO.map((prohibicion) =>
  prohibicion.salvo === undefined
    ? prohibicion
    : { ...prohibicion, salvo: SALVO_EN_ESTE_ARBOL[prohibicion.clave] },
);

/**
 * Las reglas del producto que el frontend expresa como verificacion. **Tal cual**: son las del
 * producto, no las de este sistema, y por eso se reexportan sin tocarlas.
 *
 * ES LA LISTA ESCRITA A MANO —alla—, y es deliberado que sea la unica. `PROHIBICIONES` se deriva
 * hacia la prueba, asi que **borrar una prohibicion borraria tambien su prueba**, en silencio.
 * Esta lista es lo que se pone rojo cuando eso pasa.
 *
 * @type {readonly string[]}
 */
export const REGLAS_EXIGIDAS = EXIGIDAS;
