import { type Dispatch, type ReactNode, createContext, useCallback, useContext, useMemo, useReducer } from 'react';

import { haySesion } from '../api/claims.ts';
import { hayPlataforma, useLaFuente, useLaSituacionSinPedir } from '../datos/fuente.ts';
import {
  type AccionDelRecorrido,
  DATOS_DE_LA_DEMOSTRACION,
  type DatosLeidos,
  type DecisionesDelRecorrido,
  type EstadoDelRecorrido,
  datosDeLaSituacion,
  decisionesDe,
  estadoInicial,
  recorrido,
} from './recorrido.ts';

/**
 * **El recorrido, montado**: `useReducer` sobre el reductor puro y un contexto para leerlo.
 *
 * Aqui no hay logica de recorrido: toda esta en `recorrido.ts`, que se prueba sin React. Este archivo
 * solo decide DONDE vive el estado —una vez, por encima del enrutador, para que cambiar de ruta no lo
 * pierda—, como se lee, y (desde el issue 50) **que parte guarda**.
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
 *
 * <h2>Lo que se guarda y lo que se lee (issue 50)</h2>
 *
 * El reductor montado guarda **solo las decisiones** de la persona (`DecisionesDelRecorrido`). Los
 * conceptos y a nombre de quien estan (`DatosLeidos`) se LEEN en cada dibujo: los del artboard en
 * demostracion, y con plataforma lo que la cache de consultas tenga de `GET /portal/situacion`
 * (`useLaSituacionSinPedir`, que la sigue sin pedirla). Nada los copia: no hay efecto, ni accion
 * `situacionLeida`, ni un dibujo en que la respuesta ya llego y la lista todavia no.
 *
 * Las acciones que necesitan la lista —marcar todo, confirmar el pago, entrar— la reciben **con la
 * accion**: `despachar` la envia junto con los datos que la persona tenia delante al pulsar, y el
 * reductor del proveedor (`conLoLeido`) los junta con las decisiones, llama al reductor puro y se
 * vuelve a quedar solo con las decisiones. Asi el reductor sigue siendo una funcion pura, y lo que
 * sella un pago es lo que se veia, no lo que habia la ultima vez que alguien copio.
 */

/** Una accion, con lo que se leia cuando la persona la hizo. */
interface Envio {
  readonly accion: AccionDelRecorrido;
  readonly datos: DatosLeidos;
}

/**
 * El reductor que monta `useReducer`: el puro, sobre las decisiones y lo leido juntos, y de vuelta
 * solo las decisiones. Si la accion no cambio nada, devuelve **las mismas** decisiones, que es lo que
 * deja a React no volver a dibujar.
 */
function conLoLeido(decisiones: DecisionesDelRecorrido, { accion, datos }: Envio): DecisionesDelRecorrido {
  const antes: EstadoDelRecorrido = { ...decisiones, ...datos };
  const despues = recorrido(antes, accion);
  return despues === antes ? decisiones : decisionesDe(despues);
}

/**
 * Lo que se lee, segun el modo. `datosDeLaSituacion` da el MISMO arreglo de conceptos mientras la
 * cache no cambie (React Query conserva la referencia si la respuesta repetida es igual), y el
 * `useMemo` el mismo objeto: sin cambio de datos no hay dibujo nuevo, ni un `despachar` nuevo.
 */
function useLoLeido(conPlataforma: boolean): DatosLeidos {
  const situacion = useLaSituacionSinPedir().data;
  return useMemo(
    () => (conPlataforma ? datosDeLaSituacion(situacion) : DATOS_DE_LA_DEMOSTRACION),
    [conPlataforma, situacion],
  );
}

export interface ValorDelRecorrido {
  readonly estado: EstadoDelRecorrido;
  readonly despachar: Dispatch<AccionDelRecorrido>;
}

const Contexto = createContext<ValorDelRecorrido | null>(null);

export interface ProveedorDelRecorridoProps {
  readonly children: ReactNode;
  /** Lo que una prueba quiere de partida. Si trae `deudas` o `contribuyente`, se ignoran: se leen. */
  readonly inicial?: DecisionesDelRecorrido;
}

export function ProveedorDelRecorrido({ children, inicial }: ProveedorDelRecorridoProps) {
  const fuente = useLaFuente();
  const conPlataforma = hayPlataforma(fuente);
  const [decisiones, enviar] = useReducer(conLoLeido, inicial, (dado) =>
    decisionesDe(
      // `haySesion()` solo se pregunta con plataforma: en demostracion no hay ninguna puerta a la que
      // haber entrado, y la sesion del artboard la enciende el paso «Mis datos».
      dado ?? estadoInicial({ conPlataforma, autenticado: conPlataforma && haySesion(), amnistia: fuente.amnistia }),
    ),
  );
  // El modo, del estado y no de la fuente: es donde vive (`estado.conPlataforma`, issue 28).
  const datos = useLoLeido(decisiones.conPlataforma);
  // Cambia solo si cambia lo leido: en demostracion, nunca; con plataforma, cuando la cache trae una
  // respuesta distinta. Un `despachar` que enviara datos viejos sellaria un pago que ya no se ve.
  const despachar = useCallback((accion: AccionDelRecorrido) => enviar({ accion, datos }), [datos]);
  const estado = useMemo(() => ({ ...decisiones, ...datos }), [decisiones, datos]);
  // Sin memo, cada render del proveedor daria un objeto nuevo y volveria a dibujar a todos los que
  // leen, aunque nada hubiera cambiado.
  const valor = useMemo(() => ({ estado, despachar }), [estado, despachar]);
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
