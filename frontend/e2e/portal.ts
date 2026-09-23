import { type Locator, type Page, expect } from '@playwright/test';

/**
 * **Como se recorre el portal en el navegador**, por rol y nombre accesible, como lo recorre quien usa
 * un lector de pantalla. Lo comparten las cuatro especificaciones de `e2e/`.
 *
 * <h2>Por que se recorre y no se entra por el hash</h2>
 *
 * Porque el estado del recorrido vive en memoria (`useReducer`): `#/pagar` escrito en la barra de
 * direcciones redirige a `#/buscar`, que es lo correcto (`src/enrutador.tsx`). Para medir un paso hay
 * que llegar a el como llega el contribuyente.
 *
 * <h2>Por que casi todo se busca dentro de `main`</h2>
 *
 * La franja de pasos repite los nombres: su boton «Buscar mi deuda» se llama igual que el del
 * formulario, y «Pagar» igual que un paso. Dentro de `main` no hay ambiguedad.
 */

/** El correo con que se paga sin cuenta. */
export const CORREO = 'maria@example.com';

/** El codigo de contribuyente de la demostracion (en la demostracion cualquier numero encuentra la deuda). */
export const CODIGO = '00000025673';

/** Los cuatro medios: el rotulo de su boton y el boton con que se confirma (`src/datos/demostracion.ts`). */
export const MEDIOS = [
  { rotulo: 'Tarjeta', titulo: 'Pagar con tarjeta', boton: 'Pagar ahora' },
  { rotulo: 'Yape o Plin', titulo: 'Pagar con Yape o Plin', boton: 'Ya yapeé' },
  { rotulo: 'pagalo.pe', titulo: 'Pagar por pagalo.pe', boton: 'Ir a pagalo.pe' },
  { rotulo: 'Banco o agente', titulo: 'Pagar en un banco o agente', boton: 'Ya pagué en el banco' },
] as const;

export const principal = (pagina: Page): Locator => pagina.getByRole('main');

