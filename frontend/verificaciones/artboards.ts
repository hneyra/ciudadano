import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * La raiz de `frontend/`, deducida de este archivo.
 */
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Los artboards que este repositorio vendoriza, con su procedencia y su huella.
 *
 * Portado de `rentas/frontend/verificaciones/artboards.ts`.
 *
 * <h2>Por que una lista, y por que con procedencia</h2>
 *
 * Porque un artboard que falta no se distingue de uno que nadie tenia que traer. La lista dice
 * cuales se esperan; la procedencia dice de donde se vuelve a sacar el que falte, que es la
 * pregunta que uno se hace justo despues de leer el rojo.
 *
 * Viven en `frontend/diseno/` y viajan en el arbol —no se descargan al verificar— porque una
 * guarda que depende de la red no es una guarda: es una que se salta el dia que la red falla.
 *
 * <h2>Lo que anade a la de `rentas`: la huella</h2>
 *
 * El issue 1 pide que `Ciudadano.dc.html` sea **byte a byte** la copia que se entrego. Esa copia
 * vive en un directorio temporal de la sesion que la vendorizo, y en CI no existe: comparar contra
 * ella no se puede repetir. Lo que si se puede es fijar su SHA-256, medido sobre esa copia al
 * traerla, y exigirlo. Un artboard retocado a mano —«solo un texto»— deja de ser la referencia
 * sin que ningun otro rojo lo diga, y todas las guardas que comparen contra el lo harian contra
 * otra cosa.
 */
export interface Artboard {
  /** El archivo, relativo a `frontend/`. */
  readonly archivo: string;
  /** Que dibuja, en una linea. */
  readonly que: string;
  /** De donde se trae si falta. */
  readonly deDonde: string;
  /** SHA-256 de la copia entregada, en hexadecimal. */
  readonly huella: string;
  /**
   * Si la copia YA NO es byte a byte la entregada, por que: la huella de arriba es la del retoque,
   * no la de la entrega, y sin este campo esa diferencia quedaria sin decir en ningun sitio.
   */
  readonly retoque?: string;
}

/** El proyecto de Claude Design del que salen. */
const PROYECTO = 'Claude Design, proyecto «SGTM Redesign»';

export const ARTBOARDS: readonly Artboard[] = [
  {
    archivo: 'diseno/Ciudadano.dc.html',
    que: 'El portal publico de pago de tributos: la referencia de medidas, textos y logica de demostracion contra la que se construye cada pantalla.',
    deDonde: `${PROYECTO}, archivo «Ciudadano.dc.html»`,
    huella: '5adece4e8174a85e42b512b7648e7520234b88baf07d7ed3728be10a32c943d5',
    retoque:
      'Issue 51 (2026-09-23): el correo del usuario de las lineas 1027 y 1045 tenia forma de persona ' +
      'real, en un dominio de webmail de verdad, y viajaba hasta el paquete de produccion. Se cambio ' +
      'por `maria.castillo@example.com` — casa con la ficha «María E. Castillo» de la propia entrega ' +
      '— y el placeholder del campo de correo de la linea 323, en otro dominio real y registrable, ' +
      'por `nombre@example.com`: los dos con el dominio reservado `example.com` (RFC 2606), que nadie ' +
      'registra. Es la unica alteracion deliberada a la copia «tal cual»; la huella de arriba es la de ' +
      'ESTA version, medida tras el cambio. Ver `los-correos-usan-dominio-reservado.test.ts`.',
  },
  {
    archivo: 'diseno/escudo-catacaos.png',
    que: 'El escudo de la barra del portal. Es la MISMA copia que vendorizan `rentas` y `caja` —196 608 bytes, sin bloque `IEND`—, y se versiona tal cual (ver «Lo que NO cierra» del PR del issue 1).',
    deDonde: `${PROYECTO}, archivo «escudo-catacaos.png»`,
    huella: '7a759e8a5929d66823abdac55994f1fa56ee3cfb0ab301615feda7acdde8cec1',
  },
];

/** La ruta absoluta de un artboard declarado. */
export const rutaDe = (artboard: Artboard): string => join(RAIZ, artboard.archivo);
