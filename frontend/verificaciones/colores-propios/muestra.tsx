import { cn } from '@kamayuk/ui';

/**
 * **La muestra que viola `sin-colores-propios`**: cada violacion lleva la marca en la linea de encima.
 *
 * No vive en `src/` —la guarda la haria roja de verdad— sino aqui, y la prueba la juzga como si
 * viviera alli. Compila y pasa el lint a proposito: ninguna de las dos cosas lo impide, y por eso
 * hace falta la guarda.
 */
// VIOLA: el hex dentro de un `cn()` que no cuelga de ningun `className` —una constante de clases—.
export const CLASES_DE_AVISO = cn('border', 'border-[#ebccd1]');

export function MuestraConColoresPropios({ activa }: { readonly activa: boolean }) {
  return (
    // VIOLA: un hex arbitrario de Tailwind en `className`.
    <div className="bg-[#0D5FA8] p-4">
      {/* VIOLA: un `rgb()` en `style`. */}
      <p style={{ color: 'rgb(51, 51, 51)' }}>a</p>
      {/* VIOLA: una declaracion de `--color-*` en `style`. */}
      <p style={{ ['--color-azul' as string]: 'var(--color-mal-tinta)' }}>b</p>
      {/* VIOLA: el hex escondido en un `cn()`, que es como llega de verdad. */}
      <p className={cn('text-[13px]', activa ? 'text-[#a94442]' : 'text-tinta')}>c</p>
    </div>
  );
}
