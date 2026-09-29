import { quienDebeDe } from '../datos/deLaSituacion.ts';
import type { ConceptoDeDeuda, LaDemostracion, QuienDebe, SituacionDelServidor } from '../datos/tipos.ts';

/**
 * **Lo que el recorrido LEE**: los conceptos y a nombre de quien estan (issue 50).
 *
 * Vive aparte de `recorrido.ts` desde el issue 59, y no por gusto: lo necesitan el reductor y el
 * modulo del modo (`src/modo/modo.ts`, que decide de donde se lee en cada modo), y el reductor
 * importa el modulo del modo. Con esto aqui dentro de `recorrido.ts`, los dos se importarian el uno
 * al otro. `recorrido.ts` lo sigue exportando: es donde lo buscan las pantallas y las pruebas.
 */

/**
 * No lo guarda el reductor: lo pone `ProveedorDelRecorrido` en cada dibujo, de la demostracion o de
 * la cache de consultas. Ver la cabecera de `recorrido.ts`.
 */
export interface DatosLeidos {
  /**
   * Los conceptos sobre los que trabaja el recorrido: los del artboard en demostracion, los de
   * `GET /portal/situacion` con plataforma. De aqui cuelgan `vivas`, `seleccion` y lo que se sella.
   */
  readonly deudas: readonly ConceptoDeDeuda[];
  /** De quien es esa deuda. `null` con plataforma mientras la consulta no ha contestado con deuda. */
  readonly contribuyente: QuienDebe | null;
  /**
   * **Los datos del artboard, tal como los aporta la fuente de demostracion** (issue 58); `null` con
   * plataforma. De aqui salen el sello del comprobante y el correo de la cuenta del artboard, y lo
   * leen las pantallas que solo existen en demostracion (la usuaria de la barra, los medios, los
   * ejemplos de los campos). Hasta el issue 58 cada una lo importaba de `demostracion.ts`, y con esos
   * `import` los datos viajaban en el paquete de produccion.
   */
  readonly demostracion: LaDemostracion | null;
}

/** Nada leido: con plataforma, mientras la consulta no contesta con deuda. */
export const SIN_DATOS: DatosLeidos = { deudas: [], contribuyente: null, demostracion: null };

/**
 * **Lo que el recorrido lee de la demostracion**: sus cuatro conceptos y la persona a cuyo nombre
 * estan, desde lo que aporta la fuente (issue 58).
 *
 * Hasta el issue 58 esto era una constante escrita sobre `DEUDAS` y `CONTRIBUYENTE`, importados de
 * `demostracion.ts`: el reductor era uno de los archivos que metian los datos en el paquete de
 * produccion. Y hasta el issue 59 aceptaba `null` —«una demostracion sin datos»—: la fuente no
 * puede ser eso (`FuenteDelPortal` es una union por modo), asi que aqui tampoco.
 */
export function datosDeLaDemostracion(demostracion: LaDemostracion): DatosLeidos {
  const { contribuyente } = demostracion;
  return {
    deudas: demostracion.deudas,
    contribuyente: {
      nombre: contribuyente.nombre,
      codigo: contribuyente.codigo,
      documento: `${contribuyente.tipoDeDocumento} ${contribuyente.numeroDeDocumento}`,
    },
    demostracion,
  };
}

/**
 * **Lo que el recorrido lee de una respuesta del servidor** (issue 50): sus conceptos y a nombre de
 * quien estan, solo si contesto CON DEUDA. Pura: la misma respuesta da los mismos conceptos —el
 * mismo arreglo, el que guarda la cache—, asi que una respuesta igual no cambia nada de lo que se
 * dibuja.
 *
 * Mientras no hay respuesta (`undefined`) y en los otros tres finales, `SIN_DATOS`: no hay nada que
 * marcar ni que pagar, y esas pantallas no dibujan la lista.
 */
export function datosDeLaSituacion(situacion: SituacionDelServidor | undefined): DatosLeidos {
  if (situacion?.estado !== 'con-deuda') return SIN_DATOS;
  return { deudas: situacion.deudas, contribuyente: quienDebeDe(situacion), demostracion: null };
}
