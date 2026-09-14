import { reglasDe } from './tailwind.ts';

/**
 * **Leer los colores de `diseno/Ciudadano.dc.html` y compararlos con una paleta de `@kamayuk/ui`.**
 *
 * Vive aparte de `la-paleta-cuadra-con-el-artboard.test.ts` por lo mismo que `enlace.ts` o
 * `tinta-que-no-es-texto.ts` en `rentas`: todo aqui son funciones puras sobre TEXTO —el del
 * artboard y la paleta ya leida—, y eso es lo que deja ejercer la guarda sobre una **copia
 * retocada** del artboard sin tocar el vendorizado, cuya huella vigila `los-artboards-estan`.
 *
 * <h2>Por que hace falta una tabla, y no basta con buscar cada hex en la paleta</h2>
 *
 * Porque «el hexadecimal esta en algun sitio del bloque» no dice que este **en el token que le
 * corresponde**: `#0D5FA8` es `--color-azul` y tambien `--color-info-tinta`, y un `#A94442` que se
 * fuera de `--mal-tinta` seguiria apareciendo en `--mal-borde`. Y porque no todo lo que el artboard
 * pinta es un token: hay valores que la libreria corrigio (los velos de la barra, el filo de la
 * alerta) y valores que no entraron (los grises por debajo de AA). Buscando a ciegas, esos
 * saldrian rojos siempre —y se silenciarian— o se quitarian de la lista sin decir por que.
 */

/** Lee UN valor del artboard, o `null` si ya no esta donde se lo busca. */
export type Lector = (artboard: string) => string | null;

/** El token de la identidad tiene el valor del artboard, tal cual. */
export interface Igual {
  readonly tipo: 'igual';
  readonly token: string;
}

/**
 * El token existe y **a proposito no vale lo que el artboard dibuja**.
 *
 * Lleva escrito el valor del artboard contra el que se decidio: si el artboard cambia, la razon
 * de la desviacion deja de ser sobre ese valor y hay que volver a decidir.
 */
export interface Desviacion {
  readonly tipo: 'desviacion';
  readonly token: string;
  readonly elArtboardDice: string;
  readonly laLibreriaDice: string;
  readonly porQue: string;
}

/**
 * El artboard pinta un valor que la identidad **no tiene como token**, y se dice que se usa en su
 * lugar. `seSustituyePor` en `null` es «no hay sustituto todavia»: lo decide la pantalla que lo
 * dibuje, y no con un hexadecimal propio.
 */
export interface SinToken {
  readonly tipo: 'sin-token';
  readonly elArtboardDice: string;
  readonly seSustituyePor: string | null;
  readonly porQue: string;
  /**
   * Si la razon es de contraste, el token contra el que se mide y el umbral que NO alcanza. Se
   * calcula en la prueba en vez de creerse.
   */
  readonly noLlegaA?: { readonly contra: string; readonly umbral: number };
}

export interface Correspondencia {
  /** Como lo nombra el artboard: `AZUL`, `html, body { background }`, `filo de la alerta`. */
  readonly delArtboard: string;
  /** Donde esta, para que el rojo mande a mirar al sitio. */
  readonly donde: string;
  readonly leer: Lector;
  readonly decision: Igual | Desviacion | SinToken;
}

/** `const AZUL = '#0D5FA8';` de la logica del artboard (lineas 706-716). */
export const constante =
  (nombre: string): Lector =>
  (artboard) =>
    new RegExp(`const ${nombre} = '([^']+)';`).exec(artboard)?.[1] ?? null;

/** Todas las constantes de la logica que valen un color: las que la tabla tiene que cubrir. */
export function constantesDeColor(artboard: string): string[] {
  return [...artboard.matchAll(/const ([A-Z][A-Z0-9_]*) = '#[0-9A-Fa-f]{3,8}';/g)].map(
    ([, nombre]) => nombre ?? '',
  );
}

/** El `<style>` del `<helmet>`: los estilos globales del artboard (lineas 12-50). */
export function estiloDelHelmet(artboard: string): string | null {
  return /<helmet>[\s\S]*?<style>([\s\S]*?)<\/style>[\s\S]*?<\/helmet>/.exec(artboard)?.[1] ?? null;
}

/**
 * Una propiedad de una regla del `<helmet>` que no esta dentro de ningun `@media`.
 *
 * `selector` es la lista tal cual, separada por comas: `html, body`.
 */
