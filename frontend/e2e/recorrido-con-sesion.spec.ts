import { expect, test } from '@playwright/test';

import {
  MEDIOS,
  abrirElPortal,
  buscarMiDeuda,
  confirmarElPago,
  entrarConMiCuenta,
  filasDe,
  pagarLoElegido,
  principal,
  seVeBien,
} from './portal.ts';

/**
 * **El recorrido con cuenta, contra el bundle** (issue 11): buscar → elegir → entrar → pagar →
 * comprobante → «Ver mis pagos» → historial → cerrar sesion.
 *
 * Y el camino que pidio el revisor: **en un celular, entrar a la cuenta desde la barra**. A ≤ 880 px
 * el artboard esconde «Iniciar sesión»; aqui se queda solo con su icono (`src/marco/Barra.tsx`), y se
 * mide que a 400 px se vea, que su area tactil llegue a 44×44 px y que por el se llegue al historial.
 */

const barra = (pagina: import('@playwright/test').Page) => pagina.getByRole('banner');

test('con cuenta: buscar, elegir, entrar, pagar, comprobante, mis pagos y cerrar sesion', async ({ page }) => {
  const main = principal(page);
  const [tarjeta] = MEDIOS;

  await test.step('buscar y elegir todo', async () => {
    await abrirElPortal(page);
    await buscarMiDeuda(page);
    await expect(main.getByText('Va a pagar los 4 conceptos')).toBeVisible();
    await pagarLoElegido(page);
  });

  await test.step('entrar con la cuenta lleva a pagar, y la barra dice quien entro', async () => {
    await entrarConMiCuenta(page);
    await expect(page).toHaveURL(/#\/pagar$/);
    await expect(page.getByText('Bienvenida. Este pago quedará en su historial.')).toBeVisible();
    await expect(barra(page).getByRole('button', { name: /María E\. Castillo/ })).toBeVisible();
    await expect(barra(page).getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0);

    const resumen = main.getByRole('region', { name: 'Lo que va a pagar' });
    await expect(resumen.getByText('El comprobante se enviará a fruiz159@gmail.com.')).toBeVisible();
    await expect(resumen.getByRole('definition').last()).toHaveText('S/ 3,149.92');
  });

  await test.step('pagar y ver el comprobante, sin invitacion a crear cuenta', async () => {
    await confirmarElPago(page, tarjeta);
    await expect(main.getByRole('region', { name: 'Constancia de pago' }).locator('tfoot tr').last()).toHaveText(
      /^Total pagado\s*3,149\.92$/,
    );
    await expect(main.getByRole('region', { name: 'Guarde este pago en una cuenta' })).toHaveCount(0);
  });

  await test.step('«Ver mis pagos» abre el historial con el pago de hoy arriba', async () => {
    await main.getByRole('button', { name: 'Ver mis pagos' }).click();
    await expect(page).toHaveURL(/#\/historial$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis pagos' })).toBeVisible();
    // En el historial no hay franja de pasos.
    await expect(page.getByRole('navigation')).toHaveCount(0);

    await expect(main.getByRole('heading', { level: 2, name: 'Pago de S/ 3,149.92 registrado hoy' })).toBeVisible();
    const pagos = main.getByRole('region', { name: 'Pagos realizados' });
    const filas = await filasDe(pagos.getByRole('table'));
    expect(filas).toHaveLength(6);
    expect(filas[0]).toEqual([
      '13/09/2026',
      'Impuesto predial 2026 · Arbitrios municipales 2026 · Impuesto predial 2024 · Impuesto vehicular 2024',
      'Tarjeta',
      '0003-0041418',
      '3,149.92',
      'Comprobante',
    ]);
    await expect(main.getByRole('region', { name: 'Lo que queda pendiente' }).getByText('Sin deuda pendiente')).toBeVisible();
  });

  await test.step('cerrar sesion vuelve a buscar, sin la cuenta en la barra', async () => {
    await barra(page).getByRole('button', { name: /María E\. Castillo/ }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/#\/buscar$/);
    await expect(page.getByText('Sesión cerrada.')).toBeVisible();
    await expect(barra(page).getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(barra(page).getByRole('button', { name: /María/ })).toHaveCount(0);
  });
});

test('a 400 px se entra a la cuenta desde la barra: «Iniciar sesión» es un icono de 44×44 px', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await abrirElPortal(page);

  const iniciarSesion = barra(page).getByRole('button', { name: 'Iniciar sesión' });

  await test.step('el boton se ve, con su nombre accesible, y el texto no', async () => {
    await expect(iniciarSesion).toBeVisible();
    await expect(iniciarSesion.locator('svg')).toBeVisible();

    const medido = await iniciarSesion.evaluate((boton) => {
      const caja = boton.getBoundingClientRect();
      const texto = boton.querySelector('span');
      const cajaDelTexto = texto?.getBoundingClientRect();
      return {
        ancho: caja.width,
        alto: caja.height,
        // `sr-only` deja el texto en el arbol de accesibilidad y lo recorta a 1×1 px fuera de la vista.
        texto: cajaDelTexto === undefined ? null : { ancho: cajaDelTexto.width, alto: cajaDelTexto.height },
        dentroDeLaVentana: caja.left >= 0 && caja.right <= window.innerWidth,
      };
    });
    expect(medido.ancho, 'el area tactil de «Iniciar sesión» es mas estrecha que 44 px').toBeGreaterThanOrEqual(44);
    expect(medido.alto, 'el area tactil de «Iniciar sesión» es mas baja que 44 px').toBeGreaterThanOrEqual(44);
    expect(medido.texto, 'el texto «Iniciar sesión» sigue ocupando sitio a 400 px').toEqual({ ancho: 1, alto: 1 });
    expect(medido.dentroDeLaVentana, 'el boton se sale de la ventana').toBe(true);
    await seVeBien(page, 'buscar a 400 px, sin sesion');
  });

  await test.step('pulsado: «Mis datos» → «Con mi cuenta» → el historial', async () => {
    await iniciarSesion.click();
    await expect(page).toHaveURL(/#\/identificar$/);
    await expect(
      principal(page).getByText('Todavía no ha elegido qué pagar. Si tiene cuenta, entre para ver sus pagos y sus comprobantes.'),
    ).toBeVisible();
    await seVeBien(page, 'mis datos a 400 px');

    await entrarConMiCuenta(page);
    await expect(page).toHaveURL(/#\/historial$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis pagos' })).toBeVisible();
    await expect(page.getByText('Bienvenida. Aquí están sus pagos.')).toBeVisible();
    await seVeBien(page, 'el historial a 400 px');
  });
});
