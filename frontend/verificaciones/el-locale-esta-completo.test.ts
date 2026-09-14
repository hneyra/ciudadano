import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';

/**
 * **El locale tiene todas las claves, y ninguna se aparta de la suya** (rentas#103, AC5).
 *
 * Portada de `rentas/frontend/verificaciones/el-locale-esta-completo.test.ts`.
 *
 * <h2>Las dos direcciones, y por que hacen falta las dos</h2>
 *
 * · **Ninguna clave usada falta del locale.** Sin esto, un segundo idioma se haria copiando un
 *   archivo incompleto y la pantalla saldria **a medias**: unas frases traducidas y otras en
 *   castellano, que parece un defecto de la traduccion y es del inventario.
 * · **Ningun valor se aparta de su clave.** El castellano esta en dos sitios —el codigo y el
 *   locale— y el artboard manda sobre el primero. Cada valor **tiene que ser igual a su clave**,
 *   asi que el locale no puede decir algo distinto del artboard sin ponerse rojo.
 *
 * <h2>Lo que cambia respecto a `rentas`: de donde salen las claves</h2>
 *
 * En `rentas` la mayoria sale DERIVADA de las 40 definiciones de pantalla (`catalogo-de-claves.ts`)
 * y el resto es una lista de literales. Aqui no hay definiciones todavia: **todas son literales**,
 * las que el codigo escribe como `t('…')`. Que el codigo no use una clave que esta lista no tiene lo
 * dice `i18next-cli status` —`yarn i18n`, dentro de `yarn verificar`—; que la lista y el locale
 * cuadren, esta guarda. Cuando lleguen las pantallas con sus datos, la lista se derivara como alli.
 *
 * <h2>Y por que el locale se REGENERA en vez de escribirse</h2>
 *
 * Porque sale de esta lista: a mano se queda viejo a la primera frase nueva.
 * `yarn i18n:regenerar` lo vuelve a escribir.
 */

const LOCALE = join(RAIZ, 'src/i18n/locales/es.json');

/** Las claves que el codigo escribe como `t('…')`. Los textos son los del artboard, tal cual. */
const LITERALES = [
  // `diseno/Ciudadano.dc.html`, linea 65: el titulo de la barra.
  'Pago de tributos en línea',
  // `diseno/Ciudadano.dc.html`, linea 692: el valor por omision de la prop `entidad`.
  'Municipalidad Distrital de Catacaos',

  // ── El marco (issue 4) ──────────────────────────────────────────────────────────────────────
  // Linea 73: el boton de la barra sin sesion.
  'Iniciar sesión',
  // Linea 1045: la cabecera del menu de la sesion (`usuario.codigo`). El codigo es dato y entra por el hueco.
  'Contribuyente {{codigo}}',
  // Lineas 1052-1055: las cuatro opciones del menu, y los dos avisos que levantan.
  'Mis pagos',
  'Mis predios y vehículos',
  'Cambiar mi clave',
  'Cerrar sesión',
  'Abriría el cambio de clave.',
  'Sesión cerrada.',
  // Lineas 1019-1021: la franja de pasos, y el aviso de un paso futuro (1071).
  'Buscar mi deuda',
  'Elegir qué pago',
  'Mis datos',
  'Pagar',
  'Comprobante',
  'Complete primero los pasos anteriores.',
  // Linea 677: el pie, con la entidad en su hueco; lineas 679-681, sus enlaces.
  '{{entidad}} — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00. Los datos de esta pantalla son de demostración.',
  'Preguntas frecuentes',
  'Reclamos',
  'Términos',
  // El rotulo accesible de la region de avisos. No esta en el artboard (alli el aviso es un
  // `role="status"` sin nombre); es la palabra de `TEXTOS_DE_LA_UI.avisos` de `@kamayuk/ui`, traducida.
  'Avisos',
  // Los titulos de cada paso: lineas 126, 224, 314, 360, 1276 y 570. El primero es ya el `h1` de la
  // pantalla de buscar (issue 5); los demas, de los marcadores hasta que lleguen las suyas (6-10).
  'Consulte y pague sus tributos',
  'Lo que debe, por concepto',
  '¿A dónde le enviamos el comprobante?',
  '¿Cómo quiere pagar?',
  'Su pago se registró',

  // ── Paso 1 · Buscar mi deuda (issue 5) ──────────────────────────────────────────────────────
  // Linea 127: la entrada bajo el titulo (que es la clave de arriba, «Consulte y pague sus tributos»).
  'Escriba su código de contribuyente o su documento de identidad. Verá lo que debe, con su vencimiento, y podrá pagar todo o solo lo que elija.',
  // Lineas 131 y 1084: «Buscar por» y sus tres opciones. Las opciones son dato del recorrido
  // (`TipoDeDocumento`) y se traducen al dibujarse.
  'Buscar por',
  'Código de contribuyente',
  'DNI',
  'RUC',
  // Linea 1086: la etiqueta del numero. El artboard concatena «Número de » + tipo; aqui son dos
  // frases enteras, para que un traductor no tenga que adivinar la concordancia.
  'Número de DNI',
  'Número de RUC',
  // Lineas 1004-1005: los dos errores de `buscar()`, y el aviso de la busqueda valida (1006).
  'Escriba su código de contribuyente o su documento para poder buscar.',
  'El código y el documento son solo números. Revise lo que escribió.',
  'Encontramos 4 conceptos pendientes.',
  // Linea 151: la ayuda bajo el formulario.
  'Su código de contribuyente figura en la cuponera del impuesto predial y en cualquier recibo anterior. Si no lo encuentra, busque por su DNI.',
  // Lineas 155 y 1093-1096: «Qué puede hacer aquí» y sus cuatro capacidades.
  'Qué puede hacer aquí',
  'Ver lo que debe',
  'Su impuesto predial, arbitrios y vehicular, con el vencimiento de cada cuota.',
  'Pagar en línea',
  'Con tarjeta, Yape, pagalo.pe o un código para el banco.',
  'Descargar comprobantes',
  'El del pago que acaba de hacer y los de años anteriores.',
  'Saber de dónde sale',
  'El autovalúo de su predio, los metros de frontis y la tabla que se le aplica.',
  // Linea 177: la amnistia. La norma es dato (`ORDENANZA`, de `src/datos/`) y entra por su hueco.
  'Amnistía vigente hasta el 31 de diciembre.',
  'La {{ordenanza}} condona el 100 % del interés moratorio. Al pagar ahora, el descuento se aplica solo: no hay que solicitarlo.',
] as const;

