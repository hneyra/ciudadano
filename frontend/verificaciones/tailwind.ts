import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile } from 'tailwindcss';

import { RAIZ } from './artboards.ts';
import { resolverPorExports } from './especificadores.ts';

/**
 * Lo que las guardas de Tailwind necesitan saber de `@kamayuk/ui`, alcanzado por el enlace, y el
 * compilador con que se mide lo que de verdad se emite.
 *
 * Portado de `rentas/frontend/verificaciones/tailwind.ts`. En el issue 1 entro solo la raiz del
 * paquete, la lista de sus componentes y la lectura de los `@source`; el compilador y el lector de
 * reglas entran con el tema (issue 2), que es cuando los usan `tailwind-emite-las-clases` y la
 * paleta contra el artboard.
 *
 * <h2>Lo que cambia respecto de `rentas`: se compila LA HOJA DE LA APLICACION</h2>
 *
 * En `rentas` se compila la hoja de `@kamayuk/ui`. Aqui la que se compila por omision es
 * `src/estilos.css`, que es la que Vite empaqueta: importa la de la libreria **y** declara la capa
 * `base` con los estilos globales del artboard. Compilar solo la de la libreria dejaria esa capa
 * sin medir, y un `@apply` o un `var(--color-…)` mal escrito ahi solo se veria en el navegador.
 */

const requerir = createRequire(import.meta.url);

/**
 * La raiz de `@kamayuk/ui`, alcanzada POR EL ENLACE y no por una ruta al clon hermano.
 *
 * Es una raiz —y no un especificador— porque lo que cuelga de ella es una BUSQUEDA: los `.tsx` de la
 * libreria, que Tailwind tiene que leer. Un paquete no publica «todos sus componentes» por su
 * `exports`, asi que no hay especificador que pedir.
 */
export const RAIZ_DE_UI = dirname(requerir.resolve('@kamayuk/ui'));

/** La hoja que `main.tsx` importa y Vite empaqueta. */
export const HOJA_DE_LA_APLICACION = join(RAIZ, 'src', 'estilos.css');

/** Todos los `.tsx` de un arbol, sin pruebas. */
export function fuentesDe(raiz: string): string[] {
  return readdirSync(raiz, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(raiz, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : fuentesDe(ruta);
    if (!e.name.endsWith('.tsx') || e.name.includes('.test.')) return [];
    return [ruta];
  });
}

/**
 * Las rutas que los `@source` de una hoja nombran, en orden.
 *
 * Los comentarios se quitan antes, por lo mismo que en `especificadores.ts`: una hoja que explica
 * en un comentario lo que hace el `@source` no declara nada.
 */
export function fuentesDeclaradas(css: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...sinComentarios.matchAll(/@source\s+['"]([^'"]+)['"]/g)].map(([, ruta]) => ruta ?? '');
}

/**
 * Donde esta, en el disco, lo que un `@import` nombra.
 *
 * `tailwindcss` es su `index.css`, como en `rentas`. Un especificador de paquete —el
 * `@kamayuk/ui/estilos.css` de la hoja de la aplicacion— se resuelve **por el `exports`**, que es la
 * puerta por la que pasa el empaquetador (rentas#138). Lo relativo cuelga de la hoja que lo escribe.
 */
function rutaDelImport(id: string, desde: string): string {
  if (id === 'tailwindcss') return requerir.resolve('tailwindcss/index.css');
  if (id.startsWith('.') || id.startsWith('/')) return join(desde, id);
  return resolverPorExports(requerir, id);
}

/**
 * El CSS que Tailwind emite para la lista de clases que se le den.
 *
 * <h2>El `base` sale de LA HOJA, y no del paquete (rentas#125)</h2>
 *
 * Un `@import "./temas.css"` escrito dentro de `estilos/estilos.css` es `estilos/temas.css`: el
 * empaquetador lo resuelve relativo al archivo que lo escribe, y eso es lo que el navegador recibe.
 * Con otro `base` se compilaria una hoja que no es la que se sirve, y en silencio.
 */
export async function compilar(
  clases: readonly string[],
  hoja: string = HOJA_DE_LA_APLICACION,
): Promise<string> {
  const compilado = await compile(readFileSync(hoja, 'utf8'), {
    base: dirname(hoja),
    loadStylesheet: (id: string, desde: string) => {
      const ruta = rutaDelImport(id, desde);
      return Promise.resolve({
        path: ruta,
        // El `base` de la importada es SU directorio: un `@import` escrito dentro de ella cuelga
        // de donde ella esta y no de donde esta la primera.
        base: dirname(ruta),
        content: readFileSync(ruta, 'utf8'),
      });
    },
  });
  return compilado.build([...clases]);
}

