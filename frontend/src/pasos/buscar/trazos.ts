/**
 * **Los trazos de las capacidades que `@kamayuk/ui` no publica**, copiados de `ICO`
 * (`diseno/Ciudadano.dc.html`, lineas 919-924).
 *
 * De los cuatro, solo `buscar` esta en `ICONOS` de la libreria, y con el mismo trazo: es `lupa`, y se
 * dibuja con `Icono`. Los otros tres no:
 *
 *   · `pagar` (un billete) no tiene equivalente.
 *   · `recibo` se parece a `documento`, pero `documento` lleva un segundo renglon que el artboard no.
 *   · `detalle` se parece a `informacion`, pero su circulo y su «i» son otros trazos.
 *
 * Asi que van aqui, literales. Que sigan siendo los del artboard —y que `lupa` siga siendo `buscar`—
 * lo comprueba `trazos.test.ts` leyendo el artboard vendorizado.
 */
export const TRAZOS_DEL_ARTBOARD = {
  pagar: ['M3.2 7.4h17.6v9.2H3.2z', 'M13.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0'],
  recibo: ['M6.5 3.5h7.5l4 4v13h-11.5z', 'M14 3.5v4h4', 'M9.5 12.5h5'],
  detalle: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17', 'M12 11v5.5', 'M12 7.8v.02'],
} as const satisfies Record<string, readonly string[]>;

export type TrazoDelArtboard = keyof typeof TRAZOS_DEL_ARTBOARD;
