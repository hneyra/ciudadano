import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getByRole, getByText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RAIZ } from '../verificaciones/artboards.ts';
import { AVISO_SIN_PORTAL, cargarElPortal } from './inicio.ts';

/**
 * **La entrada nunca deja la pagina en blanco** (issue 56).
 *
 * `main.tsx` pide el portal con `cargarElPortal(raiz, () => import('./montaje.tsx'))`. Lo que se
 * mide aqui es esa funcion con un `import()` que rechaza —el trozo que no llega— y con un montaje
 * que rechaza —el arranque que revienta—: en los dos, `#raiz` tiene que acabar con algo que leer.
 */

let raiz: HTMLElement;

beforeEach(() => {
  raiz = document.createElement('div');
  raiz.id = 'raiz';
  document.body.append(raiz);
});

afterEach(() => {
  raiz.remove();
});

describe('AC1 — si el portal no llega, se dice', () => {
  it('con el `import()` rechazado, se ve un aviso y no una pagina vacia', async () => {
    await cargarElPortal(raiz, () =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module: /portal/assets/montaje-abc.js')),
    );

    const aviso = getByRole(raiz, 'alert');
    expect(getByText(aviso, AVISO_SIN_PORTAL.titulo)).toBeInTheDocument();
    expect(getByText(aviso, AVISO_SIN_PORTAL.remedio)).toBeInTheDocument();
    // Lo que dijo el navegador, para quien tenga que arreglarlo: es lo que se busca en su consola.
    expect(getByText(aviso, /Failed to fetch dynamically imported module/)).toBeInTheDocument();
  });

  it('con el montaje rechazado —el arranque que revienta—, tambien', async () => {
    await cargarElPortal(raiz, () =>
      Promise.resolve({ montar: () => Promise.reject(new Error('el arranque revento')) }),
    );

    expect(getByRole(raiz, 'alert')).toHaveTextContent(AVISO_SIN_PORTAL.titulo);
  });

  it('y si el portal se monta, el aviso no aparece', async () => {
    await cargarElPortal(raiz, () =>
      Promise.resolve({
        montar: (donde: HTMLElement) => {
          donde.textContent = 'el portal';
          return Promise.resolve();
        },
      }),
    );

    expect(raiz).toHaveTextContent('el portal');
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('el aviso no depende de nada de lo que puede no haber llegado', () => {
  const FUENTE = readFileSync(join(RAIZ, 'src/inicio.ts'), 'utf8');

  it('`src/inicio.ts` no importa NADA: ni React, ni i18next, ni la libreria', () => {
    // Si el trozo que no llego es el de React o el de i18next, un aviso que los importe tampoco sale:
    // la pagina en blanco otra vez, y justo en el caso que este archivo existe para cubrir.
    // Sin los comentarios, que hablan del `import()` de `main.tsx` para explicarlo.
    const codigo = FUENTE.split('\n').filter((linea) => !/^\s*(\*|\/\/|\/\*)/.test(linea));
    const importaciones = codigo.filter((linea) => /^\s*import\b|\bimport\(|\brequire\(/.test(linea));
    expect(importaciones).toEqual([]);
  });

  it('`main.tsx` pide el portal con `import()` y por `cargarElPortal`, y no importa estatico nada mas', () => {
    const entrada = readFileSync(join(RAIZ, 'src/main.tsx'), 'utf8');
    expect(entrada).toMatch(/cargarElPortal\(raiz, \(\) => import\('\.\/montaje\.tsx'\)\)/);
    // Cualquier otro `import` estatico —el portal, React, i18next— viaja en la entrada, y si su
    // carga falla no queda nadie que lo diga. Solo la hoja (sin la cual el aviso sale sin clases) y
    // `inicio.ts`, que no importa nada.
    const estaticas = [...entrada.matchAll(/^\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(estaticas).toEqual(['./estilos.css', './inicio.ts']);
  });
});
