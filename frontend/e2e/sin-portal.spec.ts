import { expect, test } from '@playwright/test';

/**
 * **Si el trozo del portal no llega, se dice: nunca una pagina en blanco** (issue 56).
 *
 * `src/inicio.test.ts` mide `cargarElPortal` con un `import()` que rechaza; esto mide el PAQUETE: que
 * Vite haya partido de verdad el portal en su propio trozo (`montaje-*.js`), que la entrada lo pida
 * con `import()` y que, con ese trozo cortado —un despliegue que lo sustituyo mientras la pagina
 * estaba abierta, una red que se cae—, `#raiz` acabe con el aviso y con las clases de la hoja, que
 * viaja en la entrada.
 */

test('con el trozo del portal cortado, se ve «No se pudo cargar el portal» y no una pagina vacia', async ({ page }) => {
  let cortados = 0;
  await page.route(/\/assets\/montaje-[^/]+\.js$/, (ruta) => {
    cortados += 1;
    return ruta.abort('failed');
  });
  // El navegador anota en la consola el trozo que no llego: es lo esperado aqui, y no se mide.

  await page.goto('./#/buscar');

  const aviso = page.getByRole('alert');
  await expect(aviso).toBeVisible();
  await expect(aviso.getByText('No se pudo cargar el portal')).toBeVisible();
  await expect(
    aviso.getByText(
      'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
    ),
  ).toBeVisible();
  // El centinela: se corto de verdad el trozo del portal. Sin esto, un paquete sin trozo aparte
  // daria el portal entero y la prueba fallaria por otro motivo que no dice nada de esto.
  expect(cortados, 'el paquete no pidio ningun trozo `montaje-*.js`: el portal no esta partido').toBeGreaterThan(0);
  // Con la hoja: el titulo va en negrita (`font-bold`); sin ella, un `<p>` sale a 400.
  await expect(aviso.getByText('No se pudo cargar el portal')).toHaveCSS('font-weight', '700');
});

test('y con el trozo en su sitio, el aviso no aparece', async ({ page }) => {
  await page.goto('./#/buscar');

  await expect(page.getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeVisible();
  await expect(page.getByText('No se pudo cargar el portal')).toHaveCount(0);
});
