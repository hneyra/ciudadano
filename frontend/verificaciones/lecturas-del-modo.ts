import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

import { RAIZ } from './artboards.ts';

/**
 * **Quien lee el modo —demostracion o plataforma— fuera del modulo que lo define** (issue 59).
 *
 * <h2>Que es «leer el modo»</h2>
 *
 * Hasta el issue 59 el modo era un booleano repartido: `conPlataforma` aparecia 57 veces en el codigo
 * de produccion y `hayPlataforma` 17, se leia de dos sitios (el estado y la fuente) y se resolvia de
 * tres formas. Desde entonces el modo es una union discriminada (`Modo`, en `src/modo/modo.ts`), y
 * lo que las pantallas preguntan es la POLITICA del modo (`useModo()`), no el modo. Esta guarda
 * senala, en el codigo de produccion de fuera de `src/modo/`:
 *
 *   1. **Los nombres del booleano**, `conPlataforma` y `hayPlataforma`, en cualquier papel: variable,
 *      propiedad, parametro, funcion, y como cadena (`estado['conPlataforma']`). Volver a escribirlos
 *      es volver a repartir el modo.
 *   2. **Una propiedad de una variante del modo**, leida de cualquier forma: por punto
 *      (`fuente.modo`), por corchete con una cadena (`fuente['modo']`), al desestructurar
 *      (`const { modo } = fuente`) o preguntando si esta (`'consulta' in fuente`). Las variantes son
 *      las interfaces de `VARIANTES`, y la propiedad se reconoce por DONDE esta declarada —con los
 *      tipos del compilador—, no por su nombre: `const { modo } = useTema()` (claro u oscuro) es otra
 *      cosa y no se senala.
 *
 * Escribir el modo no es leerlo: `modo: 'demostracion'` en el objeto de una fuente es una asignacion
 * de propiedad en un literal, y no se senala. Tampoco preguntar a la politica (`politica.pagoSimulado`):
 * es lo que se pide.
 *
 * <h2>Lo que NO ve, dicho</h2>
 *
 *   · **Un sustituto del modo hecho con otro dato**: `estado.demostracion !== null` dice lo mismo que
 *     «estoy en demostracion». Con la fuente como union ya no puede ser `null` en demostracion, pero
 *     la pregunta se puede seguir haciendo asi; esta guarda no lo distingue de leer el dato.
 *   · **Lo que se hace por reflexion**: `Reflect.get(fuente, 'modo')`, una clave elegida con una
 *     variable (`fuente[clave]`), `Object.values(fuente)`.
 *   · **Las pruebas y su andamiaje** (`*.test.*`, `src/pruebas/`): una prueba construye estados de un
 *     modo o del otro a proposito.
 */

/** El modulo que define el modo: lo unico que puede leerlo. */
export const MODULO_DEL_MODO = 'src/modo/';

/** Los nombres del booleano que el issue 59 retiro. */
export const NOMBRES_DEL_BOOLEANO: ReadonlySet<string> = new Set(['conPlataforma', 'hayPlataforma']);

/**
 * Las interfaces que son VARIANTES del modo: sus propiedades propias —el discriminante `modo`, los
 * datos de la demostracion, la consulta de la plataforma— solo se leen en `src/modo/`.
 */
export const VARIANTES: ReadonlySet<string> = new Set([
  'EnDemostracion',
  'ConPlataforma',
  'FuenteDeDemostracion',
  'FuenteConPlataforma',
]);

export interface Lectura {
  readonly ruta: string;
  readonly linea: number;
  readonly forma: string;
}

/** Un archivo a juzgar: su ruta relativa, para el informe, y la absoluta, para el compilador. */
export interface Archivo {
  readonly ruta: string;
  readonly archivo: string;
}

function recorrer(desde: string): string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return entrada === 'pruebas' ? [] : recorrer(ruta);
    return /\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada) ? [ruta] : [];
  });
}

/** El codigo de produccion de `src/`: sin pruebas ni su andamiaje. El modulo del modo, INCLUIDO. */
export function archivosDelPortal(): Archivo[] {
  return recorrer(join(RAIZ, 'src')).map((archivo) => ({ ruta: relative(RAIZ, archivo), archivo }));
}

/** Una muestra del arbol, juzgada con el mismo programa que el portal (para sus tipos). */
export function archivoDeMuestra(ruta: string): Archivo {
  return { ruta, archivo: join(RAIZ, ruta) };
}

