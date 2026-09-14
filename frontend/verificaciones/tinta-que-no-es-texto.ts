import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

/**
 * **El token que NO es color de texto, y quien lo usa como texto.** Portado de
 * `rentas/frontend/verificaciones/tinta-que-no-es-texto.ts` (rentas#140).
 *
 * <h2>Vive aparte de su prueba, y es lo que la hace demostrable</h2>
 *
 * Una funcion pura sobre `(ruta, fuente)` se puede ejercer sobre fuentes **inventadas** —una que
 * viola la regla, otra que la cumple— sin fabricar archivos en el arbol. Lo que en
 * `verificaciones/muestras/` es un archivo, aqui es una cadena.
 *
 * <h2>Lo que cambia respecto de `rentas`: de DONDE se lee el token</h2>
 *
 * En `rentas` el nombre sale de la hoja de tokens del artboard V8, que lo escribe con la frase «NO
 * se usa como texto». `Ciudadano.dc.html` no trae hoja de tokens ni lo dice. Quien lo dice aqui es
 * **la hoja publicada de `@kamayuk/ui`** —«`--tinta-4` NO ES COLOR DE TEXTO», en la cabecera de su
 * `@theme`— y el valor que importa es el de la identidad que este portal elige: `--color-tinta-4` de
 * `[data-tema='clasico']`, `#999999`, que `estilos/clasico.css` vuelve a declarar «el trazo de un
 * icono decorativo». Escribir «tinta-4» a mano seria una copia, y el dia que la condicion se mueva a
 * otro token esta guarda seguiria vigilando el de ayer **en verde**.
 *
 * <h2>Por que hace falta un arbol de sintaxis y no basta un `grep`</h2>
 *
 * Porque la regla no es «no escribas esta clase»: es «no la escribas sobre algo que se lee». Los
 * usos legitimos existen —el trazo de un icono, el separador de una miga— y todos llevan
 * `aria-hidden`. Con el arbol, la clase se sigue hasta el elemento sobre el que cae.
 *
 * <h2>Y por que es CERRADA: lo que no se puede demostrar, se senala</h2>
 *
 * Una clase que no cuelga de un `className` no permite saber sobre que elemento cae, y eso no se
 * deja pasar. Abierta, bastaria sacar la cadena del JSX para que la guarda dejara de verla.
 */

/** Un token que NO se usa como texto, con la clase que lo pinta. */
export interface TokenQueNoEsTexto {
  /** El nombre del token, sin los dos guiones ni el prefijo de Tailwind: `tinta-4`. */
  readonly token: string;
  /** Su valor en la identidad: `#999999`. */
  readonly valor: string;
  /** La utilidad de Tailwind que lo aplica como color de texto: `text-tinta-4`. */
  readonly clase: string;
  /** La frase de la hoja que lo declara. Es la que se cita en el rojo. */
  readonly porQue: string;
}