/**
 * Las clases que un archivo usa, sacadas de sus `className` **literales** y de sus cadenas sueltas.
 *
 * Solo literales: una interpolacion no se puede resolver sin ejecutar el componente, y adivinarla
 * daria falsos rojos sobre clases que nadie escribio.
 */
export function clasesDe(fuente: string): string[] {
  const salida = new Set<string>();
  for (const [, dobles, plantilla, simples] of fuente.matchAll(
    /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g,
  )) {
    for (const t of (dobles ?? plantilla ?? simples ?? '').split(/\s+/)) if (esUtilidad(t)) salida.add(t);
  }
  for (const [, cadena] of fuente.matchAll(/'([^'\n]*)'/g)) {
    for (const t of (cadena ?? '').split(/\s+/)) if (esUtilidad(t)) salida.add(t);
  }
  return [...salida];
}

/**
 * Los prefijos que Tailwind genera y que estas piezas usan.
 *
 * Lista de inclusion, como en `rentas`: peca de corta y no de larga. Una utilidad nueva que no
 * este aqui no se comprueba, pero ninguna cadena ajena —una ruta, un identificador— se cuela.
 * `leading`, `font`, `min-h`, `px`, `py` y `gap` se anaden a la de `rentas` porque el marcador los
 * escribe y alli no los escribia nadie fuera del interprete.
 */
const PREFIJOS =
  /^(?:-?(?:bg|text|border|rounded|ring|shadow|fill|stroke|outline|from|via|to|accent|caret|divide|placeholder|decoration|leading|font|min-h|px|py|gap|h|w)-|(?:hover|focus|focus-visible|active|disabled|data-\[[^\]]+\]|aria-\w+|group-hover|peer-focus|print|sm|md|lg|xl):)/;

