/**
 * Lo que el portal NO puede saber cuando se construye.
 *
 * Portado de `rentas/frontend/src/api/configuracion.ts` (rentas#44) sin cambiar el mecanismo: los
 * tres escalones, la cadena en blanco que cuenta como ausencia y la lectura en tiempo de ejecucion
 * son los mismos. Lo que cambia es el nombre del global y las senias por omision, que son las de
 * ESTE portal y estan medidas (ver abajo).
 *
 * <h2>El problema, medido y no supuesto</h2>
 *
 * `vite build` sustituye cada `import.meta.env.VITE_*` por su valor **al construir** y despues
 * pliega lo que dependa de el: lo que queda en el paquete es una constante, no una lectura. Aqui
 * eso es el defecto: la URL del emisor OIDC no es la misma en el puesto de quien desarrolla
 * (`localhost:18180`), en la marcha blanca y en la municipalidad, y una URL horneada convierte el
 * bundle en el bundle **de un ambiente**.
 *
 * <h2>La salida: un archivo que se sirve, no un valor que se hornea</h2>
 *
 * El ambiente entra **al servir el portal** y no al construirlo. `index.html` carga
 * `configuracion.js` —un guion clasico, y por tanto antes que el modulo, que va diferido— y ese
 * archivo deja un objeto en `window`. En un despliegue lo entrega un `ConfigMap` montado sobre el
 * que la imagen trae; en `yarn dev`, en el arnes y en las pruebas, el que viaja en `public/` esta
 * VACIO a proposito y la cadena cae al escalon siguiente.
 *
 * <h2>Los tres escalones, y por que el ultimo no es «fallar»</h2>
 *
 * `servida` -> `de la construccion` -> `por omision`. El ultimo son las senias de la plataforma
 * local, que es donde corre `yarn dev` y donde corren las pruebas: fallar ahi obligaria a que todo
 * arnes montara un `window.__KAMAYUK_CIUDADANO__` para dibujar una pantalla que —en esta entrega—
 * no entra a ninguna puerta.
 *
 * Lo que **no** hace la cadena es tratar la cadena vacia como un valor: una llave puesta con el
 * valor en blanco es un error de despliegue, y heredar de el una URL vacia daria un rebote a
 * `"/protocol/openid-connect/auth"` —una ruta del propio portal— que el servidor de estaticos
 * contesta con un 200 y el `index.html` dentro. Es el «200 que miente» aplicado a la puerta de
 * identidad: por eso una cadena en blanco cuenta como ausencia.
 */

/** Las senias que se resuelven al servir y no al construir. */
export type ClaveDeConfiguracion = 'oidcRealm' | 'oidcCliente' | 'oidcAlcance';

declare global {
  interface Window {
    /**
     * Lo que deja `public/configuracion.js`.
     *
     * Opcional en el tipo porque de verdad puede no estar: las pruebas montan el portal sin cargar
     * ningun guion clasico, y ahi `window.__KAMAYUK_CIUDADANO__` es `undefined`.
     *
     * **El nombre lleva `CIUDADANO` y no `RENTAS`**, aunque la API que se pide sea la de `rentas`:
     * lo que hay aqui dentro son las senias de ESTA interfaz. Las cinco del producto pueden
     * servirse del mismo origen, y dos que compartieran global se pisarian el realm — que en este
     * caso ni siquiera es el mismo (`kamayuk` para el back-office, `kamayuk-ciudadano` para el
     * portal).
     */
    __KAMAYUK_CIUDADANO__?: Partial<Record<ClaveDeConfiguracion, string>>;
  }
}

/**
 * El tercer escalon: la plataforma local, **medida el 2026-09-16** y no supuesta.
 *
 * · `http://localhost:18180/realms/kamayuk-ciudadano` — el realm del ciudadano. No es el
 *   `kamayuk` del back-office: son dos realms distintos en el mismo Keycloak.
 * · `kamayuk-portal` — el client publico del portal, con PKCE S256, sin secreto y con
 *   `directAccessGrants` desactivado. Sus `redirectUris` ya incluyen
 *   `http://localhost:5174/portal/*` y sus `webOrigins`, `http://localhost:5174`: exactamente lo
 *   que sirve `yarn dev` (`base: '/portal/'`, puerto 5174).
 * · `openid profile` — el alcance que el client admite. El token que devuelve trae los claims
 *   `tipo_documento` y `numero_documento`, y **no** trae `municipalidad_id`.
 */
const POR_OMISION: Record<ClaveDeConfiguracion, string> = {
  oidcRealm: 'http://localhost:18180/realms/kamayuk-ciudadano',
  oidcCliente: 'kamayuk-portal',
  oidcAlcance: 'openid profile',
};

/**
 * El segundo escalon: lo que Vite horneo al construir.
 *
 * Se escriben las tres lecturas **literales**, una por linea, y no con un indice calculado:
 * Vite sustituye `import.meta.env.VITE_ALGO` reconociendolo en el texto, asi que
 * `import.meta.env[clave]` no se sustituiria y las tres saldrian `undefined` en el paquete
 * —en silencio, porque la cadena tiene un escalon mas debajo—.
 */
const DE_LA_CONSTRUCCION: Record<ClaveDeConfiguracion, string | undefined> = {
  oidcRealm: import.meta.env.VITE_KAMAYUK_OIDC_REALM,
  oidcCliente: import.meta.env.VITE_KAMAYUK_OIDC_CLIENTE,
  oidcAlcance: import.meta.env.VITE_KAMAYUK_OIDC_ALCANCE,
};

/** Una cadena en blanco no es un valor: es una llave puesta sin rellenar. Ver la cabecera. */
function siTieneAlgo(valor: string | undefined): string | undefined {
  const limpio = valor?.trim();
  return limpio === undefined || limpio === '' ? undefined : limpio;
}

/** Lo que sirve el contenedor, si es que sirve algo. */
function servida(clave: ClaveDeConfiguracion): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return siTieneAlgo(window.__KAMAYUK_CIUDADANO__?.[clave]);
}

/**
 * El valor de una senia, resuelto por los tres escalones.
 *
 * Se lee **en tiempo de ejecucion** a proposito: si esto se resolviera en una constante de modulo,
 * quien la importara la congelaria en el orden de carga de los modulos, que es exactamente el
 * defecto contra el que existe este archivo.
 */
export function configuracion(clave: ClaveDeConfiguracion): string {
  return servida(clave) ?? siTieneAlgo(DE_LA_CONSTRUCCION[clave]) ?? POR_OMISION[clave];
}

/** De donde salio el valor. Existe para que la prueba pueda distinguir escalon de escalon. */
export function procedencia(clave: ClaveDeConfiguracion): 'servida' | 'construccion' | 'omision' {
  if (servida(clave) !== undefined) return 'servida';
  if (siTieneAlgo(DE_LA_CONSTRUCCION[clave]) !== undefined) return 'construccion';
  return 'omision';
}
