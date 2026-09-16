import { crearIdentidad, type ConfiguracionDeIdentidad, type Identidad } from '@kamayuk/sesion';

import { configuracion } from './configuracion.ts';

/**
 * **La puerta de identidad del portal: la de `@kamayuk/sesion`, con lo que nombra a ESTE portal**
 * (issue 13).
 *
 * <h2>Lo que hay aqui, y lo que NO</h2>
 *
 * Aqui estan **las seis decisiones** que `crearIdentidad` pide a quien la consume, y ninguna linea
 * del flujo. El codigo de autorizacion con PKCE S256, la sonda del emisor, el canje, el token en
 * memoria, los dos frenos del rebote, la salida con `id_token_hint` y la consola de la cuenta son
 * de la libreria. `rentas` tiene 537 lineas de ese flujo en su propio `src/api/identidad.ts`, y
 * `catastro` llego a tener una copia suya de 351 (`catastro`#110): con dos copias, cada sistema
 * vuelve a descubrir cada defecto; con una, lo descubre uno y lo arregla la libreria para los
 * cinco. Este portal nace sin copia.
 *
 * <h2>Se construye UNA vez, y despues de leer `configuracion.js`</h2>
 *
 * `crearIdentidad` toma la configuracion **al construir** y la guarda: no vuelve a leer el global.
 * Asi que el orden importa, y lo sostiene `index.html` —`configuracion.js` como guion CLASICO
 * antes del modulo, o sea ejecutado antes de evaluar ningun `import`—. Si un dia ese guion pasara
 * a `type="module"`, esta constante congelaria el realm de `localhost:18180` en cada
 * municipalidad; lo mide `src/api/identidad.test.ts`.
 *
 * Una constante de modulo, y no una funcion que la construya a demanda, porque el cliente de la
 * API es una linea que recibe `identidad.token`: el TOKEN cambia dentro de la vida de la pagina
 * —por eso viaja como funcion—, pero la puerta no.
 *
 * <h2>El token vive en MEMORIA, y esta entrega no lo cambia</h2>
 *
 * La prohibicion `token-en-almacenamiento` sigue encendida en todo el arbol, sin excepcion. Lo
 * unico que la libreria escribe en `sessionStorage` son las cinco claves del rebote —el
 * verificador PKCE, el estado, el destino, la cuenta de idas y la marca de salida—, que no son
 * credenciales: el verificador solo vale para el canje que lo genero, y sin el no se puede pedir
 * ningun token. Las nombra una por una `verificaciones/el-token-vive-en-memoria.test.ts`.
 */

/**
 * **El retorno: la raiz de la APLICACION, no la del sitio.**
 *
 * `import.meta.env.BASE_URL` es la `base` de `vite.config.ts` —`/portal/`—, de donde ya salen los
 * activos del paquete, asi que no hay un segundo sitio que mantener. Y es exactamente lo que el
 * client `kamayuk-portal` declara: medido el 2026-09-16, sus `redirectUris` incluyen
 * `http://localhost:5174/portal/*`, que es lo que sirve `yarn dev`.
 *
 * `origin + '/'` es lo que tenia `rentas` y le costo el acceso a produccion (rentas#71): quien se
 * autenticaba volvia a `https://<dominio>/` con el `code` y el `iss` correctos, y recibia un 404.
 * La autenticacion funcionaba y el retorno no. Con `base: '/'` los dos valores coinciden y el
 * defecto no se ve, por eso `vitest.config.ts` fija la misma base que `vite.config.ts`.
 */
function retorno(): string {
  return window.location.origin + import.meta.env.BASE_URL;
}

/**
 * **A donde se vuelve cuando la ida no llevaba hash**: el primer paso del recorrido.
 *
 * Se escribe, y no se deriva de `RUTA_DEL_PASO` (`src/recorrido/rutas.ts`), a proposito: ese modulo
 * arrastra React, el enrutador y —por `recorrido.ts`— los datos de demostracion, y este archivo lo
 * carga `arranque.ts` **antes de montar nada**. Lo que impide que se quede viejo es su prueba, que
 * si puede importarlos: `src/api/identidad.test.ts` exige que esta cadena sea el hash del paso con
 * el que arranca `ESTADO_INICIAL`.
 */
export const DESTINO_POR_OMISION = '#/buscar';

/**
 * Lo que ata la puerta a ESTE portal, entero y en un sitio.
 *
 * · `realm`, `cliente` y `alcance`: de la cadena de `configuracion.ts` —servida, horneada, por
 *   omision—, que es lo que deja un bundle para todas las municipalidades.
 * · `retorno` y `destinoPorOmision`: ver arriba.
 * · `prefijoDeClaves`: `kamayuk.ciudadano`, el mismo que el tema (`src/aplicacion.tsx`). Las
 *   interfaces del producto pueden servirse del mismo origen y comparten `sessionStorage`; con el
 *   prefijo de otro sistema, abrir las dos en la misma pestana pisaria el verificador PKCE de la
 *   primera, y el sintoma seria un «no se pudo completar la ida» sin causa a la vista.
 *
 * Exportada por las pruebas: es la unica forma de mirar lo que se le pasa a la libreria sin
 * reimplementarla.
 */
export function configuracionDeLaPuerta(): ConfiguracionDeIdentidad {
  return {
    realm: configuracion('oidcRealm'),
    cliente: configuracion('oidcCliente'),
    alcance: configuracion('oidcAlcance'),
    retorno: retorno(),
    destinoPorOmision: DESTINO_POR_OMISION,
    prefijoDeClaves: 'kamayuk.ciudadano',
  };
}

/** La puerta de este portal. Ver la cabecera: se construye al evaluar el modulo, y una sola vez. */
export const identidad: Identidad = crearIdentidad(configuracionDeLaPuerta());
