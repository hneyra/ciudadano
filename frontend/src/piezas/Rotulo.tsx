import type { ReactNode } from 'react';

/**
 * **El rotulo y las medidas de control del artboard**, sobre las de `@kamayuk/ui`.
 *
 * Nacieron en `src/pasos/buscar/Buscar.tsx` (issue 5) y se mudan aqui cuando «Mis datos» (issue 7)
 * los necesita igual: dos copias de la misma medida se desincronizan.
 *
 * · `Rotulo`: el artboard escribe el rotulo de un campo en 13.5 px, negrita y `--tinta` (lineas 136 y
 *   322); `Etiqueta` lo pinta en 12.5 px y `--tinta-2`. Va DENTRO del rotulo de `Etiqueta`, que pone
 *   la negrita y el `htmlFor`.
 * · `MEDIDAS_DE_CONTROL`: `IN` (linea 718), 44 px de alto, 10/12 px de relleno y 15 px de letra,
 *   encima de `CONTROL`, que pone el filo, el papel y el aspecto invalido.
 */

export function Rotulo({ children }: { readonly children: ReactNode }) {
  return <span className="text-[13.5px] text-tinta">{children}</span>;
}

export const MEDIDAS_DE_CONTROL = 'min-h-[44px] px-3 py-[10px] text-[15px]';
