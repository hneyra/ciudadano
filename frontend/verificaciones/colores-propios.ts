import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

/**
 * **Quien en `src/` escribe un color, en vez de elegirlo de la identidad** (issue 2).
 *
 * <h2>Por que funciones puras sobre `(ruta, fuente)`</h2>
 *
 * Por lo mismo que `tinta-que-no-es-texto.ts` en `rentas` (rentas#140): se pueden ejercer sobre la
 * muestra que viola la regla —`verificaciones/colores-propios/`— y sobre fuentes inventadas que la
 * cumplen, sin fabricar archivos en `src/`.
 *
 * <h2>Que se senala</h2>
 *
 * En una hoja (`.css`), con los comentarios quitados:
 *   · declarar `--color-*`, `--font-*`, `--radius*` o `--shadow-*`: es escribir la paleta, la
 *     fuente, el radio o la sombra que la libreria ya publica —una segunda fuente de verdad—;
 *   · un color literal —`#rgb`, `#rrggbb`, `rgb()`, `hsl()`, `oklch()`…— en cualquier sitio;
 *   · un `font-family` que no sea `inherit`: la fuente es de la identidad (`--font-sans`).
 *
 * En codigo (`.ts`, `.tsx`), con el arbol de TypeScript:
 *   · un color literal en una cadena que cuelga de `className` o de `style`, o que va dentro de
 *     `cn()`, `clsx()`, `cva()` o `twMerge()` —que es como una clase llega de verdad—;
 *   · una clave `--color-*` en un objeto, o un `setProperty('--color-…')`: declarar el token.
 *
 * Usar el token no se senala: `style={{ color: 'var(--color-azul)' }}` y `bg-azul` eligen de la
 * identidad, que es lo que se pide.
 *
 * <h2>Por que el arbol y no un `grep` en el codigo</h2>
 *
 * Porque un `#` seguido de tres letras de la a a la f aparece en sitios que no pintan —un ancla
 * `#add`, un selector de prueba— y senalarlos obligaria a una lista de excepciones que nadie
 * mantiene. Lo que importa es DONDE va la cadena.
 */

/** Un color escrito a mano: hexadecimal de 3, 4, 6 u 8 cifras, o una funcion de color. */
const COLOR_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

