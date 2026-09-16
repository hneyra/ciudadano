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
 *   · un color literal en **cualquier cadena o plantilla** (issue 23), salvo en los contextos de
 *     `EXENCIONES`, que no pintan;
 *   · una clave `--color-*` en un objeto, o un `setProperty('--color-…')`: declarar el token.
 *
 * Usar el token no se senala: `style={{ color: 'var(--color-azul)' }}` y `bg-azul` eligen de la
 * identidad, que es lo que se pide.
 *
 * <h2>Por que cualquier cadena, y no solo `className`, `style` y `cn()`</h2>
 *
 * Hasta el issue 23 la guarda miraba DONDE iba la cadena: `className`, `style` o una funcion que
 * compone clases. Y un color llega a una clase por muchos mas caminos que esos. Medido en la revision
 * del issue 7: `<Tarjeta filo="border-t-[#A6093D]" />` dejaba la guarda en verde, y lo mismo una
 * constante (`const FILO = 'border-t-[#a6093d]'`), un objeto de tonos o una plantilla que luego se
 * pasan a `cn()` desde otra linea. Seguir el valor hasta el `className` es seguir el flujo de datos,
 * y eso un recorrido del arbol no lo sabe hacer. Asi que se invierte la carga: **toda cadena con un
 * color literal se senala**, y lo que se exime es lo que se sabe que no pinta.
 *
 * <h2>Lo que se exime, y por que no se decide por la forma de la cadena</h2>
 *
 * `'#fed'` es a la vez un ancla valida y un color valido: mirando solo la cadena no hay manera de
 * saber cual es. Lo decide DONDE va, y por eso cada exencion es un contexto del arbol —nunca un
 * nombre de archivo, ni una lista de cadenas—. Lo que no pinta y ya sale limpio sin exencion:
 *   · los **comentarios**, que no son nodos del arbol;
 *   · las **rutas hash** `#/buscar`: tras el `#` va una `/`, que no es cifra hexadecimal, y
 *     `COLOR_LITERAL` no las toma por color.
 * Lo demas esta en `EXENCIONES`, cada una con su porque.
 */

/** Un color escrito a mano: hexadecimal de 3, 4, 6 u 8 cifras, o una funcion de color. */
const COLOR_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

