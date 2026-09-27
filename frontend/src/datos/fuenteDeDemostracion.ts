import textos from '../i18n/locales/es.demostracion.json' with { type: 'json' };
import { COMPROBANTE, CONTRIBUYENTE, DEUDAS, EJEMPLOS, HISTORIAL, MEDIOS, UNIDADES, USUARIO } from './demostracion.ts';
import type { FuenteDelPortal } from './fuente.ts';
import type { LaDemostracion } from './tipos.ts';

/**
 * **La fuente de la demostracion**: resuelve con los datos del artboard, sin tocar la red.
 *
 * <h2>Por que vive sola en un archivo, y por que eso no es manía</h2>
 *
 * Porque a este modulo **solo se llega por el `import()` dinamico de `laFuente.ts`**, detras de las
 * dos condiciones que Vite sustituye al construir. Un `import … from './fuenteDeDemostracion.ts'`
 * en cualquier otro archivo de produccion lo metería en el paquete pase lo que pase con la bandera:
 * no hay condicion que pliegue un import estatico. Por eso no cuelga de `fuente.ts` —que lo importa
 * cada pantalla por sus ganchos— ni es el valor por omision de `FuenteActiva`.
 *
 * <h2>Y es el UNICO archivo de produccion que importa los datos (issue 58)</h2>
 *
 * `demostracion.ts` —el nombre, los documentos, el correo, los comprobantes, los predios— y la parte
 * del locale que los traduce (`es.demostracion.json`) entran aqui y en ningun otro sitio: lo demas los
 * recibe de la fuente, por `demostracion`. Hasta el issue 58 ocho archivos de produccion importaban
 * `demostracion.ts` por su cuenta, y con eso los datos viajaban en el paquete de produccion aunque
 * esta fuente se quedara fuera.
 *
 * Lo vigila `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts`, y lo mide sobre el `dist/`
 * construido `e2e/la-demostracion-no-viaja-al-bundle.spec.ts`: ni la fuente, ni una sola marca de los
 * datos.
 *
 * <h2>`consulta: null`, y eso es lo que las pantallas leen</h2>
 *
 * En demostracion **no hay consulta que hacer**: la deuda no llega de ningun servidor, sale de
 * `demostracion` a traves del reductor del recorrido. El `null` no es un hueco por rellenar; es
 * la respuesta, y es lo que `hayPlataforma()` mira para que una pantalla sepa en que modo esta sin
 * leer el entorno.
 *
 * Inventar aqui una `SituacionDelServidor` con las cifras del artboard seria darle a las pantallas
 * una respuesta de servidor que ningun servidor dio, y con ella se probarian en verde caminos que
 * en la plataforma de verdad no existen.
 */
/** Lo que esta fuente aporta y la de la plataforma no (issue 58). Con nombre, para las pruebas. */
export const LA_DEMOSTRACION: LaDemostracion = {
  contribuyente: CONTRIBUYENTE,
  usuario: USUARIO,
  deudas: DEUDAS,
  comprobante: COMPROBANTE,
  medios: MEDIOS,
  ejemplos: EJEMPLOS,
  textos,
};

export const fuenteDeDemostracion: FuenteDelPortal = {
  consulta: null,
  // La del artboard: la Ordenanza 012-2026-MPS condona el interes entero (issue 49).
  amnistia: true,
  demostracion: LA_DEMOSTRACION,
  historial: () => Promise.resolve(HISTORIAL),
  unidades: () => Promise.resolve(UNIDADES),
};
