import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { crearClienteDeConsultas } from './consultas.ts';

/**
 * **La politica del cliente de consultas, escrita y UNA** (issue 50).
 *
 * Que la politica diga lo que dice la mide su efecto en `LaConsulta.unaVerdad.test.tsx` (el foco no
 * vuelve a pedir, un error repetido no borra la lista). Aqui se mide lo que aquella prueba no puede
 * ver: que el portal de verdad (`main.tsx`) y el de las pruebas (`montarElPortal`) usan **el mismo**
 * cliente. Si `main.tsx` volviera a `new QueryClient()`, todas las pruebas seguirian en verde —montan
 * el suyo— y el portal servido volveria a pedir la situacion con cada cambio de pestana.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Los archivos de `src/` que no son pruebas, con su texto. */
function codigoDeSrc(): readonly { readonly ruta: string; readonly texto: string }[] {
  const archivos: { ruta: string; texto: string }[] = [];
  const recorrer = (carpeta: string) => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = join(carpeta, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
        archivos.push({ ruta: relative(SRC, ruta), texto: readFileSync(ruta, 'utf8') });
      }
    }
  };
  recorrer(SRC);
  return archivos;
}

describe('el cliente de consultas del portal', () => {
  it('lo leido no caduca ni se tira solo, y ni el foco, ni la red, ni un fallo lo vuelven a pedir', () => {
    expect(crearClienteDeConsultas().getDefaultOptions().queries).toEqual({
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    });
  });

  it('es el mismo en el portal servido y en las pruebas, y nadie mas crea otro', () => {
    const codigo = codigoDeSrc();
    const quienCrea = codigo.filter(({ texto }) => /new QueryClient\s*\(/.test(texto)).map(({ ruta }) => ruta);
    expect(quienCrea, 'Un `new QueryClient` fuera de `datos/consultas.ts` es otra politica').toEqual([
      'datos/consultas.ts',
    ]);

    const quienUsa = codigo
      .filter(({ texto }) => /=\s*crearClienteDeConsultas\(\)/.test(texto))
      .map(({ ruta }) => ruta)
      .sort();
    expect(quienUsa).toEqual(['main.tsx', 'pruebas/portal.tsx']);
  });
});
