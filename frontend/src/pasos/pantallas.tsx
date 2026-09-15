import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

import type { Paso } from '../recorrido/recorrido.ts';

/**
 * **Las seis pantallas del recorrido, cada una en su trozo del bundle** (issue 11, nota del revisor).
 *
 * <h2>Por que</h2>
 *
 * Con las seis importadas de forma estatica, `vite build` emitia UN trozo de JavaScript de 792.30 kB y
 * avisaba «Some chunks are larger than 500 kB after minification». Subir `chunkSizeWarningLimit`
 * callaria el aviso sin cambiar lo que el telefono del contribuyente descarga y compila antes de ver
 * la primera pantalla. Asi que se reparte: cada pantalla es un `import()` —un trozo propio— y las
 * dependencias grandes van a trozos de proveedor (`build.rollupOptions.output.manualChunks`, en
 * `trozos.ts`). Que ningun trozo pase de 500 kB lo impide el complemento `ningunTrozoPasaDelTope` de
 * ese mismo archivo, que hace FALLAR `yarn build`.
 *
 * <h2>Por que cada pantalla se puede precargar, y por que eso la dibuja sin suspender</h2>
 *
 * `React.lazy` suspende la PRIMERA vez que se dibuja cada pantalla, aunque su modulo ya este en
 * memoria: llama a su cargador, recibe una promesa y hasta el siguiente turno de microtareas no sabe
 * que esta cumplida. Dos consecuencias:
 *
 * · **En el navegador**, sin mas, cada paso nuevo parpadearia en blanco el tiempo de pedir su trozo,
 *   y en mitad de un pago con mala cobertura ese hueco es donde se pierde la conexion. Por eso el
 *   enrutador pide las seis en cuanto se dibuja la primera (`precargarLasPantallas`).
 * · **En las pruebas de `vitest`**, que montan el portal y preguntan `getByRole` en el acto, la
 *   pantalla aun no estaria. `src/pruebas/portal.tsx` precarga las seis antes de montar.
 *
 * Y para que precargar sirva de algo, el cargador que ve `lazy` devuelve, cuando el modulo ya llego,
 * una **promesa ya cumplida que contesta en el acto** (`cumplida`): `lazy` la da por resuelta dentro de
 * la misma llamada y dibuja sin suspender. El camino que SI suspende —pantalla no precargada, respaldo
 * y luego la pantalla— lo mide `src/pasos/pantallas.test.tsx` con una pantalla perezosa nueva.
 */

/**
 * Una promesa que ya se cumplio y **contesta en el acto**, no en la siguiente microtarea.
 *
 * Es lo unico que `lazy` necesita para no suspender: llama a `then` y, si el valor llego dentro de esa
 * misma llamada, lo usa (`lazyInitializer` de `react`: el estado pasa a «resuelto» antes de volver).
 * Es una `Promise` de verdad —`lazy` la tipa asi— a la que solo se le cambia `then`.
 */
function cumplida<T>(valor: T): Promise<T> {
  const enElActo = (alCumplir?: ((v: T) => unknown) | null) =>
    Promise.resolve(alCumplir === undefined || alCumplir === null ? valor : alCumplir(valor));
  return Object.assign(Promise.resolve(valor), { then: enElActo as Promise<T>['then'] });
}

export interface PantallaPerezosa {
  /** La pantalla, para dibujarla dentro de un `Suspense`. */
  readonly Pantalla: LazyExoticComponent<ComponentType>;
  /** Pide su trozo y devuelve la pantalla. Una vez; si falla (la red), la siguiente llamada lo vuelve a pedir. */
  readonly precargar: () => Promise<ComponentType>;
}

/** Una pantalla que se carga con `import()` y se puede pedir antes de dibujarla. */
export function perezosa(cargar: () => Promise<ComponentType>): PantallaPerezosa {
  let cargada: ComponentType | undefined;
  let enCamino: Promise<ComponentType> | undefined;

  const pedir = (): Promise<ComponentType> => {
    enCamino ??= cargar().then(
      (componente) => (cargada = componente),
      (error: unknown) => {
        enCamino = undefined;
        throw error;
      },
    );
    return enCamino;
  };

  const Pantalla = lazy(() =>
    cargada === undefined ? pedir().then((componente) => ({ default: componente })) : cumplida({ default: cargada }),
  );

  return { Pantalla, precargar: pedir };
}

/** Las seis, por paso. Cada `import()` es un trozo del bundle. */
export const PANTALLAS: Readonly<Record<Paso, PantallaPerezosa>> = {
  buscar: perezosa(() => import('./buscar/Buscar.tsx').then((m) => m.Buscar)),
  deudas: perezosa(() => import('./deudas/Deudas.tsx').then((m) => m.Deudas)),
  identificar: perezosa(() => import('./identificar/Identificar.tsx').then((m) => m.Identificar)),
  pagar: perezosa(() => import('./pagar/Pagar.tsx').then((m) => m.Pagar)),
  comprobante: perezosa(() => import('./comprobante/Comprobante.tsx').then((m) => m.Comprobante)),
  historial: perezosa(() => import('./historial/Historial.tsx').then((m) => m.Historial)),
};

/** Pide los seis trozos a la vez. */
export async function precargarLasPantallas(): Promise<void> {
  await Promise.all(Object.values(PANTALLAS).map((pantalla) => pantalla.precargar()));
}
