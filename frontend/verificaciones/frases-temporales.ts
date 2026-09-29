import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from 'typescript';

import { RAIZ } from './artboards.ts';

/**
 * **Las frases temporales de los comentarios** (issue 64): quien juzga para
 * `sin-frases-temporales.test.ts`.
 *
 * Un comentario que dice «hoy», «todavia» o «ya no» describe el arbol del dia en que se escribio, y
 * el dia siguiente puede ser falso sin que nada se ponga rojo. Lo operativo se escribe en presente o
 * sin tiempo; la historia (que se midio, que se descarto) va a `docs/adr/`.
 *
 * <h2>Como se leen los comentarios</h2>
 *
 * Con el analizador de TypeScript, no con una expresion regular sobre el texto: el comentario es la
 * trivia que precede a cada token, asi que una frase dentro de una cadena, una plantilla o el texto de
 * un JSX no es un comentario y no se mira. El texto de un `JsxText` no se lee como trivia: ahi `//` es
 * texto de la pagina.
 *
 * <h2>Lo que NO ve</h2>
 *
 * Lo que no es un comentario de `.ts`/`.tsx`: los `.md`, `CLAUDE.md`, las cadenas (los nombres de las
 * pruebas incluidos) y los archivos de fuera de los directorios que se le pasan.
 */

/** Un comentario, con la linea donde empieza (desde 1) y su texto entero, marcas incluidas. */
export interface Comentario {
  readonly linea: number;
  readonly texto: string;
}

/** Una frase temporal encontrada en un comentario. */
export interface FraseTemporal {
  readonly ruta: string;
  /** La linea del archivo donde esta la frase, no donde empieza el comentario. */
  readonly linea: number;
  /** La frase, por su nombre en `FRASES` (sin tilde y en minusculas: «Todavía» es `todavia`). */
  readonly frase: string;
}

/** Letra o cifra de cualquier alfabeto: lo que hace que una frase sea parte de otra palabra. */
const NO_ES_BORDE = '[\\p{L}\\p{N}_]';

/**
 * Lo que sigue a «aun» (sin tilde) cuando significa «incluso» y no «todavia». Sin tilde, «aun» es
 * «incluso» en la norma; pero este arbol escribe sin tildes, asi que tambien puede ser «todavia». Se
 * senala salvo delante de estas palabras, que solo admiten la lectura de «incluso» («aun asi», «aun
 * cuando», «aun si», «aun mas»). «Aun sin» o «aun con» admiten las dos, y se senalan: se reescriben.
 */
export const AUN_QUE_ES_INCLUSO = ['asi', 'así', 'cuando', 'si', 'mas', 'más'] as const;

/**
 * Las frases que se senalan, cada una con su nombre y su expresion. Sin distinguir mayusculas, y
 * enteras: «hoyo», «ahoy» o «yano» no son la frase.
 */
export const FRASES: readonly { readonly frase: string; readonly patron: RegExp }[] = [
  { frase: 'hoy', patron: entera('hoy') },
  { frase: 'todavia', patron: entera('todav[ií]a') },
  { frase: 'ya no', patron: entera('ya\\s+no') },
  { frase: 'esta entrega', patron: entera('esta\\s+entrega') },
  { frase: 'por ahora', patron: entera('por\\s+ahora') },
  { frase: 'de momento', patron: entera('de\\s+momento') },
  { frase: 'aun', patron: entera('aún') },
  // «ni aun» es «ni siquiera»: por eso el «ni» delante tambien lo exime.
  {
    frase: 'aun',
    patron: new RegExp(
      `(?<!${NO_ES_BORDE})(?<!\\bni\\s+)aun(?!${NO_ES_BORDE})(?!\\s+(?:${AUN_QUE_ES_INCLUSO.join('|')})(?!${NO_ES_BORDE}))`,
      'giu',
    ),
  },
];

function entera(cuerpo: string): RegExp {
  return new RegExp(`(?<!${NO_ES_BORDE})${cuerpo}(?!${NO_ES_BORDE})`, 'giu');
}

/**
 * Los comentarios de un archivo, en el orden en que aparecen.
 *
 * Se recorren TODOS los nodos y tokens del arbol y se pide la trivia que precede a cada uno: la de
 * un token es todo lo que hay entre el anterior y el, asi que juntas cubren el archivo entero. Se
 * deduplican por posicion (un nodo y su primer token empiezan en el mismo sitio).
 */
