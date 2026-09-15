// Capturas de «Mis pagos» (issue 10): el artboard renderizado con SU PROPIA logica y el portal (`yarn dev`).
//
// El metodo es el de `capturas/issue-9` (`capturar.cjs`): la plantilla de `<x-dc>` y el `class Component`
// del artboard, instanciados con un `DCLogic` minimo y el `state` de cada caso, con `<sc-if>`, `<sc-for>`
// y `{{ }}` expandidos con `renderVals()`. Cuatro casos —con pago reciente y sin el, con deuda pendiente y
// sin ella—, a 1180 y a 400 px. Y en el portal, «Mis predios y vehículos» del menu: foco y desplazamiento.
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

const TODAS = { pred26: true, arb26: true, pred24: true, veh24: true };
/** Los dos sellos, con la forma que sella el artboard (lineas 1261-1266). */
const SELLO_DE_LOS_CUATRO = {
  ids: ['pred26', 'arb26', 'pred24', 'veh24'], insoluto: 3041.92, interes: 413.32, gastos: 108, conAmnistia: 3149.92,
  medio: 'Tarjeta', numero: '0003-0041418', operacion: '86 4418 2026 0913', fecha: '13/09/2026 · 10:42', destino: 'fruiz159@gmail.com',
};
const SELLO_DEL_PREDIAL = { ...SELLO_DE_LOS_CUATRO, ids: ['pred26'], insoluto: 293.72, interes: 0, gastos: 0, conAmnistia: 293.72 };

const CASOS = [
  { id: 'con-pago-sin-deuda', estado: { recienPagado: true, ultimo: SELLO_DE_LOS_CUATRO, pagadas: TODAS } },
  { id: 'con-pago-con-deuda', estado: { recienPagado: true, ultimo: SELLO_DEL_PREDIAL, pagadas: { pred26: true } } },
  { id: 'sin-pago-con-deuda', estado: { recienPagado: false, ultimo: null, pagadas: {} } },
  { id: 'sin-pago-sin-deuda', estado: { recienPagado: false, ultimo: null, pagadas: TODAS } },
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
  const d = (n) => Math.round(n * 100) / 100;
  const caja = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: d(r.left), y: d(r.top + scrollY), ancho: d(r.width), alto: d(r.height) };
  };
  const h2 = (texto) => [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === texto);
  const seccionDe = (texto) => {
    const h = h2(texto);
    let el = h;
    while (el && el.parentElement && !/border: 1px solid|1px solid/.test(cs(el).border) ) el = el.parentElement;
    return el;
  };
  const tabla = document.querySelector('table');
  const marco = tabla && tabla.parentElement;
  const pendiente = seccionDe('Lo que queda pendiente');
  const unidades = seccionDe('De dónde sale lo que paga');
  const reciente = [...document.querySelectorAll('span,h2')].find((el) => /^Pago de S\/ .* registrado hoy$/.test(el.textContent.trim()));
  return {
    anchoDoc: document.documentElement.scrollWidth,
    anchoVentana: window.innerWidth,
    hayDesplazamientoHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    titulo: (() => { const h = [...document.querySelectorAll('h1')].find((x) => x.textContent.trim() === 'Mis pagos'); return h && { tamano: cs(h).fontSize, color: cs(h).color }; })(),
    reciente: reciente ? { texto: reciente.textContent.trim(), color: cs(reciente).color } : null,
    tabla: tabla && {
      minWidth: cs(tabla).minWidth, ancho: caja(tabla).ancho, anchoDelMarco: caja(marco).ancho, overflowX: cs(marco).overflowX,
      desplazamientoPropio: d(marco.scrollWidth - marco.clientWidth),
      filas: [...tabla.querySelectorAll('tbody tr')].map((tr) => ({ celdas: [...tr.children].map((c) => c.textContent.trim()), papel: cs(tr).backgroundColor })),
    },
    pendiente: pendiente && {
      total: (() => { const h = h2('Lo que queda pendiente'); const s = h && h.nextElementSibling; return s && { texto: s.textContent.trim(), color: cs(s).color }; })(),
      botones: [...pendiente.querySelectorAll('button')].map((b) => ({ texto: b.textContent.trim(), alto: caja(b).alto })),
    },
    unidades: unidades && {
      bases: [...unidades.querySelectorAll('span')].filter((s) => /^S\/ [0-9,]+\.[0-9]{2}$/.test(s.textContent.trim())).map((s) => s.textContent.trim()),
      chip: (() => { const c = [...unidades.querySelectorAll('span,li')].find((el) => el.textContent.trim() === '8.20 m de frontis'); return c && { papel: cs(c).backgroundColor, filo: cs(c).borderTopColor, tinta: cs(c).color, caja: caja(c) }; })(),
    },
  };
}

