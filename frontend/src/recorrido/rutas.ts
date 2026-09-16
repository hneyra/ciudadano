import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useRecorrido } from './ProveedorDelRecorrido.tsx';
import type { Paso } from './recorrido.ts';

/**
 * **Las rutas del portal**: una por paso, con hash, y el estado del recorrido como arbitro.
 *
 * <h2>Por que hash</h2>
 *
 * El portal es un bundle estatico bajo `/portal/` sin servidor que reescriba rutas. Con
 * `#/pagar`, recargar la pagina o compartir el enlace llega siempre a `index.html`.
 *
 * <h2>Quien manda: el reductor o la URL</h2>
 *
 * Los dos, cada uno en su direccion, y sin pisarse:
 *
 *   1. **Una accion cambia `estado.paso`** (buscar, pagar, cerrar sesion…) → `useLaRutaSigueAlPaso`
 *      navega a su ruta. Las pantallas despachan; no navegan.
 *   2. **La URL cambia** (atras del navegador, un enlace, escribir el hash) → `PantallaDelPaso`
 *      (`src/enrutador.tsx`)
 *      comprueba `pasoAlcanzable`: si lo es, despacha `irA` para que el estado lo siga; si no,
 *      redirige CON `replace` al ultimo alcanzable, y ese hash no queda en el historial.
 *
 * Cada efecto actua **solo cuando cambia lo suyo** (un `useRef` recuerda lo ultimo que vio). Sin eso,
 * en el render intermedio —estado ya en `deudas`, URL todavia en `buscar`— la pantalla de buscar
 * veria «el estado no dice buscar» y despacharia `irA('buscar')`, deshaciendo la accion.
 */

/** La ruta de cada paso. */
export const RUTA_DEL_PASO: Readonly<Record<Paso, `/${string}`>> = {
  buscar: '/buscar',
  deudas: '/deudas',
  identificar: '/identificar',
  pagar: '/pagar',
  comprobante: '/comprobante',
  historial: '/historial',
};

/** (1) Cuando una accion cambia el paso, la URL lo sigue. */
export function useLaRutaSigueAlPaso(): void {
  const { estado } = useRecorrido();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const visto = useRef(estado.paso);

  useEffect(() => {
    if (visto.current === estado.paso) return;
    visto.current = estado.paso;
    if (pathname !== RUTA_DEL_PASO[estado.paso]) navegar(RUTA_DEL_PASO[estado.paso]);
  }, [estado.paso, pathname, navegar]);
}

