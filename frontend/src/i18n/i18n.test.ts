import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FuenteDelPortal } from '../datos/fuente.ts';
import { fuenteDeDemostracion } from '../datos/fuenteDeDemostracion.ts';
import { UNIDADES } from '../datos/demostracion.ts';
import i18n, { IDIOMA_POR_OMISION, sumarLosTextosDeLaFuente } from './i18n.ts';

/**
 * **Lo que dicen los datos de la demostracion llega con ellos, no en el locale de siempre** (issue 58).
 *
 * `es.json` viaja en todo paquete; `es.demostracion.json` —las direcciones, las fichas catastrales, el
 * nombre de la tarjeta de ejemplo— solo con la fuente de demostracion. Que la particion sea la correcta
 * lo mide `verificaciones/el-locale-esta-completo.test.ts`; esto mide que la segunda parte **se sume al
 * idioma** cuando llega, y solo entonces. Sin la suma seria un archivo que nadie lee, y un segundo
 * idioma dejaria los datos sin traducir.
 *
 * Cada prueba empieza con el locale que viaja siempre y nada mas, y al acabar se deja como estaba:
 * `sumarLosTextosDeLaFuente` escribe en el i18next global, y sin esta limpieza la segunda prueba
 * dependeria de que la tercera no hubiera corrido antes (revision del issue 58).
 */

let comoEstaba: Record<string, unknown> = {};

beforeEach(() => {
  comoEstaba = { ...(i18n.getResourceBundle(IDIOMA_POR_OMISION, 'translation') as Record<string, unknown>) };
});

afterEach(() => {
  i18n.removeResourceBundle(IDIOMA_POR_OMISION, 'translation');
  i18n.addResourceBundle(IDIOMA_POR_OMISION, 'translation', comoEstaba);
});

/** Un texto que solo dicen los datos: la direccion del predio principal. */
const DE_LOS_DATOS = UNIDADES[0]?.titulo ?? '(sin unidades)';

// Desde el issue 59 una fuente sin demostracion es una de la plataforma: no hay otra forma de no traerla.
const SIN_DEMOSTRACION: FuenteDelPortal = {
  modo: 'plataforma',
  consulta: () => Promise.reject(new Error('no se consulta en esta prueba')),
  amnistia: fuenteDeDemostracion.amnistia,
  historial: fuenteDeDemostracion.historial,
  unidades: fuenteDeDemostracion.unidades,
};

describe('sumarLosTextosDeLaFuente', () => {
  it('EL CENTINELA: la direccion es un texto de los datos, y el locale de siempre no la trae', () => {
    expect(DE_LOS_DATOS).toBe('Casa habitación · Calle Santa Rosa 116');
    expect(i18n.getResource(IDIOMA_POR_OMISION, 'translation', DE_LOS_DATOS)).toBeUndefined();
  });

  it('sin demostracion en la fuente —la de la plataforma— no suma nada', () => {
    sumarLosTextosDeLaFuente(SIN_DEMOSTRACION);

    expect(i18n.getResource(IDIOMA_POR_OMISION, 'translation', DE_LOS_DATOS)).toBeUndefined();
  });

  it('con la de demostracion, sus textos pasan a ser del idioma', () => {
    expect(i18n.getResource(IDIOMA_POR_OMISION, 'translation', DE_LOS_DATOS)).toBeUndefined();

    sumarLosTextosDeLaFuente(fuenteDeDemostracion);

    expect(i18n.getResource(IDIOMA_POR_OMISION, 'translation', DE_LOS_DATOS)).toBe(DE_LOS_DATOS);
    // Y lo del portal sigue donde estaba: sumar no pisa.
    expect(i18n.getResource(IDIOMA_POR_OMISION, 'translation', 'Pago de tributos en línea')).toBe(
      'Pago de tributos en línea',
    );
  });
});