/** Desde el portal limpio, entra con la cuenta (con busqueda y los conceptos elegidos) y paga; o solo entra. */
async function prepararPortal(portal, caso) {
  const main = portal.locator('main');
  const entrarConLaCuenta = async () => {
    const cuenta = main.getByRole('region', { name: 'Con mi cuenta' });
    await cuenta.getByRole('textbox', { name: 'Documento de identidad' }).fill('44218937');
    await cuenta.getByLabel('Clave').fill('demo');
    await cuenta.getByRole('button', { name: 'Entrar y pagar' }).click();
  };
  const buscarYPagar = async (soloElPredial) => {
    await main.getByRole('textbox', { name: 'Código de contribuyente' }).fill('00000025673');
    await main.getByRole('button', { name: 'Buscar mi deuda' }).click();
    await portal.waitForFunction(() => location.hash === '#/deudas');
    if (soloElPredial) {
      for (const c of ['Arbitrios municipales 2026', 'Impuesto predial 2024', 'Impuesto vehicular 2024']) {
        await main.getByRole('checkbox', { name: `Pagar ${c}` }).click();
      }
      await main.getByRole('button', { name: 'Pagar lo marcado' }).click();
    } else {
      await main.getByRole('button', { name: 'Pagar todo' }).click();
    }
    await portal.waitForFunction(() => location.hash === '#/identificar');
    await entrarConLaCuenta();
    await portal.waitForFunction(() => location.hash === '#/pagar');
    await main.getByRole('button', { name: 'Pagar ahora' }).click();
    await portal.waitForFunction(() => location.hash === '#/comprobante');
    await main.getByRole('button', { name: 'Ver mis pagos' }).click();
  };
  await portal.goto(PORTAL);
  if (caso.id === 'con-pago-sin-deuda') await buscarYPagar(false);
  if (caso.id === 'con-pago-con-deuda') await buscarYPagar(true);
  if (caso.id === 'sin-pago-sin-deuda') {
    await buscarYPagar(false);
    await portal.waitForFunction(() => location.hash === '#/historial');
    // Cerrar sesion olvida el recibo pero no lo pagado; al volver a entrar, sin banda y sin deuda.
    const barra = portal.locator('header');
    await barra.getByRole('button', { name: /María E\. Castillo/ }).click();
    await portal.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await portal.waitForFunction(() => location.hash === '#/buscar');
  }
  if (caso.id === 'sin-pago-con-deuda' || caso.id === 'sin-pago-sin-deuda') {
    // «Iniciar sesión» se oculta a ≤ 880 px (en el artboard tambien, `data-sm-hide`): se pulsa a 1180 px y
    // se vuelve al ancho del caso.
    const ancho = portal.viewportSize();
    await portal.setViewportSize({ width: 1180, height: ancho.height });
    await portal.locator('header').getByRole('button', { name: 'Iniciar sesión' }).click();
    await portal.setViewportSize(ancho);
    await portal.waitForFunction(() => location.hash === '#/identificar');
    await entrarConLaCuenta();
  }
  await portal.waitForFunction(() => location.hash === '#/historial');
  await main.getByRole('heading', { level: 1, name: 'Mis pagos' }).waitFor();
  await main.getByText('8.20 m de frontis').waitFor();
  await portal.evaluate(() => document.activeElement && document.activeElement.blur());
  await portal.mouse.move(0, 0);
  // Fuera los avisos, para comparar en reposo.
  await portal.waitForTimeout(4500);
}

