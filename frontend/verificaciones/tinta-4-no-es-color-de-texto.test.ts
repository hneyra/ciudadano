// @vitest-environment node
//
// Lee archivos del disco y los parte con el compilador de TypeScript. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';
import { UMBRAL_DE_TEXTO, conDosDecimales, contraste } from './contraste.ts';
import { hojaDeUi, temasDeUi } from './especificadores.ts';
import { paletaDeLaIdentidad, reglasDe } from './tailwind.ts';
import { archivosDeInterfaz, hallazgosDe, losQueNoSonTexto, usaLaClase } from './tinta-que-no-es-texto.ts';

/**
 * **`--tinta-4` no es color de texto, y aqui no puede serlo.** Portada de
 * `rentas/frontend/verificaciones/tinta-4-no-es-color-de-texto.test.ts` (rentas#140).
 *
 * <h2>El defecto del que viene, en `rentas`</h2>
 *
 * La libreria lo escribe en mayusculas en su hoja: `--tinta-4` **NO ES COLOR DE TEXTO**. Es el trazo
 * de un icono decorativo, y los usos de `@kamayuk/ui` lo respetan con `aria-hidden`. Y `rentas` lo
 * usaba para prosa que habia que leer, a 12 px, en el cajon de Preferencias. Una regla que solo vive
 * en un comentario se incumple en seis meses; alli se convirtio en rojo, y aqui nace con el.
 *
 * <h2>Por que importa MAS en este portal</h2>
 *
 * El artboard escribe sus notas en `#777` y `#888`, y `kamayuk-lib`#56 los dejo fuera de `clasico`
 * por no llegar a AA. La tentacion al portar una nota sera el token mas tenue que hay, y en
 * `clasico` ese es `--tinta-4` —`#999999`—, que da menos todavia: 2.85:1 sobre blanco. Lo que se lee
 * es `--tinta-3` (`la-paleta-cuadra-con-el-artboard.test.ts`, filas de los grises).
 *
 * <h2>Lo que cambia respecto de `rentas`</h2>
 *
 *   · **De donde sale el token**: de la hoja publicada de `@kamayuk/ui`, no del artboard, que aqui
 *     no lo dice. El porque esta en `tinta-que-no-es-texto.ts`.
 *   · **Contra que papeles se calcula**: `--fondo` y `--superficie` de `[data-tema='clasico']`, que
 *     es lo que este portal pinta.
 *   · **Que barre**: `src/`, como en `rentas` y por los mismos motivos —la libreria tiene su
 *     propia guarda de contraste, y barrerla desde aqui pondria rojo a un consumidor por un archivo
 *     que no puede tocar—. Hoy `src/` es el marcador; la guarda esta para la primera pantalla.
 */

const HOJA_DE_LA_LIBRERIA = readFileSync(hojaDeUi(), 'utf8');

/** `clasico/claro`, que es donde se miden el valor del token y los dos papeles. */
const CLASICO = paletaDeLaIdentidad(reglasDe(readFileSync(temasDeUi(), 'utf8')), 'clasico');

/** Los tokens que la libreria declara que NO son texto, con su valor en `clasico`. Hoy, uno. */
const NO_SON_TEXTO = losQueNoSonTexto(HOJA_DE_LA_LIBRERIA, CLASICO);

/** Los dos papeles sobre los que se dibuja: el lienzo y la superficie de una tarjeta. */
const PAPELES = ['--color-fondo', '--color-superficie'] as const;

/** Todo `src/`, que es el codigo de produccion de este frontend. */
const ARCHIVOS = archivosDeInterfaz(join(RAIZ, 'src'));

/**
 * Las fuentes inventadas con que se demuestra que la guarda muerde, y que no muerde de mas.
 *
 * Son el equivalente de `verificaciones/muestras/`: la regla se ejerce sobre codigo que la viola a
 * proposito **y** sobre codigo que la cumple. Sin la segunda mitad, una guarda que senalara todo
 * pasaria esta prueba igual de bien y dejaria el repositorio sin poder pintar un icono.
 */
const QUE_VIOLA: readonly { readonly que: string; readonly archivo: string; readonly fuente: string }[] = [
  {
    que: 'prosa a 12 px, que es el defecto de este issue',
    archivo: 'Mando.tsx',
    fuente: 'export const M = () => <p className="text-[12px] text-tinta-4">{t(nota)}</p>;\n',
  },
  {
    que: 'la clase escondida dentro de un `cn()`, que es como llega de verdad',
    archivo: 'Mando.tsx',
    fuente:
      "export const M = ({ a }: { a: boolean }) => <span className={cn('leading-[1.5]', a ? 'text-tinta-4' : 'text-tinta-3')}>x</span>;\n",
  },
  {
    que: '`aria-hidden` puesto en `false`, que es no llevarlo',
    archivo: 'Mando.tsx',
    fuente: 'export const M = () => <span aria-hidden={false} className="text-tinta-4">/</span>;\n',
  },
  {
    que: 'la clase fuera de todo JSX, donde no se puede saber sobre que cae',
    archivo: 'clases.ts',
    fuente: "export const NOTA = 'text-[12px] text-tinta-4';\n",
  },
  {
    que: 'la clase en un mapa de `classNames`, como la lleva el calendario de la libreria',
    archivo: 'Calendario.tsx',
    fuente:
      "export const C = () => <DayPicker classNames={{ outside: cn(porOmision.outside, 'text-tinta-4') }} />;\n",
  },
];

