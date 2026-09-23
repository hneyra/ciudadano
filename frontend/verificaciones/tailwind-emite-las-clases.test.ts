// @vitest-environment node
//
// Compila CSS de verdad y lee archivos del disco. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { UMBRAL_DE_LO_QUE_NO_ES_TEXTO, conDosDecimales, contraste } from './contraste.ts';
import {
  type Regla,
  clasesDe,
  clasesEmitidas,
  compilar,
  fuentesDe,
  paletaDeLaIdentidad,
  paletaDelTema,
  reglasDe,
  resolver,
  utilidadDesnuda,
} from './tailwind.ts';

/**
 * **Una clase de Tailwind produce una REGLA, y no solo esta escrita.** Portada de `rentas` (rentas#91,
 * rentas#139), sobre la hoja de ESTE portal.
 *
 * <h2>Lo que hoy no comprueba nadie</h2>
 *
 * Un `bg-azull`, un `text-tinta-5` o un `rounded-xs` compilan, pasan el lint y pasan las pruebas,
 * que comparan `className` **como texto**. El elemento se queda sin estilo y nadie lo ve hasta que
 * lo mira. Y el modo de fallo que lo motiva en `rentas`: que el token EXISTA y la utilidad NO se
 * genere, porque Tailwind v4 saca `bg-*` de `--color-*` y de nada mas (`kamayuk-lib`#8).
 *
 * <h2>Lo que cambia respecto de `rentas`</h2>
 *
 *   1. **Se compila `src/estilos.css`**, no la hoja de la libreria: es la que Vite empaqueta, y
 *      ahora trae la capa `base` con los estilos globales del artboard.
 *   2. **El valor se resuelve contra `clasico`**, que es la identidad que este portal elige. En
 *      `rentas` se resolvia contra el `@theme` porque su identidad es la del `@theme`; aqui el
 *      `@theme` es `institucional` y lo que se ve lo pinta el bloque `[data-tema='clasico']`. Que
 *      ese bloque sea el del artboard lo mide `la-paleta-cuadra-con-el-artboard`; lo que se mide
 *      aqui es que la utilidad APUNTE al token que ese bloque declara.
 *   3. Las fuentes son `src/`, no la libreria entera: este portal todavia no dibuja con sus piezas.
 *      Cuando lo haga, las clases de las piezas que use entran por `src/`.
 */

/** Lo que el issue 2 nombra: las cinco utilidades de color que tienen que generar regla. */
const LAS_DEL_ISSUE = [
  { clase: 'bg-azul', propiedad: 'background-color', token: '--color-azul' },
  { clase: 'text-tinta', propiedad: 'color', token: '--color-tinta' },
  { clase: 'border-linea', propiedad: 'border-color', token: '--color-linea' },
  { clase: 'bg-ok-fondo', propiedad: 'background-color', token: '--color-ok-fondo' },
  { clase: 'text-mal-tinta', propiedad: 'color', token: '--color-mal-tinta' },
] as const;

const FUENTES = fuentesDe(join(RAIZ, 'src'));
const CLASES = [...new Set(FUENTES.flatMap((f) => clasesDe(readFileSync(f, 'utf8'))))].sort();

/** Lo que la cascada deja: el `@theme` y, encima, lo que `clasico` redefine. */
function paletaQueSeVe(reglas: readonly Regla[]): Map<string, string> {
  return new Map([...paletaDelTema(reglas), ...paletaDeLaIdentidad(reglas, 'clasico')]);
}

/**
 * Las declaraciones de un selector dentro de `@layer base`, con la ultima ganando.
 *
 * Es la cascada dentro de una misma capa y a igual especificidad: el preflight escribe `a { color:
 * inherit }` y la hoja de la aplicacion, despues, `a { color: var(--color-azul) }`. Lo que se ve es
 * lo segundo.
 */
function enLaCapaBase(reglas: readonly Regla[], selectores: readonly string[]): Map<string, string> {
  const salida = new Map<string, string>();
  for (const regla of reglas) {
    if (regla.dentroDe.join(' ') !== '@layer base') continue;
    if (regla.selectores.length !== selectores.length) continue;
    if (!regla.selectores.every((s, i) => s === selectores[i])) continue;
    for (const [propiedad, valor] of regla.declaraciones) salida.set(propiedad, valor);
  }
  return salida;
}

