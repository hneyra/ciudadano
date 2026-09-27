import { cn } from '@kamayuk/ui';
import type { ComponentProps } from 'react';

import { bandaConFilo } from './variantes.tsx';

/**
 * **El aviso con filo izquierdo de 4 px** del artboard (`diseno/Ciudadano.dc.html`, lineas 148 y 176):
 * el error de la busqueda (`mal`) y la amnistia (`atencion`).
 *
 * <h2>Por que no es `Alerta` de `@kamayuk/ui`</h2>
 *
 * `Alerta` es la pieza del producto para avisos, y se miro primero. No cuadra con el artboard en
 * tres cosas que se ven y en una que se oye:
 *
 *   · Dibuja un **icono** (triangulo o «i») delante del texto; el artboard no lleva ninguno.
 *   · Su texto va a **13 px** con un relleno de 11/14 px y radio de 3 px; el artboard pinta
 *     14.5 px, 13/16 px (15/18 la amnistia) y esquinas rectas.
 *   · No tiene el **filo izquierdo de 4 px** en la tinta del tono, que es lo que distingue estos
 *     dos avisos en la pantalla.
 *   · Y pone `role="status"` a todo lo que no es `mal`: la amnistia, que esta ahi desde que se abre
 *     la pagina, seria una region viva sin nada que anunciar.
 *
 * Asi que se construye aqui, con los MISMOS pares de tokens que `Alerta` usa para cada tono —el filo
 * tenue es el suyo, `border-mal-borde/40` y `border-atencion-tinta/25`, escritos una vez en
 * `bandaConFilo` (`variantes.tsx`, issue 60)— y sin un color propio. El
 * `role` lo decide quien lo usa: el error de la busqueda lleva `role="alert"`; la amnistia, ninguno.
 */

/** La tinta del texto de cada tono; el filo y el papel son los de `bandaConFilo` (issue 60). */
const TINTA = {
  mal: 'text-mal-tinta',
  atencion: 'text-atencion-tinta',
} as const;

export interface AvisoConFiloProps extends ComponentProps<'div'> {
  readonly tono: keyof typeof TINTA;
}

export function AvisoConFilo({ tono, className, ...resto }: AvisoConFiloProps) {
  return (
    <div
      data-tono={tono}
      className={cn(bandaConFilo({ tono, filo: 'fino' }), TINTA[tono], 'text-[14.5px] text-pretty', className)}
      {...resto}
    />
  );
}
