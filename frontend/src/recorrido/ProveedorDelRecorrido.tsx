import { type Dispatch, type ReactNode, createContext, useContext, useMemo, useReducer } from 'react';

import { haySesion } from '../api/claims.ts';
import { hayPlataforma, useLaFuente } from '../datos/fuente.ts';
import { type AccionDelRecorrido, type EstadoDelRecorrido, estadoInicial, recorrido } from './recorrido.ts';

/**
 * **El recorrido, montado**: `useReducer` sobre el reductor puro y un contexto para leerlo.
 *
 * Aqui no hay logica: toda esta en `recorrido.ts`, que se prueba sin React. Este archivo solo decide
 * DONDE vive el estado —una vez, por encima del enrutador, para que cambiar de ruta no lo pierda— y
 * como se lee.
 *
 * `inicial` existe para las pruebas: una que necesite empezar con sesion o en el paso 4 lo dice con
 * datos, en vez de repetir el recorrido entero pulsando botones.
 *
 * <h2>Quien decide con que recorrido se arranca (issue 28)</h2>
 *
 * Aqui, y **una sola vez**: `estadoInicial` pregunta si hay plataforma —a la fuente inyectada, no al
 * entorno— y si hay sesion —a la puerta, que es quien tiene el token—. Las dos respuestas estan
 * fijadas antes de montar: la bandera es de construccion y el canje corre en `arrancar()`, antes de
 * que React dibuje nada. Por eso se leen en el inicializador de `useReducer` y no en cada dibujo.
 */

export interface ValorDelRecorrido {
  readonly estado: EstadoDelRecorrido;
  readonly despachar: Dispatch<AccionDelRecorrido>;
}

const Contexto = createContext<ValorDelRecorrido | null>(null);

export interface ProveedorDelRecorridoProps {
  readonly children: ReactNode;
  readonly inicial?: EstadoDelRecorrido;
}

export function ProveedorDelRecorrido({ children, inicial }: ProveedorDelRecorridoProps) {
  const fuente = useLaFuente();
  const conPlataforma = hayPlataforma(fuente);
  const [estado, despachar] = useReducer(recorrido, inicial, (dado) =>
    // `haySesion()` solo se pregunta con plataforma: en demostracion no hay ninguna puerta a la que
    // haber entrado, y la sesion del artboard la enciende el paso «Mis datos».
    dado ?? estadoInicial({ conPlataforma, autenticado: conPlataforma && haySesion(), amnistia: fuente.amnistia }),
  );
  // `despachar` es estable; sin memo, cada render del proveedor daria un objeto nuevo y volveria a
  // dibujar a todos los que leen, aunque el estado no hubiera cambiado.
  const valor = useMemo(() => ({ estado, despachar }), [estado]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * El estado del recorrido y con que cambiarlo.
 *
 * Revienta fuera del proveedor, y con su nombre: sin el, una pantalla montada sin proveedor leeria
 * `null` y fallaria tres llamadas despues con un «Cannot read properties of null» que no dice por que.
 */
export function useRecorrido(): ValorDelRecorrido {
  const valor = useContext(Contexto);
  if (valor === null) {
    throw new Error('useRecorrido() se llamo fuera de <ProveedorDelRecorrido>.');
  }
  return valor;
}
