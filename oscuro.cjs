// Impresion en oscuro (revision del PR del issue 9): el recibo y el lienzo tienen que salir blancos.
// Casos: el sistema en oscuro sin modo elegido, y el modo oscuro ELEGIDO (guardado por ProveedorDeTema).
// Mide en pantalla (oscuro), con `emulateMedia({ colorScheme: 'dark', media: 'print' })`, y con una
// impresion de verdad (`page.pdf()`), leyendo el estilo desde un `beforeprint` que escucha despues del portal.
const { chromium } = require('/home/jorge/ws/rentas/frontend/node_modules/playwright');
const fs = require('fs');
const D = __dirname;
const sufijo = process.argv[2] || '';

async function alComprobante(portal) {
  await portal.goto('http://localhost:5174/portal/#/buscar');
  const main = portal.locator('main');
  await main.getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
  await main.getByRole('button', { name: 'Buscar mi deuda' }).click();
  await main.getByRole('button', { name: 'Pagar todo' }).click();
  const correo = main.getByRole('region', { name: 'Solo con mi correo' });
  await correo.getByRole('textbox', { name: 'Correo electrónico' }).fill('maria@correo.com');
  await correo.getByRole('button', { name: 'Continuar al pago' }).click();
  await main.getByRole('button', { name: 'Pagar ahora' }).click();
  await main.getByRole('region', { name: 'Constancia de pago' }).waitFor();
  await portal.waitForTimeout(4500);
}

const leer = () => ({
  modo: document.documentElement.hasAttribute('data-modo') ? document.documentElement.getAttribute('data-modo') : '(ausente)',
  body: getComputedStyle(document.body).backgroundColor,
  recibo: getComputedStyle(document.querySelector('[data-recibo]')).backgroundColor,
  tintaDelRecibo: getComputedStyle(document.querySelector('[data-recibo] td')).color,
  print: matchMedia('print').matches,
});

(async () => {
  const navegador = await chromium.launch();
  const salida = {};
  for (const caso of ['sistema-oscuro', 'modo-oscuro-elegido']) {
    const contexto = await navegador.newContext({ viewport: { width: 1180, height: 900 }, colorScheme: 'dark' });
    if (caso === 'modo-oscuro-elegido') await contexto.addInitScript(() => localStorage.setItem('kamayuk.ciudadano.modo', 'oscuro'));
    const portal = await contexto.newPage();
    await alComprobante(portal);
    const r = {};
    r.pantalla = await portal.evaluate(leer);
    await portal.screenshot({ path: `${D}/oscuro-${caso}-pantalla${sufijo}.png` });
    await portal.emulateMedia({ colorScheme: 'dark', media: 'print' });
    await portal.waitForTimeout(300);
    r.emulada = await portal.evaluate(leer);
    await portal.screenshot({ path: `${D}/oscuro-${caso}-impresion${sufijo}.png`, fullPage: true });
    await portal.emulateMedia({ colorScheme: 'dark', media: 'screen' });
    await portal.waitForTimeout(300);
    r.trasEmular = await portal.evaluate(leer);
    await portal.evaluate((leerTexto) => {
      const leerEn = new Function(`return (${leerTexto})()`);
      window.__enBeforeprint = null;
      window.addEventListener('beforeprint', () => { window.__enBeforeprint = leerEn(); });
    }, leer.toString());
    await portal.pdf({ path: `${D}/oscuro-${caso}${sufijo}.pdf` });
    r.pdfEnBeforeprint = await portal.evaluate(() => window.__enBeforeprint);
    r.trasElPdf = await portal.evaluate(leer);
    r.preferenciaGuardada = await portal.evaluate(() => localStorage.getItem('kamayuk.ciudadano.modo'));
    salida[caso] = r;
    await contexto.close();
  }
  fs.writeFileSync(`${D}/oscuro${sufijo}.json`, JSON.stringify(salida, null, 1));
  console.log(JSON.stringify(salida, null, 1));
  await navegador.close();
})().catch((e) => { console.error(e); process.exit(1); });
