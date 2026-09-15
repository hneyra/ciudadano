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
export const CORREO = 'maria@correo.com';

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
 * **Lo que se mide en cada paso, a cada anchura** (issue 11): que la pagina no se desplace de lado, que
 * la barra sea el azul del artboard y que la letra sea Arial.
 *
 * `scrollWidth <= innerWidth` sobre `<html>`: si una tabla o una rejilla se sale, el documento entero
 * crece y se desplaza, aunque la pieza culpable este al fondo de la pagina.
 */
export async function seVeBien(pagina: Page, donde: string): Promise<void> {
  const medido = await pagina.evaluate(() => {
    const barra = document.querySelector('header');
    return {
      ancho: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      barra: barra === null ? '(no hay barra)' : getComputedStyle(barra).backgroundColor,
      letra: getComputedStyle(document.body).fontFamily,
    };
  });
  expect(medido.ancho, `${donde}: la pagina mide ${medido.ancho} px en una ventana de ${medido.ventana}`).toBeLessThanOrEqual(
    medido.ventana,
  );
  expect(medido.barra, `${donde}: la barra no es el azul #0D5FA8 del artboard`).toBe('rgb(13, 95, 168)');
  expect(medido.letra, `${donde}: la letra del cuerpo no es la del artboard`).toMatch(/^Arial\b/);
}
