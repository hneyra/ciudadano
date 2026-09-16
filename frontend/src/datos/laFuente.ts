import type { FuenteDelPortal } from './fuente.ts';
import { fuenteDeLaPlataforma } from './fuenteDeLaPlataforma.ts';

/**
 * **De donde lee el portal: la demostracion o la plataforma** (issue 27).
 *
 * Portado de `rentas/frontend/src/arranque.ts` (rentas#114), mecanismo por mecanismo. Alli la
 * bandera siembra el catalogo para poder mirar cuarenta pantallas sin levantar nada; aqui elige la
 * fuente, que es la misma idea con otro sujeto: **una bandera de construccion, la demostracion por
 * omision en desarrollo, y ni una linea de demostracion en el paquete de produccion.**
 *
 * <h2>Las dos condiciones son CONSTANTES AL CONSTRUIR, y de eso depende que no viaje nada</h2>
 *
 * Vite sustituye `import.meta.env.DEV` por `false` y cada `import.meta.env.VITE_*` por su literal
 * **al construir**, asi que Rollup pliega la condicion y **se lleva por delante el `import()`
 * dinamico entero**, con los datos del artboard dentro. Leer la bandera en tiempo de EJECUCION
 * —tras una funcion, desde `globalThis`, desde `configuracion()`— deja el modulo dentro del
 * paquete; esta medido en `rentas` por los dos lados (227 205 bytes con «Rufina Medina Medina»
 * dentro frente a 193 592 sin ella), y aqui lo miden dos guardas: la estatica
 * `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts` y, sobre el `dist/` de verdad,
 * `e2e/la-demostracion-no-viaja-al-bundle.spec.ts`.
 *
 * **`import.meta.env.DEV` va primero y no sobra.** La bandera sola dependeria de que nadie la
 * encienda al construir; con esta delante, `yarn build` sale limpio **haga lo que haga el
 * entorno**.
 *
 * <h2>Y por que esto no vive en `arranque.ts`, que es donde `rentas` lo tiene</h2>
 *
 * Porque `arranque.ts` de este portal es lo que corre **antes de montar** y no puede arrastrar
 * React: importa `api/identidad.ts` y nada mas, a proposito (ver su cabecera). La eleccion de la
 * fuente, en cambio, termina en un valor que se le pasa a un contexto de React. Separadas, cada
 * una se prueba por lo suyo; juntas, la prueba del arranque tendria que cargar el arbol entero.
 */

/**
 * La fuente de este arranque.
 *
 * Asincrona porque la de demostracion llega por `import()`, que es lo unico que Rollup puede
 * plegar. Se llama UNA vez, en `main.tsx`, antes de montar: lo que se inyecta en `FuenteActiva` no
 * cambia dentro de la vida de la pagina, porque la bandera es de construccion y no de ejecucion.
 */
export async function laFuente(): Promise<FuenteDelPortal> {
  if (!import.meta.env.DEV) return fuenteDeLaPlataforma;
  if (import.meta.env.VITE_KAMAYUK_SIN_PLATAFORMA !== 'true') return fuenteDeLaPlataforma;

  const { fuenteDeDemostracion } = await import('./fuenteDeDemostracion.ts');
  return fuenteDeDemostracion;
}