export const delHelmet =
  (selector: string, propiedad: string): Lector =>
  (artboard) => {
    const estilo = estiloDelHelmet(artboard);
    if (estilo === null) return null;
    const buscados = selector.split(',').map((s) => s.trim());
    const regla = reglasDe(estilo).find(
      (r) =>
        r.dentroDe.length === 0 &&
        r.selectores.length === buscados.length &&
        r.selectores.every((s, i) => s === buscados[i]),
    );
    const valor = regla?.declaraciones.get(propiedad);
    return valor === undefined ? null : (colorDe(valor) ?? valor);
  };

/** Un trozo del marcado, con el valor en el primer grupo de captura. */
export const enElMarcado =
  (patron: RegExp): Lector =>
  (artboard) =>
    patron.exec(artboard)?.[1] ?? null;

/** El primer color de una declaracion: `2px solid #1BA0D7` -> `#1BA0D7`. `null` si no lleva. */
export function colorDe(valor: string): string | null {
  return /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i.exec(valor)?.[0] ?? null;
}

/**
 * La forma comparable de un valor, sea color o fuente.
 *
 * `#777` -> `#777777`; `#0D5FA8` -> `#0d5fa8`; `rgba(255,255,255,.1)` -> `rgba(255, 255, 255, 0.1)`,
 * que es como lo escribe `temas.css`. Lo demas —una lista de fuentes— solo se le normalizan los
 * espacios.
 */
export function normalizar(valor: string): string {
  const limpio = valor.trim();
  const corto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(limpio);
  if (corto !== null) return `#${corto[1]}${corto[1]}${corto[2]}${corto[2]}${corto[3]}${corto[3]}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(limpio)) return limpio.toLowerCase();
  const rgba = /^(rgba?)\(([^)]*)\)$/i.exec(limpio);
  if (rgba !== null) {
    const canales = (rgba[2] ?? '').split(',').map((c) => String(Number(c.trim())));
    return `${(rgba[1] ?? '').toLowerCase()}(${canales.join(', ')})`;
  }
  return limpio.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ');
}

/**
 * **Lo que no cuadra**, una linea por discrepancia y nombrando la fila de la tabla.
 *
 * Pura sobre `(tabla, artboard, paleta)`: la prueba la llama con el artboard vendorizado y con una
 * copia retocada, y en la segunda exige que el rojo salga.
 */
export function discrepancias(
  tabla: readonly Correspondencia[],
  artboard: string,
  paleta: ReadonlyMap<string, string>,
): string[] {
  const salida: string[] = [];
  const valores = new Map([...paleta].map(([n, v]) => [n, normalizar(v)]));

  for (const { delArtboard, donde, leer, decision } of tabla) {
    const leido = leer(artboard);
    if (leido === null) {
      salida.push(`  ${delArtboard} (${donde}): el artboard ya no lo escribe ahi`);
      continue;
    }
    const delDibujo = normalizar(leido);

    if (decision.tipo === 'igual') {
      const publicado = valores.get(decision.token);
      if (publicado === undefined) {
        salida.push(`  ${delArtboard} (${donde}): la identidad no declara ${decision.token}`);
      } else if (publicado !== delDibujo) {
        salida.push(
          `  ${delArtboard} (${donde}): el artboard dice «${delDibujo}» y ${decision.token} vale «${publicado}»`,
        );
      }
      continue;
    }

    if (delDibujo !== normalizar(decision.elArtboardDice)) {
      salida.push(
        `  ${delArtboard} (${donde}): la tabla se decidio contra «${normalizar(decision.elArtboardDice)}» ` +
          `y el artboard dice ahora «${delDibujo}». La razon escrita ya no es sobre este valor: decide otra vez`,
      );
      continue;
    }

    if (decision.tipo === 'desviacion') {
      const publicado = valores.get(decision.token);
      if (publicado === delDibujo) {
        salida.push(
          `  ${delArtboard} (${donde}): ${decision.token} ya vale lo que el artboard dice; la desviacion sobra`,
        );
      } else if (publicado !== normalizar(decision.laLibreriaDice)) {
        salida.push(
          `  ${delArtboard} (${donde}): la tabla dice que ${decision.token} vale ` +
            `«${normalizar(decision.laLibreriaDice)}» y la identidad dice «${publicado ?? '(no lo declara)'}»`,
        );
      }
      continue;
    }

    const conEseValor = [...valores].filter(([, v]) => v === delDibujo).map(([n]) => n);
    if (conEseValor.length > 0) {
      salida.push(
        `  ${delArtboard} (${donde}): la tabla dice que no tiene token y ${conEseValor.join(', ')} ` +
          `vale «${delDibujo}»; la entrada sobra`,
      );
    }
    if (decision.seSustituyePor !== null && !valores.has(decision.seSustituyePor)) {
      salida.push(
        `  ${delArtboard} (${donde}): se sustituye por ${decision.seSustituyePor}, que la identidad no declara`,
      );
    }
  }
  return salida;
}
