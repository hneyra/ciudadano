import { type Locator, type Page, expect, test } from '@playwright/test';

import {
  CORREO,
  MEDIOS,
  abrirElPortal,
  buscarMiDeuda,
  confirmarElPago,
  continuarConMiCorreo,
  elegirMedio,
  entrarConMiCuenta,
  pagarLoElegido,
  principal,
  seVeBien,
} from './portal.ts';

/**
 * **Que el portal se VE** (issue 11), portada de `rentas/frontend/e2e/se-ve.spec.ts` (rentas#107).
 *
 * Todo lo de aqui es lo que `vitest` **no puede** decir, porque jsdom no aplica CSS y las pruebas
 * comparan `className` como texto: que Tailwind emita las clases —las de `@kamayuk/ui` tambien, que
 * llegan por el `@source` de `src/estilos.css`—, que el navegador las aplique, que las rejillas se
 * reacomoden y que ninguna tabla desplace la pagina.
 *
 * <h2>Se mide la paleta CLARA, a proposito</h2>
 *
 * El azul de la barra es el de `clasico` en claro. Playwright emula claro por omision
 * (`colorScheme ?? 'light'`), pero un valor por omision de otra herramienta no es una decision: se
 * declara (como en `rentas`). La impresion en oscuro la mide `imprime-solo-el-recibo.spec.ts`.
 *
 * <h2>Los puntos de corte se miden EN el corte y un pixel por encima</h2>
 *
 * El artboard escribe `@media (max-width: 880px)`: a 880 px aplica y a 881 no. Tailwind v4 emite
 * `max-[880px]:` como `width < 880px`, que a 880 px NO aplica. Por eso se mide en el pixel exacto:
 * midiendo a 400 y a 1180 los dos se ven iguales. **Este arnes lo destapo en pagar**: con `max-[820px]`,
 * a 820 px el resumen seguia a la derecha («a 820 px el resumen tiene que ir ENCIMA de los medios»,
 * Expected <= 129, Received 725), y con `max-[520px]`, a 520 px los medios iban en dos columnas.
 * Corregido en su componente (`max-[821px]`, `max-[521px]`). Las cifras de elegir qué pago tenian el
 * mismo `max-[520px]` y se corrigieron igual, pero ahi el corte no se ve a 520 px —el `auto-fit` ya da
 * dos columnas— y se mide a 360.
 */
test.use({ colorScheme: 'light' });

const ANCHURAS = [1180, 400] as const;

/** Abre el detalle de un concepto: su tabla lleva un ancho minimo de 560 a 640 px. */
async function abrirElDetalle(pagina: Page, concepto: string): Promise<void> {
  const fila = principal(pagina)
    .getByRole('listitem')
    .filter({ has: pagina.getByRole('checkbox', { name: `Pagar ${concepto}` }) });
  await fila.getByRole('button', { name: 'Ver el detalle' }).click();
  await expect(fila.getByRole('table')).toBeVisible();
}

for (const ancho of ANCHURAS) {
  test(`a ${ancho} px, en cada paso: sin desplazamiento de lado, la barra azul y Arial`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    const main = principal(page);

    await test.step('buscar', async () => {
      await abrirElPortal(page);
      await seVeBien(page, `buscar a ${ancho} px`);
    });

    await test.step('elegir qué pago, con los cuatro desgloses abiertos', async () => {
      await buscarMiDeuda(page);
      await seVeBien(page, `elegir qué pago a ${ancho} px`);
      for (const concepto of ['Impuesto predial 2026', 'Arbitrios municipales 2026', 'Impuesto predial 2024', 'Impuesto vehicular 2024']) {
        await abrirElDetalle(page, concepto);
        await seVeBien(page, `elegir qué pago a ${ancho} px, con el desglose de «${concepto}»`);
      }
      await pagarLoElegido(page);
    });

    await test.step('mis datos', async () => {
      await expect(page.getByRole('heading', { level: 1, name: '¿A dónde le enviamos el comprobante?' })).toBeVisible();
      await seVeBien(page, `mis datos a ${ancho} px`);
      await continuarConMiCorreo(page, CORREO);
    });

    await test.step('pagar, con cada medio', async () => {
      for (const medio of [...MEDIOS].reverse()) {
        await elegirMedio(page, medio);
        await seVeBien(page, `pagar a ${ancho} px, con «${medio.rotulo}»`);
      }
      await confirmarElPago(page, MEDIOS[0]);
    });

    await test.step('comprobante', async () => {
      await seVeBien(page, `el comprobante a ${ancho} px`);
      await main.getByRole('button', { name: 'Crear mi cuenta' }).click();
    });

    await test.step('mis pagos', async () => {
      await entrarConMiCuenta(page);
      await expect(page).toHaveURL(/#\/historial$/);
      await expect(main.getByRole('region', { name: 'Pagos realizados' }).getByRole('table')).toBeVisible();
      await expect(main.getByRole('region', { name: 'De dónde sale lo que paga' }).getByRole('listitem').first()).toBeVisible();
      await seVeBien(page, `mis pagos a ${ancho} px`);
    });
  });
}

