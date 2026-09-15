// Capturas del paso 3 (issue 7): el artboard renderizado con SU PROPIA logica y el portal (`yarn dev`).
//
// El artboard no se reescribe a mano: se toma la plantilla de `<x-dc>` (lineas 53-690) y el
// `class Component` del `<script type="text/x-dc">`, se instancia con un `DCLogic` minimo (solo
// `props`), se fija el `state` de cada caso y se expanden `<sc-if>`, `<sc-for>` y `{{ }}` con los
// valores de `renderVals()`. `<sc-*>` se pasan a `<template>` antes de parsear, porque dentro de una
// `<table>` el parser HTML sacaria un elemento desconocido fuera de la tabla.
//
// Chromium de ~/.cache/ms-playwright con el `playwright` de rentas/frontend/node_modules (no se toca nada alli).
const { chromium } = require('/home/jorge/ws/rentas/frontend/node_modules/playwright');
const fs = require('fs');

const D = __dirname;
const FE = '/tmp/claude-1000/-home-jorge-ws-ciudadano/ae63e912-83b6-4026-817c-169e14c25ecf/scratchpad/obra/ciudadano/frontend';
const PORTAL = 'http://localhost:5174/portal/#/buscar';

const artboard = fs.readFileSync(FE + '/diseno/Ciudadano.dc.html', 'utf8');
const estilo = /<helmet>[\s\S]*?(<style>[\s\S]*?<\/style>)/.exec(artboard)[1];
const plantilla = /<\/helmet>([\s\S]*?)<\/x-dc>/.exec(artboard)[1];
const codigo = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(artboard)[1];

const CASOS = {
  'con-seleccion': { paso: 'identificar' },
  'con-errores': {
    paso: 'identificar',
    correo: 'maria@correo',
    errorCorreo: 'Ese correo no parece completo. Revíselo: le enviaremos el comprobante ahí.',
    errorLogin: 'Escriba su documento y su clave para entrar.',
  },
};

/** Se ejecuta en la pagina del artboard. */
function renderizar({ plantilla, codigo, estado }) {
  class DCLogic {
    constructor() {
      this.props = {};
    }
    setState() {}
  }
  const Component = new Function('DCLogic', `${codigo}\nreturn Component;`)(DCLogic);
  const c = new Component();
  c.state = { ...c.state, ...estado };
  const vals = c.renderVals();

  const evaluar = (expr, scope) => new Function('s', `with (s) { return (${expr}); }`)(scope);
  const solo = (texto) => /^\s*\{\{([\s\S]*?)\}\}\s*$/.exec(texto)?.[1];
  const interpolar = (texto, scope) =>
    texto.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => {
      const v = evaluar(e, scope);
      return v === null || v === undefined || v === false ? '' : String(v);
    });

  const fuente = document.createElement('div');
  fuente.innerHTML = plantilla
    .replace(/<sc-(if|for)\b/g, '<template data-sc-$1')
    .replace(/<\/sc-(if|for)>/g, '</template>');

  function expandir(origen, destino, scope) {
    for (const n of origen.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        destino.appendChild(document.createTextNode(interpolar(n.data, scope)));
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      if (n.tagName === 'TEMPLATE' && n.hasAttribute('data-sc-if')) {
        if (evaluar(solo(n.getAttribute('value')), scope)) expandir(n.content, destino, scope);
        continue;
      }
      if (n.tagName === 'TEMPLATE' && n.hasAttribute('data-sc-for')) {
        const lista = evaluar(solo(n.getAttribute('list')), scope) || [];
        for (const item of lista) {
          const hijo = Object.create(scope);
          hijo[n.getAttribute('as')] = item;
          expandir(n.content, destino, hijo);
        }
        continue;
      }
      const copia = n.cloneNode(false);
      for (const { name, value } of [...n.attributes]) {
        copia.removeAttribute(name);
        if (/^on/i.test(name) || name === 'style-hover') continue;
        const expr = solo(value);
        if (name === 'checked') {
          if (expr === undefined || evaluar(expr, scope)) copia.setAttribute('checked', '');
          continue;
        }
        copia.setAttribute(name, interpolar(value, scope));
      }
      destino.appendChild(copia);
      expandir(n.tagName === 'TEMPLATE' ? n.content : n, copia, scope);
    }
  }
  const salida = document.createElement('div');
  expandir(fuente, salida, vals);
  document.body.appendChild(salida);
  if (document.body.innerHTML.includes('{{')) throw new Error('quedo un {{ }} sin evaluar');
}

