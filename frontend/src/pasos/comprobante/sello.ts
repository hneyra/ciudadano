import type { ComprobanteDeDemostracion } from '../../datos/tipos.ts';
import type { EstadoDelRecorrido, PagoSellado } from '../../recorrido/recorrido.ts';
import { rotuloDelMedio } from '../pagar/textosDeLosMedios.ts';

/** Lo que el recibo de la demostracion dice del sello de un pago: sus numeros y con que se pago. */
export interface SelloDeLaDemostracion {
  readonly comprobante: ComprobanteDeDemostracion;
  /** El rotulo del medio, SIN traducir: quien lo dibuja lo pasa por `t()`. */
  readonly medio: string;
}

/**
 * **El sello de un pago, cuando hay uno que decir**: solo en demostracion (issue 58).
 *
 * Con plataforma no hay ninguno —no hubo cobro, no hay operacion ni comprobante que numerar, y el
 * recibo no dice con que se pago (issue 28)— y ademas no hay de donde sacarlo: los numeros y los
 * medios del artboard llegan con la fuente de demostracion, y en ese paquete no estan. Las dos
 * pantallas que lo dicen, el comprobante y la banda del historial, preguntan aqui en vez de mirar
 * cada una el modo y los datos por su cuenta.
 */
export function selloDeLaDemostracion(estado: EstadoDelRecorrido, pago: PagoSellado): SelloDeLaDemostracion | null {
  if (estado.conPlataforma || estado.demostracion === null || pago.comprobante === null) return null;
  return { comprobante: pago.comprobante, medio: rotuloDelMedio(estado.demostracion.medios, pago.medio) };
}
