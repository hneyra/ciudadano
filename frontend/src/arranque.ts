import type { FallaDeLaPuerta } from '@kamayuk/sesion';

import { identidad } from './api/identidad.ts';

/**
 * **El arranque del portal: primero quien pregunta, y solo entonces quien dibuja** (issue 13).
 *
 * Sigue a `rentas/frontend/src/arranque.ts` y a `catastro/frontend/src/arranque.ts`, con **una
 * diferencia que es todo el sentido de esta entrega**: aqui NO se va a la puerta.
 *
 * <h2>El montaje entra como ARGUMENTO, y eso se queda</h2>
 *
 * `arrancar(montar)` recibe el montaje en vez de que el montaje venga en la linea de abajo, porque
 * hay cosas que tienen que pasar **antes de que React monte** y la unica forma de que no puedan
 * colarse despues es que el montaje sea lo ultimo que esta funcion hace. Hoy es el canje del
 * codigo de autorizacion; manana sera otra. La forma aguanta el cambio; una linea suelta debajo,
 * no.
 *
 * <h2>Lo que NO hace, y por que es la decision del issue</h2>
 *
 * `rentas` y `catastro` van a la puerta cuando no hay token: sin identificarse no tienen nada que
 * ensenar. **Este portal si tiene**: el recorrido entero funciona en modo demostracion, y quien
 * entra a mirar cuanto debe no puede encontrarse un formulario de Keycloak antes de haber visto
 * una pantalla. Asi que aqui no se llama a `entrar()` al arrancar, y por eso `yarn dev`, las
 * pruebas y el arnes siguen sin tocar la plataforma. Cuando el doble modo llegue (issue 15), lo
 * que decidira la ida es la bandera, no la ausencia de token.
 *
 * Lo que si se hace **siempre** es canjear si volvemos: es barato —`canjearSiVuelve()` mira la
 * barra de direcciones y devuelve `sin-vuelta` sin tocar la red ni el almacenamiento cuando no hay
 * `?code=` ni `?error=`— y es lo unico que no puede esperar. Si se montara primero, la primera
 * peticion de la primera pantalla saldria sin token y recibiria su 401.
 *
 * <h2>Y cuando la vuelta falla, se dice: nunca una pagina en blanco</h2>
 *
 * Volver con `?error=access_denied`, con un `state` que no cuadra o con un canje que el emisor
 * rechaza deja al portal **sin token y sin motivo a la vista**: la libreria limpia la URL —un
 * codigo usado no vale dos veces— y lo unico que quedaria seria la pantalla de siempre, como si
 * nadie hubiera intentado entrar. `vueltaFallida()` es lo que `src/aplicacion.tsx` lee para
 * dibujar «la puerta no contesto» con **lo que dijo el emisor**, que es lo que hace falta para
 * arreglarlo.
 */

/** Lo que hay que decir cuando la vuelta del emisor no se pudo canjear. */
export interface VueltaFallida {
  /** Por que, en una frase: «El emisor no dejo entrar», «No se completo la entrada»… */
  readonly motivo: string;
  /** Lo que el emisor dijo, o lo que la libreria pudo averiguar. Tal cual. */
  readonly detalle: string;
}

/**
 * La vuelta fallida de la ultima pasada de `arrancar()`, o `null` si no la hubo.
 *
 * **Variable de modulo y no un argumento de `montar`** porque el montaje es una funcion sin
 * argumentos a proposito —ver la cabecera: lo que importa es que sea LO ULTIMO que pasa— y porque
 * quien tiene que leerla no es `main.tsx` sino la aplicacion. Cada pasada la vuelve a fijar, asi
 * que no hay estado viejo que arrastrar de una a otra.
 */
let laVuelta: VueltaFallida | null = null;

/** Por que no se pudo canjear la vuelta del emisor, si es que se intento y no se pudo. */
export function vueltaFallida(): VueltaFallida | null {
  return laVuelta;
}

/**
 * Canjea si volvemos del emisor, y monta. Siempre monta: ver la cabecera.
 */
export async function arrancar(montar: () => void): Promise<void> {
  laVuelta = null;

  const vuelta = await identidad.canjearSiVuelve();
  if (vuelta.estado === 'fallo') {
    laVuelta = { motivo: vuelta.motivo, detalle: vuelta.detalle };
  }

  montar();
}

/**
 * **Manda al formulario del emisor.** Lo llamara «Iniciar sesion» del marco cuando haya plataforma
 * (issue 16); hoy no lo llama nadie, y por eso el portal sigue arrancando en demostracion.
 *
 * Devuelve `null` cuando el navegador se va —que es el caso de siempre— y la falla cuando no se
 * pudo ni llegar al emisor, para que quien llama la explique en vez de dejar la pagina en blanco.
 * Se lee al reves de lo que parece: `null` es que todo fue bien.
 */
export function entrar(): Promise<FallaDeLaPuerta | null> {
  return identidad.entrar();
}

/**
 * **Cierra la sesion aqui y en el emisor.** La usara el menu de la barra (issue 16).
 *
 * Va con `id_token_hint`: sin el, la sesion del emisor sigue viva y el siguiente arranque entraria
 * solo con la misma cuenta sin que nadie teclee nada — en un equipo compartido, que es donde se
 * paga un tributo, eso no es un detalle.
 */
export function salir(): void {
  identidad.salir();
}
