import type { ComprobanteDeDemostracion } from '../../datos/tipos.ts';
import { type DatosLeidos, type PagoRegistrado, laDemostracion } from '../../recorrido/recorrido.ts';
import { rotuloDelMedio } from '../pagar/textosDeLosMedios.ts';

/** Lo que el recibo de la demostracion dice del sello de un pago: sus numeros y con que se pago. */
export interface SelloDeLaDemostracion {
  readonly comprobante: ComprobanteDeDemostracion;
  /** El rotulo del medio, SIN traducir: quien lo dibuja lo pasa por `t()`. */
  readonly medio: string;
}

/**
 * **El sello de un pago registrado**: sus numeros y el rotulo de su medio (issues 58 y 59).
 *
 * Solo lo tiene un `PagoRegistrado` —el de la demostracion—: un `PagoSimulado` no tiene ni medio ni
 * numeros que decir (no hubo cobro, no hay operacion ni comprobante que numerar, issue 28), y desde
 * el issue 59 eso lo dice el tipo y no esta funcion. Hasta entonces devolvia `null` mirando el modo
 * Y los datos, y el comprobante elegia la banda por ese `null` mientras el aviso de pago simulado
 * colgaba del modo: dos preguntas distintas para lo mismo. Ahora las pantallas preguntan una sola
 * cosa, `esSimulado(pago)`, y solo con la respuesta «no» pueden llegar aqui.
 *
 * El rotulo del medio sale de los medios de la demostracion, que llegan con la fuente.
 */
export function selloDeLaDemostracion(estado: DatosLeidos, pago: PagoRegistrado): SelloDeLaDemostracion {
  return { comprobante: pago.comprobante, medio: rotuloDelMedio(laDemostracion(estado).medios, pago.medio) };
}
