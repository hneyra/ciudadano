import { formatearFecha, formatearImporte } from '@kamayuk/formato';
import type { TFunction } from 'i18next';

import { cifraSinSimbolo } from '../../datos/cuentas.ts';
import { ORDENANZA } from '../../datos/constantes.ts';
import { type EstadoDelRecorrido, type PagoSellado, aCobrar, aCobrarDe, esSimulado } from '../../recorrido/recorrido.ts';
import { selloDeLaDemostracion } from './sello.ts';

/**
 * **Lo que el comprobante dibuja, preparado sin React** (issue 60).
 *
 * El modelo de vista del paso 5: funciones puras del estado y del PAGO SELLADO (`estado.ultimo`), y
 * de `t`. Todo sale del sello —los conceptos, los importes, el medio, el destino y los numeros—; del
 * estado vivo solo lo que el artboard tambien lee vivo: la amnistia de la fuente, que no cambia en la
 * visita. Se prueban solas en `vista.test.ts`.
 *
 * **Una sola pregunta, al pago** (issue 59): `esSimulado(pago)`. Un pago simulado no tiene ni
 * numeros, ni medio, ni destino (`PagoSimulado`); todo lo demas cuelga de esa respuesta.
 *
 * **Ninguna cifra se calcula aqui**: el importe de cada fila es `aCobrarDe` y la cifra sin «S/ » es
 * `cifraSinSimbolo`, de `src/datos/cuentas.ts`; el condonado y el total, los del sello, por `aCobrar`.
 */

/** Lo que dicen las dos bandas de arriba: la de exito (registrado) y la de la simulacion. */
export function laBanda(estado: EstadoDelRecorrido, pago: PagoSellado, t: TFunction): string {
  const importe = formatearImporte(aCobrar(estado, pago));
  if (esSimulado(pago)) {
    return t(
      'Esto es lo que habría pagado: {{importe}}. No se cobró nada, no se envió ningún comprobante y su deuda no ha cambiado.',
      { importe },
    );
  }
  return t(
    'Pagó {{importe}} con {{medio}}. Le enviamos el comprobante a {{destino}}, y puede descargarlo aquí mismo. La deuda pagada ya se descontó de su cuenta.',
    {
      importe,
      // «con tarjeta»: el artboard lo pone en minusculas (linea 1279).
      medio: t(selloDeLaDemostracion(estado, pago).medio).toLowerCase(),
      destino: pago.destino ?? t('su correo'),
    },
  );
}

/** Una celda de la meta del recibo: rotulo y valor. */
export interface LineaDeLaMeta {
  readonly rotulo: string;
  readonly valor: string;
}

/** Una fila de la tabla del recibo. */
export interface FilaDelRecibo {
  readonly id: string;
  readonly concepto: string;
  readonly unidad: string;
  /** El contrato del portal no trae cuotas (issue 26): la celda queda vacia, no inventada. */
  readonly cuotas: string | null;
  readonly importe: string;
}

/** El recibo entero (artboard, lineas 491-534 y 1287-1322). */
export interface ElRecibo {
  readonly simulado: boolean;
  /** «Constancia de pago», o «Comprobante de ejemplo» si el pago es simulado. */
  readonly titulo: string;
  /** El numero del comprobante; `null` si no se emitio ninguno. */
  readonly numero: string | null;
  readonly meta: readonly LineaDeLaMeta[];
  readonly filas: readonly FilaDelRecibo[];
  /** La fila del interes condonado, o `null` sin amnistia. */
  readonly condonado: LineaDeLaMeta | null;
  readonly total: LineaDeLaMeta;
  readonly nota: string;
}

/**
 * **El recibo del pago sellado.**
 *
 * · **Con el pago simulado esto NO es una constancia y no tiene numero**: no hay comprobante emitido
 *   que numerar, ni operacion, ni fecha de pago, ni medio —**no se pago**—, y «Enviado a» afirmaria
 *   que se envio. Las del artboard son numeros de utileria, y en un recibo se leen como el registro de
 *   un hecho. «Total pagado» pasa a «Total que se pagaría».
 * · **Quien es sale del SELLO** y no de `CONTRIBUYENTE` (issues 28 y 50): a nombre de quien estaba la
 *   deuda AL PAGAR. El codigo solo si lo hay: con dos municipalidades detras no hay uno que valga por
 *   los dos.
 * · **Sin amnistia no se condona nada** (issue 49): el interes ya va dentro de cada fila, y una
 *   «Ordenanza» del artboard escrita en un recibo de una deuda de verdad seria inventada.
 */
export function elRecibo(estado: EstadoDelRecorrido, pago: PagoSellado, t: TFunction): ElRecibo {
  const registrado = esSimulado(pago) ? null : { pago, sello: selloDeLaDemostracion(estado, pago) };
  const quien = pago.contribuyente;

  const meta: LineaDeLaMeta[] = [
    ...(registrado === null
      ? []
      : [
          { rotulo: t('Número de operación'), valor: registrado.sello.comprobante.operacion },
          {
            rotulo: t('Fecha y hora'),
            valor: `${formatearFecha(registrado.sello.comprobante.fecha)} · ${registrado.sello.comprobante.hora}`,
          },
          { rotulo: t('Medio de pago'), valor: t(registrado.sello.medio) },
        ]),
    ...(quien === null ? [] : [{ rotulo: t('Contribuyente'), valor: quien.nombre }]),
    ...(quien?.codigo == null ? [] : [{ rotulo: t('Código'), valor: quien.codigo }]),
    ...(registrado === null ? [] : [{ rotulo: t('Enviado a'), valor: registrado.pago.destino ?? t('su correo') }]),
  ];

  return {
    simulado: registrado === null,
    titulo: registrado === null ? t('Comprobante de ejemplo') : t('Constancia de pago'),
    numero: registrado === null ? null : registrado.sello.comprobante.numero,
    meta,
    filas: pago.conceptos.map((deuda) => ({
      id: deuda.id,
      concepto: deuda.concepto,
      unidad: deuda.unidad,
      cuotas: deuda.cuotas,
      importe: cifraSinSimbolo(aCobrarDe(estado, deuda)),
    })),
    condonado: estado.amnistia
      ? {
          rotulo: t('Interés condonado por la {{ordenanza}}', { ordenanza: ORDENANZA }),
          valor: `− ${cifraSinSimbolo(pago.interes)}`,
        }
      : null,
    total: {
      rotulo: registrado === null ? t('Total que se pagaría') : t('Total pagado'),
      valor: cifraSinSimbolo(aCobrar(estado, pago)),
    },
    nota:
      registrado === null
        ? t(
            'Este comprobante es una vista de ejemplo y no acredita ningún pago: el portal todavía no cobra en línea, así que no hay ninguna operación que constatar. Para pagar, acérquese con su documento a la ventanilla de la municipalidad.',
          )
        : t(
            'Esta constancia acredita el pago de los conceptos detallados. Consérvela: es lo que hay que presentar si la deuda volviera a aparecer. El pago con tarjeta, Yape o pagalo.pe se aplica de inmediato; el pago con código de banco, al día siguiente hábil.',
          ),
  };
}