/** Lo que se mide en los dos: el paso 3, sin barra ni pie. */
function medir() {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const px = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return `${Math.round(r.width * 100) / 100}x${Math.round(r.height * 100) / 100}`;
  };
  const texto = (t) =>
    [...document.querySelectorAll('span,p,button,h1,h2')].find(
      (e) => e.textContent.trim() === t && [...e.children].every((h) => h.textContent.trim() !== t),
    );
  const tarjeta = (t) => {
    let el = texto(t);
    while (el && !/border-top/.test(el.getAttribute('style') || '') && el.tagName !== 'SECTION') el = el.parentElement;
    return el;
  };
  const correo = tarjeta('Solo con mi correo');
  const cuenta = tarjeta('Con mi cuenta');
  const rejilla = correo.parentElement;
  const h1 = texto('¿A dónde le enviamos el comprobante?');
  const parrafo = [...document.querySelectorAll('p')].find((p) => /^(Va a pagar|Todavía no)/.test(p.textContent.trim()));
  const campoCorreo = correo.querySelector('input:not([type="checkbox"]):not([aria-hidden="true"])');
  const casilla = correo.querySelector('[role="checkbox"], input[type="checkbox"]');
  const continuar = texto('Continuar al pago');
  const entrar = texto('Entrar y pagar');
  const errores = [...document.querySelectorAll('[role="alert"]')].filter((e) => e.closest('main, body') && e.textContent.trim() !== '');
  const doc = cuenta.querySelector('input');
  return {
    anchoDoc: document.documentElement.scrollWidth,
    anchoVentana: window.innerWidth,
    hayDesplazamientoHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    columnas: cs(rejilla).gridTemplateColumns.split(' ').length,
    rejilla: { columnas: cs(rejilla).gridTemplateColumns, hueco: cs(rejilla).columnGap },
    h1: { tam: cs(h1).fontSize, peso: cs(h1).fontWeight, color: cs(h1).color },
    parrafo: parrafo && { texto: parrafo.textContent.trim(), tam: cs(parrafo).fontSize, color: cs(parrafo).color },
    tarjetaCorreo: { caja: px(correo), filo: `${cs(correo).borderTopWidth} ${cs(correo).borderTopColor}`, relleno: cs(correo).padding },
    tarjetaCuenta: { caja: px(cuenta), filo: `${cs(cuenta).borderTopWidth} ${cs(cuenta).borderTopColor}`, relleno: cs(cuenta).padding },
    campoCorreo: { caja: px(campoCorreo), filo: cs(campoCorreo).borderColor, papel: cs(campoCorreo).backgroundColor, tam: cs(campoCorreo).fontSize },
    documento: { caja: px(doc), filo: cs(doc).borderColor, papel: cs(doc).backgroundColor },
    casilla: px(casilla),
    continuar: { caja: px(continuar), fondo: cs(continuar).backgroundColor, tinta: cs(continuar).color, tam: cs(continuar).fontSize, peso: cs(continuar).fontWeight },
    entrar: { caja: px(entrar), fondo: cs(entrar).backgroundColor, tinta: cs(entrar).color, filo: cs(entrar).borderColor },
    errores: errores.map((e) => ({ texto: e.textContent.trim(), color: cs(e).color, tam: cs(e).fontSize })),
  };
}

