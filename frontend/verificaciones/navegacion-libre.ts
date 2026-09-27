import { readFileSync } from 'node:fs';

import ts from 'typescript';

/**
 * **Quien mueve el recorrido de paso por su cuenta** (issue 61).
 *
 * <h2>Por que</h2>
 *
 * Hasta el issue 61 el recorrido era una maquina de estados implicita: trece sitios de las pantallas y
 * del marco despachaban `{ tipo: 'irA', paso }` con el destino ya decidido —`Pagar.tsx` escogia entre
 * buscar y elegir, la barra de pago entre «Mis datos» y pagar, la marca entre el historial y el primer
 * paso—, y el reductor lo aceptaba sin preguntar. Desde el issue 61 cada transicion del recorrido es
 * una ACCION CON NOMBRE (`confirmarEleccion`, `volverAElegir`, `noSoyYo`…) y el destino lo decide el
 * reductor. `irA` queda para la navegacion que de verdad es libre —elegir en la franja un paso ya
 * alcanzado, o que la URL lo nombre— y el reductor la rechaza hacia un paso no alcanzable.
 *
 * Y la URL es la otra puerta (revision del PR #72): el gancho de `rutas.ts` convierte en `irA` la ruta
 * que el navegador nombre, asi que una pantalla que navegara —`useNavigate()('/pagar')`, un
 * `<Link to="/pagar">`, un `<a href="#/pagar">`— volveria a decidir el paso sin despachar nada.
 *
 * <h2>Que se senala, en el codigo de produccion de `src/`</h2>
 *
 *   · **`irA`**: un objeto literal con `tipo: 'irA'` —la clave como identificador, como cadena o
 *     calculada con una cadena (`['tipo']`); el valor como cadena, plantilla sin huecos, o con
 *     `as const` / `satisfies` / parentesis / `!` alrededor—, o un objeto literal con `tipo` (escrito
 *     como sea, tambien abreviado: `{ tipo, paso }`) Y `paso`: la unica accion que lleva un paso es
 *     `irA`, asi que un literal con los dos es una, aunque el valor de `tipo` no se vea.
 *   · **`navegar`**: importar de `react-router`/`react-router-dom` lo que navega —`useNavigate`,
 *     `Navigate`, `Link`, `NavLink`, `redirect`— (se senala el nombre importado, asi que renombrarlo no
 *     lo esconde), o llamar a un `.navigate(…)` (el del enrutador).
 *   · **`ruta`**: una cadena o plantilla sin huecos que nombre la ruta de un paso —`'/pagar'`,
 *     `'#/pagar'`, `'/pagar?x'`—, vaya a un `href`, a un `to`, a `location.hash` o a una variable.
 *     `'#/'` (los enlaces del pie) no nombra ningun paso, ni `'/pagarlo'`.
 *
 * Cada forma se permite solo en los sitios de `PERMITIDOS`, archivo por archivo y con su porque.
 *
 * <h2>Lo que NO ve, dicho</h2>
 *
 *   · **El valor partido o en una variable**: `{ tipo: IR_A }` sin `paso` al lado, `{ [clave]: … }`
 *     con una clave elegida por una variable, una ruta construida por partes (`'/' + 'pagar'`,
 *     `` `/${paso}` ``), o una accion construida por partes (`Object.assign({}, { paso }, { tipo })`).
 *   · **Un ayudante exportado desde un sitio permitido**: si `rutas.ts` exportara `irA(paso)` o
 *     `navegarA(paso)`, una pantalla que lo llamara no escribiria ninguna de las formas. Hoy `rutas.ts`
 *     exporta `RUTA_DEL_PASO`, `pasoDeLaRuta` y el gancho, que no navegan; la franja no exporta mas
 *     que su componente.
 *   · **Navegar sin el enrutador ni una cadena**: `history.back()`, `location.assign(variable)`.
 *   · **Una accion con nombre que acepte un paso como dato**: seria `irA` con otro nombre, y se veria
 *     en `AccionDelRecorrido`, que es donde se revisa.
 *   · **Las pruebas y su andamiaje** (`*.test.*`, `src/pruebas/`): una prueba lleva el recorrido a
 *     donde necesita.
 */

export type Forma = 'irA' | 'navegar' | 'ruta';

