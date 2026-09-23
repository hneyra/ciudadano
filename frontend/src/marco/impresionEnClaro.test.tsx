import { afterEach, describe, expect, it } from 'vitest';

import { limpiarElPortal, montarElPortal, plazosDelPortal } from '../pruebas/portal.tsx';
import { imprimirEnClaro } from './impresionEnClaro.ts';

/**
 * **Al imprimir, `data-modo="claro"`; al acabar, lo que habia** (revision del PR del issue 9).
 *
 * jsdom no pinta ni evalua `@media print`: aqui se mide el atributo, que es lo que decide que paleta
 * de `temas.css` se aplica. Que con el atributo el recibo y el lienzo salen blancos en un navegador en
 * oscuro se midio con Playwright (`emulateMedia({ colorScheme: 'dark', media: 'print' })`, capturas
 * del PR).
 */

const CLAVE_DEL_MODO = 'kamayuk.ciudadano.modo';
const raiz = document.documentElement;
const modo = () => (raiz.hasAttribute('data-modo') ? raiz.getAttribute('data-modo') : '(ausente)');
const imprimir = () => window.dispatchEvent(new Event('beforeprint'));
const acabar = () => window.dispatchEvent(new Event('afterprint'));

afterEach(async () => {
  await limpiarElPortal();
  window.localStorage.removeItem(CLAVE_DEL_MODO);
  raiz.removeAttribute('data-modo');
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('el portal montado', () => {
  it('con el modo oscuro ELEGIDO: imprime en claro, vuelve a oscuro y no toca la preferencia guardada', () => {
    window.localStorage.setItem(CLAVE_DEL_MODO, 'oscuro');
    montarElPortal();
    expect(modo()).toBe('oscuro');

    imprimir();
    expect(modo()).toBe('claro');
    expect(window.localStorage.getItem(CLAVE_DEL_MODO)).toBe('oscuro');

    acabar();
    expect(modo()).toBe('oscuro');
    expect(window.localStorage.getItem(CLAVE_DEL_MODO)).toBe('oscuro');
  });

  it('sin modo elegido (el del sistema): imprime en claro y devuelve el atributo AUSENTE, no «claro»', () => {
    montarElPortal();
    expect(modo()).toBe('(ausente)');

    imprimir();
    expect(modo()).toBe('claro');

    acabar();
    expect(modo()).toBe('(ausente)');
    expect(window.localStorage.getItem(CLAVE_DEL_MODO)).toBeNull();
  });

  it('desmontado, deja de escuchar', () => {
    window.localStorage.setItem(CLAVE_DEL_MODO, 'oscuro');
    const { unmount } = montarElPortal();
    unmount();

    imprimir();
    expect(modo()).toBe('oscuro');
  });
});

describe('`imprimirEnClaro`, sin React', () => {
  /** Una `ventana` con su propio `matchMedia('print')` al que se le puede disparar el cambio. */
  function ventanaDePrueba() {
    const eventos = new EventTarget();
    const impresion = new EventTarget();
    const ventana = {
      addEventListener: eventos.addEventListener.bind(eventos),
      removeEventListener: eventos.removeEventListener.bind(eventos),
      matchMedia: () => impresion,
    } as unknown as Window;
    const cambiar = (matches: boolean) => impresion.dispatchEvent(Object.assign(new Event('change'), { matches }));
    const disparar = (tipo: string) => eventos.dispatchEvent(new Event(tipo));
    return { ventana, cambiar, disparar };
  }

  it('la impresion EMULADA (cambio de `matchMedia("print")`) tambien pasa a claro y vuelve', () => {
    const elemento = document.createElement('div');
    elemento.setAttribute('data-modo', 'oscuro');
    const { ventana, cambiar } = ventanaDePrueba();
    const soltar = imprimirEnClaro(elemento, ventana);

    cambiar(true);
    expect(elemento.getAttribute('data-modo')).toBe('claro');
    cambiar(false);
    expect(elemento.getAttribute('data-modo')).toBe('oscuro');
    soltar();
  });

  it('entrar por las dos senales guarda lo anterior UNA vez; salir sin entrar no toca nada; soltar a mitad restaura', () => {
    const elemento = document.createElement('div');
    const { ventana, cambiar, disparar } = ventanaDePrueba();
    const soltar = imprimirEnClaro(elemento, ventana);

    disparar('afterprint');
    expect(elemento.hasAttribute('data-modo')).toBe(false);

    disparar('beforeprint');
    cambiar(true);
    expect(elemento.getAttribute('data-modo')).toBe('claro');
    cambiar(false);
    expect(elemento.hasAttribute('data-modo')).toBe(false);
    disparar('afterprint');
    expect(elemento.hasAttribute('data-modo')).toBe(false);

    elemento.setAttribute('data-modo', 'oscuro');
    disparar('beforeprint');
    soltar();
    expect(elemento.getAttribute('data-modo')).toBe('oscuro');
    disparar('beforeprint');
    expect(elemento.getAttribute('data-modo')).toBe('oscuro');
  });
});
