import { cn } from '@kamayuk/ui';
import type { ReactNode } from 'react';

/**
 * **La muestra que viola `sin-colores-propios`**: cada violacion lleva la marca en la linea de encima.
 *
 * No vive en `src/` —la guarda la haria roja de verdad— sino aqui, y la prueba la juzga como si
 * viviera alli. Compila y pasa el lint a proposito: ninguna de las dos cosas lo impide, y por eso
 * hace falta la guarda.
 *
 * Las cinco de abajo del todo (issue 23) son las formas en que un color llega a una clase SIN pasar a
 * la vista por `className`, `style` ni `cn()`: hasta ese issue la guarda no las veia.
 */
// VIOLA: el hex dentro de un `cn()` que no cuelga de ningun `className` —una constante de clases—.
export const CLASES_DE_AVISO = cn('border', 'border-[#ebccd1]');

// VIOLA: una constante que luego es clase, y el `cn()` que la usa esta en otra linea.
const FILO = 'border-t-[#a6093d]';

// VIOLA: un objeto de tonos, en `rgb()`.
const TONOS = { mal: 'bg-[rgb(169,68,66)]' } as const;

function Tarjeta({ filo, children }: { readonly filo: string; readonly children?: ReactNode }) {
  return <section className={cn('border-t-4', FILO, TONOS.mal, filo)}>{children}</section>;
}

function Icono({ tono }: { readonly tono: string }) {
  return <svg aria-hidden="true" style={{ color: tono }} />;
}

export function MuestraConColoresPropios({ activa, algo }: { readonly activa: boolean; readonly algo: string }) {
  // VIOLA: una plantilla con interpolacion, guardada antes de llegar al `className`.
  const encabezado = `text-[#333] ${algo}`;
  return (
    // VIOLA: un hex arbitrario de Tailwind en `className`.
    <div className="bg-[#0D5FA8] p-4">
      {/* VIOLA: un `rgb()` en `style`. */}
      <p style={{ color: 'rgb(51, 51, 51)' }}>a</p>
      {/* VIOLA: una declaracion de `--color-*` en `style`. */}
      <p style={{ ['--color-azul' as string]: 'var(--color-mal-tinta)' }}>b</p>
      {/* VIOLA: el hex escondido en un `cn()`, que es como llega de verdad. */}
      <p className={cn('text-[13px]', activa ? 'text-[#a94442]' : 'text-tinta')}>c</p>
      <h2 className={encabezado}>d</h2>
      {/* VIOLA: el color por una prop que no se llama `className` (lo que dejo pasar el issue 7). */}
      <Tarjeta filo="border-t-[#A6093D]" />
      {/* VIOLA: el color en llaves, en una prop cualquiera. */}
      <Icono tono={'#0D5FA8'} />
    </div>
  );
}
