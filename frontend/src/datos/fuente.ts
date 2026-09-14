import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';

import { CONTRIBUYENTE, DEUDAS, HISTORIAL, UNIDADES } from './demostracion.ts';
import type { PagoDelHistorial, Situacion, Unidad } from './tipos.ts';

/**
 * **De donde lee el portal**, y los tres ganchos con que lo leen las pantallas.
 *
 * <h2>Por que una interfaz asincrona, si los datos estan en memoria</h2>
 *
 * Porque las pantallas no tienen que saber que no hay backend. Leyendo por `useQuery` desde el
 * principio, dibujan «cargando» y «fallo» como lo haria un portal de verdad, y el dia que exista
 * una fuente real se cambia la que se inyecta y no se toca ninguna pantalla.
 *
 * <h2>Una sola fuente activa, inyectable</h2>
 *
 * `FuenteActiva` es un contexto de React cuyo valor por omision es `fuenteDeDemostracion`: la
 * aplicacion no tiene que montar nada para leer los datos del artboard, y una prueba pone la suya
 * con `<FuenteActiva value={falsa}>`. No hay un modulo global que se sustituya con `vi.mock`,
 * que es justo lo que dejaria a dos pruebas pisandose la fuente.
 *
 * `demostracion.ts` y `cuentas.ts` no importan React; este archivo si, porque los ganchos lo son.
 */

/** Lo que el portal sabe pedir. */
export interface FuenteDelPortal {
  /** La deuda viva de quien tenga ese documento o codigo de contribuyente. */
  situacion(documento: string): Promise<Situacion>;
  /** Los pagos ya hechos por la cuenta con sesion. */
  historial(): Promise<readonly PagoDelHistorial[]>;
  /** Los predios y vehiculos del contribuyente de la cuenta con sesion. */
  unidades(): Promise<readonly Unidad[]>;
}

/**
 * La fuente de la demostracion: resuelve con los datos del artboard.
 *
 * `situacion` contesta lo mismo a cualquier documento, como el artboard (`buscar()`, lineas
 * 1002-1007): alli la unica comprobacion es que el texto sean digitos, y eso es del formulario,
 * no de la fuente.
 */
export const fuenteDeDemostracion: FuenteDelPortal = {
  situacion: () => Promise.resolve({ contribuyente: CONTRIBUYENTE, deudas: DEUDAS }),
  historial: () => Promise.resolve(HISTORIAL),
  unidades: () => Promise.resolve(UNIDADES),
};

/** La fuente que leen los ganchos. Por omision, la de demostracion. */
export const FuenteActiva = createContext<FuenteDelPortal>(fuenteDeDemostracion);

/** La rama de la cache donde vive todo lo del portal. Escrita una sola vez. */
const RAMA = 'portal';

/**
 * Las llaves con que cada lectura vive en la cache de consultas.
 *
 * **Se exportan** por lo mismo que en `rentas` (`src/datos/useCatalogoPermitido.ts`): quien tenga
 * que invalidar o sembrar una lectura —el pago que deja de ser deuda, en el issue 4— tiene que
 * usar ESTAS llaves. Con los literales repetidos en otro sitio, renombrar una aqui dejaria aquel
 * apuntando a una llave que nadie lee, y el sintoma no seria un error sino un dato viejo.
 *
 * La de la situacion lleva el documento dentro: dos busquedas distintas no comparten cache.
 */
export const LLAVES = {
  rama: [RAMA],
  situacion: (documento: string) => [RAMA, 'situacion', documento] as const,
  historial: [RAMA, 'historial'],
  unidades: [RAMA, 'unidades'],
} as const;

/**
 * `retry: false` en los tres, como en `rentas`: reintentar una fuente que ya contesto que no solo
 * hace esperar el triple para leer el mismo fallo.
 */

/** La deuda viva de ese documento. */
export function useSituacion(documento: string) {
  const fuente = useContext(FuenteActiva);
  return useQuery({
    queryKey: LLAVES.situacion(documento),
    queryFn: () => fuente.situacion(documento),
    retry: false,
  });
}

/** Los pagos ya hechos. */
export function useHistorial() {
  const fuente = useContext(FuenteActiva);
  return useQuery({
    queryKey: LLAVES.historial,
    queryFn: () => fuente.historial(),
    retry: false,
  });
}

/** Los predios y vehiculos. */
export function useUnidades() {
  const fuente = useContext(FuenteActiva);
  return useQuery({
    queryKey: LLAVES.unidades,
    queryFn: () => fuente.unidades(),
    retry: false,
  });
}