/** Los prefijos de las variables que son de la libreria. */
const DECLARACION_DE_LA_LIBRERIA = /(?:^|[;{\s])(--(?:color|font)-[\w-]*|--radius[\w-]*|--shadow-[\w-]*)\s*:/g;

/** Las funciones con que una clase se compone: solo para decir, en el hallazgo, por donde pinta. */
const COMPONEN_CLASES = new Set(['cn', 'clsx', 'cva', 'twMerge']);

/**
 * **Los atributos JSX que llevan un destino**: `<a href>` y el `to` de `Link` y `Navigate`. Una ruta
 * hash o un ancla (`href="#add"`, `to="#cafe"`) no pinta nada, aunque sus letras sean hexadecimales.
 *
 * Solo si el valor TIENE FORMA de destino (`DESTINO`): una prop que se llame `to` y reciba
 * `hover:bg-[#a94442]` sigue senalandose.
 */
const ATRIBUTOS_DE_DESTINO = new Set(['href', 'to']);

/** Empieza como un destino: `#`, `/`, `./`, `../`, o un esquema de enlace. */
const DESTINO = /^(?:#|\/|\.\.?\/|https?:|mailto:|tel:)/i;

/**
 * **Los atributos JSX que nombran, no pintan**: `data-testid` es un asidero de prueba, y su valor
 * nunca llega a una hoja de estilos.
 */
const ATRIBUTOS_QUE_NOMBRAN = new Set(['data-testid']);

/**
 * **Lo que se exime**, en el orden en que se mira. Cada entrada dice por que ese contexto no pinta;
 * `CLAUDE.md` las repite, y `sin-colores-propios.test.ts` tiene, para cada una, una cadena que sin
 * ella saldria roja.
 */
export const EXENCIONES = {
  destino:
    'el destino de un enlace (`href`, `to`) con forma de destino: una ruta hash o un ancla no pinta',
  nombre: 'un `data-testid`: nombra el elemento para una prueba, no le da estilo',
  texto: 'el texto de `t()`: es lo que se lee, y un texto no llega nunca a una clase ni a un `style`',
} as const;

export type Exencion = keyof typeof EXENCIONES;

/** Todas las exenciones: lo que se aplica a `src/`. Una prueba puede quitar una para ver que ampara. */
const TODAS = new Set(Object.keys(EXENCIONES) as Exencion[]);

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

/** `t('…')` o `i18n.t('…')`: la funcion que traduce. */
function esTraducir(expresion: ts.Expression): boolean {
  if (ts.isIdentifier(expresion)) return expresion.text === 't';
  return ts.isPropertyAccessExpression(expresion) && expresion.name.text === 't';
}

/**
 * Como empieza la cadena entera: la de una plantilla es su cabeza, aunque el color vaya en la cola.
 * Asi `href={cond ? '#add' : 'bg-[#a94442]'}` exime la primera y senala la segunda.
 */
function comienzoDe(nodo: ts.StringLiteralLike | ts.TemplateLiteralToken): string {
  if (ts.isTemplateMiddle(nodo) || ts.isTemplateTail(nodo)) return nodo.parent.parent.head.text;
  return nodo.text;
}

/**
 * La exencion que ampara a la cadena, si alguna. Se sube por los padres hasta el primer atributo JSX
 * —una prop es una frontera: lo que va dentro de otra prop no la hereda— o hasta la raiz.
 */
function exencion(nodo: ts.StringLiteralLike | ts.TemplateLiteralToken): Exencion | null {
  let hijo: ts.Node = nodo;
  for (let actual = nodo.parent; !ts.isSourceFile(actual); hijo = actual, actual = actual.parent) {
    if (ts.isJsxAttribute(actual)) {
      const nombre = actual.name.getText();
      if (ATRIBUTOS_DE_DESTINO.has(nombre) && DESTINO.test(comienzoDe(nodo))) return 'destino';
      if (ATRIBUTOS_QUE_NOMBRAN.has(nombre)) return 'nombre';
      return null;
    }
    // Solo el PRIMER argumento: `t('Aviso', { color: '#a94442' })` no exime sus opciones.
    if (ts.isCallExpression(actual) && esTraducir(actual.expression) && actual.arguments[0] === hijo) {
      return 'texto';
    }
  }
  return null;
}

/**
 * Por donde pinta la cadena, para que el hallazgo lo diga: el atributo JSX o la funcion que compone
 * clases, si los hay; si no, la clave o la constante que la guarda.
 */
function dondeVa(nodo: ts.Node): string | null {
  let guardada: string | null = null;
  for (let actual = nodo.parent; !ts.isSourceFile(actual); actual = actual.parent) {
    if (ts.isJsxAttribute(actual)) return `\`${actual.name.getText()}\``;
    if (ts.isCallExpression(actual) && COMPONEN_CLASES.has(actual.expression.getText())) {
      return `\`${actual.expression.getText()}()\``;
    }
    // Fuera de la funcion que la contiene ya no se sabe por donde pinta: el nombre del componente no lo dice.
    if (guardada === null && ts.isFunctionLike(actual)) break;
    if (guardada === null && ts.isPropertyAssignment(actual)) guardada = `la clave \`${actual.name.getText()}\``;
    if (guardada === null && ts.isVariableDeclaration(actual)) guardada = `\`${actual.name.getText()}\``;
  }
  return guardada;
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
export function hallazgosEnCodigo(
  ruta: string,
  fuente: string,
  exentas: ReadonlySet<Exencion> = TODAS,
): Hallazgo[] {
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
      const amparada = color === null ? null : exencion(nodo);
      if (color !== null && (amparada === null || !exentas.has(amparada))) {
        const que = ts.isStringLiteral(nodo) ? 'una cadena' : 'una plantilla';
        const donde = dondeVa(nodo);
        salida.push({
          ruta,
          linea: enLinea(nodo),
          porQue: `color literal «${color[0]}» en ${que} ${donde === null ? 'suelta' : `de ${donde}`}: se usa la utilidad o el \`var(--color-…)\` del token`,
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
export function hallazgosDe(ruta: string, fuente: string, exentas: ReadonlySet<Exencion> = TODAS): Hallazgo[] {
  if (ruta.endsWith('.css')) return hallazgosEnHoja(ruta, fuente);
  return hallazgosEnCodigo(ruta, fuente, exentas);
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
