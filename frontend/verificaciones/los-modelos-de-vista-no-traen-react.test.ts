// @vitest-environment node
//
// Lee archivos del disco y sigue sus `import`. No es un DOM lo que necesita.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';

/**
 * **Los modelos de vista de `src/pasos/*` no traen React** (issue 60, revision del PR #71).
 *
 * Cada paso partido en el issue 60 tiene un `vista.ts`: funciones puras del estado del recorrido y de
 * `t` que devuelven lo que la pantalla dibuja, y se prueban sin montar nada. Lo que las hace puras es
 * que no dependen de React; la primera vez que una pida un `useMemo` o un gancho de la fuente deja de
 * serlo, y su prueba empieza a necesitar un proveedor. Es la misma comprobacion que
 * `los-datos-no-cuentan-a-mano.test.ts` hace con `src/datos/cuentas.ts`, extendida a las vistas.
 *
 * <h2>Que se mira</h2>
 *
 * Lo que cada `vista.ts` importa **en tiempo de ejecucion**, y lo que eso importa, siguiendo los
 * `import` relativos por todo `src/`: un modelo de vista que importara un `.ts` que importa React
 * lo trae igual. Los `import type` no se siguen —se borran al compilar, no traen nada—, pero si uno
 * nombra React tambien se senala: una vista no tiene por que hablar de componentes. Un `.tsx`
 * alcanzado ya es un componente, y se senala solo por serlo.
 *
 * <h2>Lo que NO ve</h2>
 *
 * Un `require()` o un `import()` con la ruta en una variable; y los modelos de vista que no se
 * llamen `vista.ts` o vivan fuera de `src/pasos/<paso>/`.
 */

const PASOS = join(RAIZ, 'src/pasos');

/** Lo que trae React, o algo que lo arrastra. */
const DE_REACT = /^(react|react-dom|react-i18next|@tanstack\/react-query|@kamayuk\/ui|radix-ui)(\/|$)/;

interface Importado {
  readonly especificador: string;
  readonly soloTipos: boolean;
}

/** Lo que un archivo importa, distinguiendo los `import type`. Coge `from '…'`, `import '…'` e `import('…')`. */
function importadosPor(codigo: string): Importado[] {
  const salida: Importado[] = [];
  for (const [, tipo, desde] of codigo.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^'";]*?\bfrom\s+['"]([^'"]+)['"]/gm)) {
    salida.push({ especificador: desde ?? '', soloTipos: tipo !== undefined });
  }
  for (const [, suelto] of codigo.matchAll(/\bimport\s*\(?\s*['"]([^'"]+)['"]/g)) {
    salida.push({ especificador: suelto ?? '', soloTipos: false });
  }
  return salida;
}

/** Los modelos de vista: `src/pasos/<paso>/vista.ts`. */
function modelosDeVista(): string[] {
  return readdirSync(PASOS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(PASOS, e.name, 'vista.ts')))
    .map((e) => join(PASOS, e.name, 'vista.ts'));
}

/**
 * Lo que un archivo alcanza en ejecucion y trae React, con el camino por el que llega. Se siguen los
 * `import` relativos que no son solo de tipos; de los de tipos solo se mira el nombre.
 */
function loQueTraeReact(archivo: string, codigoDe: (ruta: string) => string): string[] {
  const hallazgos: string[] = [];
  const vistos = new Set<string>();
  const visitar = (ruta: string, camino: readonly string[]) => {
    if (vistos.has(ruta)) return;
    vistos.add(ruta);
    const aqui = [...camino, relative(RAIZ, ruta)];
    if (ruta.endsWith('.tsx')) hallazgos.push(`${aqui.join(' → ')} (es un componente)`);
    for (const { especificador, soloTipos } of importadosPor(codigoDe(ruta))) {
      if (DE_REACT.test(especificador)) hallazgos.push(`${aqui.join(' → ')} importa «${especificador}»`);
      else if (!soloTipos && especificador.startsWith('.')) visitar(resolve(dirname(ruta), especificador), aqui);
    }
  };
  visitar(archivo, []);
  return hallazgos;
}

const leer = (ruta: string) => readFileSync(ruta, 'utf8');
const VISTAS = modelosDeVista();

describe('los modelos de vista no traen React', () => {
  it('EL CENTINELA: estan los cinco de los pasos partidos, y el lector ve lo que importan', () => {
    expect(VISTAS.map((v) => relative(RAIZ, v)).sort()).toEqual([
      'src/pasos/comprobante/vista.ts',
      'src/pasos/deudas/vista.ts',
      'src/pasos/historial/vista.ts',
      'src/pasos/identificar/vista.ts',
      'src/pasos/pagar/vista.ts',
    ]);
    // Que el lector lee: sin esto, uno roto que no devolviera nada pasaria en verde.
    expect(importadosPor(leer(join(PASOS, 'deudas/vista.ts'))).map((i) => i.especificador)).toContain(
      '../../recorrido/recorrido.ts',
    );
    expect(importadosPor("import type { X } from 'react';\nimport { y } from './y.ts';\n")).toEqual([
      { especificador: 'react', soloTipos: true },
      { especificador: './y.ts', soloTipos: false },
    ]);
  });

  it('y el que sigue los import encuentra React aunque llegue por otro archivo', () => {
    const falsos: Record<string, string> = {
      [join(RAIZ, 'a/vista.ts')]: "import { b } from './b.ts';\nimport type { C } from './c.ts';\n",
      [join(RAIZ, 'a/b.ts')]: "import { useMemo } from 'react';\n",
      [join(RAIZ, 'a/c.ts')]: "import { useQuery } from '@tanstack/react-query';\n",
    };
    // `c.ts` solo se importa por sus tipos: no se sigue.
    expect(loQueTraeReact(join(RAIZ, 'a/vista.ts'), (ruta) => falsos[ruta] ?? '')).toEqual([
      'a/vista.ts → a/b.ts importa «react»',
    ]);
  });

  it.each(VISTAS.map((v) => [relative(RAIZ, v), v]))('%s', (_ruta, vista) => {
    expect(loQueTraeReact(vista, leer), 'Un modelo de vista tiene que poder probarse sin montar nada').toEqual([]);
  });
});
