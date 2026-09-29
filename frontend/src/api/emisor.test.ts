import { TEXTOS_DE_LA_PUERTA, type FallaDeLaPuerta } from '@kamayuk/sesion';
import { describe, expect, it } from 'vitest';

import {
  TEXTOS_DEL_EMISOR,
  TEXTOS_DE_LA_PUERTA_DEL_PORTAL,
  TEXTOS_DE_LA_SONDA,
  clavesDelEmisor,
  deLaSonda,
} from './emisor.ts';

/**
 * **La ida que no llega al sistema de identidad, dicha con claves del portal** (issue 67).
 *
 * `deLaSonda()` recibe el `motivo` de la libreria —palabras del navegador, o uno de los dos textos que
 * el portal le dio— y devuelve una clave de `TEXTOS_DEL_EMISOR`. Lo que se mide aqui es que el
 * `motivo` elige y nunca se ensena; que llegue a la pantalla lo miden la barra, el paso 1 y el
 * peldano de la consulta.
 */

const conMotivo = (motivo: string): FallaDeLaPuerta => ({
  emisor: 'http://localhost:18180/realms/kamayuk-ciudadano',
  url: 'http://localhost:18180/realms/kamayuk-ciudadano/.well-known/openid-configuration',
  motivo,
});

describe('deLaSonda', () => {
  it('el plazo agotado, contado con la marca del portal, dice los segundos que trae', () => {
    expect(deLaSonda(conMotivo(TEXTOS_DE_LA_SONDA.noContestoEn(8)))).toEqual({
      clave: TEXTOS_DEL_EMISOR.sondaSinRespuesta,
      valores: { segundos: '8' },
    });
    expect(deLaSonda(conMotivo(TEXTOS_DE_LA_SONDA.noContestoEn(7.5)))).toEqual({
      clave: TEXTOS_DEL_EMISOR.sondaSinRespuesta,
      valores: { segundos: '7.5' },
    });
  });

  it.each([
    ['el «Failed to fetch» de Chromium', 'Failed to fetch'],
    ['el «Load failed» de Safari', 'Load failed'],
    ['la frase de la libreria, si la puerta se construyera sin los textos del portal', TEXTOS_DE_LA_PUERTA.noContestoEn(8)],
    ['algo que se parece a la marca y no lo es', `${TEXTOS_DE_LA_SONDA.noContestoEn(8)} y algo mas`],
  ])('%s es «no contesta», sin una palabra del motivo', (_caso, motivo) => {
    const aviso = deLaSonda(conMotivo(motivo));

    expect(aviso).toEqual({ clave: TEXTOS_DEL_EMISOR.sondaNoLlega });
    expect(JSON.stringify(aviso)).not.toContain(motivo);
  });

  it('lo que no era un `Error` llega como la clave de «no contesta», y es esa', () => {
    expect(deLaSonda(conMotivo(TEXTOS_DE_LA_SONDA.laPeticionNoLlegoACompletarse))).toEqual({
      clave: TEXTOS_DEL_EMISOR.sondaNoLlega,
    });
  });
});

describe('lo que la puerta del portal le da a la libreria', () => {
  it('la sonda, ademas de la vuelta: ni una frase de la libreria queda sin sustituir', () => {
    // Menos las que el portal dice con las MISMAS palabras, que son claves suyas.
    const sinSustituir = (Object.keys(TEXTOS_DE_LA_PUERTA) as (keyof typeof TEXTOS_DE_LA_PUERTA)[]).filter(
      (clave) =>
        TEXTOS_DE_LA_PUERTA_DEL_PORTAL[clave] === TEXTOS_DE_LA_PUERTA[clave] &&
        !clavesDelEmisor().includes(String(TEXTOS_DE_LA_PUERTA[clave])),
    );
    expect(sinSustituir).toEqual([]);
    expect(TEXTOS_DE_LA_PUERTA_DEL_PORTAL.noContestoEn(8)).not.toBe(TEXTOS_DE_LA_PUERTA.noContestoEn(8));
  });
});