/** Los bloques de comentario de una hoja de CSS, con sus saltos de linea. */
const comentariosDe = (hoja: string): string[] =>
  [...hoja.matchAll(/\/\*([\s\S]*?)\*\//g)].map(([, cuerpo]) => cuerpo ?? '');

/**
 * Los tokens que la hoja declara que NO son color de texto, con su valor en `paleta`.
 *
 * Se buscan por la frase —«`--x` NO ES COLOR DE TEXTO»— y no por el nombre del token, y se toma el
 * NOMBRE que va pegado a la frase: la cabecera de la hoja nombra muchos otros tokens, y cogerlos
 * todos haria prohibir `text-azul`. Devuelve una lista: si la hoja declarara dos, se vigilan los
 * dos, y si no declara ninguno el centinela se entera.
 *
 * Un token que la frase nombra y la paleta no declara NO se descarta en silencio: sale con valor
 * vacio y el centinela lo dice.
 */
export function losQueNoSonTexto(hoja: string, paleta: ReadonlyMap<string, string>): TokenQueNoEsTexto[] {
  const salida: TokenQueNoEsTexto[] = [];
  for (const comentario of comentariosDe(hoja)) {
    for (const coincidencia of comentario.matchAll(
      /`--([a-z0-9-]+)`\s+NO ES COLOR DE TEXTO\s*-*\s*([\s\S]*?)(?=\n\s*\n|\n\s*={5,}|$)/gi,
    )) {
      const nombre = (coincidencia[1] ?? '').toLowerCase();
      salida.push({
        token: nombre,
        valor: (paleta.get(`--color-${nombre}`) ?? '').toLowerCase(),
        clase: `text-${nombre}`,
        porQue: `\`--${nombre}\` NO ES COLOR DE TEXTO. ${(coincidencia[2] ?? '').replace(/\s+/g, ' ').trim()}`,
      });
    }
  }
  return salida;
}

/** Un uso de la clase que no se pudo demostrar decorativo, con donde esta y por que no vale. */
export interface Hallazgo {
  readonly ruta: string;
  readonly linea: number;
  /** El elemento sobre el que cae la clase, o lo que se encontro en su lugar. */
  readonly sobre: string;
  readonly porQue: string;
}

/**
 * Una cadena de clases usa la utilidad, mirando token a token.
 *
 * Se compara el token ENTERO tras quitarle sus variantes —`hover:`, `md:`, `[&>button]:`— porque
 * `includes` daria por usado `text-tinta-4` dentro de `text-tinta-40` y dentro de cualquier
 * comentario que la nombre.
 */
export function usaLaClase(texto: string, clase: string): boolean {
  return texto
    .split(/\s+/)
    .some((token) => token.slice(token.lastIndexOf(':') + 1) === clase);
}

/** Las cadenas literales de un arbol: comillas y plantillas. El texto JSX no, que es prosa. */
function esCadena(nodo: ts.Node): nodo is ts.StringLiteralLike | ts.TemplateLiteralToken {
  return (
    ts.isStringLiteral(nodo) ||
    ts.isNoSubstitutionTemplateLiteral(nodo) ||
    ts.isTemplateHead(nodo) ||
    ts.isTemplateMiddle(nodo) ||
    ts.isTemplateTail(nodo)
  );
}

/** El `JsxAttribute` del que cuelga una cadena, o `null` si no cuelga de ninguno. */
function atributoQueLaLleva(nodo: ts.Node): ts.JsxAttribute | null {
  for (let actual: ts.Node | undefined = nodo.parent; actual !== undefined; actual = actual.parent) {
    if (ts.isJsxAttribute(actual)) return actual;
    if (ts.isSourceFile(actual)) return null;
  }
  return null;
}

/**
 * El elemento lleva `aria-hidden`, y no puesto en `false`.
 *
 * Un `{...resto}` no cuenta como prueba de nada: puede traerlo o no, y no se sabe hasta ejecutar.
 * Sin `aria-hidden` escrito, el elemento se senala — que es la mitad cerrada de esta guarda.
 */
function estaOculto(apertura: ts.JsxOpeningLikeElement): boolean {
  for (const propiedad of apertura.attributes.properties) {
    if (!ts.isJsxAttribute(propiedad)) continue;
    if (propiedad.name.getText() !== 'aria-hidden') continue;

    const valor = propiedad.initializer;
    // `aria-hidden` a secas es `true` en JSX.
    if (valor === undefined) return true;
    if (ts.isStringLiteral(valor)) return valor.text !== 'false';
    if (ts.isJsxExpression(valor) && valor.expression !== undefined) {
      return valor.expression.kind !== ts.SyntaxKind.FalseKeyword;
    }
    return true;
  }
  return false;
}

/**
 * Los usos de la clase en un archivo que NO se pudo demostrar que sean decorativos.
 *
 * `ruta` entra como dato y no se lee del disco: es lo que permite ejercerla sobre una fuente
 * inventada.
 */
export function hallazgosDe(ruta: string, fuente: string, clase: string): Hallazgo[] {
  const arbol = ts.createSourceFile(
    ruta,
    fuente,
    ts.ScriptTarget.Latest,
    // `setParentNodes`: sin esto no hay `.parent` que subir, y toda la guarda se queda muda.
    true,
    ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const salida: Hallazgo[] = [];
  const enLinea = (nodo: ts.Node): number =>
    arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1;

  const visitar = (nodo: ts.Node): void => {
    if (esCadena(nodo) && usaLaClase(nodo.text, clase)) {
      const atributo = atributoQueLaLleva(nodo);

      if (atributo === null) {
        salida.push({
          ruta,
          linea: enLinea(nodo),
          sobre: '(ningun elemento)',
          porQue:
            'la clase no cuelga de ningun `className`, asi que no hay elemento del que decir si ' +
            'es decorativo',
        });
      } else if (atributo.name.getText() !== 'className') {
        salida.push({
          ruta,
          linea: enLinea(nodo),
          sobre: `el atributo «${atributo.name.getText()}»`,
          porQue:
            'la clase viaja en un atributo que no es `className`, asi que no se sabe sobre que ' +
            'elemento cae',
        });
      } else {
        const apertura = atributo.parent.parent;
        if (!estaOculto(apertura)) {
          salida.push({
            ruta,
            linea: enLinea(nodo),
            sobre: `<${apertura.tagName.getText()}>`,
            porQue: 'el elemento no lleva `aria-hidden`, o sea que lo que pinta se lee',
          });
        }
      }
    }
    ts.forEachChild(nodo, visitar);
  };

  visitar(arbol);
  return salida;
}

/** Los `.ts` y `.tsx` de un arbol, sin pruebas: una prueba no pinta nada. */
export function archivosDeInterfaz(raiz: string): string[] {
  return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(raiz, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === 'node_modules' ? [] : archivosDeInterfaz(ruta);
    }
    if (!/\.tsx?$/.test(entrada.name) || entrada.name.includes('.test.')) return [];
    return [ruta];
  });
}
