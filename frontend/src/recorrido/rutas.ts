import { startTransition, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useRecorrido } from './ProveedorDelRecorrido.tsx';
import { type Paso, TODOS_LOS_PASOS, pasoAlcanzable, ultimoAlcanzable } from './recorrido.ts';

/**
 * **Las rutas del portal**: una por paso, con hash, y el recorrido como arbitro.
 *
 * <h2>Por que hash</h2>
 *
 * El portal es un bundle estatico bajo `/portal/` sin servidor que reescriba rutas. Con
 * `#/pagar`, recargar la pagina o compartir el enlace llega siempre a `index.html`.
 *
 * <h2>URL y estado, en un solo sitio y con una sola regla (issue 61)</h2>
 *
 * Hasta el issue 61 la sincronia vivia en dos sitios, cada uno con su `useRef`: aqui el efecto que
 * llevaba la URL al paso, y en `src/enrutador.tsx` el de cada ruta, que llevaba el paso a la URL y
 * solo actuaba cuando cambiaba la URL. Entre los dos quedaba un hueco: si lo alcanzable cambiaba sin
 * que cambiara ni el paso ni la URL, nadie redirigia y la pantalla se quedaba en blanco (el
 * comprobante sin sello, `src/enrutador.test.tsx`). Ahora es UN gancho, `useLaUrlYElPaso`, y la regla
 * es una:
 *
 *   **Manda lo que cambio.**
 *
 *   1. **Si cambio el paso** —una accion: buscar, confirmar la eleccion, cerrar sesion…—, la URL lo
 *      sigue, con una entrada NUEVA en el historial del navegador: es un paso que se dio, y Atras
 *      tiene que poder deshacerlo. Las pantallas despachan; no navegan.
 *   2. **Si no cambio el paso, manda la URL** —Atras, Adelante, un enlace, escribir el hash—: si nombra
 *      un paso alcanzable, el recorrido lo sigue (`irA`, la navegacion libre); si no, la URL se
 *      REEMPLAZA por el ultimo paso alcanzable (`ultimoAlcanzable`), y el hash que no lo era no queda
 *      en el historial.
 *
 * El paso 2 se comprueba en CADA dibujo, no solo cuando cambia la URL: es lo que cierra el hueco de la
 * pantalla en blanco. Un solo `useRef` recuerda el ultimo paso visto, para saber cual de los dos
 * cambio: sin el, en el dibujo intermedio —estado ya en `deudas`, URL todavia en `buscar`— la URL
 * «mandaria» y deshacia la accion.
 *
 * <h2>La URL es la del navegador, no la del ultimo dibujo</h2>
 *
 * El enrutador cambia la historia del navegador en el acto, pero avisa a React **dentro de una
 * transicion** (`startTransition`, en `RouterProvider`): un clic que llega entre las dos cosas se
 * dibuja con la ruta VIEJA. Medido con «Mis datos» → «Continuar al pago» → la franja otra vez en «Mis
 * datos» (`Identificar.test.tsx`, con la maquina cargada): el efecto veia `/identificar` —la ruta del
 * dibujo— cuando el navegador ya estaba en `#/pagar`, no navegaba, y cuando la transicion llegaba con
 * `/pagar` la URL «mandaba» y devolvia el recorrido a pagar. Por eso el efecto lee la ruta del
 * navegador (`rutaDelNavegador`), y `useLocation` lo despierta cuando cambia.
 *
 * Y al reves: la URL tambien se cambia A ESPALDAS del enrutador. La vuelta del emisor limpia la barra
 * con `history.replaceState` (`@kamayuk/sesion`, y el `catch` de `src/arranque.ts`), que no avisa a
 * nadie: el navegador queda en `#/entrar` y el enrutador en `/`, la raiz, que no dibuja nada. Medido
 * con el arnes (`recorrido-con-plataforma.spec.ts`, cancelar en el formulario): `main` vacio. Por eso,
 * cuando lo que el enrutador dibuja no es lo que el navegador dice, se le pone al dia REEMPLAZANDO: la
 * historia no gana ninguna entrada que la persona no haya dado. (Desde la revision del PR #72 el
 * enrutador se crea DESPUES del canje, en `montaje.tsx`, y el caso del emisor ya no llega aqui; la
 * linea se queda para cualquier otro `replaceState`.)
 *
 * <h2>Lo que despierta al efecto: el navegador, no solo el enrutador (issue 74)</h2>
 *
 * El efecto lee la URL del navegador, que no es estado de React: si solo lo despertaran `pathname` y el
 * paso, habria un caso en que la URL cambia y el efecto no se entera. Medido en Chromium contra el
 * paquete con la CPU x6: «Continuar al pago» lleva el recorrido a «Pagar», la regla 1 empuja `#/pagar`,
 * y Atras llega ANTES de que la transicion del enrutador se dibuje. React sustituye esa transicion por
 * la del `popstate`, que vuelve a `/identificar`: la misma ruta que el ultimo dibujo. Ni el paso ni
 * `pathname` cambiaron, el efecto no corria, y la URL y la pantalla quedaban en «Mis datos» con la franja
 * en «Pagar» —14 s despues, y para siempre—. Por eso el efecto depende tambien de
 * `useMovimientosDelNavegador`, que cuenta los `popstate`. Lo reproduce sin carga
 * `rutas.transicion.test.tsx`, con la pantalla de «Pagar» suspendida (la misma detencion que daria su
 * trozo sin llegar todavia por la red; eso no se midio en el navegador).
 *
 * <h2>Seguir a la URL no es una accion (issue 74)</h2>
 *
 * El paso que llega por un `irA` de la regla 2 lo pidio la URL, y se apunta como visto AL DESPACHARLO,
 * no cuando se dibuja. Si la URL vuelve a cambiar en medio —dos Atras seguidos con la maquina ocupada, un
 * enlace—, el dibujo siguiente vera el paso nuevo y, apuntado solo al dibujarse, la regla 1 lo tomaria
 * por una accion: empujaria su ruta con una entrada NUEVA encima de la URL que la persona acababa de
 * poner, y esa URL se perderia. Lo reproduce `rutas.carrera.test.tsx`.
 *
 * Mientras una transicion del enrutador esta pendiente, el efecto puede correr mas de una vez con la
 * misma URL del navegador y pedir la misma redireccion con `replace` dos veces: es idempotente —la
 * segunda reemplaza la entrada por si misma— y no hay bucle, porque cada vuelta compara contra la URL
 * del navegador, que ya es la de destino.
 */

