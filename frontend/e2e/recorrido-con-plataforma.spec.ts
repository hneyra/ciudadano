import { type Page, expect, test } from '@playwright/test';

import { URL_CON_PLATAFORMA } from '../puerto-del-arnes.mjs';
import { principal, seVeBien } from './portal.ts';

/**
 * **AC6 — el recorrido CON PLATAFORMA, contra un backend falso que pone el propio arnes** (issue 28).
 *
 * Los demas caminos de `e2e/` recorren el paquete de **demostracion**, que es el del artboard. Este
 * recorre el otro portal: el paquete de PRODUCCION, que el segundo `webServer` de
 * `playwright.config.ts` construye y sirve en su puerto. Alli no hay datos de demostracion —los
 * pliega Rollup— y todo sale del servidor.
 *
 * <h2>El backend falso: `page.route`, y no un servicio levantado</h2>
 *
 * En CI no hay Keycloak ni base de datos, y levantarlos para esto costaria minutos y una docena de
 * cosas que se pueden romper solas. Lo que hace falta es que el PORTAL crea que los tiene, y eso son
 * cuatro respuestas:
 *
 *   1. `/.well-known/openid-configuration` — la sonda de `entrar()`, que comprueba que el emisor esta
 *      **antes** de mandarle el navegador entero (`@kamayuk/sesion`);
 *   2. `/protocol/openid-connect/auth` — el formulario del emisor. Aqui se contesta con un 302 de
 *      vuelta al portal con el `code` y **el mismo `state` que el portal mando**: sin eso,
 *      `canjearSiVuelve` lo rechaza, que es justo lo que tiene que hacer con un codigo ajeno;
 *   3. `/protocol/openid-connect/token` — el canje, con un `access_token` que es un JWT de mentira. La
 *      firma la comprueba el backend y no el navegador (`src/api/claims.ts`);
 *   4. `GET /rentas/api/v1/portal/situacion` — la deuda.
 *
 * Lo que esto mide, y ninguna prueba de jsdom puede medir: que el paquete **construido** arranca en
 * el recorrido con plataforma, que el canje del arranque ocurre antes de montar, que la franja
 * renumerada se ve, y que el aviso de pago simulado esta en la pantalla de verdad.
 *
 * <h2>Lo que NO mide, y por que</h2>
 *
 * El emisor de verdad. La plataforma local existe y esta medida (`diseno/medidas/README.md`), pero
 * un arnes que la necesite no corre en CI y no corre en la maquina de quien no la tenga levantada.
 */

/** El realm y el cliente que el paquete de produccion trae horneados (`src/api/configuracion.ts`). */
const EMISOR = 'http://localhost:18180/realms/kamayuk-ciudadano';

/** Un JWT de mentira con los claims del realm del ciudadano. */
function tokenDeMentira(): string {
  const base64url = (texto: string) =>
    Buffer.from(texto, 'utf8').toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const cuerpo = JSON.stringify({
    name: 'Rufina Medina Medina',
    tipo_documento: 'DNI',
    numero_documento: '03593174',
  });
  return `${base64url('{"alg":"RS256"}')}.${base64url(cuerpo)}.firma-de-mentira`;
}

/** La deuda que contesta el backend falso: una obligacion, con cada importe con su fecha. */
const SITUACION = {
  tipoDocumento: 'DNI',
  numeroDocumento: '03593174',
  aLaFecha: '2026-09-16',
  municipalidadesRecorridas: 1,
  totalConsolidado: { importe: '1842.60', actualizadoA: '2026-09-16' },
  notaDelTotal: null,
  sinRegistros: false,
  municipalidades: [
    {
      ubigeo: '200104',
      nombre: 'Municipalidad Distrital de Catacaos',
      codigoContribuyente: '00000025673',
      nombreContribuyente: 'Rufina Medina Medina',
      activo: true,
      resumenDeSaldos: {
        insoluto: { importe: '1500.00', actualizadoA: '2026-09-16' },
        reajuste: { importe: '42.60', actualizadoA: '2026-09-16' },
        interes: { importe: '200.00', actualizadoA: '2026-09-16' },
        gasto: { importe: '100.00', actualizadoA: '2026-09-16' },
        total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        estadoDeLaConsulta: '1 obligacion con saldo al 16/09/2026',
      },
      obligaciones: [
        {
          tributo: 'PREDIAL',
          ejercicio: 2024,
          predioId: 41,
          vehiculoId: null,
          insoluto: { importe: '1500.00', actualizadoA: '2026-09-16' },
          reajuste: { importe: '42.60', actualizadoA: '2026-09-16' },
          interes: { importe: '200.00', actualizadoA: '2026-09-16' },
          gasto: { importe: '100.00', actualizadoA: '2026-09-16' },
          total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        },
      ],
      predios: [
        {
          codigoReferenciaCatastral: '20010400001234',
          tipo: 'Casa habitación',
          direccion: 'Calle Santa Rosa 116',
          porcentajeTitularidad: '100.00',
        },
      ],
    },
  ],
};

/**
 * El backend falso entero. Se instala en la pagina ANTES de la primera navegacion, y sobrevive a
 * las que vengan: el rebote del emisor es una navegacion mas.
 */
