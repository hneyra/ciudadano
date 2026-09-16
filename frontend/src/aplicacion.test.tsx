import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import i18n, { IDIOMA_MARCADO } from './i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from './pruebas/portal.tsx';

/**
 * **El marco dice lo que dice el artboard, y lo dice por `t()`.**
 *
 * Las dos mitades hacen falta. Con el idioma `es`, un texto escrito a pelo pasaria igual que uno
 * traducido: el texto es el mismo. Solo con el idioma `marcado`, que envuelve entre `⟦…⟧` todo lo que
 * sale de `t()`, se distingue lo que paso por la traduccion de lo que no. El menu de la sesion se
 * comprueba en `marco/Barra.test.tsx`, que es donde se abre.
 */

const TITULO = 'Pago de tributos en línea';
const ENTIDAD = 'Municipalidad Distrital de Catacaos';
const PIE =
  'Municipalidad Distrital de Catacaos — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00. Los datos de esta pantalla son de demostración.';
const PASOS = ['Buscar mi deuda', 'Elegir qué pago', 'Mis datos', 'Pagar', 'Comprobante'];
const ENLACES = ['Preguntas frecuentes', 'Reclamos', 'Términos'];

// La instancia de i18next es global: si una prueba se queda en `marcado`, la siguiente veria texto
// envuelto y fallaria por un motivo que no es el suyo. `limpiarElPortal` la devuelve a `es`.
afterEach(limpiarElPortal);

describe('el marco del portal', () => {
  it('barra, franja, marcador del paso y pie con los textos del artboard', () => {
    montarElPortal();

    const barra = screen.getByRole('banner');
    expect(within(barra).getByRole('button', { name: `${TITULO} ${ENTIDAD}` })).toBeInTheDocument();
    expect(within(barra).getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation')).getAllByRole('button').map((b) => b.textContent)).toEqual(
      PASOS.map((paso, i) => `${String(i + 1)}${paso}`),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeInTheDocument();
    const pie = screen.getByRole('contentinfo');
    expect(within(pie).getByText(PIE)).toBeInTheDocument();
    expect(within(pie).getAllByRole('link').map((a) => a.textContent)).toEqual(ENLACES);
  });

  it('y todo pasa por `t()`: con el idioma marcado sale envuelto', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);

    montarElPortal();

    const barra = screen.getByRole('banner');
    expect(
      within(barra).getByRole('button', { name: `${marcado(TITULO)} ${marcado(ENTIDAD)}` }),
    ).toBeInTheDocument();
    expect(within(barra).getByRole('button', { name: marcado('Iniciar sesión') })).toBeInTheDocument();
    // Las etiquetas de los pasos, en su texto y en su nombre accesible.
    const pasos = within(screen.getByRole('navigation')).getAllByRole('button');
    expect(pasos.map((b) => b.getAttribute('aria-label'))).toEqual(PASOS.map(marcado));
    expect(pasos.map((b) => b.textContent)).toEqual(PASOS.map((paso, i) => `${String(i + 1)}${marcado(paso)}`));
    expect(screen.getByRole('heading', { level: 1, name: marcado('Consulte y pague sus tributos') })).toBeInTheDocument();
    // El pie: la frase entera marcada, con la entidad —que tambien es texto— marcada dentro.
    const pie = screen.getByRole('contentinfo');
    expect(within(pie).getByText(marcado(PIE.replace(ENTIDAD, marcado(ENTIDAD))))).toBeInTheDocument();
    expect(within(pie).getAllByRole('link').map((a) => a.textContent)).toEqual(ENLACES.map(marcado));
    // Y el rotulo de la region de avisos, que no se dibuja: sin `t()` llegaria «Avisos» sin marcar.
    expect(document.querySelector('[aria-live]')?.getAttribute('aria-label')).toContain(marcado('Avisos'));
  });

  it('con sesion, el disparador del menu dice quien entro (dato, no texto a traducir)', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);

    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });

    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'María E. Castillo DNI 44218937' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { level: 1, name: marcado('¿Cómo quiere pagar?') })).toBeInTheDocument();
  });
});

describe('el tema del portal', () => {
  beforeEach(() => {
    // El `<html>` es el mismo para todas las pruebas del archivo y el proveedor no lo limpia al
    // desmontar: sin esto, un `data-tema` que dejo puesto otra prueba pasaria por el de esta.
    document.documentElement.removeAttribute('data-tema');
    document.documentElement.removeAttribute('data-modo');
    window.localStorage.clear();
  });

  it('el proveedor marca el documento con la identidad `clasico`', () => {
    expect(document.documentElement).not.toHaveAttribute('data-tema');

    montarElPortal();

    expect(document.documentElement).toHaveAttribute('data-tema', 'clasico');
    // Sin modo: ausente es «el del equipo», y lo resuelve `prefers-color-scheme` en `temas.css`.
    expect(document.documentElement).not.toHaveAttribute('data-modo');
  });

  it('y recuerda lo elegido bajo SU prefijo, no bajo el de otra interfaz del producto', () => {
    // Lo que otra interfaz servida del mismo origen dejo guardado no le cambia el tema a esta.
    window.localStorage.setItem('kamayuk.rentas.tema', 'sepia');
    const { unmount } = montarElPortal();
    expect(document.documentElement).toHaveAttribute('data-tema', 'clasico');
    unmount();

    // Y lo guardado bajo `kamayuk.ciudadano` si se respeta: el prefijo es el que se configuro.
    window.localStorage.setItem('kamayuk.ciudadano.tema', 'sepia');
    montarElPortal();
    expect(document.documentElement).toHaveAttribute('data-tema', 'sepia');
  });
});
