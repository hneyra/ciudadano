import { type Page, expect, test } from '@playwright/test';

import {
  MEDIOS,
  abrirElPortal,
  buscarMiDeuda,
  confirmarElPago,
  continuarConMiCorreo,
  pagarLoElegido,
  principal,
  recibo,
} from './portal.ts';

/**
 * **Al imprimir el comprobante, solo queda el recibo** (issue 11, sobre la regla del issue 9).
 *
 * `verificaciones/lo-no-imprimible-no-se-imprime.test.ts` mide que la regla `@media print` este en el
 * CSS emitido; esto mide que **el navegador la aplique**: con la impresion emulada, la barra, la franja,
 * el pie, los avisos, la banda de exito, las acciones y la invitacion no se ven, y el recibo si.
 *
 * <h2>Y en oscuro, se imprime en claro</h2>
 *
 * Con el equipo en oscuro, sin `useImpresionEnClaro` el recibo salia sobre `rgb(27, 27, 27)` (medido en
 * el issue 9). La impresion EMULADA no dispara `beforeprint`; lo que el gancho escucha ademas es el
 * cambio de `matchMedia('print')`, que es lo que aqui se ejercita.
 *
 * La captura de la vista de impresion se adjunta al informe (`impresion-claro.png`, `impresion-oscuro.png`).
 */

async function llegarAlComprobante(pagina: Page): Promise<void> {
  await abrirElPortal(pagina);
  await buscarMiDeuda(pagina);
  await pagarLoElegido(pagina);
  await continuarConMiCorreo(pagina);
  await confirmarElPago(pagina, MEDIOS[0]);
  // El aviso «Pago registrado…» esta abierto: tampoco puede salir en el papel.
  await expect(pagina.getByText(/^Pago registrado\. Le enviamos el comprobante a /)).toBeVisible();
}

async function soloQuedaElRecibo(pagina: Page): Promise<void> {
  const main = principal(pagina);
  await expect(recibo(pagina), 'el recibo tiene que imprimirse').toBeVisible();
  await expect(recibo(pagina).getByRole('table')).toBeVisible();

  const loQueNoSeImprime = {
    'la barra': pagina.getByRole('banner'),
    'la franja de pasos': pagina.locator('nav'),
    'el pie': pagina.getByRole('contentinfo'),
    'los avisos': pagina.getByText(/^Pago registrado\. Le enviamos el comprobante a /),
    'la banda de exito': main.getByRole('heading', { name: 'Su pago se registró' }),
    'las acciones': main.locator('[data-acciones]'),
    'la invitacion a crear cuenta': main.getByRole('heading', { name: 'Guarde este pago en una cuenta' }),
  };
  for (const [que, donde] of Object.entries(loQueNoSeImprime)) {
    await expect(donde, `en el papel sale ${que}`).toBeHidden();
  }
}

async function papelDe(pagina: Page): Promise<{ recibo: string; cuerpo: string; lienzo: string }> {
  return pagina.evaluate(() => {
    const recibo = document.querySelector('[data-recibo]');
    const lienzo = document.querySelector('#raiz > div');
    return {
      recibo: recibo === null ? '(no hay recibo)' : getComputedStyle(recibo).backgroundColor,
      cuerpo: getComputedStyle(document.body).backgroundColor,
      lienzo: lienzo === null ? '(no hay lienzo)' : getComputedStyle(lienzo).backgroundColor,
    };
  });
}

test.describe('en claro', () => {
  test.use({ colorScheme: 'light' });

  test('en pantalla se ve todo, y al imprimir solo el recibo, sobre blanco', async ({ page }, informe) => {
    await llegarAlComprobante(page);
    // En pantalla, lo que luego desaparece SI esta: sin esto, un recibo solo en la pantalla tambien pasaria.
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(principal(page).locator('[data-acciones]')).toBeVisible();

    await page.emulateMedia({ media: 'print' });
    await soloQuedaElRecibo(page);
    expect(await papelDe(page)).toEqual({ recibo: 'rgb(255, 255, 255)', cuerpo: 'rgb(255, 255, 255)', lienzo: 'rgb(255, 255, 255)' });

    await informe.attach('impresion-claro.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
});

test.describe('en oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('tambien solo el recibo, y en claro: la paleta oscura no llega al papel', async ({ page }, informe) => {
    await llegarAlComprobante(page);
    const enPantalla = await papelDe(page);
    // El centinela: en pantalla SI esta en oscuro. Si no lo estuviera, lo de abajo no mediria nada.
    expect(enPantalla.recibo, 'en pantalla el recibo no esta en oscuro').not.toBe('rgb(255, 255, 255)');

    await page.emulateMedia({ media: 'print' });
    await soloQuedaElRecibo(page);
    expect(await papelDe(page)).toEqual({ recibo: 'rgb(255, 255, 255)', cuerpo: 'rgb(255, 255, 255)', lienzo: 'rgb(255, 255, 255)' });

    await informe.attach('impresion-oscuro.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
});
