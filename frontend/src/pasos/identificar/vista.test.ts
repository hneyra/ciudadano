import { beforeAll, describe, expect, it } from 'vitest';

import { LA_DEMOSTRACION } from '../../datos/fuenteDeDemostracion.ts';
import i18n, { IDIOMA_POR_OMISION } from '../../i18n/i18n.ts';
import { enDemostracion } from '../../modo/modo.ts';
import { estadoInicial, recorrido } from '../../recorrido/recorrido.ts';
import { correoCompleto, laBienvenida, laIntroduccion } from './vista.ts';

/** **Lo que «Mis datos» decide y dice, sin montar nada** (issue 60). */

const t = i18n.t.bind(i18n);

beforeAll(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

const AL_ABRIR = estadoInicial({ en: enDemostracion(LA_DEMOSTRACION), autenticado: false, amnistia: true });
const BUSCADO = recorrido(AL_ABRIR, { tipo: 'buscar', tipoDeDocumento: 'DNI', numero: '03593174' });

describe('mis datos', () => {
  it('un correo esta completo con algo antes de la @ y un punto despues (artboard, linea 1187)', () => {
    expect(['maria@example.com', 'a@b.c'].map(correoCompleto)).toEqual([true, true]);
    expect(['@example.com', 'maria@example', 'maria.example@com', ''].map(correoCompleto)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('con algo que pagar, el parrafo dice cuanto, con la amnistia; y entrar lleva a pagar', () => {
    expect(laIntroduccion(BUSCADO, t)).toMatch(/^Va a pagar S\/ 3,149\.92\. /);
    expect(laBienvenida(BUSCADO, t)).toBe('Bienvenida. Este pago quedará en su historial.');
  });

  it('sin haber elegido nada, no dice «Va a pagar», y entrar lleva a los pagos', () => {
    expect(laIntroduccion(AL_ABRIR, t)).toBe(
      'Todavía no ha elegido qué pagar. Si tiene cuenta, entre para ver sus pagos y sus comprobantes.',
    );
    expect(laBienvenida(AL_ABRIR, t)).toBe('Bienvenida. Aquí están sus pagos.');
  });
});
