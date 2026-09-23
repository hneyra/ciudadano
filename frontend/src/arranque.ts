import type { FallaDeLaPuerta, Vuelta } from '@kamayuk/sesion';

import { identidad } from './api/identidad.ts';
import {
  type CanjeSilencioso,
  type FalloDelSilencio,
  type Silencio,
  falloInesperado,
  silencio as silencioDelPortal,
} from './api/silencio.ts';

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
 * <h2>Y desde el issue 35, con plataforma, se PREGUNTA en silencio</h2>
 *
 * El token vive solo en memoria, asi que recargar lo perdia y la persona tenia que volver a la
 * puerta. Ahora, si no se vuelve del emisor, no hay token, hay plataforma y no se acaba de salir,
 * se le pregunta al emisor desde un marco oculto con `prompt=none` si su sesion sigue viva
 * (`src/api/silencio.ts`): si lo esta, se monta ya identificado; si no, se monta anonimo y **sin ir
 * a ningun sitio**. Sigue sin irse a la puerta —la pagina no navega—, y en demostracion no se
 * pregunta nada.
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
 * **La pregunta silenciosa que no salio** (issue 35), o `null`.
 *
 * Aparte de `vueltaFallida()` y no mezclada con ella porque la pantalla tiene que decir otra cosa
 * (revision del PR #45): quien recarga no fue a ningun sitio y, con el tope, el marco ni siquiera
 * volvio, asi que «Volvimos del sistema de identidad…» seria afirmar algo que no ocurrio. Y porque
 * sus textos son claves que traduce la pantalla (`TextoDelSilencio`), no palabras de la libreria.
 */
let laPregunta: FalloDelSilencio | null = null;

export function preguntaFallida(): FalloDelSilencio | null {
  return laPregunta;
}

/**
 * **Cuanto se deja la pagina como esta antes de dibujar la espera** (issue 35).
 *
 * El canje silencioso contra un emisor vivo tarda lo que un ida y vuelta —decenas o pocos cientos
 * de milisegundos—, y en ese rato la pagina esta como estaba mientras llegaba el paquete: en
 * blanco. Dibujar la espera al instante haria que, en el caso de todos los dias, apareciera
 * «Comprobando su sesion…» un destello y desapareciera: el parpadeo que el issue prohibe. Pasado el
 * umbral, en cambio, la pagina en blanco empieza a parecer rota, y entonces si se dice que se esta
 * esperando.
 */
export const UMBRAL_DE_ESPERA = 300;

/** Lo que `arrancar()` necesita saber del arranque, ademas de como montar. */
export interface ComoArrancar {
  /**
   * Si el portal lee de la plataforma (`hayPlataforma(fuente)`, en `main.tsx`). En demostracion no
   * hay emisor al que preguntar, y **no se le pregunta**: ni una peticion, ni un marco.
   */
  readonly conPlataforma: boolean;
  /** Dibuja la espera, si la pregunta tarda mas de `UMBRAL_DE_ESPERA`. */
  readonly esperando?: () => void;
  /**
   * El canje silencioso. Por omision, el del portal —uno por carga—; lo inyectan las pruebas, que
   * necesitan uno nuevo en cada caso, como inyectan la fuente.
   */
  readonly silencio?: CanjeSilencioso;
}

/**
 * **Si hay que preguntarle al emisor en silencio.** Solo cuando TODO esto es cierto:
 *
 *   · hay plataforma: en demostracion no hay emisor;
 *   · no se volvia del emisor: si se volvio, o hay token ya o hay una vuelta fallida que explicar;
 *   · no hay token;
 *   · hay puerta (`crypto.subtle`): sin S256 no se puede pedir un codigo;
 *   · y **no se acaba de salir**: quien cerro sesion y recarga no puede encontrarse dentro otra vez
 *     sin teclear nada. La marca es la de `@kamayuk/sesion`, que `salir()` pone y `entrar()` quita.
 *
 * `conPlataforma` va primero a proposito: en demostracion no se llega a preguntar nada a la puerta.
 */
function hayQuePreguntar(conPlataforma: boolean, vuelta: Vuelta): boolean {
  return (
    conPlataforma &&
    vuelta.estado === 'sin-vuelta' &&
    identidad.token() === null &&
    identidad.hayPuerta() &&
    !identidad.vieneDeSalir()
  );
}

/**
 * Canjea si volvemos del emisor; si no, y hay plataforma, le pregunta en silencio si ya se habia
 * entrado (issue 35); y monta. Siempre monta: ver la cabecera.
 *
 * <h2>Se monta DESPUES de preguntar, y no antes con la sesion llegando luego</h2>
 *
 * Porque el recorrido decide al montar si hay sesion (`ProveedorDelRecorrido`), y con plataforma
 * eso decide el primer paso: montar antes seria dibujar «Entrar» y, un instante despues, la deuda
 * — el parpadeo que el issue prohibe— y lanzar la primera consulta sin token. Mientras tanto, si
 * tarda, `esperando()` dibuja la espera: ni la pagina en blanco ni un salto a la puerta.
 *
 * <h2>Un fallo que no es «no hay sesion» se dice</h2>
 *
 * Con la pantalla de «No se pudo abrir su sesion», en su variante de la pregunta silenciosa
 * (`preguntaFallida()`), y con el motivo dentro. Tambien si preguntar REVIENTA en vez de contestar:
 * nunca una pagina en blanco. «No hay sesion» no es un fallo: se monta anonimo y la persona decide
 * si entra.
 */
export async function arrancar(
  montar: () => void,
  { conPlataforma, esperando = () => undefined, silencio = silencioDelPortal }: ComoArrancar,
): Promise<void> {
  laVuelta = null;
  laPregunta = null;

  const vuelta = await identidad.canjearSiVuelve();
  if (vuelta.estado === 'fallo') {
    laVuelta = { motivo: vuelta.motivo, detalle: vuelta.detalle };
  }

  if (hayQuePreguntar(conPlataforma, vuelta)) {
    const espera = setTimeout(esperando, UMBRAL_DE_ESPERA);
    let respuesta: Silencio;
    try {
      respuesta = await silencio.intentar();
    } catch (error) {
      // Una excepcion aqui saltaria el `montar()` de abajo y dejaria la pagina en blanco: se dice,
      // como cualquier otro fallo (revision del PR #45; es lo que la libreria cerro en rentas#112).
      respuesta = falloInesperado(error);
    } finally {
      clearTimeout(espera);
    }
    if (respuesta.estado === 'fallo') laPregunta = respuesta;
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
