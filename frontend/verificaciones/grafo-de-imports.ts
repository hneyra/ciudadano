import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

import ts from 'typescript';

import { RAIZ } from './artboards.ts';
import { opcionesDelProyecto } from './compilador.ts';

/**
 * **El grafo de `import` del arbol, leido con el compilador** (issue 63).
 *
 * Dos guardas seguian los `import` con expresiones regulares, cada una la suya:
 * `la-demostracion-no-viaja-al-bundle.test.ts` solo veia comillas simples y solo lo que un archivo
 * importaba de primera mano, y `los-modelos-de-vista-no-traen-react.test.ts` no veia un `require` y
 * resolvia a mano, con `path.resolve`. Aqui se lee el ARBOL de cada modulo —las dos comillas, las
 * plantillas sin huecos, los comentarios fuera— y se resuelve cada especificador con
 * `ts.resolveModuleName` y las opciones de `tsconfig.json`, que es como lo resuelve `tsc`.
 *
 * <h2>Que es una importacion</h2>
 *
 *   · `import … from '…'` e `import '…'` (forma `estatica`);
 *   · `export … from '…'` (`reexporta`), que carga el modulo igual que un `import`;
 *   · `import('…')` con la ruta escrita (`dinamica`), que Vite parte en otro trozo pero sigue viajando;
 *   · `require('…')` e `import x = require('…')` (`require`).
 *
 * **`soloTipos` es solo la declaracion entera de tipos** (`import type …`, `export type … from`), que
 * el compilador borra. Un especificador de tipos suelto (`import { type A } from './a.ts'`) NO lo es:
 * con `verbatimModuleSyntax`, que este arbol pide, queda `import {} from './a.ts'`, y el modulo se
 * carga (medido con `ts.transpileModule` y con esbuild).
 *
 * <h2>Lo que NO ve</h2>
 *
 * Un `import()` o un `require()` con la ruta en una variable o en una plantilla con huecos, y los
 * `import.meta.glob` de Vite: no hay especificador que resolver.
 */

export type Forma = 'estatica' | 'reexporta' | 'dinamica' | 'require';

export interface Importacion {
  readonly especificador: string;
  readonly forma: Forma;
  /** `import type …` o `export type … from`: el compilador la borra y no carga nada. */
  readonly soloTipos: boolean;
  /** El archivo al que lleva, relativo a la raiz del frontend; `null` si es un paquete o no existe. */
  readonly archivo: string | null;
  /** El paquete, si el especificador no es una ruta: `react`, `@tanstack/react-query`. */
  readonly paquete: string | null;
  readonly linea: number;
}

let opciones: ts.CompilerOptions | undefined;
let cache: ts.ModuleResolutionCache | undefined;

/** Con JavaScript: un `.js` o un `.mjs` del arbol tambien importa. */
function resolucion(): { readonly opciones: ts.CompilerOptions; readonly cache: ts.ModuleResolutionCache } {
  opciones ??= opcionesDelProyecto({ allowJs: true });
  cache ??= ts.createModuleResolutionCache(RAIZ, (nombre) => nombre, opciones);
  return { opciones, cache };
}

const absoluta = (ruta: string) => (isAbsolute(ruta) ? ruta : join(RAIZ, ruta));

/** El nombre del paquete de un especificador que no es una ruta: `@a/b/c` → `@a/b`, `a/b` → `a`. */
function paqueteDe(especificador: string): string | null {
  if (especificador.startsWith('.') || isAbsolute(especificador)) return null;
  const trozos = especificador.split('/');
  return especificador.startsWith('@') ? trozos.slice(0, 2).join('/') : (trozos[0] ?? null);
}

/** A que archivo del arbol lleva un especificador; `null` si es de un paquete o no existe. */
function resolver(especificador: string, desde: string): string | null {
  const { opciones: o, cache: c } = resolucion();
  const resuelto = ts.resolveModuleName(especificador, desde, o, ts.sys, c).resolvedModule;
  if (resuelto !== undefined) {
    return resuelto.isExternalLibraryImport === true ? null : relative(RAIZ, resuelto.resolvedFileName);
  }
  // Lo que el compilador no resuelve —una hoja de estilos, una imagen, un `?raw`— pero existe.
  if (!especificador.startsWith('.')) return null;
  const enElDisco = resolve(dirname(desde), especificador.replace(/\?.*$/, ''));
  return existsSync(enElDisco) ? relative(RAIZ, enElDisco) : null;
}

