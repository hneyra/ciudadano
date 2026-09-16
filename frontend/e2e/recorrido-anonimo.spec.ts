import { expect, test } from '@playwright/test';

import {
  CORREO,
  MEDIOS,
  abrirElPortal,
  buscarMiDeuda,
  confirmarElPago,
  continuarConMiCorreo,
  elegirMedio,
  filasDe,
  pagarLoElegido,
  principal,
  recibo,
} from './portal.ts';

/**
 * **El recorrido sin cuenta, de punta a punta, contra el bundle** (issue 11).
 *
 * Buscar → elegir desmarcando un concepto → «Solo con mi correo» → los cuatro medios → pagar →
 * comprobante. Cada cifra que se mira es la que el contribuyente lee, escrita aqui A MANO y no
 * calculada: si una cuenta se rompe, la pantalla y esta prueba no pueden romperse a la vez.
 *
 * Las cifras, con el vehicular 2024 desmarcado (`src/datos/demostracion.ts`):
 *
 *   predial 2026   293.72 + 0.00 interes + 0.00 gastos  =   293.72
 *   arbitrios 2026 291.60 + 18.44        + 0.00        =   310.04
 *   predial 2024  1842.60 + 212.44       + 12.00       = 2,067.04
 *                 ───────   ──────         ─────         ────────
 *                 2427.92   230.88         12.00         2,670.80 total · 2,439.92 con la amnistia
 */

test('sin cuenta: buscar, desmarcar uno, pagar con correo por cada medio y ver el comprobante', async ({ page }) => {
  const main = principal(page);

  await test.step('buscar', async () => {
    await abrirElPortal(page);
    await buscarMiDeuda(page);
    await expect(main.getByText('S/ 3,563.24').first()).toBeVisible();
  });

  await test.step('elegir: se desmarca el vehicular y la barra de pago lo dice', async () => {
    const vehicular = main.getByRole('checkbox', { name: 'Pagar Impuesto vehicular 2024' });
    await expect(vehicular).toBeChecked();
    await vehicular.click();
    await expect(vehicular).not.toBeChecked();

    await expect(main.getByText('Va a pagar 3 conceptos de 4')).toBeVisible();
    await expect(main.getByText('S/ 2,670.80')).toBeVisible();
    await expect(main.getByText('Con la amnistía paga S/ 2,439.92: se descuentan S/ 230.88 de interés')).toBeVisible();
    await pagarLoElegido(page);
  });

  await test.step('mis datos: solo con el correo', async () => {
    await expect(
      main.getByText(/^Va a pagar S\/ 2,439\.92\. Necesitamos un correo para enviarle el comprobante\./),
    ).toBeVisible();
    await continuarConMiCorreo(page);
  });

  await test.step('pagar: el resumen, y cada uno de los cuatro medios con su panel', async () => {
    const resumen = main.getByRole('region', { name: 'Lo que va a pagar' });
    await expect(resumen.getByRole('listitem')).toHaveText([
      /^Impuesto predial 2026.*S\/ 293\.72$/,
      /^Arbitrios municipales 2026.*S\/ 310\.04$/,
      /^Impuesto predial 2024.*S\/ 2,067\.04$/,
    ]);
    const cifra = (rotulo: string) => resumen.locator('div', { has: page.getByRole('term').filter({ hasText: rotulo }) }).getByRole('definition');
    await expect(cifra('Impuesto y arbitrios')).toHaveText('S/ 2,427.92');
    await expect(cifra('Interés condonado')).toHaveText('− S/ 230.88');
    await expect(cifra('Gastos y costas')).toHaveText('S/ 12.00');
    await expect(cifra('Total a pagar')).toHaveText('S/ 2,439.92');
    await expect(resumen.getByText(`El comprobante se enviará a ${CORREO}.`)).toBeVisible();

    const [tarjeta, yape, pagalo, banco] = MEDIOS;

    await elegirMedio(page, yape);
    await expect(main.getByText('969 032 194')).toBeVisible();
    await expect(
      main.getByText('Confirme el monto exacto de S/ 2,439.92 y escriba su código de contribuyente en el mensaje.'),
    ).toBeVisible();

    await elegirMedio(page, pagalo);
    await expect(main.getByText('8 4 1 6 2')).toBeVisible();

    await elegirMedio(page, banco);
    await expect(main.getByText('2026-0025673-4418')).toBeVisible();
    await expect(main.getByText('Escriba el código de pago y confirme el monto de S/ 2,439.92.')).toBeVisible();
    await expect(main.getByRole('list', { name: 'Dónde puede pagarlo' }).getByRole('listitem')).toHaveCount(6);

    await elegirMedio(page, tarjeta);
    await main.getByRole('textbox', { name: 'Número de la tarjeta' }).fill('4111 1111 1111 1111');
    await confirmarElPago(page, tarjeta);
  });

  await test.step('comprobante: el recibo sellado con lo que se pago', async () => {
    const constancia = recibo(page);
    await expect(constancia.getByText('0003-0041418')).toBeVisible();
    await expect(constancia.getByRole('definition').filter({ hasText: CORREO })).toBeVisible();
    await expect(constancia.getByRole('definition').filter({ hasText: /^Tarjeta$/ })).toBeVisible();
    expect(await filasDe(constancia.getByRole('table'))).toEqual([
      ['Impuesto predial 2026', 'Casa habitación · Calle Santa Rosa 116', 'Cuotas 3 y 4 de 4', '293.72'],
      ['Arbitrios municipales 2026', 'Casa habitación · Calle Santa Rosa 116', 'Cuotas 1 a 8 de 12', '291.60'],
      ['Impuesto predial 2024', 'Casa habitación · Calle Santa Rosa 116', 'Cuotas 1 a 4 de 4', '1,854.60'],
    ]);
    const pie = constancia.locator('tfoot tr');
    await expect(pie.nth(0)).toHaveText(/Interés condonado por la .*− 230\.88$/);
    await expect(pie.nth(1)).toHaveText(/^Total pagado\s*2,439\.92$/);
    await expect(main.getByText(/^Pagó S\/ 2,439\.92 con tarjeta\. Le enviamos el comprobante a maria@correo\.com/)).toBeVisible();

    // Sin cuenta, la invitacion a guardarlo y «Consultar otra deuda»; ni «Ver mis pagos».
    await expect(main.getByRole('region', { name: 'Guarde este pago en una cuenta' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Consultar otra deuda' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Ver mis pagos' })).toHaveCount(0);
  });
});
