import { avisar } from '@kamayuk/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, configure, render } from '@testing-library/react';
import { vi } from 'vitest';

import { haySesion } from '../api/claims.ts';
import { Aplicacion } from '../aplicacion.tsx';
import { crearClienteDeConsultas } from '../datos/consultas.ts';
import { FuenteActiva, type FuenteDelPortal, hayPlataforma } from '../datos/fuente.ts';
// La de demostracion, importada A PROPOSITO de forma estatica: esto es andamiaje de pruebas y no
// entra en el paquete (solo lo importan los `*.test.tsx`). Que siga siendo asi —y que ningun archivo
// de produccion lo importe— lo vigila `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts`.
import { fuenteDeDemostracion } from '../datos/fuenteDeDemostracion.ts';
import { type Enrutador, crearEnrutador } from '../enrutador.tsx';
import i18n, { ABRE, CIERRA, IDIOMA_POR_OMISION } from '../i18n/i18n.ts';
import { precargarLasPantallas } from '../pasos/pantallas.tsx';
import { type EstadoDelRecorrido, estadoInicial } from '../recorrido/recorrido.ts';

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
 * **Los plazos de un caso que monta el portal entero** (issue 42): 20 s el caso, y no los 5 s de
 * Vitest; 5 s cada espera de Testing Library (`findBy…`, `waitFor`), y no 1 s.
 *
 * Cada archivo que monta el portal los pide con `plazosDelPortal()` en su nivel superior, a la vista,
 * y `verificaciones/la-suite-tiene-tope.test.ts` vigila que ninguno se lo salte.
 *
 * <h2>Por que hacen falta</h2>
 *
 * El tiempo de estos casos es CPU —jsdom dibujando el marco, la pantalla y Radix, y `getByRole`
 * recorriendo el arbol— y crece con la carga de la maquina, que es COMPARTIDA (`k3s-server` y otras
 * suites). Con carga 15 y los plazos por omision caian de 7 a 10 casos por corrida, cada vez otros, y en
 * aislado pasaban: rojo de la maquina, no del codigo. Y los rojos cambiaban de archivo, por eso el plazo
 * es de TODOS los que montan el portal y no solo de los que cayeron alguna vez.
 *
 * <h2>La medida: una corrida EN VERDE con la maquina cargada</h2>
 *
 * 2026-09-23, `vitest run` entero con 2 procesos, 13 procesos `yes` encima de lo que ya hubiera: carga
 * media 15.9, pico 20.8; 72 archivos, 791 de 791. Duracion por caso del reportero JSON, y cada espera
 * cronometrada envolviendo el `asyncWrapper` de Testing Library (instrumento de un rato, no confirmado).
 * Por archivo, el caso mas lento y la espera mas larga (entre parentesis, cuantas esperas hizo):
 *
 *     caso   espera        archivo
 *     7.1 s  1.21 s (65)   src/pasos/historial/Historial.test.tsx
 *     5.5 s  1.80 s  (4)   src/aplicacion.sinPlataforma.test.tsx
 *     5.3 s  0.11 s  (1)   src/pasos/buscar/Buscar.tipo.test.tsx
 *     4.6 s  0.58 s (15)   src/pasos/historial/Historial.menu.test.tsx
 *     3.6 s  0.28 s  (5)   src/pasos/comprobante/Comprobante.sesion.test.tsx
 *     3.4 s  1.15 s (15)   src/pasos/historial/Historial.plataforma.test.tsx
 *     3.3 s  0.26 s (69)   src/pasos/comprobante/Comprobante.test.tsx
 *     3.3 s  0.68 s  (7)   src/pasos/deudas/Deudas.test.tsx
 *     3.2 s  0.75 s (19)   src/pasos/pagar/Pagar.test.tsx
 *     3.1 s  1.39 s (14)   src/pasos/buscar/Buscar.test.tsx
 *     3.0 s  0.99 s (23)   src/pasos/pagar/Pagar.plataforma.test.tsx
 *     2.8 s  0.16 s  (1)   src/pasos/pagar/Pagar.cuentas.test.tsx
 *     2.6 s  0.29 s  (6)   src/marco/Barra.test.tsx
 *     2.3 s  0.39 s (10)   src/enrutador.test.tsx
 *     2.3 s  0.41 s (22)   src/pasos/identificar/Identificar.test.tsx
 *     2.2 s  0.23 s  (1)   src/pasos/historial/Historial.cuentas.test.tsx
 *     2.2 s  0.23 s  (2)   src/pasos/comprobante/Comprobante.cuentas.test.tsx
 *     2.1 s     —    (0)   src/aplicacion.puerta.test.tsx
 *     2.0 s  0.25 s  (5)   src/arranque.plataforma.test.tsx
 *     1.9 s     —    (0)   src/pasos/deudas/Deudas.cuentas.test.tsx
 *     1.9 s     —    (0)   src/marco/impresionEnClaro.test.tsx
 *     1.9 s  0.41 s  (1)   src/pruebas/portal.test.tsx
 *     1.9 s     —    (0)   src/aplicacion.test.tsx
 *     1.8 s  0.17 s (13)   src/pasos/entrar/Entrar.test.tsx
 *     1.7 s  0.43 s  (4)   src/marco/FranjaDePasos.test.tsx
 *     1.5 s  0.60 s (22)   src/pasos/deudas/Deudas.plataforma.test.tsx
 *     1.2 s  0.28 s  (3)   src/marco/Barra.plataforma.test.tsx
 *
 * De las 327 esperas, 312 acabaron en medio segundo o menos (mediana 76 ms), y **4 pasaron del segundo
 * que Testing Library da por omision** (1.80, 1.39, 1.21 y 1.15 s): esas cuatro, con el plazo de
 * siempre, habrian salido rojas en una corrida que por lo demas es verde.
 *
 * <h2>Y no es lentitud de como estan escritos</h2>
 *
 * Revisado lo que el issue pide mirar antes de subir un plazo. Ya escriben con `fireEvent` y no con
 * `userEvent` (lo que hacia pasar de 5 s al desplegable, `Buscar.test.tsx`). Y `findBy` donde bastaria
 * `getBy`: en estos 27 archivos hay 136 `findBy` y 101 `waitFor`; en la corrida de arriba sus esperas
 * sumaron 45.9 s de 252.3 s de casos, y las 189 que acabaron en 100 ms o menos —las unicas que un
 * `getBy` podria sustituir, porque contestan a la primera— sumaron 7.8 s, repartidos entre todos los
 * archivos. Las largas esperan una navegacion o una consulta de verdad, donde un `getBy` fallaria. No se
 * cambio ninguna: no hay tiempo que ganar ahi, y cada una dice «esto llega despues». Lo que si era lento
 * por como estaba escrito se arreglo en su archivo: `src/pasos/pantallas.test.tsx`.
 *
 * <h2>De ahi los dos numeros</h2>
 *
 * El mismo margen para los dos, algo menos de tres veces lo peor medido en verde:
 *
 *   · **caso, 20 s** = 2.8 × 7.1 s. Tres archivos pasan de los 5 s por omision (`Historial`,
 *     `aplicacion.sinPlataforma`, `Buscar.tipo`) y otros diez quedan entre 2.5 y 5 s, sin margen para
 *     una carga algo mayor que esta.
 *   · **espera, 5 s** = 2.8 × 1.8 s. Cuatro archivos tuvieron una espera de mas de 1 s (`sinPlataforma`,
 *     `Buscar`, `Historial`, `Historial.plataforma`).
 *
 * Lo que la tabla dice de los demas, sin recortarles el plazo (los rojos cambiaban de archivo): los
 * catorce archivos por debajo de 2.5 s NO necesitan el plazo del caso con esta carga —su peor caso cabe
 * dos veces en los 5 s—, y cuatro (`aplicacion.puerta`, `Deudas.cuentas`, `impresionEnClaro` y
 * `aplicacion.test`) no esperan nunca, asi que el plazo de las esperas no les cambia nada.
 *
 * El precio: un caso que se cuelga de verdad —un `findBy` que no llega nunca— tarda 5 s en salir rojo en
 * vez de 1, y uno que no acaba, 20 en vez de 5.
 *
 * Una cifra que ya no se usa: la primera version de este comentario anclaba los 20 s en «8.7 s de
 * `Comprobante.sesion`, carga 15». Era lo que ese caso tardo en CADUCAR a 5 s en una corrida roja, no lo
 * que necesita para pasar; en la corrida verde de arriba tardo 3.6 s.
 */