/** Abre el portal en su primer paso y espera a que la pantalla (un trozo aparte) este dibujada. */
export async function abrirElPortal(pagina: Page): Promise<void> {
  await pagina.goto('./#/buscar');
  await expect(pagina.getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeVisible();
}

/** Paso 1 → 2: busca la deuda de la demostracion. */
export async function buscarMiDeuda(pagina: Page): Promise<void> {
  await principal(pagina).getByRole('textbox', { name: 'Código de contribuyente' }).fill(CODIGO);
  await principal(pagina).getByRole('button', { name: 'Buscar mi deuda' }).click();
  await expect(pagina).toHaveURL(/#\/deudas$/);
  await expect(pagina.getByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeVisible();
}

/** Paso 2 → 3 (o 4 con sesion): «Pagar todo» o «Pagar lo marcado». */
export async function pagarLoElegido(pagina: Page): Promise<void> {
  await principal(pagina).getByRole('button', { name: /^Pagar (todo|lo marcado)$/ }).click();
}

/** Paso 3 → 4 sin cuenta. */
export async function continuarConMiCorreo(pagina: Page, correo = CORREO): Promise<void> {
  await expect(pagina).toHaveURL(/#\/identificar$/);
  const tarjeta = principal(pagina).getByRole('region', { name: 'Solo con mi correo' });
  await tarjeta.getByRole('textbox', { name: 'Correo electrónico' }).fill(correo);
  await tarjeta.getByRole('button', { name: 'Continuar al pago' }).click();
  await expect(pagina).toHaveURL(/#\/pagar$/);
}

/** Paso 3 con cuenta: documento y clave (en la demostracion vale cualquiera). */
export async function entrarConMiCuenta(pagina: Page): Promise<void> {
  await expect(pagina).toHaveURL(/#\/identificar$/);
  const tarjeta = principal(pagina).getByRole('region', { name: 'Con mi cuenta' });
  await tarjeta.getByRole('textbox', { name: 'Documento de identidad' }).fill('44218937');
  await tarjeta.getByLabel('Clave').fill('una clave de demostracion');
  await tarjeta.getByRole('button', { name: 'Entrar y pagar' }).click();
}

/** Paso 4: elige un medio y espera su panel. */
export async function elegirMedio(pagina: Page, medio: (typeof MEDIOS)[number]): Promise<void> {
  const boton = principal(pagina).getByRole('button', { name: medio.rotulo, exact: true });
  await boton.click();
  await expect(boton).toHaveAttribute('aria-pressed', 'true');
  await expect(principal(pagina).getByRole('heading', { level: 2, name: medio.titulo })).toBeVisible();
}

/** Paso 4 → 5: confirma con el medio elegido. */
export async function confirmarElPago(pagina: Page, medio: (typeof MEDIOS)[number]): Promise<void> {
  await principal(pagina).getByRole('button', { name: medio.boton }).click();
  await expect(pagina).toHaveURL(/#\/comprobante$/);
  await expect(pagina.getByRole('heading', { level: 1, name: 'Su pago se registró' })).toBeVisible();
}

/** El recibo del comprobante: la region que se imprime. */
export const recibo = (pagina: Page): Locator => principal(pagina).getByRole('region', { name: 'Constancia de pago' });

/** Las filas de una tabla como texto, celda a celda. */
export async function filasDe(tabla: Locator): Promise<string[][]> {
  return tabla.locator('tbody tr').evaluateAll((filas) =>
    filas.map((fila) => [...fila.querySelectorAll('th, td')].map((celda) => (celda.textContent ?? '').trim())),
  );
}

/**
 * **Lo que se mide en cada paso, a cada anchura** (issue 11): que la pagina no se desplace de lado,
 * que la barra sea el azul del artboard y que el cuerpo DECLARE la fuente del tema.
 *
 * `scrollWidth <= innerWidth` sobre `<html>`: si una tabla o una rejilla se sale, el documento entero
 * crece y se desplaza, aunque la pieza culpable este al fondo de la pagina.
 *
 * <h2>Por que dice «declara» y no «es Arial» (issue 36)</h2>
 *
 * `getComputedStyle(...).fontFamily` devuelve la DECLARACION —la pila `font-family` tal como el CSS
 * la escribio—, no la familia con la que el motor de texto compuso los glifos. Linux no trae Arial:
 * si falta, el navegador sustituye en silencio y esta lectura sigue diciendo «Arial, Helvetica,
 * sans-serif» igual, porque la declaracion no cambio. Por eso esta comprobacion solo puede fallar si
 * el CSS declara OTRA cosa —un `font-family` distinto en alguna pantalla—, y el nombre lo dice: lo
 * que de verdad se DIBUJA lo mide `laLetraDibujadaCalzaConArial`, con CDP, mas abajo.
 *
 * El valor esperado se LEE de la propia pagina —`--font-sans` de `[data-tema='clasico']`, el token
 * que el preflight pinta en `body`— y no de un literal escrito aqui: el pin a «Arial, Helvetica,
 * sans-serif» vive SOLO en `verificaciones/tailwind-emite-las-clases.test.ts` (vitest, contra el CSS
 * compilado). Aqui lo que se exige es que `body` DECLARE lo que el tema dice, sea cual sea ese
 * valor: un desacuerdo entre los dos es la rotura real —una pantalla con su propio `font-family`—,
 * y no depende de mantener el mismo literal en dos sitios.
 *
 * <h2>Lo que esta comprobacion NO ve</h2>
 *
 * Solo lee `body`. Una clase `font-serif` o `font-mono` puesta a mano en UN elemento concreto —un
 * boton, una celda— no la ve nadie aqui, salvo que ese elemento sea uno de los tres que
 * `laLetraDibujadaCalzaConArial` mide (el cuerpo, un titulo, una cifra) y ademas cambie lo DIBUJADO.
 * `sin-colores-propios.test.ts` es quien cierra ese hueco de verdad: un `font-family` a mano en
 * `src/` sale rojo ahi, en cualquier elemento, sin esperar a que el arnes lo recorra.
 */
export async function seVeBien(pagina: Page, donde: string): Promise<void> {
  const medido = await pagina.evaluate(() => {
    const barra = document.querySelector('header');
    return {
      ancho: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      barra: barra === null ? '(no hay barra)' : getComputedStyle(barra).backgroundColor,
      letra: getComputedStyle(document.body).fontFamily,
      fuenteDelTema: getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim(),
    };
  });
  expect(medido.ancho, `${donde}: la pagina mide ${medido.ancho} px en una ventana de ${medido.ventana}`).toBeLessThanOrEqual(
    medido.ventana,
  );
  expect(medido.barra, `${donde}: la barra no es el azul #0D5FA8 del artboard`).toBe('rgb(13, 95, 168)');
  expect(medido.letra, `${donde}: el cuerpo no DECLARA la fuente del tema («${medido.fuenteDelTema}»)`).toBe(
    medido.fuenteDelTema,
  );
}

/**
 * Las familias que Chromium puede DIBUJAR sin que las medidas del artboard se corran: mismas
 * metricas que Arial (mismo ancho por caracter, mismo interlineado), asi que un boton con un ancho
 * fijo en px o el corte de una rejilla no cambian aunque el trazo no sea Arial byte a byte.
 *
 *   · **Arial**: si el entorno la tiene instalada (con licencia: `ttf-mscorefonts-installer`).
 *   · **Liberation Sans**: la sustituta de Red Hat, diseñada para calzar con Arial metrica a
 *     metrica. Es la que instala `fonts-liberation` (Debian/Ubuntu, y el paso nuevo de
 *     `.github/workflows/frontend.yml`), y la que ya hay en esta maquina, en
 *     `~/.local/share/fonts/liberation` — de ahi que `fc-match Arial` conteste «Liberation Sans».
 *   · **Arimo**: la misma sustitucion, pero de Google, y con el mismo objetivo: **no** es la de
 *     Android (que usa Roboto) — es la de Chrome OS y las fuentes Croscore.
 *
 * `DejaVu Sans` NO esta: es la que cae por `fc-match sans-serif` en esta maquina SIN esas fuentes, y
 * es mas ancha que Arial — las medidas fijas del artboard (`e2e/se-ve.spec.ts`) se desvian con ella.
 */
export const FAMILIAS_QUE_CALZAN_CON_ARIAL = ['Arial', 'Liberation Sans', 'Arimo'] as const;

/**
 * El atributo con que se marca, EN TIEMPO DE PRUEBA, el nodo que CDP tiene que medir: el marcado de
 * produccion no se toca solo para que el arnes tenga un selector (issue 36, ronda 1 de revision del
 * PR #47). `laLetraDibujadaCalzaConArial` lo pone con `locator.evaluate` justo antes de medir y lo
 * quita despues, asi que nunca queda en el DOM entre una medida y la siguiente.
 */
const ATRIBUTO_DE_MEDIDA = 'data-medir-fuente';

/**
 * Lo que Chromium usa de VERDAD para pintar el texto de `elemento`, leido por CDP y no por
 * `getComputedStyle` (issue 36): `CSS.getPlatformFontsForNode` devuelve la lista de familias con
 * las que el motor de texto compuso glifos dentro del nodo, cada una con cuantos glifos le tocaron.
 *
 * Devuelve **todas** las que de verdad pintaron algo (`glyphCount > 0`), no solo la que mas glifos
 * tuvo: si el texto del nodo mezcla un caracter que la fuente principal no trae, ese caracter cae a
 * otra familia por *fallback* —a menudo una que NO calza con Arial— y con pocos glifos puede
 * esconderse detras de la que domina. Quien decide cuales de esas familias son aceptables es
 * `laLetraDibujadaCalzaConArial`, mas abajo.
 */
async function familiasDibujadasDe(
  pagina: Page,
  elemento: Locator,
): Promise<ReadonlyArray<{ readonly familia: string; readonly glifos: number }>> {
  await elemento.evaluate((nodo, atributo) => nodo.setAttribute(atributo, ''), ATRIBUTO_DE_MEDIDA);
  try {
    const cdp = await pagina.context().newCDPSession(pagina);
    try {
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[${ATRIBUTO_DE_MEDIDA}]` });
      if (nodeId === 0) throw new Error('CDP no encontro el nodo marcado para medir que fuente se dibujo.');
      await cdp.send('CSS.enable');
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      const pintadas = fonts
        .filter((f) => f.glyphCount > 0)
        .map((f) => ({ familia: f.familyName, glifos: f.glyphCount }))
        .sort((a, b) => b.glifos - a.glifos);
      if (pintadas.length === 0) throw new Error('CDP no informo ninguna fuente pintada en el nodo marcado.');
      return pintadas;
    } finally {
      await cdp.detach();
    }
  } finally {
    await elemento.evaluate((nodo, atributo) => nodo.removeAttribute(atributo), ATRIBUTO_DE_MEDIDA);
  }
}

/**
 * **TODAS** las familias DIBUJADAS en `elemento` tienen que ser Arial o una compatible en metricas
 * (issue 36): basta que UNA letra caiga en una familia fuera de la lista —el *fallback* de un solo
 * caracter que Liberation no trae, por ejemplo— para que el ancho del texto deje de ser el de Arial
 * en algun punto, y eso ya no lo cubre medir solo la familia que mas glifos pinto.
 */
export async function laLetraDibujadaCalzaConArial(pagina: Page, elemento: Locator, donde: string): Promise<void> {
  const pintadas = await familiasDibujadasDe(pagina, elemento);
  const fuera = pintadas.filter((f) => !(FAMILIAS_QUE_CALZAN_CON_ARIAL as readonly string[]).includes(f.familia));
  const resumen = pintadas.map((f) => `${f.familia}×${f.glifos}`).join(', ');
  expect(
    fuera,
    `${donde}: Chromium dibujo con [${resumen}], y [${fuera.map((f) => f.familia).join(', ')}] no es Arial ni ` +
      `una compatible en metricas (${FAMILIAS_QUE_CALZAN_CON_ARIAL.join(', ')}). Si es DejaVu Sans, al entorno ` +
      'le falta una compatible: instale `fonts-liberation` (Debian/Ubuntu) o el paquete equivalente.',
  ).toEqual([]);
}