/** Los prefijos de las variables que son de la libreria. */
const DECLARACION_DE_LA_LIBRERIA = /(?:^|[;{\s])(--(?:color|font)-[\w-]*|--radius[\w-]*|--shadow-[\w-]*)\s*:/g;

/** Las funciones con que una clase se compone. */
const COMPONEN_CLASES = new Set(['cn', 'clsx', 'cva', 'twMerge']);

export interface Hallazgo {
  readonly ruta: string;
  readonly linea: number;
  readonly porQue: string;
}

const lineaDe = (texto: string, indice: number): number => texto.slice(0, indice).split('\n').length;

/** Una hoja de estilos: comentarios fuera, y lo que quede se juzga entero. */
export function hallazgosEnHoja(ruta: string, css: string): Hallazgo[] {
  // Se sustituye cada comentario por el mismo numero de saltos de linea, para que la linea que se
  // cita siga siendo la del archivo.
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const salida: Hallazgo[] = [];

  for (const coincidencia of sinComentarios.matchAll(DECLARACION_DE_LA_LIBRERIA)) {
    salida.push({
      ruta,
      linea: lineaDe(sinComentarios, coincidencia.index),
      porQue: `declara ${coincidencia[1] ?? ''}, que es de \`@kamayuk/ui\`: se elige la identidad, no se escribe`,
    });
  }

  sinComentarios.split('\n').forEach((texto, i) => {
    const color = COLOR_LITERAL.exec(texto);
    if (color !== null) {
      salida.push({ ruta, linea: i + 1, porQue: `color literal «${color[0]}»: se usa un \`var(--color-…)\`` });
    }
    const fuente = /(?:^|[;{\s])font-family\s*:\s*([^;}]+)/.exec(texto);
    if (fuente !== null && fuente[1]?.trim() !== 'inherit') {
      salida.push({
        ruta,
        linea: i + 1,
        porQue: `\`font-family: ${fuente[1]?.trim() ?? ''}\`: la fuente es de la identidad (\`--font-sans\`)`,
      });
    }
  });

  return salida;
}

function esCadena(nodo: ts.Node): nodo is ts.StringLiteralLike | ts.TemplateLiteralToken {
  return (
    ts.isStringLiteral(nodo) ||
    ts.isNoSubstitutionTemplateLiteral(nodo) ||
    ts.isTemplateHead(nodo) ||
    ts.isTemplateMiddle(nodo) ||
    ts.isTemplateTail(nodo)
  );
}

/** La cadena pinta: cuelga de `className`/`style` o va dentro de una funcion que compone clases. */
function pinta(nodo: ts.Node): string | null {
  for (let actual = nodo.parent; !ts.isSourceFile(actual); actual = actual.parent) {
    if (ts.isJsxAttribute(actual)) {
      const nombre = actual.name.getText();
      return nombre === 'className' || nombre === 'style' ? `\`${nombre}\`` : null;
    }
    if (ts.isCallExpression(actual) && COMPONEN_CLASES.has(actual.expression.getText())) {
      return `\`${actual.expression.getText()}()\``;
    }
  }
  return null;
}

/** El texto de una clave de objeto, si es literal: `'--color-azul'`, `['--color-azul' as string]`. */
function textoDeLaClave(nombre: ts.PropertyName): string | null {
  if (ts.isStringLiteral(nombre) || ts.isIdentifier(nombre)) return nombre.text;
  if (ts.isComputedPropertyName(nombre)) {
    let expresion: ts.Expression = nombre.expression;
    while (ts.isAsExpression(expresion) || ts.isParenthesizedExpression(expresion)) {
      expresion = expresion.expression;
    }
    return ts.isStringLiteralLike(expresion) ? expresion.text : null;
  }
  return null;
}

/** Un archivo de codigo, juzgado por su arbol. */
export function hallazgosEnCodigo(ruta: string, fuente: string): Hallazgo[] {
  const arbol = ts.createSourceFile(
    ruta,
    fuente,
    ts.ScriptTarget.Latest,
    // Sin `setParentNodes` no hay `.parent` que subir, y la guarda se queda muda.
    true,
    ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const salida: Hallazgo[] = [];
  const enLinea = (nodo: ts.Node): number =>
    arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1;

  const visitar = (nodo: ts.Node): void => {
    if (esCadena(nodo)) {
      const color = COLOR_LITERAL.exec(nodo.text);
      const donde = color === null ? null : pinta(nodo);
      if (color !== null && donde !== null) {
        salida.push({
          ruta,
          linea: enLinea(nodo),
          porQue: `color literal «${color[0]}» en ${donde}: se usa la utilidad o el \`var(--color-…)\` del token`,
        });
      }
    }

    if (ts.isPropertyAssignment(nodo)) {
      const clave = textoDeLaClave(nodo.name);
      if (clave?.startsWith('--color-') === true) {
        salida.push({ ruta, linea: enLinea(nodo), porQue: `declara ${clave}: se elige la identidad, no se escribe` });
      }
    }

    if (
      ts.isCallExpression(nodo) &&
      ts.isPropertyAccessExpression(nodo.expression) &&
      nodo.expression.name.text === 'setProperty'
    ) {
      const [primero] = nodo.arguments;
      if (primero !== undefined && ts.isStringLiteralLike(primero) && primero.text.startsWith('--color-')) {
        salida.push({ ruta, linea: enLinea(nodo), porQue: `declara ${primero.text} con \`setProperty\`` });
      }
    }

    ts.forEachChild(nodo, visitar);
  };

  visitar(arbol);
  return salida;
}

/** Lo que se juzga de un archivo, segun su extension. */
export function hallazgosDe(ruta: string, fuente: string): Hallazgo[] {
  if (ruta.endsWith('.css')) return hallazgosEnHoja(ruta, fuente);
  return hallazgosEnCodigo(ruta, fuente);
}

/** Los `.ts`, `.tsx` y `.css` de un arbol, sin pruebas: una prueba no pinta nada. */
export function archivosQuePintan(raiz: string): string[] {
  return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(raiz, entrada.name);
    if (entrada.isDirectory()) return entrada.name === 'node_modules' ? [] : archivosQuePintan(ruta);
    if (!/\.(?:tsx?|css)$/.test(entrada.name) || entrada.name.includes('.test.')) return [];
    return [ruta];
  });
}
