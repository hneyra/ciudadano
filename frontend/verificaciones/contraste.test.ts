// @vitest-environment node
//
// Cuentas sobre texto: no hace falta un DOM.

import { describe, expect, it } from 'vitest';

import { apilar, componer, conDosDecimales, contraste } from './contraste.ts';

/**
 * **El compositor de velos** (issue 75): `canalesDe` descarta el alfa, y para medir un texto sobre un
 * velo de la barra hay que componer el velo sobre `--azul` antes. Los valores esperados no son de esta
 * cuenta: son los papeles que axe midio en Chromium sobre el disparador abierto del menu de la sesion.
 */
describe('componer un velo sobre un papel', () => {
  it('`--barra-hover` sobre `--azul` de `clasico` en claro es el papel que axe midio en el disparador abierto', () => {
    expect(componer('rgba(255, 255, 255, 0.15)', '#0d5fa8')).toBe('#3177b5');
  });

  it('y el disco de las iniciales (`--barra-realce`) encima de ese, el que axe midio bajo «MC»', () => {
    expect(apilar('#0d5fa8', 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.12)')).toBe('#4a87be');
    // Y con eso salen las dos razones que axe dio: 3.59 el documento y 3.81 las iniciales. axe trunca a
    // dos decimales (`Math.floor`), y `conDosDecimales` redondea: 3.818 es su 3.81 y nuestro 3.82.
    const comoAxe = (razon: number) => (Math.floor(razon * 100) / 100).toFixed(2);
    expect(comoAxe(contraste('#cfe3f4', '#3177b5'))).toBe('3.59');
    expect(comoAxe(contraste('#ffffff', '#4a87be'))).toBe('3.81');
    expect(conDosDecimales(contraste('#ffffff', '#4a87be'))).toBe('3.82');
  });

  it('lee el alfa tal como lo escribe el artboard, sin espacios ni cero delante', () => {
    expect(componer('rgba(255,255,255,.15)', '#0d5fa8')).toBe('#3177b5');
  });

  it('una capa opaca tapa el papel, y una transparente lo deja como estaba', () => {
    expect(componer('#0a4c86', '#0d5fa8')).toBe('#0a4c86');
    expect(componer('rgb(10, 76, 134)', '#0d5fa8')).toBe('#0a4c86');
    expect(componer('rgba(255, 255, 255, 0)', '#0d5fa8')).toBe('#0d5fa8');
  });

  it('lo que no sabe leer no lo compone a ojo: lo dice', () => {
    expect(() => componer('var(--color-barra-hover)', '#0d5fa8')).toThrow(/No se pudo leer el color/);
  });
});
