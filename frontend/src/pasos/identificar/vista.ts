import { formatearImporte } from '@kamayuk/formato';
import type { TFunction } from 'i18next';

import { type EstadoDelRecorrido, cuenta, destinoAlEntrar, hayQuePagar } from '../../recorrido/recorrido.ts';

/**
 * **Lo que «Mis datos» decide y dice, sin React** (issue 60): el parrafo de arriba, si un correo esta
 * completo y la bienvenida al entrar. Se prueban solas en `vista.test.ts`.
 */

/** El correo esta completo si hay algo antes de la `@` y un punto despues (artboard, linea 1187). */
export function correoCompleto(correo: string): boolean {
  const arroba = correo.indexOf('@');
  return arroba >= 1 && correo.lastIndexOf('.') > arroba;
}

/**
 * El parrafo bajo el titulo. **Sin seleccion, cambia** (nota del revisor del issue 7): no dice «Va a
 * pagar S/ …» si no hay nada que pagar (`hayQuePagar`). El importe es `conAmnistia` de `cuenta`: aqui
 * no se suma nada.
 */
export function laIntroduccion(estado: EstadoDelRecorrido, t: TFunction): string {
  return hayQuePagar(estado)
    ? t(
        'Va a pagar {{importe}}. Necesitamos un correo para enviarle el comprobante. Si tiene cuenta, entre y le guardamos el pago en su historial.',
        { importe: formatearImporte(cuenta(estado).conAmnistia) },
      )
    : t('Todavía no ha elegido qué pagar. Si tiene cuenta, entre para ver sus pagos y sus comprobantes.');
}

/**
 * Lo que se avisa al entrar con la cuenta. A donde lleva lo decide el reductor (`destinoAlEntrar`),
 * sobre el estado de ANTES de entrar; el aviso dice lo que va a pasar alli.
 */
export function laBienvenida(estado: EstadoDelRecorrido, t: TFunction): string {
  return destinoAlEntrar(estado) === 'historial'
    ? t('Bienvenida. Aquí están sus pagos.')
    : t('Bienvenida. Este pago quedará en su historial.');
}