function esUtilidad(token: string): boolean {
  if (token === '' || token.length > 80) return false;
  if (/[^A-Za-z0-9_:\-[\]().,%#/\\&>*+~=@'"]/.test(token)) return false;
  return PREFIJOS.test(token);
}

/**
 * **Leer el CSS EMITIDO por reglas, y no por `includes` sobre todo el texto** (rentas#139).
 *
 * `includes` responde «¿existe esto en alguna parte?», y esa no es la pregunta: `temas.css` repite
 * los valores de cada paleta fuera de toda capa, asi que un hexadecimal aparece SIEMPRE, lo traiga
 * la utilidad o no. Y es subcadena: `.bg-superficie` contesta que si a `.bg-sup`. Se parte el CSS en
 * reglas y se pregunta a la regla.
 */
export interface Regla {
  /** Los selectores TAL CUAL se emitieron, con sus escapes: `.hover\:bg-azul:hover`. */
  readonly selectores: readonly string[];
  /** `background-color` -> `var(--color-azul)`. */
  readonly declaraciones: ReadonlyMap<string, string>;
  /** Los preludios de las at-rules que la envuelven: `['@layer utilities']`. */
  readonly dentroDe: readonly string[];
}

const esAtRule = (preludio: string): boolean => preludio.startsWith('@');

/**
 * Parte el CSS en reglas.
 *
 * Es un lector y no un analizador de CSS: le basta con llaves, puntos y comas y dos puntos porque
 * lo que lee lo escribio Tailwind —o una hoja de paletas generada—. Los comentarios se quitan antes
 * para que un `/* … {` no abra un bloque de mentira.
 */
export function reglasDe(css: string): Regla[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const salida: Regla[] = [];
  const pila: { preludio: string; declaraciones: Map<string, string> }[] = [];
  let acumulado = '';

  const anotar = (texto: string): void => {
    const bloque = pila[pila.length - 1];
    const corte = texto.indexOf(':');
    if (bloque === undefined || corte < 0) return;
    bloque.declaraciones.set(texto.slice(0, corte).trim(), texto.slice(corte + 1).trim());
  };

  for (const caracter of sinComentarios) {
    if (caracter === '{') {
      pila.push({ preludio: acumulado.trim(), declaraciones: new Map() });
      acumulado = '';
    } else if (caracter === '}') {
      anotar(acumulado);
      const bloque = pila.pop();
      if (bloque !== undefined && !esAtRule(bloque.preludio)) {
        salida.push({
          selectores: partirEnSelectores(bloque.preludio),
          declaraciones: bloque.declaraciones,
          dentroDe: pila.map((b) => b.preludio),
        });
      }
      acumulado = '';
    } else if (caracter === ';') {
      anotar(acumulado);
      acumulado = '';
    } else {
      acumulado += caracter;
    }
  }
  return salida;
}

/** `button, input:where([type="a"], [type="b"])` -> dos selectores, y no tres. */
function partirEnSelectores(preludio: string): string[] {
  const salida: string[] = [];
  let nivel = 0;
  let actual = '';
  for (const caracter of preludio) {
    if (caracter === '(' || caracter === '[') nivel += 1;
    else if (caracter === ')' || caracter === ']') nivel -= 1;
    if (caracter === ',' && nivel === 0) {
      salida.push(actual.trim());
      actual = '';
    } else {
      actual += caracter;
    }
  }
  if (actual.trim() !== '') salida.push(actual.trim());
  return salida;
}

/**
 * Las clases que un selector emitido NOMBRA, con sus escapes ya resueltos.
 *
 * Caracter a caracter, porque es la unica manera de saber donde ACABA la clase: en
 * `.hover\:bg-azul:hover` el primer `:` es parte del nombre y el segundo no.
 */
export function clasesDelSelector(selector: string): string[] {
  const salida: string[] = [];
  for (let i = 0; i < selector.length; i += 1) {
    if (selector[i] !== '.' || selector[i - 1] === '\\') continue;
    let nombre = '';
    let j = i + 1;
    while (j < selector.length) {
      const caracter = selector[j] ?? '';
      if (caracter === '\\') {
        nombre += selector[j + 1] ?? '';
        j += 2;
      } else if (/[A-Za-z0-9_-]/.test(caracter)) {
        nombre += caracter;
        j += 1;
      } else break;
    }
    if (nombre !== '') salida.push(nombre);
  }
  return salida;
}

/** Todas las clases que el CSS emitido llega a nombrar, exactas y no por subcadena. */
export function clasesEmitidas(reglas: readonly Regla[]): Set<string> {
  return new Set(reglas.flatMap((r) => r.selectores.flatMap((s) => clasesDelSelector(s))));
}

/** La regla de la utilidad **desnuda**: la que tiene por selector exactamente `.<clase>`. */
export function utilidadDesnuda(reglas: readonly Regla[], clase: string): Regla | undefined {
  return reglas.find(
    (r) => r.selectores.length === 1 && r.selectores[0]?.replace(/\\/g, '') === `.${clase}`,
  );
}

/**
 * **La paleta que Tailwind deriva del `@theme`**: `@layer theme { :root, :host { … } }`.
 *
 * Acotada a la capa a proposito (rentas#139): las paletas de `temas.css` salen FUERA de toda capa
 * y repiten los tokens, asi que sin acotar, una mutacion del `@theme` se la taparia la paleta de al
 * lado.
 */
export function paletaDelTema(reglas: readonly Regla[]): Map<string, string> {
  const salida = new Map<string, string>();
  for (const regla of reglas) {
    if (!regla.dentroDe.some((a) => /^@layer\s+theme$/.test(a))) continue;
    if (!regla.selectores.includes(':root')) continue;
    for (const [propiedad, valor] of regla.declaraciones) {
      if (propiedad.startsWith('--')) salida.set(propiedad, valor);
    }
  }
  return salida;
}

/**
 * **La paleta de UNA identidad en su modo claro**: el bloque `[data-tema='<identidad>']` de
 * `temas.css`, fuera de toda capa y de todo `@media`.
 *
 * Es el que el navegador pinta con `data-tema="clasico"` y sin `data-modo`: fuera de capa le gana
 * al `@theme` por regla (`kamayuk-lib`#23), y va despues del de `institucional` en el archivo. Los
 * dos bloques oscuros se excluyen por su selector —`:not([data-modo='claro'])`,
 * `[data-modo='oscuro']`— y por el `@media`.
 */
export function paletaDeLaIdentidad(reglas: readonly Regla[], identidad: string): Map<string, string> {
  const selector = `[data-tema='${identidad}']`;
  const salida = new Map<string, string>();
  for (const regla of reglas) {
    if (regla.dentroDe.length > 0) continue;
    if (!regla.selectores.includes(selector)) continue;
    for (const [propiedad, valor] of regla.declaraciones) {
      if (propiedad.startsWith('--')) salida.set(propiedad, valor);
    }
  }
  return salida;
}

/**
 * El valor de una declaracion con sus `var(--…)` sustituidos por lo que la paleta dice.
 *
 * Lo que la paleta no conozca se deja tal cual, para que el rojo diga `var(--color-x)` —«el token no
 * llego»— en vez de un vacio.
 */
export function resolver(valor: string, paleta: ReadonlyMap<string, string>): string {
  let salida = valor;
  // Cuatro pasadas: un token que apunte a otro es legitimo, una cadena mas larga no, y el tope
  // impide dar vueltas si alguna vez se cierra un ciclo.
  for (let vuelta = 0; vuelta < 4; vuelta += 1) {
    const siguiente = salida.replace(/var\(\s*(--[a-z0-9-]+)\s*\)/gi, (todo, token: string) =>
      paleta.get(token) ?? todo,
    );
    if (siguiente === salida) break;
    salida = siguiente;
  }
  return salida.replace(/\s+/g, ' ').trim().toLowerCase();
}
