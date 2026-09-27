import { skipToken, useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';

import { type ConPlataforma, type EnDemostracion, consultaDe } from '../modo/modo.ts';
import type { PagoDelHistorial, SituacionDelServidor, Unidad } from './tipos.ts';

/**
 * **De donde lee el portal**, y los ganchos con que lo leen las pantallas.
 *
 * <h2>Por que una interfaz asincrona, si en demostracion los datos estan en memoria</h2>
 *
 * Porque las pantallas no tienen que saber de donde salen. Leyendo por `useQuery` desde el
 * principio, dibujan «pidiendo» y «no se pudo» como lo haria un portal de verdad, y cambiar de modo
 * es cambiar la fuente que se inyecta, no tocar una pantalla.
 *
 * <h2>Una sola fuente activa, inyectable</h2>
 *
 * `FuenteActiva` es un contexto de React; quien elige su valor es `src/datos/laFuente.ts`, desde
 * `montaje.tsx`, segun la bandera de construccion (issue 27). Una prueba pone la suya con
 * `<FuenteActiva value={falsa}>`. No hay un modulo global que se sustituya con `vi.mock`, que es
 * justo lo que dejaria a dos pruebas pisandose la fuente.
 *
 * <h2>Una union por modo (issue 59)</h2>
 *
 * La fuente ES un modo (`src/modo/modo.ts`) con lo que sabe pedir encima: la de demostracion trae los
 * datos del artboard (`demostracion`), la de la plataforma trae la consulta (`consulta`), y ninguna
 * trae las dos ni puede no traer ninguna. Hasta el issue 59 las dos eran campos independientes
 * —`consulta` o `null`, `demostracion` o `null`— y una fuente con los dos a `null` arrancaba en
 * demostracion y `laDemostracion(estado)` reventaba en la primera pantalla.
 *
 * **Las pantallas no preguntan a la fuente en que modo esta**: preguntan a la politica del modo
 * (`useModo()`). Lo vigila `verificaciones/el-modo-se-lee-en-su-modulo.test.ts`. Antes la pregunta era
 * `hayPlataforma(fuente)`, repartida por seis archivos.
 *
 * `demostracion.ts` y `cuentas.ts` no importan React; este archivo si, porque los ganchos lo son.
 * Y este archivo **no importa la demostracion**: lo hace `fuenteDeDemostracion.ts`, al que solo se
 * llega por el `import()` plegable de `laFuente.ts` (`verificaciones/la-demostracion-no-viaja-al-bundle.test.ts`).
 */

/** Lo que toda fuente sabe, este en el modo que este. */
interface LoQueTodaFuenteSabe {
  /**
   * **Si hay una amnistia que condone el interes moratorio** (issue 49).
   *
   * La dice la fuente y no cada pantalla: en demostracion, la de la Ordenanza del artboard; con
   * plataforma, ninguna, porque el contrato de `GET /portal/situacion` no la trae. El recorrido la
   * copia al arrancar (`estadoInicial`) y de ella cuelga lo que se cobra (`aCobrar`) y si se nombra.
   * No es del modo (ver la cabecera de `src/modo/modo.ts`): el dia que el contrato la traiga, saldra
   * de la respuesta.
   */
  readonly amnistia: boolean;
  /** Los pagos ya hechos por la cuenta con sesion. */
  historial(): Promise<readonly PagoDelHistorial[]>;
  /** Los predios y vehiculos del contribuyente de la cuenta con sesion. */
  unidades(): Promise<readonly Unidad[]>;
}

/**
 * **La fuente de la demostracion**: los datos del artboard (issue 58) —la deuda, el contribuyente, la
 * usuaria, el sello del comprobante, los medios de pago y los ejemplos de los campos—, en
 * `demostracion`, que le viene de `EnDemostracion`. Llegan por aqui y no por un `import` de
 * `demostracion.ts` en cada pantalla: esos `import` estaticos eran los que metian los datos en el
 * paquete de produccion aunque la fuente de demostracion se quedara fuera.
 */
export interface FuenteDeDemostracion extends EnDemostracion, LoQueTodaFuenteSabe {}

/** **La fuente de la plataforma**: sin datos de ejemplo, y con a quien preguntar. */
export interface FuenteConPlataforma extends ConPlataforma, LoQueTodaFuenteSabe {
  /**
   * La situacion del ciudadano **tal como la cuenta el servidor**.
   *
   * Sin parametros a proposito: ADR-0020 retiro `GET /portal/deuda?doc=` —era una enumeracion de
   * contribuyentes— y lo reemplazo por `GET /portal/situacion`, donde el sujeto sale del token. Por
   * eso la fuente ya no ofrece «la deuda de este documento»: el servidor no lo ofrece.
   */
  readonly consulta: () => Promise<SituacionDelServidor>;
}

/** Lo que el portal sabe pedir: en un modo o en el otro, nunca en los dos ni en ninguno (issue 59). */
export type FuenteDelPortal = FuenteDeDemostracion | FuenteConPlataforma;

/**
 * **Nadie inyecto una fuente**, que es el unico valor por omision honesto.
 *
 * Antes lo era la de demostracion, y no puede seguir siendolo: un valor por omision es un `import`
 * estatico, y un `import` estatico de la demostracion la mete en el paquete de produccion pase lo
 * que pase con la bandera. Lo que se pone en su sitio no calla: `montaje.tsx` inyecta siempre la que
 * `laFuente.ts` elige, y las pruebas, la suya (`src/pruebas/portal.tsx`).
 */
const SIN_INYECTAR =
  'Nadie inyecto una fuente en `FuenteActiva`. La elige `src/datos/laFuente.ts` y la pone ' +
  '`montaje.tsx`; en una prueba, `montarElPortal({ fuente })`.';

const NADIE: FuenteDelPortal = {
  // Un modo hay que tenerlo (issue 59): el que no inventa datos. Su consulta rechaza diciendo por que,
  // como lo demas.
  modo: 'plataforma',
  consulta: () => Promise.reject(new Error(SIN_INYECTAR)),
  // Nadie dijo que la haya: no se condona nada.
  amnistia: false,
  historial: () => Promise.reject(new Error(SIN_INYECTAR)),
  unidades: () => Promise.reject(new Error(SIN_INYECTAR)),
};

/** La fuente que leen los ganchos. Ver `NADIE`: por omision, ninguna. */
export const FuenteActiva = createContext<FuenteDelPortal>(NADIE);

/** La fuente activa, para quien tenga que preguntarle algo que no sea una de las tres lecturas. */
export function useLaFuente(): FuenteDelPortal {
  return useContext(FuenteActiva);
}

/** La rama de la cache donde vive todo lo del portal. Escrita una sola vez. */
const RAMA = 'portal';

/**
 * Las llaves con que cada lectura vive en la cache de consultas.
 *
 * **Se exportan** por lo mismo que en `rentas` (`src/datos/useCatalogoPermitido.ts`): quien tenga
 * que invalidar o sembrar una lectura tiene que usar ESTAS llaves. Con los literales repetidos en
 * otro sitio, renombrar una aqui dejaria aquel apuntando a una llave que nadie lee, y el sintoma no
 * seria un error sino un dato viejo.
 *
 * La de la situacion ya no lleva documento dentro: no hay dos consultas distintas que separar,
 * porque el sujeto sale del token y hay uno solo por pestana.
 */
export const LLAVES = {
  rama: [RAMA],
  situacion: [RAMA, 'situacion'],
  historial: [RAMA, 'historial'],
  unidades: [RAMA, 'unidades'],
} as const;

/**
 * `retry: false` en los tres, como en `rentas`: reintentar una fuente que ya contesto que no solo
 * hace esperar el triple para leer el mismo fallo. Y aqui ademas, un 401 reintentado tres veces son
 * tres 401: el remedio es entrar, no insistir.
 */

/**
 * **La situacion del ciudadano, cuando hay a quien preguntarsela.**
 *
 * Sin plataforma la consulta queda **apagada** (`enabled: false`) en vez de no llamarse: un gancho
 * que unas veces se llama y otras no seria un gancho condicional, y React no lo admite. Apagada, la
 * consulta ni pide ni reintenta, y quien la dibuja pregunta antes a la politica (`deuda`).
 */
export function useLaSituacion() {
  const consulta = consultaDe(useContext(FuenteActiva));
  return useQuery({
    queryKey: LLAVES.situacion,
    queryFn: consulta === null ? skipToken : consulta,
    retry: false,
  });
}

/**
 * **La situacion que ya este en la cache, sin pedirla** (issue 50).
 *
 * La lee `ProveedorDelRecorrido`, que esta montado en todo el portal: si pidiera, preguntaria
 * tambien en `#/entrar`, sin token, y se llevaria un 401. Apagada (`enabled: false`) no pide nunca,
 * pero sigue a la cache: cuando `useLaSituacion` —la del paso 2 o la del historial— trae la
 * respuesta, este gancho la ve en el MISMO dibujo, porque los dos observan la misma llave.
 *
 * Que la respuesta siga ahi al volver al paso 2 —sin volver a dibujar «Consultando…»— no depende de
 * este observador sino de la politica del cliente (`src/datos/consultas.ts`): `gcTime: Infinity` no
 * la tira nunca y `staleTime: Infinity` no la vuelve a pedir al montar.
 */
export function useLaSituacionSinPedir() {
  const consulta = consultaDe(useContext(FuenteActiva));
  return useQuery({
    queryKey: LLAVES.situacion,
    queryFn: consulta === null ? skipToken : consulta,
    enabled: false,
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
