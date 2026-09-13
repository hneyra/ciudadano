import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * Lo que las guardas de Tailwind necesitan saber de `@kamayuk/ui`, alcanzado por el enlace.
 *
 * Portado de `rentas/frontend/verificaciones/tailwind.ts` **solo en lo que este andamiaje usa**: la
 * raiz del paquete, la lista de sus componentes y la lectura de los `@source`. Alli trae ademas el
 * compilador de Tailwind y el lector de reglas del CSS emitido, que sirven a
 * `tailwind-emite-las-clases` y a la paleta contra el artboard; esas guardas entran con el tema
 * (issue 2), y su parte de este archivo con ellas. Traerla hoy seria codigo que nadie ejecuta.
 */

const requerir = createRequire(import.meta.url);

/**
 * La raiz de `@kamayuk/ui`, alcanzada POR EL ENLACE y no por una ruta al clon hermano.
 *
 * Es una raiz —y no un especificador— porque lo que cuelga de ella es una BUSQUEDA: los `.tsx` de la
 * libreria, que Tailwind tiene que leer. Un paquete no publica «todos sus componentes» por su
 * `exports`, asi que no hay especificador que pedir.
 */
export const RAIZ_DE_UI = dirname(requerir.resolve('@kamayuk/ui'));

/** Todos los `.tsx` de un arbol, sin pruebas. */
export function fuentesDe(raiz: string): string[] {
  return readdirSync(raiz, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(raiz, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : fuentesDe(ruta);
    if (!e.name.endsWith('.tsx') || e.name.includes('.test.')) return [];
    return [ruta];
  });
}

/**
 * Las rutas que los `@source` de una hoja nombran, en orden.
 *
 * Los comentarios se quitan antes, por lo mismo que en `especificadores.ts`: una hoja que explica
 * en un comentario lo que hace el `@source` no declara nada.
 */
export function fuentesDeclaradas(css: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...sinComentarios.matchAll(/@source\s+['"]([^'"]+)['"]/g)].map(([, ruta]) => ruta ?? '');
}
