import { expect, test } from '@playwright/test';

import { principal, seVeBien } from './portal.ts';

/**
 * **Si una pantalla no se puede dibujar, se dice dentro del marco, con palabras del portal** (issue 67).
 *
 * `src/enrutador.averia.test.tsx` mide el `errorElement` con una pantalla que revienta al pulsar;
 * esto mide el PAQUETE, sin tocar su codigo: el trozo de «Buscar mi deuda» (`Buscar-*.js`) se corta,
 * el `import()` perezoso rechaza al dibujar el paso, y lo que se ve tiene que ser el aviso del portal,
 * con la barra y la franja en pie, y no el «Unexpected Application Error!» de React Router.
 */

const TROZO_DE_BUSCAR = /\/assets\/Buscar-[^/]+\.js$/;

test('con el trozo de una pantalla cortado, se ve «No se pudo mostrar esta pantalla» dentro del marco', async ({ page }) => {
  let cortados = 0;
  await page.route(TROZO_DE_BUSCAR, (ruta) => {
    cortados += 1;
    return ruta.abort('failed');
  });
  // El navegador anota en la consola el trozo que no llego, y React lo que recogio: es lo esperado
  // aqui, y no se mide.

  await page.goto('./#/buscar');

  const aviso = principal(page).getByRole('alert');
  await expect(aviso).toBeVisible();
  await expect(aviso.getByText('No se pudo mostrar esta pantalla')).toBeVisible();
  await expect(
    aviso.getByText(
      'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Unexpected Application Error!')).toHaveCount(0);
  // El marco sigue: la barra, la franja y el pie.
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  // El centinela: se corto de verdad el trozo. Sin esto, un paquete que no partiera las pantallas daria
  // «Buscar mi deuda» entera y la prueba fallaria por otro motivo que no dice nada de esto.
  expect(cortados, 'el paquete no pidio ningun trozo `Buscar-*.js`').toBeGreaterThan(0);

  for (const ancho of [1180, 320]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await seVeBien(page, `el aviso de una pantalla rota a ${ancho} px`);
    await test.info().attach(`aviso de una pantalla rota a ${ancho} px`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }

  // «Volver a cargar» recarga de verdad: con el trozo en su sitio, la pantalla vuelve.
  await page.unroute(TROZO_DE_BUSCAR);
  await aviso.getByRole('button', { name: 'Volver a cargar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeVisible();
  await expect(page.getByText('No se pudo mostrar esta pantalla')).toHaveCount(0);
});
