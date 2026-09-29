import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

import { RAIZ } from './artboards.ts';
import { opcionesDelProyecto } from './compilador.ts';

/**
 * **Donde se escribe texto en la pagina sin React**, juzgado por el ARBOL y con los TIPOS (issue 56,
 * revision del PR #66).
 *
 * La primera version de `el-texto-del-dom-pasa-por-t.test.ts` era una expresion regular por linea, y
 * el revisor le encontro diecisiete formas que no veia: `append('x')`, `new Text('x')`, `.data =`,
 * `textContent +=`, `['textContent'] =`, una asignacion partida en dos lineas, una linea que empieza
 * por un comentario, `setAttribute('aria-label', …)`, `document.title =`… Aqui se lee con el
 * compilador de TypeScript, como `colores-propios.ts`, y ademas con su **comprobador de tipos**: es
 * lo unico que distingue `caja.append('x')` —texto en la pagina— de `parametros.append('a', 'b')`
 * —un `URLSearchParams`— y de `caja.append(parrafo)` —un nodo—.
 *
 * <h2>Lo que se senala</h2>
 *
 *   1. **Asignar** (con `=`, `+=` o cualquier asignacion compuesta), por punto o por corchete con una
 *      cadena, una de las `PROPIEDADES_DE_TEXTO` de algo que es un nodo del DOM (tiene `nodeType`) o
 *      cuyo tipo no se sabe (`any`).
 *   2. **Llamar** a `METODOS_QUE_ESCRIBEN` (`createTextNode`, `insertAdjacentText`, `write`,
 *      `setHTMLUnsafe`…) sobre un nodo o sobre algo sin tipo, con lo que sea.
 *   3. **Llamar** a `METODOS_QUE_INSERTAN` (`append`, `prepend`, `before`, `after`, `replaceChildren`,
 *      `replaceWith`) sobre un nodo, con algun argumento que NO es un nodo: una cadena, o algo sin
 *      tipo.
 *   4. **`setAttribute`** de un `ATRIBUTOS_DE_TEXTO` (`aria-label`, `title`, `placeholder`, `alt`…),
 *      o de un nombre cuyo tipo no es una cadena literal (una constante `as const` o `const X = '…'`
 *      si lo es) y por tanto no se sabe cual es.
 *   5. **`new Text(…)`** y **`new Option(…)`**, que son nodos con texto.
 *
 * <h2>Donde se mira</h2>
 *
 * Todo `.ts`/`.tsx` de `src/` que no es prueba ni andamiaje de pruebas (`src/pruebas/`), los `.js` de
 * `public/`, y los `<script>` en linea de los `.html` de `public/` y de `index.html`.
 *
 * <h2>Lo que NO ve, dicho</h2>
 *
 *   · **El JSX**: no es lo que esta guarda mide. Lo que React dibuja lo vigilan las pruebas con el
 *     idioma `marcado` e `i18next-cli`.
 *   · **Lo que se hace por un alias o por reflexion**: `const escribir = caja.append.bind(caja)`,
 *     `Reflect.set(caja, 'textContent', …)`, `Object.assign(caja, { textContent })`, una propiedad
 *     elegida con una variable (`caja[clave] = …`). Nadie escribe asi sin querer esconderlo.
 *   · **Un atributo de texto puesto por `setAttributeNS`, `toggleAttribute` o `dataset`**, y las
 *     propiedades de texto que no estan en `PROPIEDADES_DE_TEXTO`.
 *   · **Los `<script src>` de fuera** y los manejadores en linea (`onclick="…"`) de un `.html`.
 */

/** Lo que, asignado, pone texto a la vista (o a los lectores de pantalla). */
export const PROPIEDADES_DE_TEXTO: ReadonlySet<string> = new Set([
  'textContent',
  'innerText',
  'outerText',
  'innerHTML',
  'outerHTML',
  'nodeValue',
  'data',
  'title',
  'placeholder',
  'alt',
  'label',
  'ariaLabel',
  'ariaDescription',
  'ariaValueText',
  'ariaPlaceholder',
  'ariaRoleDescription',
]);

/** Metodos que escriben texto con cualquier argumento. */
export const METODOS_QUE_ESCRIBEN: ReadonlySet<string> = new Set([
  'createTextNode',
  'insertAdjacentText',
  'insertAdjacentHTML',
  'write',
  'writeln',
  'setHTMLUnsafe',
  'setHTML',
  'createComment',
]);

