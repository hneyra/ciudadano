// @vitest-environment node
//
// Lee el arbol con el analizador de TypeScript. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { archivoDeMuestra, archivosDelPortal } from './lecturas-del-modo.ts';
import { PERMITIDOS, despachosDeIrA, esPermitido } from './navegacion-libre.ts';

/**
 * **Ninguna pantalla decide el paso siguiente** (issue 61, tercer criterio).
 *
 * Lo que es «despachar `irA`», los sitios donde se permite y lo que la guarda no ve estan en
 * `navegacion-libre.ts`, que es quien juzga. Aqui se mira el codigo de produccion de `src/` entero:
 * `irA` solo lo despachan la franja y la URL, que es la navegacion libre; las pantallas y la barra
 * despachan acciones con nombre y el reductor decide a donde llevan.
 *
 * El 2026-09-27, sobre `main` (`59837745`), esta guarda contaba **13 despachos** fuera de esos dos
 * sitios, en **8 archivos**: la barra (4: la marca, «Iniciar sesión», «Mis pagos» y «Mis predios y
 * vehículos»), las acciones del comprobante (3: «Ver mis pagos», «Pagar otra deuda», «Crear mi
 * cuenta»), el efecto de la ruta en `src/enrutador.tsx` (1, que se mudo a `rutas.ts`), la barra de pago
 * (1), «No soy yo» (1), el resumen del pago (1), el pie del historial (1) y el pago reciente del
 * historial (1). La franja era la unica que ya era navegacion libre, y `rutas.ts` no despachaba
 * ninguno. Despues del issue 61, 0 fuera de los permitidos.
 *
 * La otra mitad —que `irA` no lleve a un paso no alcanzable aunque alguien lo despache— la mide el
 * reductor: `src/recorrido/recorrido.progreso.test.ts`.
 */

const MUESTRA = 'verificaciones/navegacion-libre/muestra.ts';

const archivos = archivosDelPortal();
const delPortal = archivos.flatMap(({ ruta, archivo }) => despachosDeIrA(ruta, archivo));
const deLaMuestra = despachosDeIrA(MUESTRA, archivoDeMuestra(MUESTRA).archivo);

/** Las lineas de la muestra marcadas con `// senala`: las que la guarda tiene que encontrar. */
function lineasMarcadas(): number[] {
  const fuente = readFileSync(archivoDeMuestra(MUESTRA).archivo, 'utf8');
  return fuente.split('\n').flatMap((linea, i) => (/\/\/ senala\b/.test(linea) ? [i + 1] : []));
}

describe('ninguna pantalla decide el paso siguiente', () => {
  it('mira el codigo de produccion de src/, sin pruebas ni su andamiaje, con los sitios permitidos', () => {
    const rutas = archivos.map((a) => a.ruta);
    expect(rutas).toContain('src/pasos/pagar/Resumen.tsx');
    expect(rutas).toContain('src/marco/Barra.tsx');
    for (const permitido of Object.keys(PERMITIDOS)) expect(rutas).toContain(permitido);
    expect(rutas.filter((r) => r.startsWith('src/pruebas/') || /\.test\.tsx?$/.test(r))).toEqual([]);
  });

  it('fuera de la franja y de la URL, nadie despacha `irA`', () => {
    const fuera = delPortal.filter((s) => !esPermitido(s.ruta)).map((s) => `  ${s.ruta}:${String(s.linea)}`);
    expect(
      fuera,
      `Hay ${String(fuera.length)} despachos de \`irA\` fuera de la navegacion libre:\n${fuera.join('\n')}\n\n` +
        '  Una pantalla no decide a que paso se va: despacha la accion con nombre de lo que la persona\n' +
        '  hizo (`confirmarEleccion`, `volverAElegir`, `irAlInicio`…) y el reductor decide el destino.\n' +
        '  Si hace falta una transicion nueva, es un caso nuevo de `AccionDelRecorrido`.',
    ).toEqual([]);
  });

  it('y los permitidos la usan de verdad: una excepcion que nadie necesita se quita', () => {
    const usados = new Set(delPortal.filter((s) => esPermitido(s.ruta)).map((s) => s.ruta));
    expect([...usados].sort()).toEqual(Object.keys(PERMITIDOS).sort());
  });

  it('y la guarda ve cada forma de la muestra, y ninguna de las que solo se le parecen', () => {
    expect(deLaMuestra.map((s) => s.linea)).toEqual(lineasMarcadas());
  });
});