export function comentariosDe(ruta: string, texto: string): Comentario[] {
  const tipo = ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const fuente = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true, tipo);
  // Donde empieza un texto de JSX no hay trivia que leer: `<p>// hola</p>` es texto de la pagina.
  const textosDeJsx = new Set<number>();
  const nodos: ts.Node[] = [];
  const recoger = (nodo: ts.Node): void => {
    nodos.push(nodo);
    if (nodo.kind === ts.SyntaxKind.JsxText) textosDeJsx.add(nodo.pos);
    for (const hijo of nodo.getChildren(fuente)) recoger(hijo);
  };
  recoger(fuente);
  const vistos = new Map<number, ts.CommentRange>();
  for (const nodo of nodos) {
    // La trivia «de delante» empieza a contar tras el primer salto de linea; lo que queda en la misma
    // linea del token anterior es trivia «de detras» de ese token. Con las dos se cubre todo.
    const delante = textosDeJsx.has(nodo.pos) ? [] : (ts.getLeadingCommentRanges(texto, nodo.pos) ?? []);
    const detras = textosDeJsx.has(nodo.end) ? [] : (ts.getTrailingCommentRanges(texto, nodo.end) ?? []);
    for (const rango of [...delante, ...detras]) vistos.set(rango.pos, rango);
  }
  // Los `//` de lineas seguidas son UN comentario: «y aun» al final de una y «asi» al principio de la
  // siguiente se leen juntos, como se leerian en un bloque.
  const juntos: { pos: number; end: number; deLinea: boolean }[] = [];
  for (const rango of [...vistos.values()].sort((a, b) => a.pos - b.pos)) {
    const deLinea = rango.kind === ts.SyntaxKind.SingleLineCommentTrivia;
    const anterior = juntos.at(-1);
    if (anterior?.deLinea === true && deLinea && /^[ \t]*\r?\n[ \t]*$/.test(texto.slice(anterior.end, rango.pos))) {
      anterior.end = rango.end;
    } else {
      juntos.push({ pos: rango.pos, end: rango.end, deLinea });
    }
  }
  return juntos.map((rango) => ({
    linea: fuente.getLineAndCharacterOfPosition(rango.pos).line + 1,
    texto: texto.slice(rango.pos, rango.end),
  }));
}

/**
 * Las frases temporales del texto de un comentario, con la linea (relativa, desde 0) donde empieza
 * cada una.
 *
 * Las lineas se juntan antes de buscar, sin el `*` o el `//` con que empieza cada una: «ya» al final
 * de una linea y «no» al principio de la siguiente siguen siendo «ya no».
 */
export function frasesDe(texto: string): { desplazamiento: number; frase: string }[] {
  const inicios: number[] = [];
  let junto = '';
  texto.split('\n').forEach((linea, i) => {
    const limpia = i === 0 ? linea : linea.replace(/^\s*(?:\*(?!\/)|\/\/)?/, '');
    if (i > 0) junto += ' ';
    inicios.push(junto.length);
    junto += limpia;
  });
  const lineaDe = (indice: number): number => inicios.filter((inicio) => inicio <= indice).length - 1;
  return FRASES.flatMap(({ frase, patron }) =>
    [...junto.matchAll(patron)].map((casa) => ({ desplazamiento: lineaDe(casa.index), frase })),
  ).sort((a, b) => a.desplazamiento - b.desplazamiento);
}

/** Las frases temporales de los comentarios de un archivo. */
export function frasesTemporalesDe(ruta: string, texto: string): FraseTemporal[] {
  return comentariosDe(ruta, texto).flatMap((comentario) =>
    frasesDe(comentario.texto).map(({ desplazamiento, frase }) => ({
      ruta,
      linea: comentario.linea + desplazamiento,
      frase,
    })),
  );
}

/** Los `.ts`/`.tsx` de un directorio del frontend, pruebas incluidas, con su ruta relativa y `/`. */
export function archivosDe(directorio: string): string[] {
  return readdirSync(join(RAIZ, directorio))
    .sort()
    .flatMap((entrada) => {
      const ruta = join(directorio, entrada);
      if (statSync(join(RAIZ, ruta)).isDirectory()) return archivosDe(ruta);
      return /\.tsx?$/.test(entrada) && !entrada.endsWith('.d.ts') ? [relative('.', ruta).split(sep).join('/')] : [];
    });
}

/** Las frases temporales de los comentarios de varios archivos del frontend. */
export function frasesTemporales(rutas: readonly string[]): FraseTemporal[] {
  return rutas.flatMap((ruta) => frasesTemporalesDe(ruta, readFileSync(join(RAIZ, ruta), 'utf8')));
}
