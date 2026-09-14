// @vitest-environment node
//
// Lee el artboard del disco y compara listas de texto. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { ICONOS } from '@kamayuk/ui';
import { describe, expect, it } from 'vitest';

import { RAIZ } from '../../../verificaciones/artboards.ts';
import { TRAZOS_DEL_ARTBOARD } from './trazos.ts';

/**
 * **Los iconos de «Qué puede hacer aquí» son los trazos del artboard**, uno a uno.
 *
 * Se lee el bloque `const ICO = {…}` del artboard vendorizado (cuya huella vigila
 * `los-artboards-estan`) y se evalua: es un literal de objeto sin una llamada. Contra el se comparan
 * los tres trazos copiados aqui y el que se toma de la libreria.
 */

const ARTBOARD = readFileSync(join(RAIZ, 'diseno/Ciudadano.dc.html'), 'utf8');

function icoDelArtboard(artboard: string): Record<string, string[]> {
  const bloque = /const ICO = (\{[\s\S]*?\n\});/.exec(artboard)?.[1];
  if (bloque === undefined) throw new Error('El artboard ya no declara `const ICO = {…};`.');
  return runInNewContext(`(${bloque})`) as Record<string, string[]>;
}

describe('los trazos de las capacidades', () => {
  const ico = icoDelArtboard(ARTBOARD);

  it('EL CENTINELA: el artboard trae los cuatro que la pantalla dibuja', () => {
    expect(Object.keys(ico)).toEqual(['buscar', 'pagar', 'recibo', 'detalle']);
  });

  it('los tres copiados son los del artboard, tal cual', () => {
    for (const [nombre, trazos] of Object.entries(TRAZOS_DEL_ARTBOARD)) {
      expect(trazos, `«${nombre}» (artboard, lineas 919-924)`).toEqual(ico[nombre]);
    }
  });

  it('`buscar` se toma de la libreria porque `lupa` es el mismo trazo', () => {
    expect(ICONOS.lupa).toEqual(ico.buscar);
  });

  it('y los que se copian NO estan en la libreria: si llegan, sobra la copia', () => {
    const publicados = Object.values(ICONOS).map((trazos) => JSON.stringify(trazos));
    const yaPublicados = Object.entries(TRAZOS_DEL_ARTBOARD)
      .filter(([, trazos]) => publicados.includes(JSON.stringify(trazos)))
      .map(([nombre]) => nombre);
    expect(yaPublicados, '`@kamayuk/ui` ya publica estos trazos: dibujalos con `Icono`').toEqual([]);
  });
});
