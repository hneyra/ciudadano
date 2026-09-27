import { Boton, cn } from '@kamayuk/ui';
import { type ReactNode, useId } from 'react';

/**
 * **Lo que las dos tarjetas de «Mis datos» comparten**: la tarjeta, el mensaje de error bajo el campo,
 * lo que un campo lleva cuando esta mal, y el enlace de demostracion (issue 60: antes, dentro de
 * `Identificar.tsx`).
 */

/**
 * Una tarjeta: papel, filo de 3 px arriba, titulo y texto. El color del filo lo pone quien la usa, y
 * por `className` y no por una prop propia: `sin-colores-propios` lee `className` y `cn`, y un
 * `border-t-[#A6093D]` pasado como `filo="…"` seguia verde (medido).
 */
export function Tarjeta({
  titulo,
  texto,
  className,
  children,
}: {
  readonly titulo: string;
  readonly texto: string;
  readonly className: string;
  readonly children: ReactNode;
}) {
  const idDelTitulo = useId();
  return (
    <section
      aria-labelledby={idDelTitulo}
      className={cn('min-w-0 border border-t-[3px] border-linea bg-superficie px-[22px] pt-[22px] pb-6', className)}
    >
      <h2 id={idDelTitulo} className="m-0 text-[18px] font-bold">
        {titulo}
      </h2>
      <p className="mt-2 mb-[18px] text-[14.5px] leading-[1.6] text-pretty text-tinta-3">{texto}</p>
      {children}
    </section>
  );
}

/** El mensaje bajo el campo (lineas 326 y 347). */
export function MensajeDeError({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 mb-0 text-[13.5px] text-pretty text-mal-tinta">
      {children}
    </p>
  );
}

/** Lo que el campo lleva cuando esta mal: pintarse invalido y apuntar al mensaje. */
export const conError = (mal: boolean, idDelError: string) =>
  mal ? { 'aria-invalid': true, 'aria-describedby': idDelError } : {};

/** Se ve como los enlaces del artboard (`--azul`, subrayado al pasar) y es un boton: no lleva a ningun sitio. */
export function EnlaceDeDemostracion({ alPulsar, children }: { readonly alPulsar: () => void; readonly children: ReactNode }) {
  return (
    <Boton
      type="button"
      variante="fantasma"
      tamano="menudo"
      onClick={alPulsar}
      // 44 px de alto (issue 62): el artboard no les fija medida (linea 350) y con la del texto median 20.
      className="inline-flex min-h-[44px] p-0 align-baseline text-[13.5px] hover:bg-transparent hover:underline"
    >
      {children}
    </Boton>
  );
}