async function backendFalso(pagina: Page): Promise<{ readonly consultas: () => number }> {
  let consultas = 0;

  // 1. La sonda del emisor. `entrar()` la pide con `mode: 'no-cors'` antes de navegar.
  await pagina.route(`${EMISOR}/.well-known/openid-configuration`, (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ issuer: EMISOR }) }),
  );

  // 2. El formulario del emisor: se contesta con la vuelta, con EL MISMO `state` que llego.
  await pagina.route(`${EMISOR}/protocol/openid-connect/auth*`, (ruta) => {
    const pedida = new URL(ruta.request().url());
    const estado = pedida.searchParams.get('state') ?? '';
    const retorno = pedida.searchParams.get('redirect_uri') ?? URL_CON_PLATAFORMA;
    void ruta.fulfill({
      status: 302,
      headers: { location: `${retorno}?code=un-codigo-de-mentira&state=${estado}` },
    });
  });

  // 3. El canje.
  await pagina.route(`${EMISOR}/protocol/openid-connect/token`, (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: tokenDeMentira(), id_token: tokenDeMentira() }),
    }),
  );

  // 4. La deuda. La ruta es la del cliente: `/rentas/api/v1` + `/portal/situacion`.
  await pagina.route('**/rentas/api/v1/portal/situacion', (ruta) => {
    consultas += 1;
    void ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SITUACION) });
  });

  return { consultas: () => consultas };
}

/** Abre el portal con plataforma en su primer paso. */
async function abrirConPlataforma(pagina: Page): Promise<void> {
  await pagina.goto(URL_CON_PLATAFORMA);
  await expect(pagina.getByRole('heading', { level: 1, name: 'Entre con su cuenta del portal' })).toBeVisible();
}

/** «Entrar con mi cuenta» y el rebote entero, hasta el paso 2 con la deuda dibujada. */
async function entrarYLlegarALaDeuda(pagina: Page): Promise<void> {
  await principal(pagina).getByRole('button', { name: 'Entrar con mi cuenta' }).click();
  await expect(pagina).toHaveURL(/#\/deudas$/);
  await expect(pagina.getByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeVisible();
}

test.describe('el recorrido con plataforma', () => {
  test('sin sesion, el paso 1 es «Entrar» y la franja tiene CUATRO pasos', async ({ page }) => {
    await backendFalso(page);
    await abrirConPlataforma(page);

    const franja = page.getByRole('navigation');
    await expect(franja.getByRole('button')).toHaveText(['1Entrar', '2Elegir qué pago', '3Pagar', '4Comprobante']);
    // Los dos pasos del artboard que este recorrido no tiene.
    await expect(franja.getByRole('button', { name: 'Buscar mi deuda' })).toHaveCount(0);
    await expect(franja.getByRole('button', { name: 'Mis datos' })).toHaveCount(0);
    // Y el paquete de produccion NO trae los datos del artboard: ni el formulario de buscar.
    await expect(principal(page).getByRole('textbox')).toHaveCount(0);
    await seVeBien(page, 'entrar a 1280 px');
  });

  test('`#/buscar` escrito a mano no ensena un formulario que el backend ya no atiende', async ({ page }) => {
    await backendFalso(page);
    await page.goto(`${URL_CON_PLATAFORMA}#/buscar`);

    await expect(page).toHaveURL(/#\/entrar$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Entre con su cuenta del portal' })).toBeVisible();
  });

  test('entrar → elegir qué pago → pagar → comprobante, con la deuda del servidor', async ({ page }) => {
    const backend = await backendFalso(page);
    await abrirConPlataforma(page);
    await entrarYLlegarALaDeuda(page);

    // El paso 2: quien es y su concepto, los dos del servidor, y ni una cifra de la demostracion.
    await expect(principal(page).getByText('Rufina Medina Medina')).toBeVisible();
    await expect(principal(page).getByText('Impuesto predial 2024')).toBeVisible();
    await expect(principal(page).getByText('1 obligacion con saldo al 16/09/2026')).toBeVisible();
    expect(backend.consultas()).toBe(1);

    // Y el desglose dice que no lo hay, en vez de rellenarlo.
    await principal(page).getByRole('button', { name: 'Ver el detalle' }).click();
    await expect(principal(page).getByText('El portal no publica el desglose de este concepto.')).toBeVisible();

    // Paso 3 · Pagar, con el aviso de que no se cobra nada.
    await principal(page).getByRole('button', { name: 'Pagar todo' }).click();
    await expect(page).toHaveURL(/#\/pagar$/);
    await expect(
      principal(page).getByText('El pago en línea todavía no está disponible: esta pantalla es una demostración.'),
    ).toBeVisible();
    await seVeBien(page, 'pagar con plataforma a 1280 px');

    // Paso 4 · Comprobante: el mismo aviso, y el recibo con lo que dijo el servidor.
    await principal(page).getByRole('button', { name: 'Simular el pago: no se cobra nada' }).click();
    await expect(page).toHaveURL(/#\/comprobante$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Su pago se registró' })).toBeVisible();
    await expect(
      principal(page).getByText('El pago en línea todavía no está disponible: esta pantalla es una demostración.'),
    ).toBeVisible();
    await expect(principal(page).getByText('Impuesto predial 2024')).toBeVisible();
    // 1500 + 42.60 + 100 = 1642.60, sin el interes que la amnistia condona.
    await expect(principal(page).getByText('1,642.60').first()).toBeVisible();
  });

  test('con sesion, la barra dice quien entro con los claims del token', async ({ page }) => {
    await backendFalso(page);
    await abrirConPlataforma(page);
    await entrarYLlegarALaDeuda(page);

    const barra = page.getByRole('banner');
    await expect(barra.getByRole('button', { name: /Rufina Medina Medina/ })).toBeVisible();
    await expect(barra.getByRole('button', { name: /Rufina Medina Medina/ })).toContainText('DNI 03593174');
    // Y ya no se ofrece entrar.
    await expect(barra.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0);
  });

  test('a 400 px se ve igual de bien, y sin desplazar la pagina', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await backendFalso(page);
    await abrirConPlataforma(page);
    await seVeBien(page, 'entrar a 400 px');

    await entrarYLlegarALaDeuda(page);
    await seVeBien(page, 'elegir qué pago con plataforma a 400 px');
  });
});