function tipoDeGuion(ruta: string): ts.ScriptKind {
  switch (extname(ruta)) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.TS;
  }
}

/** Lo que importa un codigo, como si viviera en `ruta` (relativa a la raiz del frontend, o absoluta). */
export function importacionesDelCodigo(codigo: string, ruta: string): readonly Importacion[] {
  const desde = absoluta(ruta);
  const arbol = ts.createSourceFile(desde, codigo, ts.ScriptTarget.Latest, true, tipoDeGuion(desde));
  const salida: Importacion[] = [];
  const apuntar = (literal: ts.Node, forma: Forma, soloTipos: boolean) => {
    if (!ts.isStringLiteralLike(literal)) return;
    const especificador = literal.text;
    salida.push({
      especificador,
      forma,
      soloTipos,
      archivo: resolver(especificador, desde),
      paquete: paqueteDe(especificador),
      linea: arbol.getLineAndCharacterOfPosition(literal.getStart(arbol)).line + 1,
    });
  };
  const visitar = (nodo: ts.Node): void => {
    if (ts.isImportDeclaration(nodo)) apuntar(nodo.moduleSpecifier, 'estatica', nodo.importClause?.isTypeOnly === true);
    else if (ts.isExportDeclaration(nodo) && nodo.moduleSpecifier !== undefined) {
      apuntar(nodo.moduleSpecifier, 'reexporta', nodo.isTypeOnly);
    } else if (ts.isImportEqualsDeclaration(nodo) && ts.isExternalModuleReference(nodo.moduleReference)) {
      apuntar(nodo.moduleReference.expression, 'require', nodo.isTypeOnly);
    } else if (ts.isCallExpression(nodo) && nodo.arguments[0] !== undefined) {
      if (nodo.expression.kind === ts.SyntaxKind.ImportKeyword) apuntar(nodo.arguments[0], 'dinamica', false);
      else if (ts.isIdentifier(nodo.expression) && nodo.expression.text === 'require') {
        apuntar(nodo.arguments[0], 'require', false);
      }
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(arbol);
  return salida;
}

const leidas = new Map<string, readonly Importacion[]>();

/** Lo que importa un archivo del arbol (relativo a la raiz del frontend). */
export function importacionesDe(ruta: string): readonly Importacion[] {
  const clave = relative(RAIZ, absoluta(ruta));
  let importaciones = leidas.get(clave);
  if (importaciones === undefined) {
    importaciones = importacionesDelCodigo(readFileSync(absoluta(clave), 'utf8'), clave);
    leidas.set(clave, importaciones);
  }
  return importaciones;
}

/** Lo que se lee como codigo: el resto (JSON, estilos, imagenes) se alcanza pero no importa nada. */
const ES_CODIGO = /\.(tsx?|jsx?|mjs|cjs)$/;

/**
 * **Lo que se alcanza desde unos archivos**, siguiendo las importaciones que `seguir` acepte, cada uno
 * con el camino por el que se llega (el primero que se encuentra, a lo ancho: el mas corto).
 */
export function alcanzados(
  desde: readonly string[],
  seguir: (importacion: Importacion, de: string) => boolean,
): ReadonlyMap<string, readonly string[]> {
  const caminos = new Map<string, readonly string[]>();
  const pendientes: string[] = [];
  for (const inicio of desde) {
    const ruta = relative(RAIZ, absoluta(inicio));
    if (!caminos.has(ruta)) {
      caminos.set(ruta, [ruta]);
      pendientes.push(ruta);
    }
  }
  while (pendientes.length > 0) {
    const ruta = pendientes.shift() as string;
    if (!ES_CODIGO.test(ruta)) continue;
    for (const importacion of importacionesDe(ruta)) {
      const siguiente = importacion.archivo;
      if (siguiente === null || caminos.has(siguiente) || !seguir(importacion, ruta)) continue;
      caminos.set(siguiente, [...(caminos.get(ruta) ?? []), siguiente]);
      pendientes.push(siguiente);
    }
  }
  return caminos;
}

/** Lo que se carga al ejecutar: todo menos la declaracion entera de tipos. */
export const seCarga = (importacion: Importacion): boolean => !importacion.soloTipos;