/**
 * **Las clases de `@kamayuk/ui` generan regla, y el navegador la aplica** (rentas#107).
 *
 * `@kamayuk/ui` llega por `link:` y vive en `node_modules`, que Tailwind no lee: sin el `@source` de
 * `src/estilos.css` el portal sigue dibujandose —el complemento de Vite ve las clases de los modulos
 * que atraviesan el empaquetado—, pero **medido al quitarlo, el CSS emitido baja de 49.1 a 39.1 kB y
 * 161 clases de la libreria dejan de generar regla**. Entre ellas estas dos, que se ven:
 *
 * · el contorno de foco sobre la barra (`CONTORNO_DE_FOCO_EN_LA_BARRA`): sin su regla cae en el
 *   contorno global, `--azul` sobre la barra `--azul`, y quien navega con teclado no ve donde esta;
 * · el hover del boton primario (`hover:bg-azul-hover`).
 */
test('las clases de `@kamayuk/ui` llegan al navegador: el foco sobre la barra y el hover del boton primario', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await abrirElPortal(page);

  const contornoDelFoco = () =>
    page.evaluate(() => {
      const enfocado = document.activeElement;
      if (enfocado === null || enfocado.closest('header') === null) return '(el foco no esta en la barra)';
      const estilo = getComputedStyle(enfocado);
      return `${estilo.outlineStyle} ${estilo.outlineWidth} ${estilo.outlineColor}`;
    });

  // Con el teclado: el foco que se pinta es el de `:focus-visible`, no el de un clic.
  await page.keyboard.press('Tab');
  expect(await contornoDelFoco(), 'el contorno de foco de la marca, sobre la barra azul').toBe('solid 2px rgb(255, 255, 255)');
  await page.keyboard.press('Tab');
  expect(await contornoDelFoco(), 'el contorno de foco de «Iniciar sesión», sobre la barra azul').toBe(
    'solid 2px rgb(255, 255, 255)',
  );

  const buscar = principal(page).getByRole('button', { name: 'Buscar mi deuda' });
  const papel = () => buscar.evaluate((boton) => getComputedStyle(boton).backgroundColor);
  expect(await papel()).toBe('rgb(13, 95, 168)');
  await buscar.hover();
  // `--azul-hover` de `clasico` en claro: #0A4C86.
  await expect.poll(papel, { message: 'el boton primario no cambia al pasar por encima' }).toBe('rgb(10, 76, 134)');
});

/** Cuantas columnas ocupan unos elementos, por su borde izquierdo. */
async function columnasDe(elementos: Locator): Promise<number> {
  const izquierdas = await elementos.evaluateAll((nodos) => nodos.map((n) => Math.round(n.getBoundingClientRect().left)));
  return new Set(izquierdas).size;
}

/** `true` si el elemento no ocupa sitio en la vista (oculto, o `sr-only`: recortado a 1×1 px). */
async function noSeVe(elemento: Locator): Promise<boolean> {
  return elemento.evaluate((nodo) => {
    const caja = nodo.getBoundingClientRect();
    return caja.width <= 1 && caja.height <= 1;
  });
}

