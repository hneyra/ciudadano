import { useEffect } from 'react';

/**
 * **Al imprimir, la paleta clara de `clasico`**, aunque la persona o su equipo esten en oscuro
 * (revision del PR del issue 9).
 *
 * El artboard imprime el recibo sobre blanco (lineas 45-49). La regla `@media print` de
 * `src/estilos.css` lo pone sobre `--color-superficie`, que en oscuro es `#1b1b1b`: el recibo saldria
 * negro. Y en CSS no hay arreglo sin un color literal: el oscuro de `temas.css` gana por especificidad
 * (`[data-tema='clasico'][data-modo='oscuro']`, o `…:not([data-modo='claro'])` bajo
 * `prefers-color-scheme: dark`) y esta hoja no puede reescribir los valores claros.
 *
 * <h2>Por que `data-modo="claro"` en la raiz</h2>
 *
 * Es el mismo atributo que `ProveedorDeTema` de `@kamayuk/ui` estampa, y desactiva a la vez las dos
 * ramas del oscuro: la elegida (`[data-modo='oscuro']` deja de coincidir) y la del sistema (la de
 * `prefers-color-scheme` exige `:not([data-modo='claro'])`). Lo que se deja como estaba es lo que el
 * proveedor guarda: **no se llama a `fijarModo`**, que anotaria «claro» en `localStorage` y congelaria
 * en claro a quien tiene el equipo en oscuro. Al acabar se restaura EXACTAMENTE lo anterior, incluida
 * la ausencia del atributo, que para el proveedor significa «lo que diga el sistema».
 *
 * <h2>Dos senales, porque ninguna llega siempre</h2>
 *
 * · `beforeprint` / `afterprint`: las del dialogo de imprimir, antes de maquetar para el papel.
 * · El cambio de `matchMedia('print')`: es lo que avisa cuando la impresion se EMULA
 *   (`page.emulateMedia({ media: 'print' })` de Playwright, las herramientas del navegador), que no
 *   dispara `beforeprint`. Sin ella, la vista de impresion emulada seguiria en oscuro y la medicion de
 *   las capturas mentiria.
 *
 * Las dos entran por la misma puerta y son idempotentes: entrar dos veces guarda lo anterior una sola
 * vez, y salir sin haber entrado no toca nada.
 */

const ATRIBUTO = 'data-modo';

/**
 * Engancha las dos senales a `ventana` sobre `raiz` y devuelve con que desengancharlas. Pura sobre sus
 * argumentos, para probarla sin React; `useImpresionEnClaro` solo la monta.
 */
export function imprimirEnClaro(raiz: HTMLElement, ventana: Window): () => void {
  // `undefined`: no se esta imprimiendo. `null`: se estaba imprimiendo y antes no habia atributo.
  let anterior: string | null | undefined;

  const entrar = (): void => {
    if (anterior !== undefined) return;
    anterior = raiz.getAttribute(ATRIBUTO);
    raiz.setAttribute(ATRIBUTO, 'claro');
  };

  const salir = (): void => {
    if (anterior === undefined) return;
    if (anterior === null) raiz.removeAttribute(ATRIBUTO);
    else raiz.setAttribute(ATRIBUTO, anterior);
    anterior = undefined;
  };

  const alCambiarLaImpresion = (evento: MediaQueryListEvent): void => {
    if (evento.matches) entrar();
    else salir();
  };

  const impresion = typeof ventana.matchMedia === 'function' ? ventana.matchMedia('print') : null;
  ventana.addEventListener('beforeprint', entrar);
  ventana.addEventListener('afterprint', salir);
  impresion?.addEventListener('change', alCambiarLaImpresion);

  return () => {
    ventana.removeEventListener('beforeprint', entrar);
    ventana.removeEventListener('afterprint', salir);
    impresion?.removeEventListener('change', alCambiarLaImpresion);
    // Si se desmonta a mitad de una impresion, no se deja el modo cambiado.
    salir();
  };
}

/** Monta `imprimirEnClaro` sobre `<html>` mientras viva quien lo llama (el marco, una vez). */
export function useImpresionEnClaro(): void {
  useEffect(() => imprimirEnClaro(document.documentElement, window), []);
}
