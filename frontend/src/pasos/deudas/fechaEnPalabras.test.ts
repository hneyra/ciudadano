// @vitest-environment node

import { formatearFechaEnPalabras } from '@kamayuk/formato';
import { describe, expect, it } from 'vitest';

import { FECHA_DE_CORTE } from '../../datos/demostracion.ts';
import { MESES, fechaEnPalabras } from './fechaEnPalabras.ts';

/**
 * **La fecha de corte dice «13 de setiembre de 2026»**: con año y sin «septiembre» (nota del revisor
 * del issue 6). La pantalla que la pinta se prueba en `Deudas.test.tsx`; aqui, la funcion.
 */

describe('fechaEnPalabras', () => {
  it('la fecha de corte de la demostracion es la del artboard, literal (lineas 199 y 1043)', () => {
    expect(fechaEnPalabras(FECHA_DE_CORTE)).toBe('13 de setiembre de 2026');
  });

  it('nunca dice «septiembre», y siempre lleva el año', () => {
    for (let mes = 1; mes <= 12; mes += 1) {
      const fecha = `2026-${String(mes).padStart(2, '0')}-01`;
      const dicho = fechaEnPalabras(fecha);
      expect(dicho, fecha).not.toMatch(/septiembre/i);
      expect(dicho, `${fecha} sin año`).toMatch(/ de 2026$/);
    }
    expect(MESES).toContain('setiembre');
  });

  it('los doce meses, en su orden, y el dia sin cero a la izquierda', () => {
    expect(MESES.map((_, i) => fechaEnPalabras(`1999-${String(i + 1).padStart(2, '0')}-03`))).toEqual([
      '3 de enero de 1999',
      '3 de febrero de 1999',
      '3 de marzo de 1999',
      '3 de abril de 1999',
      '3 de mayo de 1999',
      '3 de junio de 1999',
      '3 de julio de 1999',
      '3 de agosto de 1999',
      '3 de setiembre de 1999',
      '3 de octubre de 1999',
      '3 de noviembre de 1999',
      '3 de diciembre de 1999',
    ]);
    expect(fechaEnPalabras('2026-12-31')).toBe('31 de diciembre de 2026');
  });

  it('una forma que no es ISO, o un mes que no existe, revienta con su nombre', () => {
    expect(() => fechaEnPalabras('13/09/2026')).toThrow('«13/09/2026»');
    expect(() => fechaEnPalabras('2026-13-01')).toThrow('un mes que no existe');
  });

  it('HUECO MEDIDO: la de la libreria sigue diciendo «septiembre» y sin año', () => {
    // El motivo de que exista esta funcion. El dia que `@kamayuk/formato` escriba lo del artboard,
    // sale rojo: entonces se usa la suya y esta se borra.
    expect(formatearFechaEnPalabras(FECHA_DE_CORTE)).toBe('13 de septiembre');
  });
});
