import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { LO_QUE_SE_MUTA } from '../mutaciones.mjs';
import { RAIZ } from './artboards.ts';
import { importacionesDe, seCarga } from './grafo-de-imports.ts';

/**
 * **Las pruebas con que Stryker mata los mutantes** (issue 63): las que importan alguno de
 * `LO_QUE_SE_MUTA`, segun el grafo de `import` del compilador.
 *
 * Sin las que montan el portal (`.test.tsx`): cada mutante vuelve a correr las pruebas que lo cubren, y
 * un caso del portal cuesta segundos donde uno de unidad cuesta milisegundos. Lo que de estos modulos
 * solo mide el portal entero queda sin matar, y la puntuacion lo dice.
 *
 * De primera mano, y no por otro modulo: las que solo lo alcanzan de paso —las guardas que importan
 * `vite.config.ts`, que importa `trozos.ts`— no miden lo mutado, y en el directorio de trabajo de
 * Stryker, dos niveles mas abajo, sus rutas hacia `kamayuk-lib` no llevan a ninguna parte (medido:
 * `tailwind-esta-conectado.test.ts` sale rojo en la corrida inicial y Stryker no arranca).
 */
export function pruebasDeLoMutado(): readonly string[] {
  const mutados = new Set<string>(LO_QUE_SE_MUTA);
  return ['src', 'verificaciones']
    .flatMap((directorio) =>
      readdirSync(join(RAIZ, directorio), { recursive: true, encoding: 'utf8' }).map((ruta) => join(directorio, ruta)),
    )
    .filter((ruta) => ruta.endsWith('.test.ts') && !ruta.startsWith('verificaciones/muestras/'))
    .filter((ruta) => importacionesDe(ruta).some((i) => seCarga(i) && i.archivo !== null && mutados.has(i.archivo)))
    .sort();
}
