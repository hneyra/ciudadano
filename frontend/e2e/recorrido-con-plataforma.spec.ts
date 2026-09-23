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

/** Lo que el backend falso cuenta: cuantas consultas, y cuantas preguntas al emisor de cada clase. */
interface BackendFalso {
  readonly consultas: () => number;
  /** Las del marco oculto del arranque, con `prompt=none` (issue 35). */
  readonly silenciosas: () => number;
  /** Las de «Entrar con mi cuenta»: la pagina entera se va al formulario. */
  readonly conFormulario: () => number;
}

/**
 * El backend falso entero. Se instala en la pagina ANTES de la primera navegacion, y sobrevive a
 * las que vengan: el rebote del emisor es una navegacion mas.
 */
async function backendFalso(pagina: Page): Promise<BackendFalso> {
  let consultas = 0;
  let silenciosas = 0;
  let conFormulario = 0;
  let sesionDelEmisor = false;

  // 1. La sonda del emisor. `entrar()` la pide con `mode: 'no-cors'` antes de navegar.
  await pagina.route(`${EMISOR}/.well-known/openid-configuration`, (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ issuer: EMISOR }) }),
  );

  // 2. El formulario del emisor: se contesta con la vuelta, con EL MISMO `state` que llego.
  //
  // Y con memoria de sesion, como el de verdad (issue 35): la primera entrada con formulario deja la
  // sesion del emisor viva, y desde entonces una pregunta con `prompt=none` —la del marco oculto del
  // arranque— vuelve con un codigo; antes de eso, con `error=login_required`. Sin esta memoria, el
  // canje silencioso entraria solo en la primera carga y el paso 1 no se veria nunca.
  await pagina.route(`${EMISOR}/protocol/openid-connect/auth*`, (ruta) => {
    const pedida = new URL(ruta.request().url());
    const estado = pedida.searchParams.get('state') ?? '';
    const retorno = pedida.searchParams.get('redirect_uri') ?? URL_CON_PLATAFORMA;
    const enSilencio = pedida.searchParams.get('prompt') === 'none';
    if (enSilencio) silenciosas += 1;
    else {
      conFormulario += 1;
      sesionDelEmisor = true;
    }
    const vuelta =
      enSilencio && !sesionDelEmisor
        ? `error=login_required&state=${estado}`
        : `code=un-codigo-de-mentira&state=${estado}`;
    void ruta.fulfill({ status: 302, headers: { location: `${retorno}?${vuelta}` } });
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

  return { consultas: () => consultas, silenciosas: () => silenciosas, conFormulario: () => conFormulario };
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
    const backend = await backendFalso(page);
    await abrirConPlataforma(page);

    // El arranque le pregunto al emisor en silencio (issue 35), UNA vez, y como no tenia sesion el
    // portal se quedo anonimo y donde estaba: sin ir al formulario.
    expect(backend.silenciosas()).toBe(1);
    expect(backend.conFormulario()).toBe(0);
    await expect(page).toHaveURL(/#\/entrar$/);

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

    // Paso 3 · Pagar: no hay medio de pago que ofrecer, y se dice.
    await principal(page).getByRole('button', { name: 'Pagar todo' }).click();
    await expect(page).toHaveURL(/#\/pagar$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Todavía no se puede pagar en línea' })).toBeVisible();
    await expect(
      principal(page).getByText('El pago en línea todavía no está disponible: esta pantalla es una demostración.'),
    ).toBeVisible();
    // Ni el numero para yapear ni el codigo del banco: son datos accionables de una ficcion, y aqui
    // hay una deuda de verdad delante (revision del issue 28).
    await expect(principal(page)).not.toContainText('969 032 194');
    await expect(principal(page)).not.toContainText('2026-0025673-4418');
    await seVeBien(page, 'pagar con plataforma a 1280 px');

    // Paso 4 · Comprobante: el mismo aviso, el recibo con lo que dijo el servidor, y NINGUNA
    // afirmacion de que se pago, se envio o se descontó algo.
    await principal(page).getByRole('button', { name: 'Simular el pago: no se cobra nada' }).click();
    await expect(page).toHaveURL(/#\/comprobante$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Así se vería su comprobante' })).toBeVisible();
    await expect(
      principal(page).getByText('El pago en línea todavía no está disponible: esta pantalla es una demostración.'),
    ).toBeVisible();
    await expect(principal(page)).not.toContainText('Su pago se registró');
    await expect(principal(page)).not.toContainText('La deuda pagada ya se descontó de su cuenta.');
    await expect(principal(page)).not.toContainText('Constancia de pago');
    await expect(principal(page)).not.toContainText('Número de operación');
    await expect(principal(page)).not.toContainText('Total pagado');
    await expect(principal(page)).toContainText('Comprobante de ejemplo');
    await expect(principal(page)).toContainText('Total que se pagaría');
    await expect(principal(page).getByText('Impuesto predial 2024')).toBeVisible();
    // 1500 + 42.60 + 100 = 1642.60, sin el interes que la amnistia condona.
    await expect(principal(page).getByText('1,642.60').first()).toBeVisible();

    // Y la deuda sigue donde estaba: volver al paso 2 la encuentra entera.
    await page.getByRole('navigation').getByRole('button', { name: 'Elegir qué pago' }).click();
    await expect(page).toHaveURL(/#\/deudas$/);
    await expect(principal(page).getByText('Impuesto predial 2024')).toBeVisible();
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

  test('recargar NO echa: con la sesion del emisor viva, se sigue dentro sin pulsar nada (issue 35)', async ({ page }) => {
    const backend = await backendFalso(page);
    await abrirConPlataforma(page);
    await entrarYLlegarALaDeuda(page);
    expect(backend.conFormulario()).toBe(1);

    await page.reload();

    // La deuda otra vez, y quien entro en la barra: el token se volvio a pedir por el marco, con la
    // pagina de vuelta `silencio.html` servida de verdad, y sin pasar por el formulario.
    await expect(page.getByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeVisible();
    await expect(page).toHaveURL(/#\/deudas$/);
    await expect(page.getByRole('banner').getByRole('button', { name: /Rufina Medina Medina/ })).toBeVisible();
    expect(backend.conFormulario(), 'recargar volvio a mandar a la persona al formulario').toBe(1);
    // Una pregunta por carga: la de la primera y la de la recarga. Ni un bucle, ni una de mas.
    expect(backend.silenciosas()).toBe(2);
    // Y el marco ya no esta: se quita siempre.
    await expect(page.locator('iframe')).toHaveCount(0);
    await seVeBien(page, 'recargado con la sesion del emisor viva');
  });

  test('si el emisor no contesta al arrancar, se dice «No se pudo abrir su sesión» (issue 35)', async ({ page }) => {
    // El marco hacia un emisor caido carga la pagina de error del navegador y no avisa de nada: lo
    // que lo delata es el tope de ocho segundos, y aqui se espera entero.
    test.slow();
    await page.route(`${EMISOR}/**`, (ruta) => ruta.abort('connectionrefused'));

    await page.goto(URL_CON_PLATAFORMA);

    // Mientras tanto, la espera: ni la pagina en blanco, ni un salto a la puerta.
    await expect(page.getByRole('status').filter({ hasText: 'Comprobando su sesión…' })).toBeVisible();
    await expect(page.getByText('No se pudo abrir su sesión')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/sin poder entrar: El emisor no contesto\./)).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});