/** Metodos que insertan nodos, y texto si se les pasa una cadena. */
export const METODOS_QUE_INSERTAN: ReadonlySet<string> = new Set([
  'append',
  'prepend',
  'before',
  'after',
  'replaceChildren',
  'replaceWith',
]);

/** Atributos cuyo valor se lee (o lo lee un lector de pantalla). */
export const ATRIBUTOS_DE_TEXTO: ReadonlySet<string> = new Set([
  'title',
  'alt',
  'placeholder',
  'label',
  'value',
  'aria-label',
  'aria-description',
  'aria-valuetext',
  'aria-placeholder',
  'aria-roledescription',
]);

export interface Hallazgo {
  readonly ruta: string;
  readonly linea: number;
  readonly forma: string;
}

/** Un archivo a juzgar: su ruta relativa, para el informe, y de donde sale el codigo. */
interface Fuente {
  readonly ruta: string;
  /** El archivo que ve el compilador: el real, o uno virtual para un `<script>` en linea. */
  readonly archivo: string;
  /** El codigo, si es virtual. */
  readonly codigo?: string;
  /** Linea del `.html` donde empieza el `<script>`, para que el informe senale la de verdad. */
  readonly desplazamiento?: number;
}

function recorrer(desde: string, admite: (nombre: string) => boolean, salta: (nombre: string) => boolean): string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return salta(entrada) ? [] : recorrer(ruta, admite, salta);
    return admite(entrada) ? [ruta] : [];
  });
}

/** Los `<script>` en linea de un `.html`, cada uno como un archivo virtual. */
function guionesEnLinea(html: string, ruta: string): Fuente[] {
  const salida: Fuente[] = [];
  for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const inicio = (m.index ?? 0) + m[0].indexOf('>') + 1;
    salida.push({
      ruta,
      archivo: join(RAIZ, `${ruta}.guion-${String(salida.length + 1)}.js`),
      codigo: m[1],
      desplazamiento: html.slice(0, inicio).split('\n').length - 1,
    });
  }
  return salida;
}

/** Lo que se juzga en este arbol: `src/` de produccion, `public/` e `index.html`. */
export function fuentesDelPortal(): Fuente[] {
  const deSrc = recorrer(
    join(RAIZ, 'src'),
    (n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n),
    (n) => n === 'pruebas',
  ).map((archivo) => ({ ruta: relative(RAIZ, archivo), archivo }));
  const dePublic = recorrer(join(RAIZ, 'public'), (n) => /\.(m?js|html)$/.test(n), () => false);
  const guiones = dePublic.filter((a) => a.endsWith('.js')).map((archivo) => ({ ruta: relative(RAIZ, archivo), archivo }));
  const html = [...dePublic.filter((a) => a.endsWith('.html')), join(RAIZ, 'index.html')].flatMap((archivo) =>
    guionesEnLinea(readFileSync(archivo, 'utf8'), relative(RAIZ, archivo)),
  );
  return [...deSrc, ...guiones, ...html];
}