describe('Tailwind emite lo que el portal pide, sobre la hoja del portal', () => {
  let reglas: Regla[] = [];

  beforeAll(async () => {
    reglas = reglasDe(
      await compilar([...LAS_DEL_ISSUE.map((u) => u.clase), 'rounded-sm', ...CLASES]),
    );
  });

  it('EL CENTINELA: hay fuentes y clases, la hoja compila y el lector encuentra sus sujetos', () => {
    // Sin esto, un cambio de ruta dejaria las listas vacias y todo lo de abajo pasando en verde
    // sobre la nada, o un cambio en como Tailwind emite el `@theme` daria rojos por el motivo
    // equivocado.
    expect(FUENTES.map((f) => f.slice(RAIZ.length + 1)), 'no se leyo el marcador').toContain(
      'src/aplicacion.tsx',
    );
    expect(CLASES.length, 'no se extrajo ni una clase de `src/`').toBeGreaterThan(0);
    expect(reglas.length, 'Tailwind no emitio CSS: la hoja no compila').toBeGreaterThan(50);
    expect(paletaDelTema(reglas).size, 'el `@theme` no se leyo del CSS emitido').toBeGreaterThan(0);
    expect(
      paletaDeLaIdentidad(reglas, 'clasico').get('--color-azul'),
      "el CSS emitido no trae el bloque `[data-tema='clasico']`: la hoja de la libreria dejo de " +
        'arrastrar `temas.css`, o `clasico` no esta en el',
    ).toBeDefined();
  });

  it('EL CENTINELA: el lector del CSS distingue lo que `includes` confundia (rentas#139)', () => {
    const muestra = [
      '@layer theme { :root, :host { --color-sup: #f7fbfe; --color-superficie: #ffffff; } }',
      '@layer utilities { .bg-superficie { background-color: var(--color-superficie); } }',
      "[data-tema='clasico'] { --color-superficie: #0000ff; }",
    ].join('\n');
    const leidas = reglasDe(muestra);
    expect(clasesEmitidas(leidas).has('bg-superficie')).toBe(true);
    expect(clasesEmitidas(leidas).has('bg-sup'), 'el lector contesta por subcadena').toBe(false);
    expect(paletaDelTema(leidas).get('--color-superficie')).toBe('#ffffff');
    expect(paletaDeLaIdentidad(leidas, 'clasico').get('--color-superficie')).toBe('#0000ff');
    expect(
      resolver(
        utilidadDesnuda(leidas, 'bg-superficie')?.declaraciones.get('background-color') ?? '',
        paletaQueSeVe(leidas),
      ),
    ).toBe('#0000ff');
  });

  it.each(LAS_DEL_ISSUE)('`$clase` genera su regla, apuntando a $token de `clasico`', ({ clase, propiedad, token }) => {
    const utilidad = utilidadDesnuda(reglas, clase);
    expect(utilidad, `Tailwind no genera la regla \`.${clase}\``).toBeDefined();

    const declarado = utilidad?.declaraciones.get(propiedad);
    expect(declarado, `\`.${clase}\` no declara ${propiedad}`).toBe(`var(${token})`);

    const deClasico = paletaDeLaIdentidad(reglas, 'clasico').get(token);
    expect(deClasico, `\`clasico\` no declara ${token}: la utilidad pintaria el de \`institucional\``).toBeDefined();
    expect(resolver(declarado ?? '', paletaQueSeVe(reglas))).toBe(deClasico);
  });

  it('`rounded-sm` es 3 px, y `clasico` no lo redefine', () => {
    const utilidad = utilidadDesnuda(reglas, 'rounded-sm');
    expect(utilidad, 'Tailwind no genera `.rounded-sm`').toBeDefined();
    expect(resolver(utilidad?.declaraciones.get('border-radius') ?? '', paletaQueSeVe(reglas))).toBe('3px');
  });

  it('TODA clase que `src/` usa produce una regla', () => {
    const emitidas = clasesEmitidas(reglas);
    const mudas = CLASES.filter((c) => !emitidas.has(c)).map((c) => `  ${c}`);
    expect(
      mudas,
      'Hay clases escritas que Tailwind NO genera. El elemento que las lleva se queda sin\n' +
        `estilo, y eso no se ve en ninguna prueba que compare \`className\` como texto:\n${mudas.join('\n')}`,
    ).toEqual([]);
  });
});