const QUE_CUMPLE: readonly { readonly que: string; readonly archivo: string; readonly fuente: string }[] = [
  {
    que: 'el trazo de un icono, con `aria-hidden` escrito',
    archivo: 'Icono.tsx',
    fuente:
      'export const I = () => <svg aria-hidden="true" className="size-[15px] text-tinta-4" />;\n',
  },
  {
    que: '`aria-hidden` a secas, que en JSX es `true`',
    archivo: 'Miga.tsx',
    fuente: "export const S = () => <span aria-hidden className={cn('text-tinta-4')}>/</span>;\n",
  },
  {
    que: 'la variante de un estado, sobre un elemento oculto',
    archivo: 'Chevron.tsx',
    fuente:
      'export const C = () => <span aria-hidden="true" className="text-tinta-3 hover:text-tinta-4" />;\n',
  },
  {
    que: 'otro token que empieza igual: `text-tinta-4` no esta dentro de `text-tinta-40`',
    archivo: 'Otro.tsx',
    fuente: 'export const O = () => <p className="text-tinta-40">x</p>;\n',
  },
  {
    que: 'la clase NOMBRADA en un comentario, que es como esta guarda se explica a si misma',
    archivo: 'Nota.tsx',
    fuente: '// `text-tinta-4` no es color de texto.\nexport const N = () => <p>x</p>;\n',
  },
];

describe('el token que no es color de texto', () => {
  it('EL CENTINELA: la libreria declara uno, `clasico` le da valor, hay archivos y la regla muerde', () => {
    // Sin esto, un cambio de redaccion en la hoja de la libreria dejaria `NO_SON_TEXTO` vacio y la
    // guarda de abajo recorreria la lista vacia **en verde** (rentas#78, rentas#90).
    expect(
      NO_SON_TEXTO.map((t) => t.token),
      'la hoja de `@kamayuk/ui` no declara ningun token como no-texto: la guarda se quedo sin sujeto',
    ).toEqual(['tinta-4']);
    for (const token of NO_SON_TEXTO) {
      expect(token.valor, `\`clasico\` no declara --color-${token.token}`).toMatch(/^#[0-9a-f]{6}$/);
    }

    // Y por el otro lado: un `src/` que no se pudiera leer daria cero hallazgos, y cero hallazgos es
    // exactamente lo que la guarda considera correcto. Se exige el marcador por nombre y no una
    // cuenta: hoy `src/` son tres archivos.
    expect(ARCHIVOS.map((r) => r.slice(RAIZ.length + 1)), 'no se leyo `src/`').toContain('src/aplicacion.tsx');

    // La regla, ejercida sobre codigo inventado. Es la mitad que demuestra que puede fallar.
    for (const { que, archivo, fuente } of QUE_VIOLA) {
      expect(hallazgosDe(archivo, fuente, 'text-tinta-4'), `la guarda dejo pasar ${que}`).not.toEqual([]);
    }
    for (const { que, archivo, fuente } of QUE_CUMPLE) {
      expect(hallazgosDe(archivo, fuente, 'text-tinta-4'), `la guarda senalo ${que}`).toEqual([]);
    }

    // Y que el reconocedor de clases mire el token entero y no un trozo.
    expect(usaLaClase('text-[12px] text-tinta-4', 'text-tinta-4')).toBe(true);
    expect(usaLaClase('text-tinta-40', 'text-tinta-4')).toBe(false);
  });

  it('y NO se le cree a la libreria: en `clasico` el token es ilegible sobre los dos papeles, calculado', () => {
    // Si alguien aclarara `--tinta-4` hasta hacerlo legible, esta guarda dejaria de tener motivo.
    // Mejor que lo diga aqui, que seguir prohibiendo por costumbre.
    for (const token of NO_SON_TEXTO) {
      for (const papel of PAPELES) {
        const valor = CLASICO.get(papel);
        expect(valor, `\`clasico\` no declara ${papel}`).toBeDefined();

        const razon = contraste(token.valor, valor ?? '');
        expect(
          razon,
          `--${token.token} (${token.valor}) sobre ${papel} (${valor ?? ''}) da ` +
            `${conDosDecimales(razon)}:1, que YA LLEGA a ${UMBRAL_DE_TEXTO}:1. La libreria dice ` +
            'que no es color de texto y el calculo ya no lo sostiene: revisa la regla antes de ' +
            'seguir prohibiendola.',
        ).toBeLessThan(UMBRAL_DE_TEXTO);
      }
    }
  });

  it('nadie en `src/` lo usa como texto', () => {
    const hallazgos = NO_SON_TEXTO.flatMap((token) =>
      ARCHIVOS.flatMap((ruta) => hallazgosDe(ruta, readFileSync(ruta, 'utf8'), token.clase)),
    );

    expect(
      hallazgos,
      'Hay texto pintado con un token que la libreria declara NO-color-de-texto:\n' +
        `${hallazgos
          .map((h) => `  ${h.ruta.slice(RAIZ.length + 1)}:${h.linea} sobre ${h.sobre} — ${h.porQue}`)
          .join('\n')}\n\n` +
        `  ${NO_SON_TEXTO.map((t) => `«${t.porQue}»`).join('\n  ')}\n\n` +
        '  Si lo que pinta se lee —una nota, el `#777` o el `#888` del artboard—, el token es\n' +
        '  `tinta-3`. Si es el trazo de un icono decorativo, el elemento lleva `aria-hidden` y deja\n' +
        '  de anunciarse al lector de pantalla, que es lo que lo hace decorativo de verdad.',
    ).toEqual([]);
  });
});