/** Si el tipo es el de un nodo del DOM, o no se sabe cual es. */
function esNodoONoSeSabe(tipo: ts.Type): boolean {
  if ((tipo.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return true;
  if (tipo.isUnion()) return tipo.types.some(esNodoONoSeSabe);
  return tipo.getProperty('nodeType') !== undefined;
}

/** Si un argumento puede NO ser un nodo: una cadena, un numero, o algo sin tipo. */
function puedeNoSerUnNodo(tipo: ts.Type): boolean {
  if ((tipo.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return true;
  if (tipo.isUnion()) return tipo.types.some(puedeNoSerUnNodo);
  if ((tipo.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike)) !== 0) return true;
  return tipo.getProperty('nodeType') === undefined;
}

/** El nombre de la propiedad a la que se asigna, por punto o por corchete con una cadena. */
function propiedadAsignada(izquierda: ts.Expression): { readonly nombre: string; readonly de: ts.Expression } | null {
  if (ts.isPropertyAccessExpression(izquierda)) return { nombre: izquierda.name.text, de: izquierda.expression };
  if (ts.isElementAccessExpression(izquierda) && ts.isStringLiteralLike(izquierda.argumentExpression)) {
    return { nombre: izquierda.argumentExpression.text, de: izquierda.expression };
  }
  return null;
}

const ES_ASIGNACION = (tipo: ts.SyntaxKind): boolean =>
  tipo >= ts.SyntaxKind.FirstAssignment && tipo <= ts.SyntaxKind.LastAssignment;

function juzgar(arbol: ts.SourceFile, comprobador: ts.TypeChecker, fuente: Fuente): Hallazgo[] {
  const salida: Hallazgo[] = [];
  const senalar = (nodo: ts.Node, forma: string): void => {
    const linea = arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1 + (fuente.desplazamiento ?? 0);
    salida.push({ ruta: fuente.ruta, linea, forma });
  };
  const tipoDe = (nodo: ts.Node): ts.Type => comprobador.getTypeAtLocation(nodo);

  const visitar = (nodo: ts.Node): void => {
    if (ts.isBinaryExpression(nodo) && ES_ASIGNACION(nodo.operatorToken.kind)) {
      const asignada = propiedadAsignada(nodo.left);
      if (asignada !== null && PROPIEDADES_DE_TEXTO.has(asignada.nombre) && esNodoONoSeSabe(tipoDe(asignada.de))) {
        senalar(nodo, `asigna \`${asignada.nombre}\``);
      }
    }

    if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression)) {
      const metodo = nodo.expression.name.text;
      const receptor = nodo.expression.expression;
      const sobreUnNodo = (): boolean => esNodoONoSeSabe(tipoDe(receptor));
      if (METODOS_QUE_ESCRIBEN.has(metodo) && sobreUnNodo()) senalar(nodo, `llama a \`${metodo}\``);
      if (
        METODOS_QUE_INSERTAN.has(metodo) &&
        sobreUnNodo() &&
        nodo.arguments.some((argumento) => puedeNoSerUnNodo(tipoDe(argumento)))
      ) {
        senalar(nodo, `llama a \`${metodo}\` con algo que no es un nodo`);
      }
      if (metodo === 'setAttribute' && sobreUnNodo()) {
        const [nombre] = nodo.arguments;
        // El nombre, por su TIPO: una constante `const ATRIBUTO = 'data-modo'` tiene el tipo literal
        // `'data-modo'` y se sabe cual es; un `string` cualquiera, no.
        const tipo = nombre === undefined ? undefined : tipoDe(nombre);
        const cual = tipo?.isStringLiteral() === true ? tipo.value : null;
        if (nombre !== undefined && cual === null) {
          senalar(nodo, '`setAttribute` con un nombre que no se sabe');
        } else if (cual !== null && ATRIBUTOS_DE_TEXTO.has(cual)) {
          senalar(nodo, `\`setAttribute('${cual}', …)\``);
        }
      }
    }

    if (ts.isNewExpression(nodo) && ts.isIdentifier(nodo.expression) && ['Text', 'Option'].includes(nodo.expression.text)) {
      senalar(nodo, `\`new ${nodo.expression.text}(…)\``);
    }

    ts.forEachChild(nodo, visitar);
  };

  visitar(arbol);
  return salida;
}

/**
 * Juzga `fuentes` con UN programa del compilador —los tipos de uno dependen de los otros— y devuelve
 * lo que escribe texto en la pagina fuera de React.
 */
export function textoEnElDom(fuentes: readonly Fuente[]): Hallazgo[] {
  const virtuales = new Map(fuentes.filter((f) => f.codigo !== undefined).map((f) => [f.archivo, f.codigo as string]));
  // Las opciones del compilador del proyecto, mas JavaScript para `public/`.
  const opciones = opcionesDelProyecto({ allowJs: true, checkJs: false });
  const anfitrion = ts.createCompilerHost(opciones, true);
  const leerOriginal = anfitrion.readFile.bind(anfitrion);
  const existeOriginal = anfitrion.fileExists.bind(anfitrion);
  anfitrion.readFile = (archivo) => virtuales.get(archivo) ?? leerOriginal(archivo);
  anfitrion.fileExists = (archivo) => virtuales.has(archivo) || existeOriginal(archivo);

  const programa = ts.createProgram(
    fuentes.map((f) => f.archivo),
    opciones,
    anfitrion,
  );
  const comprobador = programa.getTypeChecker();
  return fuentes.flatMap((fuente) => {
    const arbol = programa.getSourceFile(fuente.archivo);
    if (arbol === undefined) throw new Error(`El compilador no cargo ${fuente.ruta}`);
    return juzgar(arbol, comprobador, fuente);
  });
}

/** Una muestra del arbol, juzgada con el mismo programa que el portal (para sus tipos). */
export function fuenteDeMuestra(ruta: string): Fuente {
  return { ruta, archivo: join(RAIZ, ruta) };
}