describe('y los estilos globales del artboard (lineas 12-22) salen de la capa `base`, con tokens', () => {
  let reglas: Regla[] = [];
  let paleta = new Map<string, string>();

  beforeAll(async () => {
    reglas = reglasDe(await compilar([]));
    paleta = paletaQueSeVe(reglas);
  });

  /** El valor que se ve con `data-tema="clasico"`, o el `var(--…)` que no se pudo resolver. */
  const seVe = (selectores: readonly string[], propiedad: string): string =>
    resolver(enLaCapaBase(reglas, selectores).get(propiedad) ?? '(no se declara)', paleta);

  it('lo que resuelve el preflight: `box-sizing` y `border-collapse`', () => {
    expect(seVe(['*', '::after', '::before', '::backdrop', '::file-selector-button'], 'box-sizing')).toBe(
      'border-box',
    );
    expect(seVe(['table'], 'border-collapse')).toBe('collapse');
  });

  it('`body`: el lienzo, la tinta, 15 px y 1.5 del artboard', () => {
    expect(seVe(['body'], 'background-color')).toBe(paleta.get('--color-fondo'));
    expect(paleta.get('--color-fondo')).toBe('#f4f6f8');
    expect(seVe(['body'], 'color')).toBe('#333333');
    expect(seVe(['body'], 'font-size')).toBe('15px');
    expect(seVe(['body'], 'line-height')).toBe('1.5');
  });

  it('enlaces sin subrayado, con subrayado al pasar, en `--color-azul`', () => {
    expect(seVe(['a'], 'text-decoration')).toBe('none');
    expect(seVe(['a:hover'], 'text-decoration')).toBe('underline');
    expect(enLaCapaBase(reglas, ['a']).get('color')).toBe('var(--color-azul)');
  });

  it('`:focus-visible`: 2 px solidos separados 2 px, y el contorno SE VE sobre los dos papeles', () => {
    const contorno = seVe([':focus-visible'], 'outline');
    expect(seVe([':focus-visible'], 'outline-offset')).toBe('2px');
    const [ancho, estilo, color] = contorno.split(' ');
    expect([ancho, estilo]).toEqual(['2px', 'solid']);

    // Por que no es el `#1BA0D7` del artboard, calculado y no creido: ver `src/estilos.css`.
    const faltos = ['--color-fondo', '--color-superficie'].flatMap((papel) => {
      const razon = contraste(color ?? '', paleta.get(papel) ?? '');
      return razon >= UMBRAL_DE_LO_QUE_NO_ES_TEXTO
        ? []
        : [`  ${color ?? ''} sobre ${papel} (${paleta.get(papel) ?? ''}): ${conDosDecimales(razon)}:1`];
    });
    expect(
      faltos,
      'El contorno de foco global no llega a 3:1 (WCAG 1.4.11) en `clasico`:\n' +
        `${faltos.join('\n')}\n\n` +
        '  El `#1BA0D7` del artboard (`--color-foco`) da 2.98:1 y 2.75:1. Por eso es `--color-azul`.',
    ).toEqual([]);
  });

  it('el foco de un campo: filo `--color-azul` y el halo de `--color-foco`, sin quitar el contorno', () => {
    const campo = ['input:focus', 'select:focus', 'textarea:focus'];
    expect(enLaCapaBase(reglas, campo).get('border-color')).toBe('var(--color-azul)');
    expect(enLaCapaBase(reglas, campo).get('box-shadow')).toBe('0 0 0 3px var(--color-foco)');
    expect(enLaCapaBase(reglas, campo).has('outline'), 'el `outline: none` del artboard no se porta').toBe(false);
  });

  it('tablas a todo el ancho, `fieldset` que encoge y `legend` con su aire', () => {
    expect(seVe(['table'], 'width')).toBe('100%');
    expect(seVe(['fieldset'], 'min-width')).toBe('0');
    expect(seVe(['legend'], 'padding')).toBe('0 8px');
  });

  // Esto es lo que el CSS DECLARA (lee el archivo compilado; no hay navegador de por medio), y
  // basta para que la prueba pueda fallar: un `--font-sans` distinto la rompe aqui mismo. Lo que
  // esto NO dice es que Chromium vaya a DIBUJAR con Arial —Linux no la trae— ni que la sustituta
  // calce en metricas: eso lo mide `e2e/se-ve.spec.ts` con CDP (issue 36), contra el navegador de
  // verdad, porque un CSS compilado no tiene glifos que pintar.
  it('y la fuente DECLARADA es la de la identidad: `--font-sans` de `clasico`, que el preflight pinta', () => {
    expect(paletaDelTema(reglas).get('--default-font-family')).toBe('var(--font-sans)');
    expect(paletaDeLaIdentidad(reglas, 'clasico').get('--font-sans')).toBe('Arial, Helvetica, sans-serif');
  });
});
