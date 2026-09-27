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

/**
 * **Atras, atras, atras, adelante, adelante, adelante**, desde «Pagar», mirando en cada paso la ruta,
 * el titulo y el paso que la franja marca como actual.
 *
 * La franja se ESPERA (`toHaveAttribute`, que reintenta) y no se lee una vez (issue 74): la pantalla la
 * dibuja la ruta y la franja el recorrido, y el recorrido sigue a la ruta en el dibujo SIGUIENTE —el
 * efecto de `useLaUrlYElPaso` despacha `irA`—. Con la CPU frenada, el titulo ya estaba y la franja
 * todavia no: leida una vez daba «Pagar» (medido: 3 de 3 con x6). Y una espera no tapa un defecto,
 * porque lo que se mide ademas es que el historial no cambia de largo: atras y adelante no escriben en
 * el. Una franja que no llega nunca —el defecto del issue 74— sale roja al agotarse la espera.
 */
async function atrasYAdelanteDesdePagar(page: Page): Promise<void> {
  const largo = await page.evaluate(() => window.history.length);
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
      await expect(
        page.getByRole('navigation').getByRole('button', { name: paso, exact: true }),
        `${hacia}, la franja no sigue a la ruta`,
      ).toHaveAttribute('aria-current', 'step');
      await expect(page, `${hacia}, la ruta cambio despues de que la franja la siguiera`).toHaveURL(ruta);
      expect(await page.evaluate(() => window.history.length), `${hacia}, el portal escribio en el historial`).toBe(
        largo,
      );
    });
  }
}

test('sin cuenta: recorrido hasta pagar, atras hasta buscar y adelante hasta pagar otra vez', async ({ page }) => {
  await abrirElPortal(page);
  await buscarMiDeuda(page);
  await pagarLoElegido(page);
  await continuarConMiCorreo(page);

  await atrasYAdelanteDesdePagar(page);
});

/**
 * **Lo mismo con la CPU seis veces mas lenta** (issue 74, `Emulation.setCPUThrottlingRate` de
 * Chromium). `continuarConMiCorreo` vuelve en cuanto la URL es `#/pagar`, y con la CPU frenada el
 * enrutador todavia no ha dibujado «Pagar»: el primer Atras llega EN MEDIO de esa transicion. Hasta el
 * issue 74 el recorrido se quedaba en «Pagar» con la URL y la pantalla en «Mis datos», y asi seguia 14 s
 * despues. La prueba determinista del mismo defecto es `src/recorrido/rutas.transicion.test.tsx`; esta
 * es la de que en el navegador de verdad tambien pasa, y deja de pasar.
 */
test('con la CPU frenada: el primer atras llega antes de que se dibuje «Pagar», y el recorrido lo sigue', async ({
  page,
}) => {
  test.slow();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  await abrirElPortal(page);
  await buscarMiDeuda(page);
  await pagarLoElegido(page);
  await continuarConMiCorreo(page);

  await atrasYAdelanteDesdePagar(page);
});