function opciones(): ts.CompilerOptions {
  const leido = ts.getParsedCommandLineOfConfigFile(join(RAIZ, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  if (leido === undefined) throw new Error('No se pudo leer tsconfig.json');
  return { ...leido.options, noEmit: true };
}

/** Si alguna declaracion del simbolo es una propiedad de una de las `VARIANTES`. */
function esDeUnaVariante(simbolo: ts.Symbol | undefined): boolean {
  return (simbolo?.declarations ?? []).some((declaracion) => {
    const padre = declaracion.parent;
    return ts.isInterfaceDeclaration(padre) && VARIANTES.has(padre.name.text);
  });
}

/**
 * Si `nombre` es una propiedad de una variante en `tipo`. Una union se mira miembro por miembro: la
 * propiedad de una sola variante (`consulta`) no es propiedad de la union, y `'consulta' in fuente`
 * es justo como se pregunta por ella.
 */
function tipoConPropiedadDeUnaVariante(tipo: ts.Type, nombre: string): boolean {
  const miembros = tipo.isUnion() || tipo.isIntersection() ? tipo.types : [tipo];
  return miembros.some((miembro) => esDeUnaVariante(miembro.getProperty(nombre)));
}

function juzgar(arbol: ts.SourceFile, comprobador: ts.TypeChecker, ruta: string): Lectura[] {
  const salida: Lectura[] = [];
  const senalar = (nodo: ts.Node, forma: string): void => {
    const linea = arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1;
    salida.push({ ruta, linea, forma });
  };

  const visitar = (nodo: ts.Node): void => {
    if ((ts.isIdentifier(nodo) || ts.isStringLiteralLike(nodo)) && NOMBRES_DEL_BOOLEANO.has(nodo.text)) {
      senalar(nodo, `el booleano \`${nodo.text}\``);
    } else if (ts.isPropertyAccessExpression(nodo)) {
      const simbolo = comprobador.getSymbolAtLocation(nodo.name);
      if (
        esDeUnaVariante(simbolo) ||
        tipoConPropiedadDeUnaVariante(comprobador.getTypeAtLocation(nodo.expression), nodo.name.text)
      ) {
        senalar(nodo, `lee \`.${nodo.name.text}\` de una variante del modo`);
      }
    } else if (ts.isElementAccessExpression(nodo) && ts.isStringLiteralLike(nodo.argumentExpression)) {
      const nombre = nodo.argumentExpression.text;
      if (tipoConPropiedadDeUnaVariante(comprobador.getTypeAtLocation(nodo.expression), nombre)) {
        senalar(nodo, `lee \`['${nombre}']\` de una variante del modo`);
      }
    } else if (ts.isBindingElement(nodo) && ts.isObjectBindingPattern(nodo.parent)) {
      const clave = nodo.propertyName ?? nodo.name;
      const nombre = ts.isIdentifier(clave) || ts.isStringLiteralLike(clave) ? clave.text : null;
      if (nombre !== null && tipoConPropiedadDeUnaVariante(comprobador.getTypeAtLocation(nodo.parent), nombre)) {
        senalar(nodo, `desestructura \`${nombre}\` de una variante del modo`);
      }
    } else if (
      ts.isBinaryExpression(nodo) &&
      nodo.operatorToken.kind === ts.SyntaxKind.InKeyword &&
      ts.isStringLiteralLike(nodo.left)
    ) {
      const nombre = nodo.left.text;
      if (tipoConPropiedadDeUnaVariante(comprobador.getTypeAtLocation(nodo.right), nombre)) {
        senalar(nodo, `pregunta \`'${nombre}' in …\` a una variante del modo`);
      }
    }
    ts.forEachChild(nodo, visitar);
  };

  visitar(arbol);
  return salida;
}

/**
 * Las lecturas del modo en `archivos`, con UN programa del compilador —los tipos de uno dependen de
 * los otros—. Devuelve TODAS, tambien las de `src/modo/`: que esas sean las permitidas lo decide la
 * prueba, a la vista.
 */
export function lecturasDelModo(archivos: readonly Archivo[]): Lectura[] {
  const programa = ts.createProgram(
    archivos.map((a) => a.archivo),
    opciones(),
  );
  const comprobador = programa.getTypeChecker();
  return archivos.flatMap(({ ruta, archivo }) => {
    const arbol = programa.getSourceFile(archivo);
    if (arbol === undefined) throw new Error(`El compilador no cargo ${ruta}`);
    return juzgar(arbol, comprobador, ruta);
  });
}

/** Si una ruta es del modulo que define el modo. */
export const esDelModulo = (ruta: string): boolean => ruta.replaceAll('\\', '/').startsWith(MODULO_DEL_MODO);
