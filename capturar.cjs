// Capturas del paso 4 (issue 8): el artboard renderizado con SU PROPIA logica y el portal (`yarn dev`).
//
// El metodo es el de `capturas/issue-7` (`capturar.cjs`): la plantilla de `<x-dc>` y el `class Component`
// del artboard, instanciados con un `DCLogic` minimo, con el `state` de cada caso, y `<sc-if>`, `<sc-for>` y
// `{{ }}` expandidos con `renderVals()`. Un caso por medio de pago, a 1180 y a 400 px. Cambio respecto del
// #7: un `<template>` dentro de `<svg>` (los trazos del icono de cada medio) es contenido extranjero y no
// tiene `.content`; se expande desde el propio nodo.
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

/** Los cuatro medios: su id, su rotulo (el boton) y su titulo (el panel). */
const MEDIOS = [
  { id: 'tarjeta', rotulo: 'Tarjeta', titulo: 'Pagar con tarjeta', boton: 'Pagar ahora' },
  { id: 'yape', rotulo: 'Yape o Plin', titulo: 'Pagar con Yape o Plin', boton: 'Ya yapeé' },
  { id: 'pagalo', rotulo: 'pagalo.pe', titulo: 'Pagar por pagalo.pe', boton: 'Ir a pagalo.pe' },
  { id: 'banco', rotulo: 'Banco o agente', titulo: 'Pagar en un banco o agente', boton: 'Ya pagué en el banco' },
];

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
      if (n.localName === 'template' && n.hasAttribute('data-sc-if')) {
        if (evaluar(solo(n.getAttribute('value')), scope)) expandir(n.content || n, destino, scope);
        continue;
      }
      if (n.localName === 'template' && n.hasAttribute('data-sc-for')) {
        const lista = evaluar(solo(n.getAttribute('list')), scope) || [];
        for (const item of lista) {
          const hijo = Object.create(scope);
          hijo[n.getAttribute('as')] = item;
          expandir(n.content || n, destino, hijo);
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
      expandir(n.localName === 'template' ? n.content || n : n, copia, scope);
    }
  }
  const salida = document.createElement('div');
  expandir(fuente, salida, vals);
  document.body.appendChild(salida);
  if (document.body.innerHTML.includes('{{')) throw new Error('quedo un {{ }} sin evaluar');
}

/** Lo que se mide en los dos: el paso 4, sin barra ni pie. */
function medir(m) {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const caja = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const d = (n) => Math.round(n * 100) / 100;
    return { x: d(r.left), y: d(r.top + scrollY), ancho: d(r.width), alto: d(r.height) };
  };
  const hoja = (t, sel = 'span,p,button,h1,h2') =>
    [...document.querySelectorAll(sel)].find(
      (e) => e.textContent.trim() === t && [...e.children].every((h) => h.textContent.trim() !== t),
    );
  const botonDe = (t) => { let el = hoja(t); while (el && el.tagName !== 'BUTTON') el = el.parentElement; return el; };
  const pagar = document.querySelector('[data-pagar]');
  const resumen = document.querySelector('[data-resumen]');
  const medios = document.querySelector('[data-medios]');
  const bancos = document.querySelector('[data-bancos]');
  const codigo = document.querySelector('[data-codigo]');
  const activo = botonDe(m.rotulo);
  const icono = activo && activo.querySelector('svg').parentElement;
  const confirmar = hoja(m.boton, 'button');
  const total = hoja('Total a pagar', 'span,dt');
  const cifraTotal = total && total.nextElementSibling;
  const h1 = hoja('¿Cómo quiere pagar?');
  return {
    anchoDoc: document.documentElement.scrollWidth,
    anchoVentana: window.innerWidth,
    hayDesplazamientoHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    columnas: cs(pagar).gridTemplateColumns,
    hueco: cs(pagar).columnGap,
    resumen: { caja: caja(resumen), position: cs(resumen).position, top: cs(resumen).top, order: cs(resumen).order },
    medios: { caja: caja(medios), columnas: cs(medios).gridTemplateColumns },
    resumenArriba: caja(resumen).y < caja(medios).y,
    h1: { tam: cs(h1).fontSize, peso: cs(h1).fontWeight, color: cs(h1).color },
    activo: { caja: caja(activo), pressed: activo.getAttribute('aria-pressed'), filo: `${cs(activo).borderTopWidth} ${cs(activo).borderTopColor}`, papel: cs(activo).backgroundColor },
    icono: { caja: caja(icono), papel: cs(icono).backgroundColor, tinta: cs(icono).color },
    codigo: codigo && { texto: codigo.textContent.trim(), tam: cs(codigo).fontSize, espaciado: cs(codigo).letterSpacing, color: cs(codigo).color, filo: cs(codigo.parentElement).borderTopStyle + ' ' + cs(codigo.parentElement).borderTopColor, papel: cs(codigo.parentElement).backgroundColor },
    bancos: bancos && { columnas: cs(bancos).gridTemplateColumns, cuantos: bancos.children.length },
    pasos: [...document.querySelectorAll('ol li')].map((li) => li.textContent.trim()),
    campos: [...document.querySelectorAll('main input, [data-pagar] input')].filter((i) => i.type !== 'hidden').map((i) => ({ ph: i.placeholder, caja: caja(i) })),
    confirmar: { caja: caja(confirmar), fondo: cs(confirmar).backgroundColor, tinta: cs(confirmar).color, tam: cs(confirmar).fontSize, peso: cs(confirmar).fontWeight },
    total: cifraTotal && { texto: cifraTotal.textContent.trim(), tam: cs(total).fontSize, color: cs(cifraTotal.querySelector('span span') || cifraTotal).color },
  };
}