/** Lo que tiene que decir cada forma plural. Hoy no hay ninguna; el mecanismo es el de `rentas`. */
const PLURALES: Readonly<Record<string, string>> = {};

function elQueDeberiaSer(): Readonly<Record<string, string>> {
  const claves = [...new Set(LITERALES)].sort((a, b) => a.localeCompare(b, 'es'));
  return Object.fromEntries(claves.map((c) => [c, PLURALES[c] ?? c]));
}

describe('el locale `es` esta completo y no se aparta', () => {
  const esperado = elQueDeberiaSer();

  if (process.env.KAMAYUK_REGENERAR === '1') {
    writeFileSync(LOCALE, `${JSON.stringify(esperado, null, 2)}\n`, 'utf8');
  }

  const enDisco = JSON.parse(readFileSync(LOCALE, 'utf8')) as Record<string, string>;

  it('EL CENTINELA: la lista trae las claves del marcador', () => {
    // Sin esto, una lista vaciada haria que «no falta ninguna» pasara en verde sobre la nada.
    expect(Object.keys(esperado), 'la lista de claves vino corta').toEqual(
      expect.arrayContaining(['Pago de tributos en línea', 'Municipalidad Distrital de Catacaos']),
    );
  });

  it('no falta ninguna clave, y no sobra ninguna', () => {
    const faltan = Object.keys(esperado).filter((c) => !(c in enDisco));
    const sobran = Object.keys(enDisco).filter((c) => !(c in esperado));
    expect(
      { faltan: faltan.slice(0, 8), sobran: sobran.slice(0, 8) },
      'El locale `es` dejo de cuadrar con lo que el portal dice.\n' +
        '  Se regenera con:  yarn i18n:regenerar',
    ).toEqual({ faltan: [], sobran: [] });
  });

  it('y NINGUN valor se aparta de su clave, salvo los plurales', () => {
    const apartados = Object.entries(enDisco)
      .filter(([clave, valor]) => valor !== (PLURALES[clave] ?? clave))
      .map(([clave, valor]) => `  «${clave}» dice «${valor}»`);
    expect(
      apartados,
      'Hay entradas del locale que dicen algo distinto de su clave:\n' +
        `${apartados.join('\n')}\n\n` +
        '  El castellano esta en dos sitios —el codigo y el locale— y el artboard manda sobre el\n' +
        '  primero. Si el locale puede decir otra cosa, la pantalla se aparta del artboard.',
    ).toEqual([]);
  });
});
