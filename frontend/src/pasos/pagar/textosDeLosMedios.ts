import type { MedioDePago } from '../../datos/tipos.ts';

/** Si el ejemplo de un campo dice algo (y se traduce) o es solo la forma de unas cifras (y no). */
export function ejemploSeTraduce(ejemplo: string): boolean {
  return !/^[0-9 ]+$/.test(ejemplo);
}

/**
 * **Lo que cada medio de pago dice, y por eso se traduce**, sacado del dato (issue 8).
 *
 * Los textos de los medios viven en `MEDIOS` (`src/datos/demostracion.ts`), copia literal del
 * artboard, que llega a la pantalla por la fuente (`LaDemostracion.medios`, issue 58), y la pantalla
 * los pasa por `t()` con una variable. Ninguna extraccion estatica sigue una
 * variable: `i18next-cli` no los ve y `yarn i18n` no los echa de menos. Asi que el inventario del
 * locale no los escribe a mano —un olvido ahi no daria ningun rojo— sino que los DERIVA de aqui, como
 * `rentas` deriva los de sus pantallas (`catalogo-de-claves.ts`, rentas#103).
 *
 * Y la pantalla no traduce otra lista: `Pagar.test.tsx` recorre los cuatro medios en el idioma
 * `marcado` y exige que CADA texto de esta lista llegue marcado al DOM. Si la pantalla dibujara un
 * campo que aqui no esta, o este archivo listara uno que la pantalla no traduce, la prueba lo dice.
 *
 * <h2>Lo que NO se traduce, y por que</h2>
 *
 * · `codigo` («969 032 194», «2026-0025673-4418»): es lo que se teclea en el banco o en la aplicacion.
 * · `bancos[].nombre` («BCP», «Caja Piura»): nombres propios. Sus `canales` si se traducen.
 * · `icono`: trazados, no texto.
 * · Los ejemplos de los campos que son SOLO cifras («0000 0000 0000 0000», «123»): como el
 *   `03593174` de «Mis datos», son un dato con la forma del valor, no palabras. Los que dicen algo
 *   («MM/AA», el nombre de ejemplo) si pasan por `t()`: cambian con el idioma. Lo decide
 *   `ejemploSeTraduce`, que usan la pantalla y esta lista.
 *
 * Los `pasos` entran con su hueco `{{TOTAL}}` dentro: se traducen primero y `pasosConTotal` pone el
 * importe despues, asi que la clave no depende de cuanto se deba.
 */
export function textosDelMedio(medio: MedioDePago): readonly string[] {
  return [
    medio.rotulo,
    medio.nota,
    medio.titulo,
    medio.detalleNota,
    ...(medio.campos ?? []).flatMap((campo) => [
      campo.etiqueta,
      ...(ejemploSeTraduce(campo.ejemplo) ? [campo.ejemplo] : []),
      ...(campo.ayuda === undefined ? [] : [campo.ayuda]),
    ]),
    ...(medio.codigoEtiqueta === undefined ? [] : [medio.codigoEtiqueta]),
    ...(medio.codigoNota === undefined ? [] : [medio.codigoNota]),
    ...(medio.pasos ?? []),
    ...(medio.bancos ?? []).map((banco) => banco.canales),
    medio.aviso,
    medio.boton,
  ];
}

/**
 * El medio de esa lista con ese id. Revienta con su nombre si no esta: los ids son los del tipo, y
 * la lista del artboard trae los cuatro (lo mide `demostracion.test.ts`).
 *
 * La lista se recibe, y no se importa (issue 58): es la de la fuente de demostracion, y un `import`
 * de `demostracion.ts` aqui metia los medios —el numero para yapear, los codigos de pago, el nombre
 * de la tarjeta de ejemplo— en el paquete de produccion.
 */
export function medioDe(medios: readonly MedioDePago[], id: MedioDePago['id']): MedioDePago {
  const medio = medios.find((m) => m.id === id);
  if (medio === undefined) throw new Error(`Los medios de la demostracion no traen el medio «${id}».`);
  return medio;
}

/**
 * El rotulo de un medio por su id, SIN traducir: lo que dicen del medio de un pago sellado el
 * comprobante y la fila del pago reciente del historial, que lo pasan por `t()`.
 */
export function rotuloDelMedio(medios: readonly MedioDePago[], id: MedioDePago['id']): string {
  return medioDe(medios, id).rotulo;
}

/**
 * Todas las claves de esos medios, sin repetidos. Las lee `el-locale-esta-completo.test.ts` con los
 * de la demostracion, para la parte del locale que viaja con ellos (`es.demostracion.json`).
 */
export function clavesDeLosMedios(medios: readonly MedioDePago[]): readonly string[] {
  return [...new Set(medios.flatMap(textosDelMedio))];
}