test.describe('los puntos de corte del artboard', () => {
  test('880: la franja se queda con los numeros y «Iniciar sesión» con su icono', async ({ page }) => {
    const franja = () => page.getByRole('navigation');
    const etiquetas = () => franja().getByRole('button').locator('span:not([aria-hidden])');
    const textoDeIniciarSesion = () => page.getByRole('banner').getByRole('button', { name: 'Iniciar sesión' }).locator('span');

    await page.setViewportSize({ width: 881, height: 900 });
    await abrirElPortal(page);
    await expect(etiquetas()).toHaveCount(5);
    for (const etiqueta of await etiquetas().all()) await expect(etiqueta).toBeVisible();
    expect(await noSeVe(textoDeIniciarSesion()), 'a 881 px «Iniciar sesión» tiene que decirlo').toBe(false);

    await page.setViewportSize({ width: 880, height: 900 });
    for (const etiqueta of await etiquetas().all()) await expect(etiqueta).toBeHidden();
    // Los numeros siguen, y cada boton se sigue llamando como su paso.
    await expect(franja().getByRole('button', { name: 'Elegir qué pago' })).toBeVisible();
    expect(await noSeVe(textoDeIniciarSesion()), 'a 880 px el texto de «Iniciar sesión» sigue ocupando sitio').toBe(true);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('820: el resumen de pagar pasa arriba y el codigo baja a 24 px; 520: medios y bancos en una columna', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await abrirElPortal(page);
    await buscarMiDeuda(page);
    await pagarLoElegido(page);
    await continuarConMiCorreo(page);
    await elegirMedio(page, MEDIOS[3]);

    const main = principal(page);
    const resumen = main.getByRole('region', { name: 'Lo que va a pagar' });
    const titulo = main.getByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' });
    const medios = main.locator('[data-medios] > button');
    const bancos = main.getByRole('list', { name: 'Dónde puede pagarlo' }).getByRole('listitem');
    const codigo = main.locator('[data-codigo]');
    const letraDelCodigo = () => codigo.evaluate((nodo) => getComputedStyle(nodo).fontSize);

    await page.setViewportSize({ width: 821, height: 900 });
    const [cajaDelResumen, cajaDelTitulo] = [await resumen.boundingBox(), await titulo.boundingBox()];
    expect(cajaDelResumen!.x, 'a 821 px el resumen tiene que ir a la derecha').toBeGreaterThan(cajaDelTitulo!.x + 200);
    expect(await letraDelCodigo()).toBe('31px');

    await page.setViewportSize({ width: 820, height: 900 });
    const [arriba, debajo] = [await resumen.boundingBox(), await titulo.boundingBox()];
    expect(arriba!.y + arriba!.height, 'a 820 px el resumen tiene que ir ENCIMA de los medios').toBeLessThanOrEqual(debajo!.y);
    expect(Math.round(arriba!.x), 'a 820 px el resumen ocupa la columna entera').toBe(Math.round(debajo!.x));
    expect(await letraDelCodigo()).toBe('24px');

    await page.setViewportSize({ width: 521, height: 900 });
    expect(await columnasDe(medios), 'a 521 px los medios van en mas de una columna').toBeGreaterThan(1);
    expect(await columnasDe(bancos), 'a 521 px los bancos van en mas de una columna').toBeGreaterThan(1);

    await page.setViewportSize({ width: 520, height: 900 });
    expect(await columnasDe(medios), 'a 520 px los medios van en UNA columna').toBe(1);
    expect(await columnasDe(bancos), 'a 520 px los bancos van en UNA columna').toBe(1);
    expect(await letraDelCodigo()).toBe('21px');
  });

  test('520: las cuatro cifras de elegir qué pago van de dos en dos, tambien en un telefono estrecho', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await abrirElPortal(page);
    await buscarMiDeuda(page);
    const cifras = principal(page).locator('[data-cifras] > li');
    await expect(cifras).toHaveCount(4);
    expect(await columnasDe(cifras), 'a 1180 px las cuatro cifras van en una fila').toBe(4);

    await page.setViewportSize({ width: 520, height: 900 });
    expect(await columnasDe(cifras), 'a 520 px las cifras van de dos en dos').toBe(2);

    // A 520 px el `auto-fit` de 162 px ya da dos columnas por su cuenta: donde la regla se nota es en un
    // telefono estrecho, donde sin ella las cuatro irian una debajo de otra.
    await page.setViewportSize({ width: 360, height: 900 });
    expect(await columnasDe(cifras), 'a 360 px las cifras siguen de dos en dos').toBe(2);
  });

  test('700: las acciones del comprobante van en columna, a lo ancho', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await abrirElPortal(page);
    await buscarMiDeuda(page);
    await pagarLoElegido(page);
    await continuarConMiCorreo(page);
    await confirmarElPago(page, MEDIOS[0]);

    const acciones = principal(page).locator('[data-acciones]');
    const botones = acciones.getByRole('button');
    await expect(botones).toHaveCount(3);
    const filas = () => botones.evaluateAll((nodos) => new Set(nodos.map((n) => Math.round(n.getBoundingClientRect().top))).size);

    await page.setViewportSize({ width: 701, height: 900 });
    expect(await filas(), 'a 701 px «Descargar comprobante» e «Imprimir» van en la misma fila').toBeLessThan(3);

    await page.setViewportSize({ width: 700, height: 900 });
    expect(await filas(), 'a 700 px cada accion va en su fila').toBe(3);
    const anchoDeLasAcciones = (await acciones.boundingBox())!.width;
    for (const boton of await botones.all()) {
      expect(Math.round((await boton.boundingBox())!.width), 'a 700 px cada accion ocupa el ancho entero').toBe(
        Math.round(anchoDeLasAcciones),
      );
    }
  });
});

test('y la consola queda limpia en el recorrido', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(error.message));

  await abrirElPortal(page);
  await buscarMiDeuda(page);
  await pagarLoElegido(page);
  await continuarConMiCorreo(page);
  await confirmarElPago(page, MEDIOS[0]);

  // Sin backend no hay peticiones que fallen: cualquier error es de la aplicacion o de un trozo que no llego.
  expect(errores).toEqual([]);
});
