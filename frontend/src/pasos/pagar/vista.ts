import type { Importe } from '@kamayuk/formato';
import type { TFunction } from 'i18next';

import { pasosConTotal, totalDe } from '../../datos/cuentas.ts';
import type { MedioDePago } from '../../datos/tipos.ts';
import {
  type EstadoDelRecorrido,
  aCobrar,
  cuentaPorPagar,
  destinoDelComprobante,
  dondeSeElige,
  porPagar,
} from '../../recorrido/recorrido.ts';

/**
 * **Lo que el paso 4 dibuja, preparado sin React** (issue 60).
 *
 * El modelo de vista de «Pagar»: funciones puras del estado del recorrido y de `t`. Lo que depende
 * del modo lo contesta la politica que el estado lleva (`estado.politica`, la misma que `useModo()`):
 * si el pago es simulado, si la deuda trae reajuste. Se prueban solas en `vista.test.ts`.
 *
 * **Ninguna cifra se calcula aqui**: las filas, los componentes y el total salen de `porPagar`,
 * `cuentaPorPagar` y `aCobrar` del reductor; el total de cada concepto, de `totalDe`; el importe de
 * las instrucciones, de `pasosConTotal`. Que la pantalla pinta lo que las cuentas dicen lo demuestra
 * `Pagar.cuentas.test.tsx` sustituyendo las cuentas.
 */

// ── Confirmar ──────────────────────────────────────────────────────────────────────────────────

/** Lo que pasa al confirmar: si hay algo que sellar, y lo que se avisa. */
export interface AlConfirmar {
  /** Sin nada que pagar: el boton se pinta apagado, y confirmar solo avisa. */
  readonly nada: boolean;
  readonly aviso: string;
}

/**
 * Sin nada que pagar no se sella nada, y se avisa con la frase del artboard (linea 1255). El aviso
 * de despues **no promete un correo si el pago es simulado**: no hay cobro, y no se envia nada.
 *
 * Se pregunta ANTES de despachar: el destino es el que el reductor sella en `ultimo`.
 */
export function alConfirmar(estado: EstadoDelRecorrido, t: TFunction): AlConfirmar {
  if (porPagar(estado).length === 0) return { nada: true, aviso: t('No hay nada que pagar.') };
  const destino = destinoDelComprobante(estado) ?? t('su correo');
  return {
    nada: false,
    aviso: estado.politica.cobro.simulado
      ? t('Pago simulado. No se cobró nada y su deuda no ha cambiado.')
      : t('Pago registrado. Le enviamos el comprobante a {{destino}}.', { destino }),
  };
}

// ── El medio ───────────────────────────────────────────────────────────────────────────────────

/** Los pasos de un medio (lineas 411-427), con el importe que se cobra donde dice `{{TOTAL}}`. */
export function pasosDelMedio(medio: MedioDePago, estado: EstadoDelRecorrido, t: TFunction): readonly string[] {
  return pasosConTotal(
    (medio.pasos ?? []).map((paso) => t(paso)),
    aCobrar(estado, cuentaPorPagar(estado)),
  );
}

// ── El resumen ─────────────────────────────────────────────────────────────────────────────────

/** Un concepto del resumen: su nombre, sus cuotas si las hay, y lo que suma. */
export interface ConceptoDelResumen {
  readonly id: string;
  readonly concepto: string;
  /** El contrato del portal no trae cuotas (issue 26): sin ellas no se dibuja la linea. */
  readonly cuotas: string | null;
  readonly total: Importe;
}

/** Una fila de los totales del resumen (lineas 459-464). */
export interface FilaDelResumen {
  readonly rotulo: string;
  readonly valor: Importe;
  /** El interes condonado: en verde y con «− » delante. */
  readonly condonado: boolean;
}

/** «Lo que va a pagar» (lineas 447-473). */
export interface ElResumen {
  readonly conceptos: readonly ConceptoDelResumen[];
  readonly filas: readonly FilaDelResumen[];
  readonly total: Importe;
  /** A donde se envia el comprobante, o que no se envia ninguno. */
  readonly aviso: string;
  /**
   * El rotulo del boton de abajo: cambiar lo elegido, o ir a elegirlo si no hay nada. A donde lleva lo
   * decide el reductor (`volverAElegir`, issue 61); el rotulo nombra ese mismo sitio (`dondeSeElige`).
   */
  readonly volver: string;
}

/**
 * **El resumen del pago.** Sin nada que pagar no hay conceptos, ni filas: la pantalla dice «No hay
 * nada que pagar.» y ofrece ir a elegir.
 *
 * · **El reajuste** solo lo trae la deuda que se consulta (issue 26); el artboard no lo tiene y su
 *   resumen son tres filas. Sin esa fila, con plataforma las filas no sumaban el total. Lo contesta la
 *   politica (`contenido.traeReajuste`, issue 60), no el modo.
 * · **El interes se condona SOLO si la fuente aporta una amnistia** (issue 49). Sin ella se cobra, y
 *   se dice como lo que es: el interes moratorio, sumado.
 * · **Con el pago simulado NO se envia ningun comprobante** (issue 28, revision): prometer un correo
 *   que nadie va a mandar es afirmar un hecho que no va a ocurrir, y da igual que haya un aviso al lado.
 */
export function elResumen(estado: EstadoDelRecorrido, t: TFunction): ElResumen {
  const conceptos = porPagar(estado);
  const lo = cuentaPorPagar(estado);
  const destino = destinoDelComprobante(estado) ?? t('su correo');
  const elegir = dondeSeElige(estado);

  const filas: FilaDelResumen[] =
    conceptos.length === 0
      ? []
      : [
          { rotulo: t('Impuesto y arbitrios'), valor: lo.insoluto, condonado: false },
          ...(estado.politica.contenido.traeReajuste
            ? [{ rotulo: t('Reajuste'), valor: lo.reajuste, condonado: false }]
            : []),
          estado.amnistia
            ? { rotulo: t('Interés condonado'), valor: lo.interes, condonado: true }
            : { rotulo: t('Interés moratorio'), valor: lo.interes, condonado: false },
          { rotulo: t('Gastos y costas'), valor: lo.gastos, condonado: false },
        ];

  let rotulo: string;
  if (conceptos.length > 0) rotulo = t('Cambiar lo que voy a pagar');
  else if (elegir === 'buscar') rotulo = t('Buscar mi deuda');
  else rotulo = t('Elegir qué pago');

  return {
    conceptos: conceptos.map((deuda) => ({
      id: deuda.id,
      concepto: deuda.concepto,
      cuotas: deuda.cuotas,
      total: totalDe(deuda),
    })),
    filas,
    total: aCobrar(estado, lo),
    aviso: estado.politica.cobro.simulado
      ? t('Aquí no se envía ningún comprobante: el portal todavía no cobra en línea.')
      : t('El comprobante se enviará a {{destino}}.', { destino }),
    volver: rotulo,
  };
}
