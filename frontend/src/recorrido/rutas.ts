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
 * <h2>URL y estado, en un solo gancho y con una sola regla (issue 61)</h2>
 *
 * `useLaUrlYElPaso`, montado en `Marco`. La regla:
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
 * El paso 2 se comprueba en CADA dibujo, no solo cuando cambia la URL: si lo alcanzable cambia sin que
 * cambie ni el paso ni la URL, tambien se redirige (el comprobante sin sello). Un solo `useRef` recuerda
 * el ultimo paso visto, para saber cual de los dos cambio: sin el, en el dibujo intermedio —estado en
 * `deudas`, la URL sin mover— la URL «mandaria» y desharia la accion.
 *
 * Tres cosas que sostienen la regla, cada una medida (`docs/adr/CIU-0002-el-recorrido-es-una-maquina-de-estados.md`):
 *
 *   · **La URL que se compara es la del navegador** (`rutaDelNavegador`), no la del ultimo dibujo: el
 *     enrutador cambia la historia en el acto pero avisa a React dentro de una transicion, y un clic
 *     que llega entre las dos cosas se dibuja con la ruta VIEJA. Y si lo que el enrutador dibuja no es
 *     lo que dice el navegador —un `history.replaceState` a sus espaldas—, se le pone al dia
 *     REEMPLAZANDO: la historia no gana ninguna entrada que la persona no haya dado.
 *   · **Al efecto lo despierta tambien el navegador** (issue 74): `useMovimientosDelNavegador` cuenta
 *     los `popstate`. Un Atras en medio de la transicion del enrutador vuelve a dibujar la MISMA ruta, y
 *     sin la cuenta el efecto no correria.
 *   · **Seguir a la URL no es una accion** (issue 74): el paso que llega por el `irA` de la regla 2 se
 *     apunta como visto AL DESPACHARLO. Apuntado al dibujarse, una URL que cambia otra vez en medio
 *     haria que la regla 1 empujara una entrada nueva encima de la que la persona acababa de poner.
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
 * La ruta que el navegador tiene AHORA, del hash (`createHashRouter` no lleva `basename`). Ver «La URL que
 * es la del navegador» en la cabecera.
 */
function rutaDelNavegador(): string {
  return window.location.hash.replace(/^#/, '').split(/[?#]/)[0] || '/';
}

/**
 * **Cuantas veces se ha movido el navegador** (issue 74): una cuenta que sube con cada `popstate`
 * —Atras, Adelante, un enlace, el hash escrito—, la misma senal que escucha el enrutador. Ver «Al efecto
 * lo despierta tambien el navegador» en la cabecera.
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
