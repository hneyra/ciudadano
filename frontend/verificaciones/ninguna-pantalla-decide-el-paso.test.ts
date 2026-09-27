// @vitest-environment node
//
// Lee el arbol con el analizador de TypeScript. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { archivoDeMuestra, archivosDelPortal } from './lecturas-del-modo.ts';
import { PERMITIDOS, esPermitido, navegaciones } from './navegacion-libre.ts';

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

const MUESTRA = 'verificaciones/navegacion-libre/muestra.tsx';

const archivos = archivosDelPortal();
const delPortal = archivos.flatMap(({ ruta, archivo }) => navegaciones(ruta, archivo));
const deLaMuestra = navegaciones(MUESTRA, archivoDeMuestra(MUESTRA).archivo);

/** Las lineas de la muestra marcadas con `senala` (tras `//`, o en un comentario de JSX): las que la guarda tiene que encontrar. */
function lineasMarcadas(): number[] {
  const fuente = readFileSync(archivoDeMuestra(MUESTRA).archivo, 'utf8');
  return fuente.split('\n').flatMap((linea, i) => (/(\/\/|\/\*) senala\b/.test(linea) ? [i + 1] : []));
}

describe('ninguna pantalla decide el paso siguiente', () => {
  it('mira el codigo de produccion de src/, sin pruebas ni su andamiaje, con los sitios permitidos', () => {
    const rutas = archivos.map((a) => a.ruta);
    expect(rutas).toContain('src/pasos/pagar/Resumen.tsx');
    expect(rutas).toContain('src/marco/Barra.tsx');
    for (const permitido of Object.keys(PERMITIDOS)) expect(rutas).toContain(permitido);
    expect(rutas.filter((r) => r.startsWith('src/pruebas/') || /\.test\.tsx?$/.test(r))).toEqual([]);
  });

  it('fuera de la franja y de la URL, nadie despacha `irA` ni navega', () => {
    const fuera = delPortal.filter((s) => !esPermitido(s)).map((s) => `  ${s.ruta}:${String(s.linea)} ${s.forma}`);
    expect(
      fuera,
      `Hay ${String(fuera.length)} sitios que mueven el recorrido de paso por su cuenta:\n${fuera.join('\n')}\n\n` +
        '  Una pantalla no decide a que paso se va —ni con `irA`, ni navegando, ni con un enlace a la\n' +
        '  ruta de un paso—: despacha la accion con nombre de lo que la persona hizo (`confirmarEleccion`,\n' +
        '  `volverAElegir`, `noSoyYo`…) y el reductor decide el destino. Si hace falta una transicion\n' +
        '  nueva, es un caso nuevo de `AccionDelRecorrido`.',
    ).toEqual([]);
  });

  it('y los permitidos usan cada forma que se les permite: una excepcion que nadie necesita se quita', () => {
    const usadas = new Set(delPortal.filter(esPermitido).map((s) => `${s.ruta} ${s.forma}`));
    const permitidas = Object.entries(PERMITIDOS).flatMap(([ruta, formas]) => formas.map((forma) => `${ruta} ${forma}`));
    expect([...usadas].sort()).toEqual(permitidas.sort());
  });

  it('y la guarda ve cada forma de la muestra, y ninguna de las que solo se le parecen', () => {
    expect([...new Set(deLaMuestra.map((s) => s.linea))]).toEqual(lineasMarcadas());
  });
});