/** «Mis predios y vehículos» del menu: donde queda el foco y cuanto se desplazo la pagina. */
async function misPrediosYVehiculos(navegador, ancho) {
  const portal = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
  await prepararPortal(portal, { id: 'sin-pago-con-deuda' });
  await portal.evaluate(() => window.scrollTo(0, 0));
  const antes = await portal.evaluate(() => scrollY);
  const barra = portal.locator('header');
  // A 400 px el nombre es `sr-only`, pero sigue siendo el nombre del disparador.
  await barra.getByRole('button', { name: /María E\. Castillo/ }).click();
  await portal.getByRole('menuitem', { name: 'Mis predios y vehículos' }).click();
  await portal.waitForTimeout(800);
  const medida = await portal.evaluate((antesDe) => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    return { scrollAntes: antesDe, scrollDespues: scrollY, foco: `${a.tagName}: ${a.textContent.trim()}`, topDelFocoEnLaVentana: Math.round(r.top), hash: location.hash };
  }, antes);
  await portal.screenshot({ path: `${D}/portal-mis-predios-${ancho}.png` });
  await portal.close();
  return medida;
}

(async () => {
  const navegador = await chromium.launch();
  const salida = {};
  fs.writeFileSync(`${D}/vacio.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="file://${FE}/diseno/">${estilo}</head><body></body></html>`);

  for (const caso of CASOS) {
    for (const ancho of [1180, 400]) {
      const nombre = `${caso.id}-${ancho}`;
      const art = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await art.goto(`file://${D}/vacio.html`);
      await art.evaluate(renderizar, { plantilla, codigo, estado: { paso: 'historial', autenticado: true, ...caso.estado } });
      await art.waitForTimeout(200);
      await art.screenshot({ path: `${D}/artboard-${nombre}.png`, fullPage: true });
      salida[`artboard-${nombre}`] = await art.evaluate(medir);
      await art.close();

      const portal = await navegador.newPage({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 1 });
      await prepararPortal(portal, caso);
      await portal.screenshot({ path: `${D}/portal-${nombre}.png`, fullPage: true });
      salida[`portal-${nombre}`] = await portal.evaluate(medir);
      await portal.close();
    }
  }
  salida['portal-mis-predios-1180'] = await misPrediosYVehiculos(navegador, 1180);
  salida['portal-mis-predios-400'] = await misPrediosYVehiculos(navegador, 400);

  fs.writeFileSync(`${D}/medidas.json`, JSON.stringify(salida, null, 1));
  const img = (n) => `file://${D}/${n}.png`;
  const TITULOS = {
    'con-pago-sin-deuda': 'con pago reciente (los 4) y sin deuda',
    'con-pago-con-deuda': 'con pago reciente (predial 2026) y con deuda',
    'sin-pago-con-deuda': 'sin pago reciente y con deuda',
    'sin-pago-sin-deuda': 'sin pago reciente y sin deuda',
  };
  for (const caso of CASOS) {
    const fila = [['Artboard', '1180 px', `artboard-${caso.id}-1180`, 590], ['Portal', '1180 px', `portal-${caso.id}-1180`, 590], ['Artboard', '400 px', `artboard-${caso.id}-400`, 400], ['Portal', '400 px', `portal-${caso.id}-400`, 400]];
    fs.writeFileSync(`${D}/lamina.html`, `<body style="margin:0;font:14px Arial;background:#e5e5e5;padding:16px">
      <p style="margin:0 0 8px"><b>Mis pagos — ${TITULOS[caso.id]}</b>. Izquierda: artboard (plantilla de &lt;x-dc&gt; con el renderVals() de su propio Component). Derecha: portal (yarn dev, #/historial al que se llega entrando y pagando).</p>
      <div style="display:flex;gap:16px;align-items:flex-start">
        ${fila.map(([q, a, n, w]) => `<div><p style="margin:4px 0"><b>${q}</b> ${a}</p><img src="${img(n)}" style="display:block;width:${w}px;border:1px solid #999"></div>`).join('')}
      </div></body>`);
    const lamina = await navegador.newPage({ viewport: { width: 2080, height: 900 }, deviceScaleFactor: 1 });
    await lamina.goto(`file://${D}/lamina.html`);
    await lamina.waitForTimeout(500);
    await lamina.screenshot({ path: `${D}/historial-${caso.id}-artboard-y-portal.png`, fullPage: true });
    await lamina.close();
  }
  for (const [k, v] of Object.entries(salida)) console.log(k, JSON.stringify(v));
  await navegador.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
