import { avisar } from '@kamayuk/ui';
import { render } from '@testing-library/react';

import { Aplicacion } from '../aplicacion.tsx';
import { type Enrutador, crearEnrutador } from '../enrutador.tsx';
import i18n, { ABRE, CIERRA, IDIOMA_POR_OMISION } from '../i18n/i18n.ts';
import { ESTADO_INICIAL, type EstadoDelRecorrido } from '../recorrido/recorrido.ts';

/**
 * **Montar el portal entero en una prueba**, entrando por un hash como entraria el navegador.
 *
 * Con el enrutador de verdad (`createHashRouter`) y no uno en memoria: lo que se prueba es justo que
 * `#/pagar` escrito en la barra de direcciones redirija, y un enrutador en memoria no lee el hash.
 *
 * `replaceState` y no `location.hash = …`: asignar el hash dispara un `hashchange` asincrono que
 * podria llegar al enrutador de la prueba siguiente. Es lo mismo que abrir la pagina con ese hash.
 */

const montados: Enrutador[] = [];

export interface ComoMontar {
  readonly hash?: string;
  readonly estado?: Partial<EstadoDelRecorrido>;
}

/**
 * jsdom no trae `matchMedia`, y `sonner` la llama para el modo `system`, que es el del portal mientras
 * nadie elija otro: «TypeError: window.matchMedia is not a function» (`sonner/dist/index.mjs:1072`).
 * Es el mismo remiendo que `piezas-del-armazon.test.tsx` de `@kamayuk/ui`. Nada coincide: el portal
 * se prueba en claro.
 */
function remendarMatchMedia(): void {
  if (typeof window.matchMedia === 'function') return;
  window.matchMedia = ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * Y el enrutador de datos, bajo jsdom, **no navega**: cada navegacion construye un `Request` con la
 * senal de su `AbortController`, y en el entorno de Vitest `Request` es el de Node (undici) mientras
 * `AbortController` es el de jsdom. undici no acepta la senal ajena:
 *
 *     TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.
 *
 * y el hash se queda donde estaba. Medido con la franja: `expected '#/pagar' to be '#/deudas'`.
 * Se le pasa a undici el `Request` sin la senal ajena. Este portal no tiene `loader` ni `action`,
 * que es lo unico que la escucharia; en el navegador los dos son del mismo reino y nada de esto hace
 * falta.
 */
function remendarRequest(): void {
  const Nativo = globalThis.Request;
  if ((Nativo as { remendado?: true }).remendado === true) return;
  class SinSenalAjena extends Nativo {
    static remendado = true as const;
    constructor(entrada: RequestInfo | URL, opciones?: RequestInit) {
      const { signal: _ajena, ...resto } = opciones ?? {};
      super(entrada, resto);
    }
  }
  globalThis.Request = SinSenalAjena;
}

/**
 * jsdom tampoco trae `ResizeObserver`, y `Checkbox` de Radix lo pide en cuanto la casilla esta DENTRO
 * de un `<form>`: entonces dibuja un `<input>` oculto que sigue su tamano (`useSize`) para que el
 * formulario lo envie. Fuera de un formulario, como en el paso 2, no se llama. Medido con la casilla de
 * aviso de «Mis datos» (issue 7): «ReferenceError: ResizeObserver is not defined» y la pantalla
 * entera sustituida por el `ErrorBoundary` del enrutador. Es el mismo remiendo que
 * `piezas-del-armazon.test.tsx` de `@kamayuk/ui`: nadie mide nada, y no hay nada que medir.
 */
function remendarResizeObserver(): void {
  if (typeof globalThis.ResizeObserver === 'function') return;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

export function montarElPortal({ hash = '#/buscar', estado = {} }: ComoMontar = {}) {
  remendarMatchMedia();
  remendarRequest();
  remendarResizeObserver();
  window.history.replaceState(null, '', `/${hash}`);
  const enrutador = crearEnrutador();
  montados.push(enrutador);
  const utilidades = render(<Aplicacion enrutador={enrutador} inicial={{ ...ESTADO_INICIAL, ...estado }} />);
  return { ...utilidades, enrutador };
}

/**
 * Lo que una prueba del portal deja puesto y la siguiente no debe heredar: el enrutador escuchando el
 * hash, los avisos de `sonner` —su almacen es global al modulo—, el hash y el idioma.
 */
export async function limpiarElPortal(): Promise<void> {
  for (const enrutador of montados.splice(0)) enrutador.dispose();
  avisar.dismiss();
  window.history.replaceState(null, '', '/');
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
}

/** Un texto como sale del idioma `marcado`: envuelto, porque paso por `t()`. */
export const marcado = (texto: string): string => `${ABRE}${texto}${CIERRA}`;

/**
 * Los remiendos que `DropdownMenu` (Radix, con el posicionador de `@floating-ui`) necesita bajo jsdom.
 *
 * Los cuatro primeros son los de `capa-del-menu.test.tsx` de `@kamayuk/ui`: `requestAnimationFrame`
 * sincrono, `scrollIntoView` y la captura de punteros, que jsdom no trae.
 *
 * **El quinto se gano aqui, y es el que hacia inservible la prueba.** Con el menu abierto y despues de
 * cerrarlo, el proceso se quedaba al 100 % de CPU: una espera de 100 ms tardaba 18 s, y la prueba
 * de «Cerrar sesión» caducaba con `[vitest-worker]: Timeout calling "onTaskUpdate"`. Perfilado con
 * el inspector de V8, todo el tiempo estaba en `nwsapi` —`isFullscreen` → `matchesNative` →
 * `Element.matches`—, y lo dispara `isTopLayer` de `@floating-ui/utils`, que pregunta
 * `el.matches(':popover-open')` y `el.matches(':modal')` en cada calculo de posicion. En `nwsapi`
 * 2.2.27, `:modal` se resuelve llamando al `matches` NATIVO, que dentro de jsdom es el propio `nwsapi`:
 * se llama a si mismo hasta desbordar la pila, el `try` lo traga, prueba `:fullscreen` por el mismo
 * camino, y el coste crece como 2^profundidad. Es lo mismo que en la libreria sale como «12 409 ms de
 * archivo» (mismas versiones de jsdom, nwsapi y floating-ui).
 *
 * En jsdom no hay capa superior ni pantalla completa, asi que esas cuatro pseudoclases son siempre
 * falsas: se contestan sin entrar en `nwsapi`. Cualquier otro selector va al `matches` de siempre.
 */
const PSEUDOCLASES_SIN_CAPA_SUPERIOR = new Set([':modal', ':popover-open', ':fullscreen', ':picture-in-picture']);

export function remendarJsdomParaElMenu(): void {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};

  const coincide = Element.prototype.matches;
  Element.prototype.matches = function matches(this: Element, selector: string): boolean {
    return PSEUDOCLASES_SIN_CAPA_SUPERIOR.has(selector.trim()) ? false : coincide.call(this, selector);
  };
}
