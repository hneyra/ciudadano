/**
 * **Un emisor de identidad de mentira para el canje silencioso** (issue 35).
 *
 * El canje silencioso abre un marco oculto hacia el emisor con `prompt=none`, y el emisor —con su
 * sesion viva o sin ella— lo devuelve a `silencio.html`, que le pasa a la ventana de arriba lo que
 * trajo en la barra. jsdom no navega marcos ni sirve `public/`, asi que aqui se hace a mano lo que el
 * navegador haria: **se vigila el documento, y cuando aparece un marco se contesta desde el**, con un
 * `message` que lleva el mismo origen y la misma ventana de origen que llevaria el de verdad.
 *
 * Lo que se mide asi es exactamente lo que el navegador no nos regala: que el portal compruebe de
 * quien viene el mensaje (origen, ventana y `state`) antes de creerselo. En el navegador de verdad,
 * con `silencio.html` servido de verdad, lo mide el arnes (`e2e/recorrido-con-plataforma.spec.ts`).
 *
 * Andamiaje de pruebas: solo lo importan los `*.test.*`.
 */

/** Lo que el emisor contesta a una pregunta: la busqueda con la que vuelve, o `null` si calla. */
export type Contestacion = (pedida: URL) => string | null;

export interface EmisorFalso {
  /** Cada marco que el portal abrio, con la URL que pidio. */
  readonly pedidas: readonly URL[];
  /** Deja de vigilar el documento. */
  soltar(): void;
}

/** El emisor con su sesion viva: vuelve con un codigo y el MISMO `state` que le llego. */
export const conSesion = (pedida: URL): string =>
  `?code=un-codigo-de-mentira&state=${pedida.searchParams.get('state') ?? ''}&session_state=abc`;

/** El emisor sin sesion: `prompt=none` le prohibe ensenar el formulario, y lo dice. */
export const sinSesion =
  (error = 'login_required') =>
  (pedida: URL): string =>
    `?error=${error}&state=${pedida.searchParams.get('state') ?? ''}`;

/** El emisor que no contesta: el marco se queda en la pagina de error del navegador y no dice nada. */
export const callado: Contestacion = () => null;

/** Contesta el mensaje como lo mandaria `silencio.html` desde dentro del marco. */
export function contestarDesde(marco: HTMLIFrameElement, busqueda: string, origen = window.location.origin): void {
  window.dispatchEvent(new MessageEvent('message', { data: busqueda, origin: origen, source: marco.contentWindow }));
}

export function emisorFalso(contestar: Contestacion): EmisorFalso {
  const pedidas: URL[] = [];
  const vigia = new MutationObserver((cambios) => {
    for (const cambio of cambios) {
      for (const nodo of cambio.addedNodes) {
        if (!(nodo instanceof HTMLIFrameElement)) continue;
        const pedida = new URL(nodo.src);
        pedidas.push(pedida);
        const busqueda = contestar(pedida);
        if (busqueda !== null) contestarDesde(nodo, busqueda);
      }
    }
  });
  vigia.observe(document.body, { childList: true, subtree: true });
  return { pedidas, soltar: () => vigia.disconnect() };
}

/** Los marcos que hay ahora mismo en el documento. Tiene que ser cero cuando el intento termino. */
export const marcosEnLaPagina = (): number => document.querySelectorAll('iframe').length;
