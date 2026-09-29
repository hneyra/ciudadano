import { avisar } from '@kamayuk/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';

import { Aplicacion } from '../aplicacion.tsx';
import { crearClienteDeConsultas } from '../datos/consultas.ts';
import { FuenteActiva, type FuenteDelPortal } from '../datos/fuente.ts';
// La de demostracion, importada A PROPOSITO de forma estatica: esto es andamiaje de pruebas y no
// entra en el paquete (solo lo importan los `*.test.tsx`). Que siga siendo asi —y que ningun archivo
// de produccion lo importe— lo vigila `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts`.
import { fuenteDeDemostracion } from '../datos/fuenteDeDemostracion.ts';
import { type Enrutador, crearEnrutador } from '../enrutador.tsx';
import i18n, { ABRE, CIERRA, IDIOMA_POR_OMISION, sumarLosTextosDeLaFuente } from '../i18n/i18n.ts';
import { precargarLasPantallas } from '../pasos/pantallas.tsx';
import { comoEmpiezaCon } from '../recorrido/ProveedorDelRecorrido.tsx';
import { type DecisionesDePartida, alcanzadoHasta, estadoInicial } from '../recorrido/recorrido.ts';
import { ESPERA_DEL_PORTAL } from './plazos.ts';

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

/**
 * **Las seis pantallas, cargadas ANTES de montar nada** (issue 11).
 *
 * Desde que cada pantalla es un trozo del bundle (`src/pasos/pantallas.tsx`), el portal recien montado
 * dibuja el hueco de `Suspense` y la pantalla llega un turno despues. Las pruebas que preguntan
 * `getByRole` justo tras montar ya no la encontrarian, y esperar en cada una seria cambiar lo que
 * miden. Precargadas, `lazy` las dibuja en el mismo render, como antes del reparto.
 *
 * AQUI, con `await` de nivel superior, y no en `vitest.setup.ts`: los `vi.mock` de una prueba (las de
 * `*.cuentas.test.tsx` sustituyen `src/datos/cuentas.ts`) se aplican a lo que ella importa. Precargado
 * desde la configuracion, el modulo de la pantalla llegaria antes que el `vi.mock` y con las cuentas de
 * verdad: esas pruebas seguirian en verde sin medir nada.
 *
 * Lo que esto deja de ver —el hueco mientras el trozo llega— lo mide `src/pasos/pantallas.test.tsx`
 * con una pantalla perezosa no precargada, y en el navegador, contra el bundle, el arnes.
 */
await precargarLasPantallas();

