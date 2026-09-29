// @vitest-environment node
//
// Lee archivos del disco y sigue sus `import`. No es un DOM lo que necesita.

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { alcanzados, importacionesDe, importacionesDelCodigo, seCarga } from './grafo-de-imports.ts';

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
 * Lo que cada `vista.ts` importa **en tiempo de ejecucion**, y lo que eso importa, por el grafo de
 * `import` del compilador (`grafo-de-imports.ts`, issue 63; hasta entonces, una expresion regular que
 * no veia un `require` y resolvia las rutas a mano): un modelo de vista que importara un `.ts` que
 * importa React lo trae igual. Los `import type` no se siguen —se borran al compilar, no traen nada—,
 * pero si uno nombra React tambien se senala: una vista no tiene por que hablar de componentes. Un
 * `.tsx` alcanzado ya es un componente, y se senala solo por serlo.
 *
 * <h2>Lo que NO ve</h2>
 *
 * Un `require()` o un `import()` con la ruta en una variable; y los modelos de vista que no se
 * llamen `vista.ts` o vivan fuera de `src/pasos/<paso>/`.
 */

const PASOS = join(RAIZ, 'src/pasos');

/** Lo que trae React, o algo que lo arrastra. */
const DE_REACT = /^(react|react-dom|react-i18next|@tanstack\/react-query|@kamayuk\/ui|radix-ui)(\/|$)/;

/** Los modelos de vista: `src/pasos/<paso>/vista.ts`. */
function modelosDeVista(): string[] {
  return readdirSync(PASOS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(PASOS, e.name, 'vista.ts')))
    .map((e) => join(PASOS, e.name, 'vista.ts'));
}

/**
 * Lo que un archivo alcanza en ejecucion y trae React, con el camino por el que llega. Se siguen las
 * importaciones que no son solo de tipos, a cualquier archivo del arbol; de las de tipos solo se mira
 * el paquete.
 */
function loQueTraeReact(archivo: string): string[] {
  const hallazgos: string[] = [];
  for (const [ruta, camino] of alcanzados([archivo], seCarga)) {
    const aqui = camino.join(' → ');
    if (ruta.endsWith('.tsx')) hallazgos.push(`${aqui} (es un componente)`);
    if (!/\.(tsx?|m?js)$/.test(ruta)) continue;
    for (const { paquete, especificador } of importacionesDe(ruta)) {
      if (paquete !== null && DE_REACT.test(paquete)) hallazgos.push(`${aqui} importa «${especificador}»`);
    }
  }
  return hallazgos;
}

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
    expect(importacionesDe('src/pasos/deudas/vista.ts').map((i) => i.archivo)).toContain('src/recorrido/recorrido.ts');
    const leidas = importacionesDelCodigo(
      "import type { X } from 'react';\nimport { y } from \"../../recorrido/recorrido.ts\";\nconst z = require('react-dom');\n",
      'src/pasos/deudas/sintetico.ts',
    );
    expect(leidas.map(({ paquete, archivo, soloTipos, forma }) => ({ paquete, archivo, soloTipos, forma }))).toEqual([
      { paquete: 'react', archivo: null, soloTipos: true, forma: 'estatica' },
      { paquete: null, archivo: 'src/recorrido/recorrido.ts', soloTipos: false, forma: 'estatica' },
      { paquete: 'react-dom', archivo: null, soloTipos: false, forma: 'require' },
    ]);
  });

  it('y el que sigue los import encuentra React aunque llegue por otro archivo', () => {
    // `useModo.ts` no importa React: lo trae el proveedor del recorrido, que si. El camino se dice entero.
    expect(loQueTraeReact('src/modo/useModo.ts')).toEqual(
      expect.arrayContaining([
        'src/modo/useModo.ts → src/recorrido/ProveedorDelRecorrido.tsx (es un componente)',
        "src/modo/useModo.ts → src/recorrido/ProveedorDelRecorrido.tsx importa «react»",
      ]),
    );
    expect(importacionesDe('src/modo/useModo.ts').map((i) => i.paquete)).not.toContain('react');
  });

  it.each(VISTAS.map((v) => [relative(RAIZ, v), v]))('%s', (_ruta, vista) => {
    expect(loQueTraeReact(vista), 'Un modelo de vista tiene que poder probarse sin montar nada').toEqual([]);
  });
});