export const PLAZO_DEL_PORTAL = 20_000;
export const ESPERA_DEL_PORTAL = 5_000;

/**
 * Pone los dos plazos al archivo que la llama. En su nivel superior: `vi.setConfig` vale para los casos
 * de ese archivo (Vitest lo deshace al acabarlo), y `configure` de Testing Library vive en el modulo, que
 * con `isolate` es uno por archivo.
 */
export function plazosDelPortal(): void {
  vi.setConfig({ testTimeout: PLAZO_DEL_PORTAL });
  configure({ asyncUtilTimeout: ESPERA_DEL_PORTAL });
}

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
  readonly estado?: Partial<EstadoDelRecorrido>;
  /** De donde leen las pantallas (issue 10). Por omision, la de demostracion, como en `main.tsx`. */
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
 * El portal, con su propio cliente de consultas (`main.tsx` pone uno; la prueba, el suyo). Uno NUEVO en
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
  const base = estadoInicial({
    conPlataforma: hayPlataforma(fuente),
    autenticado: hayPlataforma(fuente) && haySesion(),
    amnistia: fuente.amnistia,
  });
  const enrutador = crearEnrutador();
  montados.push(enrutador);
  // La MISMA politica que `main.tsx` (issue 50): con los valores por omision, el foco volveria a pedir
  // la situacion y la prueba mediria otro portal.
  const consultas = crearClienteDeConsultas();
  const utilidades = render(
    <QueryClientProvider client={consultas}>
      <FuenteActiva value={fuente}>
        <Aplicacion enrutador={enrutador} inicial={{ ...base, ...estado }} />
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
