/**
 * **Lo primero que corre, y lo unico que no puede fallar** (issue 56).
 *
 * <h2>El problema: una pagina en blanco sin una linea que leer</h2>
 *
 * Hasta el issue 56, `main.tsx` importaba el portal entero de forma estatica y encadenaba la fuente
 * y el arranque sin `.catch`. Si algo de eso rechazaba —un trozo que no llega porque se desplego
 * otra version mientras la pagina estaba abierta, una red que se corta, una excepcion en el
 * arranque— no se montaba nada: `#raiz` vacio, que para quien iba a pagar un tributo es «el portal
 * esta roto» sin mas.
 *
 * Ahora el portal es un `import()` (`src/montaje.tsx`) y este archivo es lo que lo pide y, si
 * rechaza —la carga o el montaje—, dibuja un aviso **con el DOM a pelo**.
 *
 * <h2>Por que sin React, sin i18next y sin un solo `import`</h2>
 *
 * Porque el aviso tiene que salir justo cuando lo que fallo puede ser cualquiera de ellos: si el
 * trozo que no llego es el de React, o el de i18next, un aviso que los necesite tampoco sale. Este
 * modulo viaja en el trozo de ENTRADA con la hoja de estilos, y no depende de nada mas; que siga
 * sin `import` lo mide `src/inicio.test.ts`.
 *
 * <h2>Y por que su texto NO pasa por `t()`, que es la regla</h2>
 *
 * `t()` es i18next, y i18next puede ser lo que no llego. La regla existe para que todo lo que se lee
 * se pueda traducir; este aviso es la unica frase que tiene que poder leerse **sin** el motor de
 * traduccion, y por eso va escrita en castellano, que es el idioma del portal y la clave de todo su
 * locale. Es una excepcion con nombre, no un descuido: la declara
 * `verificaciones/el-texto-del-dom-pasa-por-t.test.ts`, que senala cualquier otro texto escrito por
 * el DOM fuera de React.
 */

/** Lo que el trozo del portal tiene que exponer para que esto lo monte. */
export interface Montaje {
  montar(raiz: HTMLElement): Promise<void>;
}

/**
 * **El aviso, en castellano y fijo.** Las mismas palabras que «No se pudo abrir su sesion»
 * (`src/aplicacion.tsx`) usa para decir que hacer: recargar, y si no, la ventanilla.
 */
export const AVISO_SIN_PORTAL = {
  titulo: 'No se pudo cargar el portal',
  remedio:
    'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
} as const;

/** El mensaje de lo que fallo, para quien tenga que arreglarlo. Es el dato, no una frase del portal. */
function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}

function parrafo(clases: string, texto: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = clases;
  p.textContent = texto;
  return p;
}

/**
 * Sustituye lo que hubiera en `raiz` por el aviso. Con las clases del aviso de la sesion
 * (`AvisoDeLaSesion`): los tokens estan en la hoja, que viaja en la entrada con este modulo.
 */
export function avisarQueNoSeCargo(raiz: HTMLElement, error: unknown): void {
  const caja = document.createElement('div');
  caja.setAttribute('role', 'alert');
  caja.className = 'max-w-[64ch] border border-mal-borde bg-mal-fondo p-[20px] text-[14px] leading-[1.6]';
  caja.append(
    parrafo('m-0 font-bold text-mal-tinta', AVISO_SIN_PORTAL.titulo),
    parrafo('mt-[10px] mb-0 text-tinta-2 text-pretty', AVISO_SIN_PORTAL.remedio),
    parrafo('mt-[10px] mb-0 text-tinta-3 text-[12px] break-words', mensajeDe(error)),
  );

  const fondo = document.createElement('div');
  fondo.className = 'grid min-h-screen place-items-center bg-fondo p-[30px]';
  fondo.append(caja);
  raiz.replaceChildren(fondo);
}

/**
 * **Pide el portal y lo monta; si cualquiera de las dos cosas rechaza, lo dice.** Nunca una pagina
 * en blanco.
 *
 * `cargar` es el `import()` de `src/montaje.tsx`, escrito en `main.tsx` para que Vite lo parta; las
 * pruebas pasan uno que rechaza.
 */
export function cargarElPortal(raiz: HTMLElement, cargar: () => Promise<Montaje>): Promise<void> {
  return cargar()
    .then((portal) => portal.montar(raiz))
    .catch((error: unknown) => avisarQueNoSeCargo(raiz, error));
}
