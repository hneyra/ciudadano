import { TEXTOS_DE_LA_PUERTA } from '@kamayuk/sesion';
import { screen } from '@testing-library/react';
import { expect, vi } from 'vitest';

import { TEXTOS_DE_LA_SONDA, clavesDelEmisor } from '../api/emisor.ts';

/**
 * **La sonda de `entrar()` que no llega al sistema de identidad, y lo que el portal dice entonces**
 * (issue 67).
 *
 * Antes de mandar al formulario, `@kamayuk/sesion` pide el documento de descubrimiento del emisor; si
 * no contesta, `entrar()` devuelve una `FallaDeLaPuerta` cuyo `motivo` son palabras del NAVEGADOR
 * —«Failed to fetch»— o de la libreria —«no contesto en 8 s», sin tilde—. Hasta el issue 67 las tres
 * pantallas que llaman a `entrar()` metian ese `motivo` tal cual en su aviso.
 *
 * Las fallas se provocan en el `fetch` de la sonda y no espiando `identidad.entrar`: asi pasan por la
 * libreria de verdad con los textos que el portal le da, que es lo que se mide.
 *
 * El plazo se modela con un `Error` llamado `TimeoutError`, que es lo que `AbortSignal.timeout` deja
 * en un navegador (un `DOMException`, que alli ES un `Error`). La `DOMException` de jsdom es de otro
 * reino y no pasa `instanceof Error`: con ella la libreria tomaria la rama de «no es un `Error`», que
 * es el tercer caso.
 */
export const LAS_SONDAS_QUE_FALLAN: readonly (readonly [caso: string, falla: () => unknown, aviso: string])[] = [
  [
    'por red, con el «Failed to fetch» del navegador',
    () => new TypeError('Failed to fetch'),
    'No pudimos llevarle al acceso: el sistema de identidad no contesta. Puede estar apagado o no ser alcanzable desde este equipo; vuelva a intentarlo en unos minutos.',
  ],
  [
    'por tiempo, con la espera de la sonda agotada',
    () => Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }),
    'No pudimos llevarle al acceso: el sistema de identidad no contestó en 8 s. Vuelva a intentarlo en unos minutos.',
  ],
  [
    'con algo que no es un `Error`',
    () => 'la red se cayo',
    'No pudimos llevarle al acceso: el sistema de identidad no contesta. Puede estar apagado o no ser alcanzable desde este equipo; vuelva a intentarlo en unos minutos.',
  ],
];

/** Deja la sonda fallando con `falla`. Quien la llame devuelve los globales con `vi.unstubAllGlobals()`. */
export function laSondaFallaCon(falla: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(falla)),
  );
}

/**
 * **Lo que no puede llegar a la pantalla**: las frases de la libreria —sin tildes, de funcionario, la
 * del plazo con sus ocho segundos incluida— y las del navegador que la sonda reenvia. Menos las que el
 * portal dice con las MISMAS palabras, que son claves suyas (como en `src/arranque.vuelta.test.tsx`).
 */
const LO_CRUDO: readonly (string | RegExp)[] = [
  ...Object.values(TEXTOS_DE_LA_PUERTA).filter(
    (v): v is string => typeof v === 'string' && !clavesDelEmisor().includes(v),
  ),
  TEXTOS_DE_LA_PUERTA.noContestoEn(8),
  // La marca con la que la libreria le cuenta al portal el plazo agotado: es un dato, no una frase.
  TEXTOS_DE_LA_SONDA.noContestoEn(8),
  'Failed to fetch',
  'signal timed out',
  'la red se cayo',
  // «contestó» sin su tilde: la palabra de la libreria.
  /\bcontesto\b/,
];

/** Lo crudo que aparece en `texto`, para un `toEqual([])` que diga cual. */
export function loCrudoEn(texto: string): readonly string[] {
  return LO_CRUDO.filter((crudo) => (typeof crudo === 'string' ? texto.includes(crudo) : crudo.test(texto))).map(String);
}

/**
 * **Espera el aviso de la ida y lo mide**: primero que en la pagina entera no haya nada crudo, y
 * despues que el aviso sea `esperado` (en `marcado`, envuelto). En ese orden, para que un aviso con el
 * `motivo` dentro salga rojo diciendo QUE se colo, y no solo que el texto es otro.
 */
export async function seAvisaSinNadaCrudo(esperado: string): Promise<void> {
  const aviso = await screen.findByText(/No pudimos llevarle al acceso/);
  expect(loCrudoEn(document.body.textContent ?? ''), 'llego a la pantalla algo del navegador o de la libreria').toEqual([]);
  expect(aviso.textContent).toBe(esperado);
}
