import { readFileSync } from 'node:fs';

import ts from 'typescript';

/**
 * **Quien despacha `irA`, la navegacion libre del recorrido** (issue 61).
 *
 * <h2>Por que</h2>
 *
 * Hasta el issue 61 el recorrido era una maquina de estados implicita: trece sitios de las pantallas y
 * del marco despachaban `{ tipo: 'irA', paso }` con el destino ya decidido —`Pagar.tsx` escogia entre
 * buscar y elegir, la barra de pago entre «Mis datos» y pagar, la marca entre el historial y el primer
 * paso—, y el reductor lo aceptaba sin preguntar. Desde el issue 61 cada transicion del recorrido es
 * una ACCION CON NOMBRE (`confirmarEleccion`, `volverAElegir`, `irAlInicio`…) y el destino lo decide el
 * reductor. `irA` queda para la navegacion que de verdad es libre —elegir en la franja un paso ya
 * alcanzado, o que la URL lo nombre— y el reductor la rechaza hacia un paso no alcanzable.
 *
 * <h2>Que se senala</h2>
 *
 * En el codigo de produccion de `src/`, **un objeto literal con `tipo: 'irA'`** fuera de los sitios
 * de `PERMITIDOS`. Se reconoce por la forma del literal y no por la llamada: da igual que vaya directo
 * a `despachar(…)`, a una constante o a una funcion que lo devuelva. Se ve la clave escrita como
 * identificador o como cadena (`'tipo'`), y el valor como cadena, plantilla sin huecos o con
 * `as const` / `satisfies` / parentesis alrededor.
 *
 * <h2>Lo que NO ve, dicho</h2>
 *
 *   · **El valor partido o en una variable**: `{ tipo: IR_A }`, `{ tipo: \`ir${'A'}\` }`, o una accion
 *     construida por partes (`Object.assign({}, { paso }, { tipo })`).
 *   · **Una pantalla que decida el destino y lo pase a una accion con nombre** que lo acepte como dato:
 *     no hay ninguna, y una accion con `paso` en su carga seria `irA` con otro nombre —lo diria su
 *     tipo en `AccionDelRecorrido`, que es donde se revisa—.
 *   · **Las pruebas y su andamiaje** (`*.test.*`, `src/pruebas/`): una prueba lleva el recorrido a
 *     donde necesita.
 */

/**
 * **Donde se permite despachar `irA`**, archivo por archivo y con su porque. Crecerla es una decision.
 */
export const PERMITIDOS: Readonly<Record<string, string>> = {
  'src/marco/FranjaDePasos.tsx': 'la franja: abrir un paso ya alcanzado es navegacion libre',
  'src/recorrido/rutas.ts': 'la URL: atras, adelante o un enlace nombran un paso, y el recorrido lo sigue si es alcanzable',
};

export interface Senal {
  readonly ruta: string;
  readonly linea: number;
}

/** Quita lo que envuelve a una expresion sin cambiar su valor: parentesis, `as`, `satisfies`, `!`. */
function desenvolver(nodo: ts.Expression): ts.Expression {
  let actual = nodo;
  while (
    ts.isParenthesizedExpression(actual) ||
    ts.isAsExpression(actual) ||
    ts.isSatisfiesExpression(actual) ||
    ts.isNonNullExpression(actual) ||
    ts.isTypeAssertionExpression(actual)
  ) {
    actual = actual.expression;
  }
  return actual;
}

/** Si el literal lleva `tipo: 'irA'`. */
function esIrA(literal: ts.ObjectLiteralExpression): boolean {
  return literal.properties.some((propiedad) => {
    if (!ts.isPropertyAssignment(propiedad)) return false;
    const clave = propiedad.name;
    const nombre = ts.isIdentifier(clave) || ts.isStringLiteralLike(clave) ? clave.text : null;
    if (nombre !== 'tipo') return false;
    const valor = desenvolver(propiedad.initializer);
    return ts.isStringLiteralLike(valor) && valor.text === 'irA';
  });
}

/** Las lineas de `archivo` con un objeto literal `tipo: 'irA'`. */
export function despachosDeIrA(ruta: string, archivo: string): Senal[] {
  const arbol = ts.createSourceFile(archivo, readFileSync(archivo, 'utf8'), ts.ScriptTarget.Latest, true);
  const salida: Senal[] = [];
  const visitar = (nodo: ts.Node): void => {
    if (ts.isObjectLiteralExpression(nodo) && esIrA(nodo)) {
      salida.push({ ruta, linea: arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1 });
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(arbol);
  return salida;
}

/** Si una ruta puede despachar `irA`. */
export const esPermitido = (ruta: string): boolean => Object.hasOwn(PERMITIDOS, ruta.replaceAll('\\', '/'));
