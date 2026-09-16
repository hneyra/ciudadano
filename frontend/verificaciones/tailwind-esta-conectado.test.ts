// @vitest-environment node
//
// En `node` y no en jsdom: importar `vite.config.ts` de verdad —en vez de leerlo como texto, que
// permitiria que la configuracion dijera una cosa y la prueba comprobara otra— arrastra a
// esbuild, que bajo jsdom muere con «Invariant violation: new TextEncoder().encode("")
// instanceof Uint8Array is incorrectly false».
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import configuracion from '../vite.config.ts';
import { RAIZ_DE_UI, fuentesDe, fuentesDeclaradas } from './tailwind.ts';

/**
 * **Tailwind esta conectado a este frontend** (rentas#90). Portada de `rentas`.
 *
 * Con el complemento fuera, todo sigue compilando y todas las pruebas siguen pasando —comparan
 * `className` como texto—, y la aplicacion sale **sin un solo estilo**. Es el fallo mas silencioso
 * que puede tener una interfaz: el HTML es correcto, la consola esta limpia, y la pantalla es una
 * columna de texto negro sobre blanco.
 *
 * <h2>Por que se mira la configuracion y no el CSS emitido</h2>
 *
 * Porque emitirlo exige un `vite build` entero en cada corrida de la suite, y lo que se quiere
 * saber aqui cabe en una linea: que el complemento esta puesto. Que lo que emite es correcto es lo
 * que mediran las guardas del tema, que compilan de verdad.
 *
 * <h2>Lo que esta anade a la de `rentas`: el `@source`</h2>
 *
 * El comentario de `rentas/frontend/src/estilos.css` dice que esta guarda «comprueba que los
 * `@source` sigan apuntando a algo», y la de `rentas` no lo hace. Aqui si: sin `@source`, Tailwind
 * **omite `node_modules`**, que es donde el `link:` deja `@kamayuk/ui`, y en `rentas` eso costo
 * 157 reglas en vez de 419 con la pantalla dibujandose igual (rentas#107). Un `@source` que apunta
 * a un directorio que no existe tampoco da error: Tailwind no mira nada y sigue.
 */

/** Los nombres de los complementos, sea cual sea la profundidad a la que Vite los anide. */
function aplanar(valor: unknown): { name?: string }[] {
  if (Array.isArray(valor)) return valor.flatMap((x: unknown) => aplanar(x));
  if (valor === null || valor === undefined) return [];
  return [valor as { name?: string }];
}

describe('Tailwind esta conectado a este frontend', () => {
  // Aplanado a mano y no con `flat(Infinity)`: el tipo de `plugins` de Vite es recursivo y con
  // `Infinity` el compilador se rinde —`TS2589: Type instantiation is excessively deep and
  // possibly infinite`—. Aqui solo interesan los nombres.
  const complementos = aplanar(configuracion.plugins ?? []);

  it('EL CENTINELA: la configuracion trae complementos', () => {
    // Sin esto, un `plugins` que dejara de existir —o un cambio de forma en la configuracion—
    // dejaria la lista vacia y la comprobacion de abajo fallando por el motivo equivocado, o
    // pasando si alguien la invirtiera.
    expect(complementos.length, 'vite.config.ts no declaro ni un complemento').toBeGreaterThan(1);
  });

  it('el complemento de Tailwind esta puesto', () => {
    const nombres = complementos.map((c) => c?.name ?? '').filter((n) => n !== '');
    expect(
      nombres.some((n) => n.includes('tailwind')),
      'Sin el complemento, las clases de `@kamayuk/ui` y de este portal no producen CSS: la\n' +
        'aplicacion sale sin un solo estilo y NADA se pone rojo — las pruebas comparan\n' +
        `\`className\` como texto. Complementos declarados: ${nombres.join(', ')}`,
    ).toBe(true);
  });

  it('y va ANTES que el de React', () => {
    // No es indiferente: el de Tailwind tiene que ver los archivos para saber que clases se usan.
    const nombres = complementos.map((c) => c?.name ?? '');
    const tailwind = nombres.findIndex((n) => n.includes('tailwind'));
    const react = nombres.findIndex((n) => n.includes('react'));
    expect(tailwind, 'no esta el de Tailwind').toBeGreaterThanOrEqual(0);
    expect(react, 'no esta el de React').toBeGreaterThanOrEqual(0);
    expect(tailwind).toBeLessThan(react);
  });
});

describe('y el `@source` de la hoja alcanza a `@kamayuk/ui`', () => {
  const AQUI = dirname(fileURLToPath(import.meta.url));
  const HOJA = join(AQUI, '..', 'src', 'estilos.css');
  const declaradas = fuentesDeclaradas(readFileSync(HOJA, 'utf8'));

  it('EL CENTINELA: la hoja declara algun `@source`, y el extractor ignora los comentarios', () => {
    expect(declaradas, 'src/estilos.css no declara ningun `@source`').not.toEqual([]);
    expect(
      fuentesDeclaradas('/* @source "../mentira"; */\n@source "../de-verdad";'),
    ).toEqual(['../de-verdad']);
  });

  it('uno de ellos es, en el disco, el mismo directorio al que resuelve `@kamayuk/ui`', () => {
    // Se compara la ruta REAL de los dos lados: el `link:` es un symlink y el `@source` apunta al
    // clon hermano por ruta relativa. Si alguien mueve la hoja de directorio, la ruta relativa deja
    // de caer en el clon y esto sale rojo, en vez de salir un CSS con la mitad de las reglas.
    const realDeUi = realpathSync(RAIZ_DE_UI);
    const alcanzadas = declaradas
      .map((ruta) => resolve(dirname(HOJA), ruta))
      .map((ruta) => (existsSync(ruta) ? realpathSync(ruta) : `${ruta} (no existe)`));

    expect(
      alcanzadas,
      `Ningun \`@source\` de src/estilos.css cae en @kamayuk/ui (${realDeUi}).\n` +
        '  Tailwind omite `node_modules`: sin esto, las clases de la libreria no generan regla y\n' +
        '  la pantalla se dibuja igual, con la mitad de su aspecto.',
    ).toContain(realDeUi);
  });

  it('y ahi hay componentes que leer', () => {
    // Sin esto, un `@kamayuk/ui` vaciado —o una raiz mal calculada— pasaria lo de arriba en verde.
    expect(fuentesDe(RAIZ_DE_UI).length).toBeGreaterThan(5);
  });
});
