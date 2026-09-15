// @vitest-environment node
//
// Compila la hoja del portal y lee el CSS emitido. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { type Regla, clasesDe, compilar, fuentesDe, paletaDeLaIdentidad, paletaDelTema, reglasDe, resolver } from './tailwind.ts';

/**
 * **Lo marcado `data-noprint` no sale en el papel, y el recibo sale limpio** (issue 9; artboard,
 * lineas 45-49).
 *
 * El comprobante se imprime SOLO: sin barra, franja, pie, avisos, banda de exito, acciones ni
 * invitacion. Que esas piezas lleven `data-noprint` —y que fuera de ellas no quede nada mas que el
 * recibo— lo mide `src/pasos/comprobante/Comprobante.test.tsx` sobre la pagina montada. Lo que se mide
 * aqui es la otra mitad, la que jsdom no puede ver porque no evalua `@media print`: que el CSS que Vite
 * empaqueta **de verdad las oculta al imprimir**.
 *
 * <h2>Lo que puede romperlo sin que ninguna prueba del DOM lo note</h2>
 *
 *   · Que la regla desaparezca o cambie de selector (`[data-no-print]`): las piezas siguen marcadas
 *     y la barra sale en el papel.
 *   · **Que pierda el `!important`.** La regla vive en `@layer base`, y las utilidades —`flex`, `grid`,
 *     que la barra y las acciones llevan— en `@layer utilities`, que va DESPUES: sin `!important`, la
 *     utilidad gana y `display: none` no se aplica. Con `!important` es al reves: una declaracion
 *     importante de una capa anterior gana a todas las de las posteriores.
 *   · Que alguna regla de impresion vuelva a mostrar lo marcado.
 *   · Que el recibo conserve su filo y su sombra, o que el lienzo no sea el blanco de la identidad.
 *
 * El arnes de navegador del issue 11 lo mide pintando; las capturas del PR del issue 9, con
 * `page.emulateMedia({ media: 'print' })`.
 */

const FUENTES = fuentesDe(join(RAIZ, 'src'));
const CLASES = [...new Set(FUENTES.flatMap((f) => clasesDe(readFileSync(f, 'utf8'))))].sort();

/** Las reglas que se aplican al imprimir: dentro de `@media print`, en la capa que sea. */
const deImpresion = (reglas: readonly Regla[]): Regla[] =>
  reglas.filter((regla) => regla.dentroDe.some((preludio) => preludio.replace(/\s+/g, ' ').trim() === '@media print'));

const esImportante = (valor: string | undefined): boolean => /!important\s*$/.test(valor ?? '');
const sinImportante = (valor: string | undefined): string => (valor ?? '').replace(/\s*!important\s*$/, '').trim();

/**
 * Lo que falla, una linea por hallazgo. Pura sobre las reglas emitidas: la prueba la llama con el CSS de
 * la hoja y con copias retocadas, y en las segundas exige el rojo.
 */
function loQueSaleEnElPapel(reglas: readonly Regla[], paleta: ReadonlyMap<string, string>): string[] {
  const salida: string[] = [];
  const impresion = deImpresion(reglas);

  // 1. `[data-noprint] { display: none !important }`, al imprimir.
  const oculta = impresion.filter(
    (regla) =>
      regla.selectores.includes('[data-noprint]') &&
      sinImportante(regla.declaraciones.get('display')) === 'none' &&
      esImportante(regla.declaraciones.get('display')),
  );
  if (oculta.length === 0) {
    const casi = impresion.find((regla) => regla.selectores.includes('[data-noprint]'));
    salida.push(
      casi === undefined
        ? '  No hay regla `@media print { [data-noprint] { display: none !important } }`: lo marcado se imprime'
        : `  \`[data-noprint]\` al imprimir declara \`display: ${casi.declaraciones.get('display') ?? '(nada)'}\`, y hace ` +
            'falta `none !important`: sin el `!important`, `flex` o `grid` de `@layer utilities` le ganan',
    );
  }

  // 2. Ninguna otra regla de impresion vuelve a mostrar lo marcado.
  for (const regla of impresion) {
    const display = sinImportante(regla.declaraciones.get('display'));
    if (display === '' || display === 'none') continue;
    const muestra = regla.selectores.filter((s) => s.includes('data-noprint'));
    if (muestra.length > 0) salida.push(`  ${muestra.join(', ')} vuelve a mostrarse al imprimir (\`display: ${display}\`)`);
  }

  // 3. El recibo, sin filo ni sombra.
  const recibo = impresion.filter((regla) => regla.selectores.includes('[data-recibo]'));
  const declara = (propiedad: string, valores: readonly string[]) =>
    recibo.some(
      (regla) => valores.includes(sinImportante(regla.declaraciones.get(propiedad))) && esImportante(regla.declaraciones.get(propiedad)),
    );
  if (!declara('border', ['0', 'none', '0 none'])) {
    salida.push('  El recibo conserva su filo al imprimir: falta `[data-recibo] { border: 0 !important }`');
  }
  if (!declara('box-shadow', ['none'])) {
    salida.push('  El recibo conserva su sombra al imprimir: falta `[data-recibo] { box-shadow: none !important }`');
  }

  // 4. El lienzo, el blanco de la identidad y por token.
  const lienzo = impresion.find((regla) => regla.selectores.includes('body'))?.declaraciones.get('background-color');
  if (lienzo === undefined) {
    salida.push('  Al imprimir el lienzo sigue siendo `--color-fondo`: falta `body { background-color }` en `@media print`');
  } else if (!/^var\(--color-[\w-]+\)$/.test(lienzo.trim())) {
    salida.push(`  El lienzo de impresion no es un token: \`${lienzo}\``);
  } else if (resolver(lienzo, paleta) !== '#ffffff') {
    salida.push(`  El lienzo de impresion es \`${lienzo}\`, que en \`clasico\` vale «${resolver(lienzo, paleta)}» y no blanco`);
  }

  return salida;
}