/** La ruta de cada paso. */
export const RUTA_DEL_PASO: Readonly<Record<Paso, `/${string}`>> = {
  entrar: '/entrar',
  buscar: '/buscar',
  deudas: '/deudas',
  identificar: '/identificar',
  pagar: '/pagar',
  comprobante: '/comprobante',
  historial: '/historial',
};

/** El paso que nombra una ruta, o `null` si no nombra ninguno (la raiz, o una que no existe). */
export function pasoDeLaRuta(ruta: string): Paso | null {
  return TODOS_LOS_PASOS.find((paso) => RUTA_DEL_PASO[paso] === ruta) ?? null;
}

/**
 * La ruta que el navegador tiene AHORA, del hash (`createHashRouter` no lleva `basename`). Ver «La URL
 * es la del navegador» en la cabecera.
 */
function rutaDelNavegador(): string {
  return window.location.hash.replace(/^#/, '').split(/[?#]/)[0] || '/';
}

/**
 * **Cuantas veces se ha movido el navegador** (issue 74): una cuenta que sube con cada `popstate`
 * —Atras, Adelante, un enlace, el hash escrito—, la misma senal que escucha el enrutador. Ver «Lo que
 * despierta al efecto» en la cabecera.
 *
 * Sube DENTRO de una transicion, como el aviso del enrutador: asi las dos llegan en el mismo dibujo, y
 * el efecto ve a la vez la cuenta nueva y la ruta nueva. Con una actualizacion urgente llegaria antes
 * que la del enrutador, veria la ruta vieja y reemplazaria la entrada del historial sin necesidad:
 * medido, 12 `replaceState` en los seis Atras/Adelante de `src/enrutador.test.tsx`, que desde el issue
 * 74 exige cero.
 */
function useMovimientosDelNavegador(): number {
  const [movimientos, fijarMovimientos] = useState(0);
  useEffect(() => {
    const alMoverse = () => startTransition(() => fijarMovimientos((n) => n + 1));
    window.addEventListener('popstate', alMoverse);
    return () => window.removeEventListener('popstate', alMoverse);
  }, []);
  return movimientos;
}

/** **La URL y el paso del recorrido, de acuerdo.** Se monta una vez, en el marco. Ver la cabecera. */
export function useLaUrlYElPaso(): void {
  const { estado, despachar } = useRecorrido();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const movimientos = useMovimientosDelNavegador();
  const pasoVisto = useRef(estado.paso);

  useEffect(() => {
    // `navegar` puede devolver una promesa (issue 55): aqui no hace falta esperarla, y se marca `void`
    // a proposito y no por descuido.
    const enElNavegador = pasoDeLaRuta(rutaDelNavegador());
    const dibujado = pasoDeLaRuta(pathname);

    // 1. Cambio el paso: la URL lo sigue. Con una entrada nueva si el navegador esta en otra ruta; si
    //    ya esta en la del paso y es el enrutador el que se quedo atras, reemplazando.
    if (pasoVisto.current !== estado.paso) {
      pasoVisto.current = estado.paso;
      if (enElNavegador !== estado.paso || dibujado !== estado.paso) {
        void navegar(RUTA_DEL_PASO[estado.paso], { replace: enElNavegador === estado.paso });
      }
      return;
    }

    // 2. No cambio el paso: manda la URL, si nombra un paso alcanzable. Y si el enrutador dibuja otra
    //    ruta que la del navegador, se le pone al dia.
    if (enElNavegador !== null && pasoAlcanzable(estado, enElNavegador)) {
      if (enElNavegador !== estado.paso) {
        // El paso que llegue con este `irA` lo pidio la URL, no una accion: se apunta YA como visto.
        // Si no, y la URL cambia otra vez antes del dibujo, la regla 1 lo tomaria por una accion y
        // empujaria su ruta encima de la URL nueva («Seguir a la URL no es una accion», issue 74).
        pasoVisto.current = enElNavegador;
        despachar({ tipo: 'irA', paso: enElNavegador });
      }
      if (dibujado !== enElNavegador) void navegar(RUTA_DEL_PASO[enElNavegador], { replace: true });
      return;
    }
    void navegar(RUTA_DEL_PASO[ultimoAlcanzable(estado)], { replace: true });
    // `movimientos` no se lee: esta para que el efecto corra cada vez que el navegador se mueve.
  }, [estado, pathname, movimientos, navegar, despachar]);
}
