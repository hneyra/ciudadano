/**
 * **El contraste de WCAG, en un solo sitio.** Portado de `rentas/frontend/verificaciones/contraste.ts`
 * (rentas#140), sin cambiar la formula.
 *
 * Aqui lo usan tres guardas del issue 2: `tinta-4-no-es-color-de-texto` (el token que se prohibe es
 * ilegible, calculado y no creido), `la-paleta-cuadra-con-el-artboard` (las desviaciones que se
 * justifican por contraste, calculadas) y `tailwind-emite-las-clases` (el contorno de foco global
 * se ve). Escrita tres veces serian tres formulas que divergen.
 *
 * Admite las dos formas en que un color llega —`#rrggbb` del archivo y `rgb(r, g, b)` del
 * navegador—, como en `rentas`, para que el arnes de Chromium (issue 11) no tenga que convertir.
 */

/** Lo que WCAG 1.4.11 pide a lo que no es texto: un filo, un indicador de foco. */
export const UMBRAL_DE_LO_QUE_NO_ES_TEXTO = 3;

/**
 * Lo que WCAG 1.4.3 (nivel AA) pide para texto normal.
 *
 * El texto grande —18 pt, o 14 pt en negrita— se conforma con 3:1, y aqui no se contempla a
 * proposito: las notas del artboard van a 12-13,5 px, que no es texto grande por ningun criterio.
 * Un umbral con excepciones invita a colocar el texto en la excepcion.
 */
export const UMBRAL_DE_TEXTO = 4.5;

/** `#93a3af` o `rgb(147, 163, 175)` -> `[147, 163, 175]`. Lo que devuelve el navegador y lo que trae el archivo. */
export function canalesDe(color: string): readonly [number, number, number] {
  const limpio = color.trim();

  const hex = /^#([0-9a-f]{6})$/i.exec(limpio);
  if (hex !== null) {
    const n = Number.parseInt(hex[1] as string, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // `rgb(147, 163, 175)` y `rgba(147, 163, 175, 0.5)`, que es como lo devuelve `getComputedStyle`.
  const rgb = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i.exec(limpio);
  if (rgb !== null) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }

  // Ni HEX ni `rgb()`. Devolver un color por omision seria calcular un contraste inventado y
  // darlo por bueno, que es justo el modo de fallo que estas guardas existen para impedir.
  throw new Error(`No se pudo leer el color «${color}»: se esperaba «#rrggbb» o «rgb(r, g, b)».`);
}

/** La luminancia relativa de WCAG, sobre los tres canales ya linealizados. */
export function luminancia(color: string): number {
  const [r, g, b] = canalesDe(color).map((canal) => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * La razon de contraste entre dos colores, de 1 a 21.
 *
 * El orden no importa —se toma el mas claro como numerador—, que es como lo define WCAG y como lo
 * quiere quien la usa: nadie tiene que acordarse de cual era la tinta y cual el papel.
 */
export function contraste(uno: string, otro: string): number {
  const a = luminancia(uno);
  const b = luminancia(otro);
  const [claro, oscuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Con dos decimales, que es como se lee en un rojo y como lo publica el issue. */
export const conDosDecimales = (razon: number): string => razon.toFixed(2);