/** **Donde se permite cada forma**, archivo por archivo y con su porque. Crecerla es una decision. */
export const PERMITIDOS: Readonly<Record<string, readonly Forma[]>> = {
  // La franja: abrir un paso ya alcanzado es navegacion libre.
  'src/marco/FranjaDePasos.tsx': ['irA'],
  // La URL: atras, adelante o un enlace nombran un paso, y el recorrido lo sigue si es alcanzable. Es
  // el unico sitio que navega y el que escribe la ruta de cada paso (`RUTA_DEL_PASO`).
  'src/recorrido/rutas.ts': ['irA', 'navegar', 'ruta'],
  // A donde devuelve el emisor al navegador cuando no se guardo otro destino (`#/buscar`). No es una
  // pantalla decidiendo: es la direccion de vuelta, y al llegar la juzga el gancho como cualquier URL.
  'src/api/identidad.ts': ['ruta'],
};

/** Lo que navega, en `react-router`. */
const QUE_NAVEGA = new Set(['useNavigate', 'Navigate', 'Link', 'NavLink', 'redirect']);
const DEL_ENRUTADOR = new Set(['react-router', 'react-router-dom']);

/** La ruta de un paso: con o sin `#`, y acabada ahi o seguida de `/`, `?` o `#`. */
const RUTA_DE_UN_PASO = /^#?\/(entrar|buscar|deudas|identificar|pagar|comprobante|historial)(?=$|[/?#])/;

export interface Senal {
  readonly ruta: string;
  readonly linea: number;
  readonly forma: Forma;
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

/** El nombre de una propiedad de un literal, si se puede leer sin evaluar nada. */
function nombreDe(propiedad: ts.ObjectLiteralElementLike): string | null {
  if (ts.isShorthandPropertyAssignment(propiedad)) return propiedad.name.text;
  if (!ts.isPropertyAssignment(propiedad)) return null;
  const clave = propiedad.name;
  if (ts.isIdentifier(clave) || ts.isStringLiteralLike(clave)) return clave.text;
  if (ts.isComputedPropertyName(clave)) {
    const dentro = desenvolver(clave.expression);
    return ts.isStringLiteralLike(dentro) ? dentro.text : null;
  }
  return null;
}

/** Si el literal es una accion `irA`: `tipo: 'irA'`, o `tipo` y `paso` juntos. */
function esIrA(literal: ts.ObjectLiteralExpression): boolean {
  const nombres = new Set(literal.properties.map(nombreDe));
  if (nombres.has('tipo') && nombres.has('paso')) return true;
  return literal.properties.some((propiedad) => {
    if (!ts.isPropertyAssignment(propiedad) || nombreDe(propiedad) !== 'tipo') return false;
    const valor = desenvolver(propiedad.initializer);
    return ts.isStringLiteralLike(valor) && valor.text === 'irA';
  });
}

/** Si el especificador importa, del enrutador, algo que navega. */
function importaQueNavega(nodo: ts.ImportSpecifier): boolean {
  const declaracion = nodo.parent.parent.parent;
  if (!ts.isImportDeclaration(declaracion) || !ts.isStringLiteral(declaracion.moduleSpecifier)) return false;
  const importado = (nodo.propertyName ?? nodo.name).text;
  return DEL_ENRUTADOR.has(declaracion.moduleSpecifier.text) && QUE_NAVEGA.has(importado);
}

/** Lo que `archivo` hace para mover el recorrido de paso, linea a linea. */
export function navegaciones(ruta: string, archivo: string): Senal[] {
  const fuente = readFileSync(archivo, 'utf8');
  const tipoDeGuion = archivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const arbol = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, tipoDeGuion);
  const salida: Senal[] = [];
  const senalar = (nodo: ts.Node, forma: Forma): void => {
    salida.push({ ruta, linea: arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1, forma });
  };
  const visitar = (nodo: ts.Node): void => {
    if (ts.isObjectLiteralExpression(nodo) && esIrA(nodo)) senalar(nodo, 'irA');
    else if (ts.isImportSpecifier(nodo) && importaQueNavega(nodo)) senalar(nodo, 'navegar');
    else if (
      ts.isCallExpression(nodo) &&
      ts.isPropertyAccessExpression(nodo.expression) &&
      nodo.expression.name.text === 'navigate'
    ) {
      senalar(nodo, 'navegar');
    } else if (
      ts.isStringLiteralLike(nodo) &&
      !ts.isImportDeclaration(nodo.parent) &&
      RUTA_DE_UN_PASO.test(nodo.text)
    ) {
      senalar(nodo, 'ruta');
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(arbol);
  return salida;
}

/** Si una ruta puede usar una forma. */
export const esPermitido = ({ ruta, forma }: Pick<Senal, 'ruta' | 'forma'>): boolean =>
  (PERMITIDOS[ruta.replaceAll('\\', '/')] ?? []).includes(forma);