(async () => {
  const navegador = await chromium.launch();
  const salida = {};
  fs.writeFileSync(`${D}/vacio.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="file://${FE}/diseno/">${estilo}</head><body></body></html>`);

  for (const ancho of [1180, 400]) {
    for (const m of MEDIOS) {
      const art = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await art.goto(`file://${D}/vacio.html`);
      await art.evaluate(renderizar, { plantilla, codigo, estado: { paso: 'pagar', medio: m.id, correo: 'maria@correo.com' } });
      await art.waitForTimeout(200);
      await art.screenshot({ path: `${D}/artboard-${m.id}-${ancho}.png`, fullPage: true });
      salida[`artboard-${m.id}-${ancho}`] = await art.evaluate(medir, m);
      await art.close();

      const portal = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await portal.goto(PORTAL);
      const main = portal.locator('main');
      await main.getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
      await main.getByRole('button', { name: 'Buscar mi deuda' }).click();
      await portal.waitForFunction(() => location.hash === '#/deudas');
      await main.getByRole('button', { name: 'Pagar todo' }).click();
      await portal.waitForFunction(() => location.hash === '#/identificar');
      const correo = main.getByRole('region', { name: 'Solo con mi correo' });
      await correo.getByRole('textbox', { name: 'Correo electrónico' }).fill('maria@correo.com');
      await correo.getByRole('button', { name: 'Continuar al pago' }).click();
      await portal.waitForFunction(() => location.hash === '#/pagar');
      await main.getByRole('button', { name: m.rotulo, exact: true }).click();
      await main.getByRole('region', { name: m.titulo }).waitFor();
      // Fuera el aviso de la busqueda y el foco, para comparar en reposo.
      await portal.evaluate(() => document.activeElement && document.activeElement.blur());
      await portal.mouse.move(0, 0);
      await portal.waitForTimeout(4500);
      await portal.screenshot({ path: `${D}/portal-${m.id}-${ancho}.png`, fullPage: true });
      salida[`portal-${m.id}-${ancho}`] = await portal.evaluate(medir, m);
      await portal.close();
    }
  }

  // Sin nada que pagar: «Iniciar sesión» -> «Solo con mi correo» -> pagar, y confirmar. Solo a 1180: a
  // <= 880 px la barra no muestra «Iniciar sesión» (artboard, linea 71).
  {
    const portal = await navegador.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
    await portal.goto(PORTAL);
    await portal.getByRole('banner').getByRole('button', { name: 'Iniciar sesión' }).click();
    await portal.waitForFunction(() => location.hash === '#/identificar');
    const main = portal.locator('main');
    const correo = main.getByRole('region', { name: 'Solo con mi correo' });
    await correo.getByRole('textbox', { name: 'Correo electrónico' }).fill('maria@correo.com');
    await correo.getByRole('button', { name: 'Continuar al pago' }).click();
    await portal.waitForFunction(() => location.hash === '#/pagar');
    // `aria-disabled`: Playwright no lo pulsa sin `force`, y la pantalla lo deja pulsable para avisar.
    await main.getByRole('button', { name: 'Pagar ahora' }).click({ force: true });
    await portal.getByText('No hay nada que pagar.').nth(1).waitFor();
    await portal.mouse.move(0, 0);
    await portal.screenshot({ path: `${D}/portal-sin-nada-que-pagar-1180.png`, fullPage: false });
    salida['portal-sin-nada-que-pagar-1180'] = {
      hash: await portal.evaluate(() => location.hash),
      resumen: await portal.evaluate(() => document.querySelector('[data-resumen]').textContent),
    };
    await portal.close();
  }

  // Tarjeta tecleada y pagada: nada en el almacenamiento del navegador.
  {
    const portal = await navegador.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
    await portal.goto(PORTAL);
    const main = portal.locator('main');
    await main.getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
    await main.getByRole('button', { name: 'Buscar mi deuda' }).click();
    await main.getByRole('button', { name: 'Pagar todo' }).click();
    const correo = main.getByRole('region', { name: 'Solo con mi correo' });
    await correo.getByRole('textbox', { name: 'Correo electrónico' }).fill('maria@correo.com');
    await correo.getByRole('button', { name: 'Continuar al pago' }).click();
    const tarjeta = main.getByRole('region', { name: 'Pagar con tarjeta' });
    await tarjeta.getByRole('textbox', { name: 'Número de la tarjeta' }).fill('4111 1111 1111 1111');
    await tarjeta.getByRole('textbox', { name: 'Código de seguridad' }).fill('987');
    await tarjeta.getByRole('button', { name: 'Pagar ahora' }).click();
    await portal.waitForFunction(() => location.hash === '#/comprobante');
    await portal.getByText('Pago registrado. Le enviamos el comprobante a maria@correo.com.').waitFor();
    await portal.screenshot({ path: `${D}/portal-pagado-1180.png`, fullPage: false });
    salida['portal-pagado-1180'] = {
      hash: await portal.evaluate(() => location.hash),
      almacenamiento: await portal.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })),
    };
    await portal.close();
  }

  fs.writeFileSync(`${D}/medidas.json`, JSON.stringify(salida, null, 1));
  const img = (n) => `file://${D}/${n}.png`;
  for (const m of MEDIOS) {
    fs.writeFileSync(`${D}/lamina-${m.id}.html`, `<body style="margin:0;font:14px Arial;background:#e5e5e5;padding:16px">
      <p style="margin:0 0 8px"><b>Paso 4 · Pagar — ${m.rotulo}</b>. Izquierda: artboard (plantilla de &lt;x-dc&gt; con el renderVals() de su propio Component). Derecha: portal (yarn dev, #/pagar).</p>
      <div style="display:flex;gap:16px;align-items:flex-start">
        <div><p style="margin:4px 0"><b>Artboard</b> 1180 px</p><img src="${img(`artboard-${m.id}-1180`)}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 1180 px</p><img src="${img(`portal-${m.id}-1180`)}" style="display:block;width:590px;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Artboard</b> 400 px</p><img src="${img(`artboard-${m.id}-400`)}" style="display:block;border:1px solid #999"></div>
        <div><p style="margin:4px 0"><b>Portal</b> 400 px</p><img src="${img(`portal-${m.id}-400`)}" style="display:block;border:1px solid #999"></div>
      </div></body>`);
    const lamina = await navegador.newPage({ viewport: { width: 2080, height: 900 }, deviceScaleFactor: 1 });
    await lamina.goto(`file://${D}/lamina-${m.id}.html`);
    await lamina.waitForTimeout(500);
    await lamina.screenshot({ path: `${D}/pagar-${m.id}-artboard-y-portal.png`, fullPage: true });
    await lamina.close();
  }
  for (const [k, v] of Object.entries(salida)) console.log(k, JSON.stringify(v));
  await navegador.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
