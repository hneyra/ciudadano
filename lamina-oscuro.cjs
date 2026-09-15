const { chromium } = require('/home/jorge/ws/rentas/frontend/node_modules/playwright');
const fs = require('fs');
const D = __dirname;
(async () => {
  const b = await chromium.launch();
  for (const caso of ['sistema-oscuro', 'modo-oscuro-elegido']) {
    const col = [['Pantalla (oscuro)', `oscuro-${caso}-pantalla`], ['Impresión emulada, con el cambio', `oscuro-${caso}-impresion`], ['Impresión emulada, SIN useImpresionEnClaro (rotura)', `oscuro-${caso}-impresion-sin-hook`]];
    fs.writeFileSync(`${D}/lamina.html`, `<body style="margin:0;font:14px Arial;background:#e5e5e5;padding:16px"><p style="margin:0 0 8px"><b>Comprobante en oscuro — ${caso === 'sistema-oscuro' ? 'sistema en oscuro, sin modo elegido' : 'modo oscuro elegido (kamayuk.ciudadano.modo = oscuro)'}</b>. Chromium con colorScheme dark; impresión con emulateMedia({ colorScheme: 'dark', media: 'print' }).</p><div style="display:flex;gap:16px;align-items:flex-start">${col.map(([t, n]) => `<div><p style="margin:4px 0"><b>${t}</b></p><img src="file://${D}/${n}.png" style="display:block;width:590px;border:1px solid #999"></div>`).join('')}</div></body>`);
    const p = await b.newPage({ viewport: { width: 1860, height: 900 } });
    await p.goto(`file://${D}/lamina.html`);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${D}/comprobante-${caso}-impresion-en-claro.png`, fullPage: true });
    await p.close();
  }
  fs.unlinkSync(`${D}/lamina.html`);
  await b.close();
})();
