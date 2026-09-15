// Capturas del paso 2 (issue 6): el artboard renderizado con SU PROPIA logica y el portal (`yarn dev`).
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
  'todo-marcado': { paso: 'deudas' },
  'detalle-abierto': { paso: 'deudas', abierta: 'pred26' },
  'nada-marcado': { paso: 'deudas', marcadas: { pred26: false, arb26: false, pred24: false, veh24: false } },
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

/** Lo que se mide en los dos: el paso 2, sin barra ni pie. */
function medir() {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const px = (el) => {
    const r = el.getBoundingClientRect();
    return `${Math.round(r.width * 100) / 100}x${Math.round(r.height * 100) / 100}`;
  };
  const texto = (t) =>
    [...document.querySelectorAll('span,p,button,h1,h2')].find(
      (e) => e.textContent.trim() === t && [...e.children].every((h) => h.textContent.trim() !== t),
    );
  const deTexto = (re) => [...document.querySelectorAll('span,p')].find((e) => re.test(e.textContent.trim()) && e.children.length === 0);
  const total = [...document.querySelectorAll('span')].filter((e) => e.textContent.trim() === 'S/ 3,563.24' && e.children.length === 0)[0];
  const banda = deTexto(/^Deuda total al/).parentElement.parentElement;
  const casilla = document.querySelector('[role="checkbox"], input[type="checkbox"]');
  let fila = casilla;
  while (fila && !/border-left/.test(fila.getAttribute('style') || '') && !(fila.tagName === 'LI')) fila = fila.parentElement;
  const pagar = [...document.querySelectorAll('button')].find((b) => /^Pagar (todo|lo marcado)$/.test(b.textContent.trim()));
  const tabla = document.querySelector('main table, table');
  const insignia = texto('Por vencer');
  return {
    anchoDoc: document.documentElement.scrollWidth,
    anchoVentana: window.innerWidth,
    hayDesplazamientoHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    banda: { fondo: cs(banda).backgroundColor, tinta: cs(banda).color, rotulo: cs(deTexto(/^Deuda total al/)).color, rotuloTexto: deTexto(/^Deuda total al/).textContent.trim() },
    total: { tam: cs(total).fontSize, peso: cs(total).fontWeight, color: cs(total).color },
    casilla: px(casilla),
    fila: { fondo: cs(fila).backgroundColor, filoIzq: `${cs(fila).borderLeftWidth} ${cs(fila).borderLeftColor}` },
    insignia: { fondo: cs(insignia).backgroundColor, tinta: cs(insignia).color, tam: cs(insignia).fontSize, radio: cs(insignia).borderRadius },
    noSoyYo: px(texto('No soy yo')),
    marcarTodo: px(texto('Quitar todo') || texto('Marcar todo')),
    verDetalle: px(texto('Ver el detalle')),
    pagar: { tam: px(pagar), fondo: cs(pagar).backgroundColor, tinta: cs(pagar).color, ariaDisabled: pagar.getAttribute('aria-disabled') },
    tabla: tabla && {
      ancho: px(tabla),
      contenedor: px(tabla.parentElement),
      contenedorDesplaza: tabla.parentElement.scrollWidth > tabla.parentElement.clientWidth,
      overflowX: cs(tabla.parentElement).overflowX,
    },
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
      await portal.locator('main').getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
      await portal.locator('main').getByRole('button', { name: 'Buscar mi deuda' }).click();
      await portal.waitForFunction(() => location.hash === '#/deudas');
      await portal.getByRole('heading', { name: 'Lo que debe, por concepto' }).waitFor();
      if (caso === 'detalle-abierto') {
        const fila = portal.locator('li').filter({ has: portal.getByRole('checkbox', { name: 'Pagar Impuesto predial 2026' }) });
        await fila.getByRole('button', { name: 'Ver el detalle' }).click();
        await portal.locator('main table').waitFor();
      }
      if (caso === 'nada-marcado') await portal.locator('main').getByRole('button', { name: 'Quitar todo' }).click();
      // Fuera el aviso de la busqueda y el foco, para comparar en reposo.
      await portal.evaluate(() => document.activeElement && document.activeElement.blur());
      await portal.mouse.move(0, 0);
      await portal.waitForTimeout(4500);
      await portal.screenshot({ path: `${D}/portal-${caso}-${ancho}.png`, fullPage: true });
      salida[`portal-${caso}-${ancho}`] = await portal.evaluate(medir);
      await portal.close();
    }
  }

  fs.writeFileSync(`${D}/medidas.json`, JSON.stringify(salida, null, 1));
  const img = (n) => `file://${D}/${n}.png`;
  const TITULO = {
    'todo-marcado': 'con los cuatro conceptos marcados',
    'detalle-abierto': 'con «Ver el detalle» del predial 2026 abierto',
    'nada-marcado': 'tras «Quitar todo»',
  };
  for (const caso of Object.keys(CASOS)) {
    fs.writeFileSync(`${D}/lamina-${caso}.html`, `<body style="margin:0;font:14px Arial;background:#e5e5e5;padding:16px">
      <p style="margin:0 0 8px"><b>Paso 2 · Elegir qué pago — ${TITULO[caso]}</b>. Izquierda: artboard (plantilla de &lt;x-dc&gt; con el renderVals() de su propio Component). Derecha: portal (yarn dev, #/deudas).</p>
      <div style="display:flex;gap:16px;align-items:flex-start">
        <div><p style="margin:4px 0"><b>Artboard</b> 1180 px</p><img src="${img(`artboard-${caso}-1180`)}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 1180 px</p><img src="${img(`portal-${caso}-1180`)}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Artboard</b> 400 px</p><img src="${img(`artboard-${caso}-400`)}" style="display:block;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 400 px</p><img src="${img(`portal-${caso}-400`)}" style="display:block;border:1px solid #999"></div>
      </div></body>`);
    const lamina = await navegador.newPage({ viewport: { width: 2080, height: 900 }, deviceScaleFactor: 1 });
    await lamina.goto(`file://${D}/lamina-${caso}.html`);
    await lamina.waitForTimeout(500);
    await lamina.screenshot({ path: `${D}/deudas-${caso}-artboard-y-portal.png`, fullPage: true });
    await lamina.close();
  }
  for (const [k, v] of Object.entries(salida)) console.log(k, JSON.stringify(v));
  await navegador.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
