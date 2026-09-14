const { chromium } = require('/home/jorge/ws/rentas/frontend/node_modules/playwright');
const fs = require('fs');
const D = __dirname;

/** Lo que se mide en los dos: el contenido del paso 1, sin la barra ni el pie (ya medidos en #4). */
const medir = () => {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const h1 = document.querySelector('h1');
  const tarjeta = h1.parentElement.parentElement;
  const select = document.querySelector('main [role="combobox"]') || document.querySelector('select');
  const campo = [...document.querySelectorAll('input')].find((i) => i.placeholder === '00000025673');
  const boton = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/[⟦⟧]/g, '') === 'Buscar mi deuda' && !b.hasAttribute('aria-current'));
  const alerta = document.querySelector('[role="alert"]');
  const amnistia = [...document.querySelectorAll('strong')].find((s) => s.textContent.startsWith('Amnistía')).parentElement;
  const rotulo = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Buscar por' && s.children.length === 0);
  const caja = document.querySelector('svg path[d^="M3.2 7.4"]').closest('svg').parentElement;
  const capacidad = caja.parentElement.parentElement;
  const px = (r) => ({ ancho: Math.round(r.width * 100) / 100, alto: Math.round(r.height * 100) / 100 });
  return {
    anchoDoc: document.documentElement.scrollWidth,
    anchoVentana: window.innerWidth,
    hayDesplazamientoHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    tarjeta: { fondo: cs(tarjeta).backgroundColor, filo: cs(tarjeta).borderTopColor, sombra: cs(tarjeta).boxShadow },
    h1: { color: cs(h1).color, tam: cs(h1).fontSize, peso: cs(h1).fontWeight },
    rotulo: { tam: cs(rotulo).fontSize, peso: cs(rotulo).fontWeight, color: cs(rotulo).color },
    buscarPor: { ...px(select.getBoundingClientRect()), filo: cs(select).borderTopColor, letra: cs(select).fontSize },
    numero: { ...px(campo.getBoundingClientRect()), filo: cs(campo).borderTopColor, letra: cs(campo).fontSize },
    boton: { ...px(boton.getBoundingClientRect()), fondo: cs(boton).backgroundColor, letra: cs(boton).fontSize, peso: cs(boton).fontWeight },
    alerta: alerta && { fondo: cs(alerta).backgroundColor, tinta: cs(alerta).color, filo: cs(alerta).borderTopColor, filoIzq: `${cs(alerta).borderLeftWidth} ${cs(alerta).borderLeftColor}`, letra: cs(alerta).fontSize, relleno: cs(alerta).padding },
    capacidad: { filo: cs(capacidad).borderTopColor, caja: `${cs(caja).width} ${cs(caja).backgroundColor} ${cs(caja).color}` },
    amnistia: { fondo: cs(amnistia).backgroundColor, tinta: cs(amnistia).color, filo: cs(amnistia).borderTopColor, filoIzq: `${cs(amnistia).borderLeftWidth} ${cs(amnistia).borderLeftColor}`, relleno: cs(amnistia).padding },
  };
};

(async () => {
  const navegador = await chromium.launch();
  const salida = {};
  for (const ancho of [1180, 400]) {
    for (const estado of ['reposo', 'error']) {
      const art = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await art.goto('file://' + D + `/artboard-${estado}.html`);
      await art.screenshot({ path: `${D}/artboard-${estado}-${ancho}.png`, fullPage: true });
      salida[`artboard-${estado}-${ancho}`] = await art.evaluate(medir);
      await art.close();

      const portal = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await portal.goto('http://localhost:5174/portal/#/buscar');
      await portal.waitForSelector('main h1');
      if (estado === 'error') {
        await portal.locator('main').getByRole('button', { name: 'Buscar mi deuda' }).click();
        await portal.waitForSelector('[role="alert"]');
        // Fuera el foco del campo (react-hook-form lo enfoca al fallar), para comparar el filo en reposo con el artboard.
        await portal.evaluate(() => document.activeElement && document.activeElement.blur());
        await portal.mouse.move(0, 0);
      }
      await portal.waitForTimeout(300);
      await portal.screenshot({ path: `${D}/portal-${estado}-${ancho}.png`, fullPage: true });
      salida[`portal-${estado}-${ancho}`] = await portal.evaluate(medir);
      await portal.close();
    }
  }
  // Y la busqueda valida, en el navegador: a `#/deudas` con el aviso.
  const valida = await navegador.newPage({ viewport: { width: 1180, height: 900 } });
  await valida.goto('http://localhost:5174/portal/#/buscar');
  await valida.locator('main').getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
  await valida.locator('main').getByRole('button', { name: 'Buscar mi deuda' }).click();
  await valida.waitForFunction(() => location.hash === '#/deudas');
  await valida.getByText('Encontramos 4 conceptos pendientes.').waitFor();
  salida.busquedaValida = { hash: await valida.evaluate(() => location.hash), aviso: true };
  await valida.close();

  fs.writeFileSync(D + '/medidas.json', JSON.stringify(salida, null, 1));
  const img = (n) => 'file://' + D + '/' + n + '.png';
  for (const estado of ['reposo', 'error']) {
    fs.writeFileSync(D + `/lamina-${estado}.html`, `<body style="margin:0;font:14px Arial;background:#e5e5e5;padding:16px">
      <p style="margin:0 0 8px"><b>Paso 1 · Buscar mi deuda — ${estado === 'reposo' ? 'en reposo' : 'tras «Buscar mi deuda» con el campo vacio'}</b>. Izquierda: artboard (lineas 12-50, 53-117, 121-180 y 675-684, con 1065-1101 evaluadas). Derecha: portal (yarn dev, #/buscar).</p>
      <div style="display:flex;gap:16px;align-items:flex-start">
        <div><p style="margin:4px 0"><b>Artboard</b> 1180 px</p><img src="${img('artboard-' + estado + '-1180')}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 1180 px</p><img src="${img('portal-' + estado + '-1180')}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Artboard</b> 400 px</p><img src="${img('artboard-' + estado + '-400')}" style="display:block;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 400 px</p><img src="${img('portal-' + estado + '-400')}" style="display:block;border:1px solid #999"></div>
      </div></body>`);
    const lamina = await navegador.newPage({ viewport: { width: 2080, height: 900 }, deviceScaleFactor: 1 });
    await lamina.goto('file://' + D + `/lamina-${estado}.html`);
    await lamina.waitForTimeout(500);
    await lamina.screenshot({ path: `${D}/buscar-${estado}-artboard-y-portal.png`, fullPage: true });
    await lamina.close();
  }
  for (const [k, v] of Object.entries(salida)) console.log(k, JSON.stringify(v));
  await navegador.close();
})().catch((e) => { console.error(e); process.exit(1); });