export interface ComoMontar {
  readonly hash?: string;
  /**
   * Las decisiones con que se empieza. Solo DECISIONES (issue 50): los conceptos y el contribuyente
   * se leen —de la demostracion o de la `fuente`—, y un `deudas` sembrado aqui el proveedor lo tiraria
   * en silencio. Con este tipo, sembrarlo no compila. Y la politica tampoco (revision del PR #70): la
   * fija el proveedor, de la `fuente`.
   */
  readonly estado?: Partial<DecisionesDePartida>;
  /** De donde leen las pantallas (issue 10). Por omision, la de demostracion, como en `montaje.tsx`. */
  readonly fuente?: FuenteDelPortal;
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

/**
 * El portal, con su propio cliente de consultas (`montaje.tsx` pone uno; la prueba, el suyo). Uno NUEVO en
 * cada montaje: con uno compartido, los pagos que una prueba leyo llegarian ya leidos a la siguiente, y
 * «mientras llegan» y «si fallan» no se podrian medir.
 */
export function montarElPortal({ hash = '#/buscar', estado = {}, fuente = fuenteDeDemostracion }: ComoMontar = {}) {
  remendarMatchMedia();
  remendarRequest();
  remendarResizeObserver();
  window.history.replaceState(null, '', `/${hash}`);
  // El estado de partida se calcula como en `ProveedorDelRecorrido`, y `estado` lo retoca encima:
  // con la fuente de la plataforma, una prueba que no dijera nada arrancaria en el recorrido de la
  // demostracion y estaria midiendo el otro portal.
  const base = estadoInicial(comoEmpiezaCon(fuente));
  // Una prueba que empieza a mitad del recorrido (`paso: 'pagar'`) sin decir su progreso lo da por
  // RECORRIDO hasta ahi, por el camino (issue 61): es lo que queria decir antes, cuando lo alcanzable
  // era «hasta el actual». Una prueba que necesite otro progreso lo escribe en `estado.alcanzado`.
  //
  // **Es una SUPOSICION, no una medida** (revision del PR #72): lo que se mida sobre esa partida mide
  // `alcanzadoHasta`, no el reductor. Lo que dependa del progreso —la franja, atras y adelante— se
  // prueba llegando con las pantallas o con las acciones (`FranjaDePasos.test.tsx`,
  // `enrutador.test.tsx`, `recorrido.progreso.test.ts`).
  const partida = { ...base, ...estado };
  const alcanzado = estado.alcanzado ?? alcanzadoHasta(partida, partida.paso);
  // Como `montaje.tsx` (issue 58).
  sumarLosTextosDeLaFuente(fuente);
  const enrutador = crearEnrutador();
  montados.push(enrutador);
  // La MISMA politica que `montaje.tsx` (issue 50): con los valores por omision, el foco volveria a pedir
  // la situacion y la prueba mediria otro portal.
  const consultas = crearClienteDeConsultas();
  const utilidades = render(
    <QueryClientProvider client={consultas}>
      <FuenteActiva value={fuente}>
        <Aplicacion enrutador={enrutador} inicial={{ ...partida, alcanzado }} />
      </FuenteActiva>
    </QueryClientProvider>,
  );
  return { ...utilidades, enrutador, consultas };
}

/**
 * Lo que una prueba del portal deja puesto y la siguiente no debe heredar: el enrutador escuchando el
 * hash, los avisos de `sonner` —su almacen es global al modulo—, el hash y el idioma.
 */
export async function limpiarElPortal(): Promise<void> {
  for (const enrutador of montados.splice(0)) enrutador.dispose();
  // Desmontar ANTES de retirar los avisos: con el portal montado, `sonner` anima la salida y programa
  // un `setTimeout` de 200 ms que sobrevive al entorno y revienta con «window is not defined» si el
  // archivo acaba dentro de ese plazo. Lo mide `src/pruebas/portal.test.tsx`.
  cleanup();
  avisar.dismiss();
  window.history.replaceState(null, '', '/');
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
}

/**
 * **Mueve el navegador y espera a que se mueva**: al `popstate`, no a un plazo (issue 74).
 *
 * `mover` es `history.back()`, `history.forward()`, asignar `location.hash`… o nada, si lo que se
 * espera es el `popstate` de algo que ya se hizo. Es la senal que escucha el enrutador
 * (`createHashRouter`) y la que despierta a `useLaUrlYElPaso`.
 *
 * <h2>Por que no un plazo</h2>
 *
 * En jsdom `history.back()` no mueve nada en el acto: encola la travesia y la hace DOS `setTimeout`
 * despues (`SessionHistory.traverseByDelta` y `_queueHistoryTraversalTask`), y solo entonces cambia la
 * URL y dispara `popstate`. Hasta el issue 74 `src/enrutador.test.tsx` esperaba 50 ms, y con la maquina
 * cargada no bastaban: si el bucle de eventos se para mas de 50 ms justo tras `back()`, al volver vencen
 * a la vez el primer `setTimeout` de jsdom y el de la prueba; el de jsdom encola el segundo para DESPUES,
 * y la prueba se despierta con la URL de antes. Medido con la prueba instrumentada (carga 8-12): el plazo
 * de 50 ms se cumplia a los +284 ms del `back()` y el `popstate` llegaba a los +303, con el historial
 * siempre de 4 entradas —el portal no habia empujado nada—. Con carga 15-16, 6 corridas de 6 en rojo.
 *
 * <h2>Por que dentro de `act`, y sin `waitFor` despues</h2>
 *
 * El `popstate` llega dentro de `act`, asi que lo que el enrutador y el recorrido hagan con el —el dibujo
 * en transicion, el efecto que sigue a la URL, el `irA` y su dibujo— se vacia al salir, antes de mirar.
 * Un `waitFor` despues daria por buena una franja que pasa un instante por el paso correcto y se va.
 *
 * Si el `popstate` no llega en `ESPERA_DEL_PORTAL` —el navegador no tenia a donde ir, o lo que se
 * esperaba no ocurrio—, falla diciendolo, en vez de agotar el plazo del caso sin decir por que. Ese plazo
 * no decide nada cuando la prueba pasa: solo pone nombre al rojo.
 */
export async function moverElNavegador(mover: () => void): Promise<void> {
  await act(async () => {
    const escucha = oirAlNavegador();
    try {
      mover();
    } catch (error) {
      // Sin esto, el oyente y el plazo seguirian vivos, y a los 5 s saldria un rechazo sin nadie que lo
      // espere, que Vitest podria achacar a otro caso (revision del PR #76).
      escucha.dejarDeOir();
      throw error;
    }
    await escucha.llego;
  });
}

/** El proximo `popstate`, con su plazo para fallar diciendolo; y como dejar de esperarlo. */
export interface EscuchaDelNavegador {
  readonly llego: Promise<void>;
  readonly dejarDeOir: () => void;
}

/**
 * **Empieza a oir el proximo `popstate` YA**, para esperarlo despues con `esperarAlNavegador`.
 *
 * Para cuando el movimiento lo provoca otro —una trampa dentro del portal, a media accion— y el oyente
 * tiene que estar puesto ANTES de moverse: registrado despues, el `popstate` ya encolado podria llegar
 * antes que el oyente (revision del PR #76). Con `moverElNavegador` no hace falta: oye y mueve a la vez.
 */
export function oirAlNavegador(): EscuchaDelNavegador {
  let dejarDeOir = () => {};
  const llego = new Promise<void>((listo, fallar) => {
    const alMoverse = () => {
      dejarDeOir();
      listo();
    };
    const plazo = setTimeout(() => {
      dejarDeOir();
      fallar(new Error(`El navegador no se movio: ningun \`popstate\` en ${ESPERA_DEL_PORTAL} ms (${window.location.hash}).`));
    }, ESPERA_DEL_PORTAL);
    dejarDeOir = () => {
      clearTimeout(plazo);
      window.removeEventListener('popstate', alMoverse);
    };
    window.addEventListener('popstate', alMoverse);
  });
  // El rechazo lo recibe quien espere `llego`; esto solo evita que, mientras nadie lo espera todavia,
  // Node lo cuente como un rechazo sin manejar.
  llego.catch(() => {});
  return { llego, dejarDeOir };
}

/** Espera, dentro de `act`, el `popstate` que ya se estaba oyendo (`oirAlNavegador`). */
export async function esperarAlNavegador(escucha: EscuchaDelNavegador): Promise<void> {
  await act(async () => {
    await escucha.llego;
  });
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
