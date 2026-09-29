import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { limpiarElPortal, montarElPortal } from '../../pruebas/portal.tsx';

/**
 * **Toda cifra del paso 2 sale de `src/datos/cuentas.ts`**, y ninguna de una suma de la pantalla
 * (issue 6, AC 1).
 *
 * Mirar que el total «da» `S/ 3,563.24` no lo demuestra: una pantalla que sumara por su cuenta con
 * `sumarImportes` daria lo mismo. Asi que aqui **se sustituyen las cuentas** por unas que devuelven
 * cifras imposibles —`1111.11` de total para cada concepto, `40.04` de deuda total— y se exige que la
 * pantalla pinte ESAS. Lo que la pantalla calculara por su lado saldria con las cifras de verdad, y
 * la prueba en rojo.
 *
 * El reductor (`src/recorrido/recorrido.ts`) importa las mismas `cuentaDe` y `resumenDe`, asi que sus
 * selectores `cuenta` y `resumen` devuelven tambien las sustituidas: lo que se mide es la pantalla
 * entera sobre las cuentas, venga por donde venga.
 */

vi.mock('../../datos/cuentas.ts', async (original) => {
  const deVerdad = await original<typeof import('../../datos/cuentas.ts')>();
  return {
    ...deVerdad,
    totalDe: () => '1111.11',
    recargoDe: () => '22.22',
    cuentaDe: () => ({ insoluto: '3.33', interes: '4.44', gastos: '5.55', total: '6.66', conAmnistia: '7.77' }),
    resumenDe: () => ({
      insoluto: '10.01',
      interes: '20.02',
      gastos: '30.03',
      total: '40.04',
      conAmnistia: '50.05',
      conceptos: 4,
      vencidas: 2,
    }),
  };
});

afterEach(limpiarElPortal);

describe('las cifras del paso 2 son las de `cuentas.ts`', () => {
  it('la banda, las cuatro cifras, cada concepto y la barra pintan lo que las cuentas devuelven', () => {
    montarElPortal({ hash: '#/deudas', estado: { paso: 'deudas' } });
    const main = within(screen.getByRole('main'));

    // `resumenDe`: la banda y las cifras.
    const banda = main.getByText(/^Deuda total al /).closest('[data-banda-del-total]') as HTMLElement;
    expect(within(banda).getByText('S/ 40.04')).toBeInTheDocument();
    expect(within(banda).getByText('S/ 50.05')).toBeInTheDocument();
    expect(within(banda).getByText('se descuenta S/ 20.02 de interés')).toBeInTheDocument();
    expect(within(banda).getByText('2 de 4 conceptos están vencidos. El interés corre cada día que pasa.')).toBeInTheDocument();
    const cifras = screen.getByRole('main').querySelector('[data-cifras]') as HTMLElement;
    expect(within(cifras).getByText('S/ 10.01')).toBeInTheDocument();
    expect(within(cifras).getByText('S/ 20.02')).toBeInTheDocument();
    expect(within(cifras).getByText('S/ 30.03')).toBeInTheDocument();

    // `totalDe` y `recargoDe`: cada concepto.
    expect(main.getAllByText('S/ 1,111.11')).toHaveLength(4);
    expect(main.getAllByText('incluye S/ 22.22 de recargo')).toHaveLength(4);

    // `cuentaDe`: la barra de pago.
    expect(main.getByText('S/ 6.66')).toBeInTheDocument();
    expect(main.getByText('Con la amnistía paga S/ 7.77: se descuentan S/ 4.44 de interés')).toBeInTheDocument();

    // Y ninguna cifra de verdad se colo por otro camino.
    for (const deVerdad of ['S/ 3,563.24', 'S/ 3,149.92', 'S/ 413.32', 'S/ 293.72', 'S/ 2,067.04']) {
      expect(main.queryByText(deVerdad), deVerdad).toBeNull();
    }
  });
});
