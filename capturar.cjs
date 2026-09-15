// Capturas del paso 5 (issue 9): el artboard renderizado con SU PROPIA logica y el portal (`yarn dev`).
//
// El metodo es el de `capturas/issue-8` (`capturar.cjs`): la plantilla de `<x-dc>` y el `class Component`
// del artboard, instanciados con un `DCLogic` minimo y el `state` de cada caso, con `<sc-if>`, `<sc-for>`
// y `{{ }}` expandidos con `renderVals()`. Dos casos (sin sesion y con sesion), a 1180 y a 400 px, y la
// VISTA DE IMPRESION (`page.emulateMedia({ media: 'print' })`) de los dos.
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

/** El pago de los cuatro conceptos con tarjeta, con la forma que sella el artboard (lineas 1261-1266). */
const SELLO_DEL_ARTBOARD = {
  ids: ['pred26', 'arb26', 'pred24', 'veh24'],
  insoluto: 3041.92, interes: 413.32, gastos: 108, conAmnistia: 3149.92, medio: 'Tarjeta',
  numero: '0003-0041418', operacion: '86 4418 2026 0913', fecha: '13/09/2026 · 10:42',
};

const CASOS = [
  { id: 'sin-sesion', estado: { paso: 'listo', correo: 'maria@correo.com', autenticado: false }, destino: 'maria@correo.com' },
  { id: 'con-sesion', estado: { paso: 'listo', autenticado: true }, destino: 'fruiz159@gmail.com' },
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


/** Lo que se mide en los dos. */
function medir() {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const caja = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const d = (n) => Math.round(n * 100) / 100;
    return { x: d(r.left), y: d(r.top + scrollY), ancho: d(r.width), alto: d(r.height) };
  };
  const recibo = document.querySelector('[data-recibo]');
  const metaEl = document.querySelector('[data-meta]');
  const acciones = document.querySelector('[data-acciones]');
  const tabla = recibo && recibo.querySelector('table');
  // Lo que se VE: hojas con texto, imagenes y botones con caja y visibles. En impresion solo deberia quedar el recibo.
  const visibles = [...document.body.querySelectorAll('*')].filter((el) => {
    if (el.getClientRects().length === 0) return false;
    const s = cs(el);
    if (s.visibility === 'hidden' || s.display === 'none') return false;
    const hoja = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim() !== '');
    return hoja || ['IMG', 'BUTTON', 'svg'].includes(el.tagName);
  });
  const fueraDelRecibo = visibles.filter((el) => !recibo || !recibo.contains(el)).map((el) => `${el.tagName}: ${el.textContent.trim().slice(0, 40)}`);
  const botones = acciones ? [...acciones.querySelectorAll('button')] : [];
  return {
    anchoDoc: document.documentElement.scrollWidth,
    anchoVentana: window.innerWidth,
    hayDesplazamientoHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    lienzo: cs(document.body).backgroundColor,
    fueraDelRecibo,
    recibo: recibo && { caja: caja(recibo), filo: cs(recibo).borderTopWidth + ' ' + cs(recibo).borderTopStyle + ' ' + cs(recibo).borderTopColor, sombra: cs(recibo).boxShadow, papel: cs(recibo).backgroundColor },
    cabecera: recibo && { filoInferior: cs(recibo.firstElementChild).borderBottomWidth + ' ' + cs(recibo.firstElementChild).borderBottomColor, escudo: caja(recibo.querySelector('img')) },
    meta: metaEl && { columnas: cs(metaEl).gridTemplateColumns, celdas: [...metaEl.children].map((c) => c.textContent.trim().replace(/\s+/g, ' ')) },
    tabla: tabla && {
      minWidth: cs(tabla).minWidth, ancho: caja(tabla).ancho, anchoDelMarco: caja(tabla.parentElement).ancho,
      filas: [...tabla.querySelectorAll('tbody tr, tfoot tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim()).filter((t) => t !== '')),
      rellenoTh: cs(tabla.querySelector('th')).paddingLeft,
      pie: [...tabla.querySelectorAll('tfoot tr')].map((tr) => ({ color: cs(tr.lastElementChild).color, papel: cs(tr.lastElementChild).backgroundColor, peso: cs(tr.lastElementChild).fontWeight })),
    },
    acciones: acciones && { direccion: cs(acciones).flexDirection, visible: acciones.getClientRects().length > 0, botones: botones.map((b) => ({ texto: b.textContent.trim(), caja: caja(b) })) },
  };
}

async function alComprobante(portal, { conSesion }) {
  await portal.goto(PORTAL);
  const main = portal.locator('main');
  await main.getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
  await main.getByRole('button', { name: 'Buscar mi deuda' }).click();
  await portal.waitForFunction(() => location.hash === '#/deudas');
  await main.getByRole('button', { name: 'Pagar todo' }).click();
  await portal.waitForFunction(() => location.hash === '#/identificar');
  if (conSesion) {
    const cuenta = main.getByRole('region', { name: 'Con mi cuenta' });
    await cuenta.getByRole('textbox', { name: 'Documento de identidad' }).fill('44218937');
    await cuenta.getByLabel('Clave').fill('demo');
    await cuenta.getByRole('button', { name: 'Entrar y pagar' }).click();
  } else {
    const correo = main.getByRole('region', { name: 'Solo con mi correo' });
    await correo.getByRole('textbox', { name: 'Correo electrónico' }).fill('maria@correo.com');
    await correo.getByRole('button', { name: 'Continuar al pago' }).click();
  }
  await portal.waitForFunction(() => location.hash === '#/pagar');
  await main.getByRole('button', { name: 'Pagar ahora' }).click();
  await portal.waitForFunction(() => location.hash === '#/comprobante');
  await main.getByRole('region', { name: 'Constancia de pago' }).waitFor();
  await portal.evaluate(() => document.activeElement && document.activeElement.blur());
  await portal.mouse.move(0, 0);
  // Fuera los avisos, para comparar en reposo.
  await portal.waitForTimeout(4500);
}

(async () => {
  const navegador = await chromium.launch();
  const salida = {};
  fs.writeFileSync(`${D}/vacio.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="file://${FE}/diseno/">${estilo}</head><body></body></html>`);

  for (const caso of CASOS) {
    for (const [ancho, medio] of [[1180, 'screen'], [400, 'screen'], [1180, 'print']]) {
      const nombre = `${caso.id}-${medio === 'print' ? 'impresion' : ancho}`;
      const art = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await art.goto(`file://${D}/vacio.html`);
      await art.evaluate(renderizar, { plantilla, codigo, estado: { ...caso.estado, ultimo: { ...SELLO_DEL_ARTBOARD, destino: caso.destino }, pagadas: { pred26: true, arb26: true, pred24: true, veh24: true } } });
      await art.emulateMedia({ media: medio });
      await art.waitForTimeout(200);
      await art.screenshot({ path: `${D}/artboard-${nombre}.png`, fullPage: true });
      salida[`artboard-${nombre}`] = await art.evaluate(medir);
      await art.close();

      const portal = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await alComprobante(portal, { conSesion: caso.id === 'con-sesion' });
      await portal.emulateMedia({ media: medio });
      await portal.waitForTimeout(200);
      await portal.screenshot({ path: `${D}/portal-${nombre}.png`, fullPage: true });
      salida[`portal-${nombre}`] = await portal.evaluate(medir);
      await portal.close();
    }
  }

  fs.writeFileSync(`${D}/medidas.json`, JSON.stringify(salida, null, 1));
  const img = (n) => `file://${D}/${n}.png`;
  for (const caso of CASOS) {
    for (const vista of ['pantalla', 'impresion']) {
      const fila = vista === 'pantalla'
        ? [['Artboard', '1180 px', `artboard-${caso.id}-1180`, 590], ['Portal', '1180 px', `portal-${caso.id}-1180`, 590], ['Artboard', '400 px', `artboard-${caso.id}-400`, 400], ['Portal', '400 px', `portal-${caso.id}-400`, 400]]
        : [['Artboard', 'impresion (1180 px)', `artboard-${caso.id}-impresion`, 590], ['Portal', 'impresion (1180 px)', `portal-${caso.id}-impresion`, 590]];
      fs.writeFileSync(`${D}/lamina.html`, `<body style="margin:0;font:14px Arial;background:#e5e5e5;padding:16px">
        <p style="margin:0 0 8px"><b>Paso 5 · Comprobante — ${caso.id === 'con-sesion' ? 'con sesión' : 'sin sesión'} — ${vista === 'impresion' ? 'vista de impresión (emulateMedia print)' : 'pantalla'}</b>. Izquierda: artboard (plantilla de &lt;x-dc&gt; con el renderVals() de su propio Component). Derecha: portal (yarn dev, #/comprobante tras pagar los 4 conceptos con tarjeta).</p>
        <div style="display:flex;gap:16px;align-items:flex-start">
          ${fila.map(([q, a, n, w]) => `<div><p style="margin:4px 0"><b>${q}</b> ${a}</p><img src="${img(n)}" style="display:block;width:${w}px;border:1px solid #999"></div>`).join('')}
        </div></body>`);
      const lamina = await navegador.newPage({ viewport: { width: vista === 'pantalla' ? 2080 : 1260, height: 900 }, deviceScaleFactor: 1 });
      await lamina.goto(`file://${D}/lamina.html`);
      await lamina.waitForTimeout(500);
      await lamina.screenshot({ path: `${D}/comprobante-${caso.id}-${vista}-artboard-y-portal.png`, fullPage: true });
      await lamina.close();
    }
  }
  for (const [k, v] of Object.entries(salida)) console.log(k, JSON.stringify(v));
  await navegador.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
