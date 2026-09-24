import { HISTORIAL, UNIDADES } from './demostracion.ts';
import type { FuenteDelPortal } from './fuente.ts';

/**
 * **La fuente de la demostracion**: resuelve con los datos del artboard, sin tocar la red.
 *
 * <h2>Por que vive sola en un archivo, y por que eso no es manía</h2>
 *
 * Porque a este modulo **solo se llega por el `import()` dinamico de `laFuente.ts`**, detras de las
 * dos condiciones que Vite sustituye al construir. Un `import … from './fuenteDeDemostracion.ts'`
 * en cualquier otro archivo de produccion lo metería en el paquete pase lo que pase con la bandera:
 * no hay condicion que pliegue un import estatico. Por eso no cuelga de `fuente.ts` —que lo importa
 * cada pantalla por sus ganchos— ni es el valor por omision de `FuenteActiva`.
 *
 * Lo vigila `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts`, y lo mide sobre el `dist/`
 * construido `e2e/la-demostracion-no-viaja-al-bundle.spec.ts`.
 *
 * <h2>`consulta: null`, y eso es lo que las pantallas leen</h2>
 *
 * En demostracion **no hay consulta que hacer**: la deuda no llega de ningun servidor, sale de
 * `demostracion.ts` a traves del reductor del recorrido. El `null` no es un hueco por rellenar; es
 * la respuesta, y es lo que `hayPlataforma()` mira para que una pantalla sepa en que modo esta sin
 * leer el entorno.
 *
 * Inventar aqui una `SituacionDelServidor` con las cifras del artboard seria darle a las pantallas
 * una respuesta de servidor que ningun servidor dio, y con ella se probarian en verde caminos que
 * en la plataforma de verdad no existen.
 */
export const fuenteDeDemostracion: FuenteDelPortal = {
  consulta: null,
  // La del artboard: la Ordenanza 012-2026-MPS condona el interes entero (issue 49).
  amnistia: true,
  historial: () => Promise.resolve(HISTORIAL),
  unidades: () => Promise.resolve(UNIDADES),
};
