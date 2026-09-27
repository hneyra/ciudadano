import { type Page, expect, test } from '@playwright/test';

import { abrirElPortal, buscarMiDeuda, continuarConMiCorreo, pagarLoElegido } from './portal.ts';

/**
 * **Atras y adelante del navegador recorren los pasos ya alcanzados** (issue 61), contra el bundle.
 *
 * Hasta el issue 61 lo alcanzable se media por la posicion ACTUAL del recorrido (`i <= actual`): tras
 * volver atras a «Elegir qué pago», «Mis datos» y «Pagar» dejaban de ser alcanzables, el enrutador
 * reemplazaba su entrada del historial y el boton Adelante no llevaba a ninguna parte. Ahora sale del
 * progreso (`alcanzado`): lo que se alcanzo se puede volver a abrir, hacia atras y hacia adelante.
 *
 * Se mira lo que ve la persona —la ruta y el paso que la franja marca como actual— y no el estado.
 */

/** El paso que la franja marca como actual, por su nombre accesible. */
async function pasoActual(pagina: Page): Promise<string | null> {
  return pagina.getByRole('navigation').locator('button[aria-current="step"]').getAttribute('aria-label');
}

test('sin cuenta: recorrido hasta pagar, atras hasta buscar y adelante hasta pagar otra vez', async ({ page }) => {
  await abrirElPortal(page);
  await buscarMiDeuda(page);
  await pagarLoElegido(page);
  await continuarConMiCorreo(page);

  const camino: ReadonlyArray<readonly ['atras' | 'adelante', RegExp, string, string]> = [
    ['atras', /#\/identificar$/, 'Mis datos', '¿A dónde le enviamos el comprobante?'],
    ['atras', /#\/deudas$/, 'Elegir qué pago', 'Lo que debe, por concepto'],
    ['atras', /#\/buscar$/, 'Buscar mi deuda', 'Consulte y pague sus tributos'],
    ['adelante', /#\/deudas$/, 'Elegir qué pago', 'Lo que debe, por concepto'],
    ['adelante', /#\/identificar$/, 'Mis datos', '¿A dónde le enviamos el comprobante?'],
    ['adelante', /#\/pagar$/, 'Pagar', '¿Cómo quiere pagar?'],
  ];

  for (const [hacia, ruta, paso, titulo] of camino) {
    await test.step(`${hacia}: ${paso}`, async () => {
      if (hacia === 'atras') await page.goBack();
      else await page.goForward();
      await expect(page, `${hacia}, la ruta tenia que ser la de «${paso}»`).toHaveURL(ruta);
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
      expect(await pasoActual(page), `${hacia}, la franja no sigue a la ruta`).toBe(paso);
    });
  }
});