(async () => {
  const navegador = await chromium.launch();
  const salida = {};
  fs.writeFileSync(`${D}/vacio.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="file://${FE}/diseno/">${estilo}</head><body></body></html>`);

  for (const ancho of [1180, 400]) {
    for (const [caso, estado] of Object.entries(CASOS)) {
      const art = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await art.goto(`file://${D}/vacio.html`);
      await art.evaluate(renderizar, { plantilla, codigo, estado });
      await art.waitForTimeout(200);
      await art.screenshot({ path: `${D}/artboard-${caso}-${ancho}.png`, fullPage: true });
      salida[`artboard-${caso}-${ancho}`] = await art.evaluate(medir);
      await art.close();

      const portal = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await portal.goto(PORTAL);
      const main = portal.locator('main');
      await main.getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
      await main.getByRole('button', { name: 'Buscar mi deuda' }).click();
      await portal.waitForFunction(() => location.hash === '#/deudas');
      await main.getByRole('button', { name: 'Pagar todo' }).click();
      await portal.waitForFunction(() => location.hash === '#/identificar');
      await portal.getByRole('heading', { name: '¿A dónde le enviamos el comprobante?' }).waitFor();
      if (caso === 'con-errores') {
        const correo = main.getByRole('region', { name: 'Solo con mi correo' });
        await correo.getByRole('textbox', { name: 'Correo electrónico' }).fill('maria@correo');
        await correo.getByRole('button', { name: 'Continuar al pago' }).click();
        await correo.getByRole('alert').waitFor();
        const cuenta = main.getByRole('region', { name: 'Con mi cuenta' });
        await cuenta.getByRole('button', { name: 'Entrar y pagar' }).click();
        await cuenta.getByRole('alert').waitFor();
      }
      // Fuera el aviso de la busqueda y el foco, para comparar en reposo.
      await portal.evaluate(() => document.activeElement && document.activeElement.blur());
      await portal.mouse.move(0, 0);
      await portal.waitForTimeout(4500);
      await portal.screenshot({ path: `${D}/portal-${caso}-${ancho}.png`, fullPage: true });
      salida[`portal-${caso}-${ancho}`] = await portal.evaluate(medir);
      await portal.close();
    }
  }

  // Sin seleccion: «Iniciar sesión» desde buscar. Solo a 1180: a <= 880 px la barra no lo muestra
  // (artboard, linea 71). Y entrar desde ahi lleva a `#/historial` con la bienvenida.
  {
    const portal = await navegador.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
    await portal.goto(PORTAL);
    await portal.getByRole('banner').getByRole('button', { name: 'Iniciar sesión' }).click();
    await portal.waitForFunction(() => location.hash === '#/identificar');
    await portal.mouse.move(0, 0);
    await portal.waitForTimeout(300);
    await portal.screenshot({ path: `${D}/portal-sin-seleccion-1180.png`, fullPage: true });
    salida['portal-sin-seleccion-1180'] = await portal.evaluate(medir);
    const cuenta = portal.locator('main').getByRole('region', { name: 'Con mi cuenta' });
    await cuenta.getByRole('textbox', { name: 'Documento de identidad' }).fill('03593174');
    await cuenta.getByLabel('Clave').fill('demo');
    await cuenta.getByRole('button', { name: 'Entrar y pagar' }).click();
    await portal.waitForFunction(() => location.hash === '#/historial');
    await portal.getByText('Bienvenida. Aquí están sus pagos.').waitFor();
    await portal.screenshot({ path: `${D}/portal-sin-seleccion-entro-1180.png`, fullPage: false });
    salida['portal-sin-seleccion-entro-1180'] = {
      hash: await portal.evaluate(() => location.hash),
      almacenamiento: await portal.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })),
    };
    await portal.close();
  }

  fs.writeFileSync(`${D}/medidas.json`, JSON.stringify(salida, null, 1));
  const img = (n) => `file://${D}/${n}.png`;
  const TITULO = {
    'con-seleccion': 'con los cuatro conceptos marcados',
    'con-errores': 'con los errores del correo («maria@correo») y de la cuenta',
  };
  for (const caso of Object.keys(CASOS)) {
    fs.writeFileSync(`${D}/lamina-${caso}.html`, `<body style="margin:0;font:14px Arial;background:#e5e5e5;padding:16px">
      <p style="margin:0 0 8px"><b>Paso 3 · Mis datos — ${TITULO[caso]}</b>. Izquierda: artboard (plantilla de &lt;x-dc&gt; con el renderVals() de su propio Component). Derecha: portal (yarn dev, #/identificar).</p>
      <div style="display:flex;gap:16px;align-items:flex-start">
        <div><p style="margin:4px 0"><b>Artboard</b> 1180 px</p><img src="${img(`artboard-${caso}-1180`)}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 1180 px</p><img src="${img(`portal-${caso}-1180`)}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Artboard</b> 400 px</p><img src="${img(`artboard-${caso}-400`)}" style="display:block;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 400 px</p><img src="${img(`portal-${caso}-400`)}" style="display:block;border:1px solid #999"></div>
      </div></body>`);
    const lamina = await navegador.newPage({ viewport: { width: 2080, height: 900 }, deviceScaleFactor: 1 });
    await lamina.goto(`file://${D}/lamina-${caso}.html`);
    await lamina.waitForTimeout(500);
    await lamina.screenshot({ path: `${D}/identificar-${caso}-artboard-y-portal.png`, fullPage: true });
    await lamina.close();
  }
  for (const [k, v] of Object.entries(salida)) console.log(k, JSON.stringify(v));
  await navegador.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