describe('al imprimir, solo el recibo', () => {
  let reglas: Regla[] = [];
  let paleta = new Map<string, string>();

  beforeAll(async () => {
    reglas = reglasDe(await compilar(CLASES));
    paleta = new Map([...paletaDelTema(reglas), ...paletaDeLaIdentidad(reglas, 'clasico')]);
  });

  it('EL CENTINELA: la hoja compila, trae reglas de impresion y la guarda muerde sobre copias retocadas', () => {
    expect(CLASES.length, 'no se extrajo ni una clase de `src/`').toBeGreaterThan(0);
    expect(deImpresion(reglas).length, 'el CSS emitido no trae ni una regla `@media print`').toBeGreaterThan(0);

    const retocar = (cambio: (regla: Regla) => Regla | null): Regla[] =>
      reglas.flatMap((regla) => {
        if (!deImpresion([regla]).length) return [regla];
        const otra = cambio(regla);
        return otra === null ? [] : [otra];
      });
    const conDeclaraciones = (regla: Regla, cambios: Readonly<Record<string, string | null>>): Regla => {
      const declaraciones = new Map(regla.declaraciones);
      for (const [propiedad, valor] of Object.entries(cambios)) {
        if (valor === null) declaraciones.delete(propiedad);
        else declaraciones.set(propiedad, valor);
      }
      return { ...regla, declaraciones };
    };
    const esLa = (regla: Regla, selector: string) => regla.selectores.includes(selector);

    // Sin la regla, sin su `!important`, con otro selector, con el recibo intacto y con el lienzo en gris.
    const casos: readonly [string, Regla[], RegExp][] = [
      ['sin la regla', retocar((r) => (esLa(r, '[data-noprint]') ? null : r)), /No hay regla/],
      [
        'sin `!important`',
        retocar((r) => (esLa(r, '[data-noprint]') ? conDeclaraciones(r, { display: 'none' }) : r)),
        /hace falta `none !important`/,
      ],
      [
        'con otro selector',
        retocar((r) => (esLa(r, '[data-noprint]') ? { ...r, selectores: ['[data-no-print]'] } : r)),
        /No hay regla/,
      ],
      [
        'otra regla que la muestra',
        [...reglas, { selectores: ['header[data-noprint]'], declaraciones: new Map([['display', 'flex !important']]), dentroDe: ['@media print'] }],
        /vuelve a mostrarse/,
      ],
      [
        'el recibo con su filo y su sombra',
        retocar((r) => (esLa(r, '[data-recibo]') ? conDeclaraciones(r, { border: null, 'box-shadow': null }) : r)),
        /conserva su filo[\s\S]*conserva su sombra/,
      ],
      [
        'el lienzo en `--color-fondo`',
        retocar((r) => (esLa(r, 'body') ? conDeclaraciones(r, { 'background-color': 'var(--color-fondo)' }) : r)),
        /vale «#f4f6f8» y no blanco/,
      ],
    ];
    for (const [nombre, retocadas, rojo] of casos) {
      expect(loQueSaleEnElPapel(retocadas, paleta).join('\n'), nombre).toMatch(rojo);
    }
  });

  it('la hoja del portal oculta lo marcado, deja el recibo sin filo ni sombra y el lienzo en blanco', () => {
    const rojo = loQueSaleEnElPapel(reglas, paleta);
    expect(
      rojo,
      'Al imprimir el comprobante saldria algo mas que el recibo:\n' +
        `${rojo.join('\n')}\n\n` +
        '  La regla vive en `src/estilos.css`, al final de `@layer base` (artboard, lineas 45-49).',
    ).toEqual([]);
  });

  it('y el contenedor del marco tambien pasa a blanco: `print:bg-superficie` genera su regla de impresion', () => {
    const regla = deImpresion(reglas).find((r) => r.selectores.some((s) => s.replace(/\\/g, '') === '.print:bg-superficie'));
    expect(regla, 'Tailwind no emite `.print:bg-superficie` dentro de `@media print`').toBeDefined();
    expect(resolver(regla?.declaraciones.get('background-color') ?? '', paleta)).toBe('#ffffff');
    expect(readFileSync(join(RAIZ, 'src/marco/Marco.tsx'), 'utf8')).toMatch(/className="[^"]*\bbg-fondo\b[^"]*\bprint:bg-superficie\b/);
  });
});
