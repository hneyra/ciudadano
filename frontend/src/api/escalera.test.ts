import { ErrorDeLaApi } from '@kamayuk/api';
import { peldanoDe } from '@kamayuk/sesion';
import { afterEach, describe, expect, it } from 'vitest';

import i18n, { IDIOMA_MARCADO, IDIOMA_POR_OMISION } from '../i18n/i18n.ts';
import {
  TEXTOS_DEL_PORTAL,
  clavesDeLaEscalera,
  peldanoDelPortal,
  type ClaveDelPeldano,
} from './escalera.ts';

/**
 * **La escalera habla como el portal, no como la ventanilla** (issue 13).
 *
 * Las siete claves son de `@kamayuk/sesion` y la clasificacion tambien; lo que se mide aqui es que
 * **ninguna de las siete llegue a la pantalla con el texto de funcionario de la libreria**, que es
 * lo que pasaria si este archivo se quedara corto: un peldano sin entrada saldria `undefined`, o
 * —peor, si alguien lo «arreglara» con un respaldo— mandaria a un ciudadano a avisar a soporte.
 */

/** Un fallo del backend con su estado y su codigo, como el que lanza `@kamayuk/api`. */
const falloDeLaApi = (estado: number, codigo?: string, mensaje?: string) =>
  new ErrorDeLaApi(estado, 'GET /portal/situacion', {
    status: estado,
    ...(codigo === undefined ? {} : { codigo }),
    ...(mensaje === undefined ? {} : { mensaje }),
  });

/** Un fallo por cada clave, para recorrer la escalera entera sin escribir la tabla dos veces. */
const UN_FALLO_POR_CLAVE: Readonly<Record<ClaveDelPeldano, unknown>> = {
  'sin-identidad': falloDeLaApi(401, 'NO_AUTENTICADO'),
  'sin-municipalidad': falloDeLaApi(403, 'SIN_MUNICIPALIDAD'),
  'sin-privilegio': falloDeLaApi(403, 'SIN_PRIVILEGIO'),
  'no-permitido': falloDeLaApi(403, 'SIN_DOCUMENTO'),
  'no-encontrado': falloDeLaApi(404),
  'no-valido': falloDeLaApi(422, 'VALIDACION'),
  averia: new TypeError('Failed to fetch'),
};

const CLAVES = Object.keys(UN_FALLO_POR_CLAVE) as readonly ClaveDelPeldano[];

/** El traductor de verdad, el que usarian las pantallas. */
const traducir = (texto: string) => i18n.t(texto);

afterEach(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

describe('EL CENTINELA: la tabla cubre la escalera entera', () => {
  it('los siete fallos caen cada uno en su clave, y no hay dos en la misma', () => {
    // Sin esto, un fallo mal construido —un 403 sin codigo donde se esperaba `SIN_PRIVILEGIO`—
    // dejaria dos casos midiendo el mismo peldano y uno sin ejercitar, en verde.
    const caidas = CLAVES.map((clave) => peldanoDe(UN_FALLO_POR_CLAVE[clave]).clave);

    expect(caidas).toEqual(CLAVES);
  });

  it('y la tabla del portal decide las siete, ni una mas', () => {
    expect(Object.keys(TEXTOS_DEL_PORTAL).sort()).toEqual([...CLAVES].sort());
  });
});

describe('las siete tienen texto propio, y ninguno es el de la libreria', () => {
  it.each(CLAVES)('«%s» dice otra cosa que `peldanoDe`', (clave) => {
    const suyo = peldanoDe(UN_FALLO_POR_CLAVE[clave]);
    const nuestro = TEXTOS_DEL_PORTAL[clave];

    expect(nuestro.titulo).not.toBe(suyo.titulo);
    expect(nuestro.remedio).not.toBe(suyo.remedio);
    for (const texto of [nuestro.titulo, nuestro.detalle, nuestro.remedio]) {
      expect(texto.trim()).not.toBe('');
    }
  });

  it('ninguna manda a «soporte», ni a un administrador, ni habla de perfiles', () => {
    // Los cuatro remedios de la libreria: «avise a soporte», «lo asigna el administrador del
    // sistema», «pida el permiso a quien administre los perfiles», «revise con que cuenta esta
    // trabajando». A quien entra a pagar su predial no le sirve ninguno.
    const culpables = clavesDeLaEscalera().filter((texto) =>
      /soporte|administrador|administre|perfil(es)?\b/i.test(texto),
    );

    expect(culpables, 'La escalera del ciudadano volvio a hablar como la del funcionario').toEqual(
      [],
    );
  });

  it('ni de una municipalidad asignada a la cuenta', () => {
    // El token del ciudadano NO trae `municipalidad_id` —medido el 2026-09-16— y la consulta no lo
    // pide: decirle que le falta una municipalidad asignada seria mandarle a arreglar algo que no
    // existe.
    const culpables = clavesDeLaEscalera().filter((texto) => /asignad|municipalidad_id/i.test(texto));

    expect(culpables).toEqual([]);
  });

  it('y todas ofrecen algo que el ciudadano puede hacer', () => {
    // La ventanilla es la salida que siempre existe; volver a entrar, la del peldano de identidad;
    // corregir lo escrito, la del 422. Un remedio que no nombra ninguna es «reintente» a secas.
    const sinSalida = CLAVES.filter(
      (clave) => !/ventanilla|vuelva a entrar|vuelva a intentarlo|revise/i.test(TEXTOS_DEL_PORTAL[clave].remedio),
    );

    expect(sinSalida).toEqual([]);
  });
});

describe('la clasificacion sigue siendo la de la libreria', () => {
  it.each(CLAVES)('«%s» conserva `pideIdentidad` y `esAveria`', (clave) => {
    // Los textos son de aqui; **que hacer** con ellos, no: si la pantalla ofrece volver a entrar y
    // si esto es una averia lo decide el codigo del contrato, igual en los cinco sistemas.
    const suyo = peldanoDe(UN_FALLO_POR_CLAVE[clave]);
    const nuestro = peldanoDelPortal(UN_FALLO_POR_CLAVE[clave], traducir);

    expect(nuestro.clave).toBe(clave);
    expect(nuestro.pideIdentidad).toBe(suyo.pideIdentidad);
    expect(nuestro.esAveria).toBe(suyo.esAveria);
  });

  it('solo el 401 pide volver a identificarse, y solo lo que no contesta es averia', () => {
    // Escrito, y no derivado: es la decision que la pantalla lee para poner el boton «Entrar» y
    // para elegir el tono. Si la libreria cambiara de opinion, esto lo dice.
    expect(CLAVES.filter((c) => peldanoDelPortal(UN_FALLO_POR_CLAVE[c], traducir).pideIdentidad)).toEqual([
      'sin-identidad',
    ]);
    expect(CLAVES.filter((c) => peldanoDelPortal(UN_FALLO_POR_CLAVE[c], traducir).esAveria)).toEqual([
      'averia',
    ]);
  });

  it('lo que el backend dijo NO se ensena tal cual', () => {
    // La libreria usa el `mensaje` del `problem+json` como `detalle`. Ese texto tambien esta
    // escrito para la ventanilla, y el ciudadano no puede corregir nada leyendolo.
    const conMensaje = falloDeLaApi(403, 'SIN_DOCUMENTO', 'El token no identifica documento.');

    expect(peldanoDe(conMensaje).detalle).toBe('El token no identifica documento.');
    expect(peldanoDelPortal(conMensaje, traducir).detalle).not.toContain('token');
  });
});

describe('los tres textos pasan por `t()`', () => {
  it.each(CLAVES)('«%s» llega marcado, los tres', async (clave) => {
    // El idioma `marcado` envuelve entre ⟦ y ⟧ todo lo que pasa por `t()`. Un texto que llegara sin
    // marcar seria uno que la escalera devolvio a pelo — y que ningun idioma podria traducir.
    await i18n.changeLanguage(IDIOMA_MARCADO);
    const peldano = peldanoDelPortal(UN_FALLO_POR_CLAVE[clave], traducir);

    for (const texto of [peldano.titulo, peldano.detalle, peldano.remedio]) {
      expect(texto, `«${clave}»: texto que no paso por t()`).toMatch(/^⟦.*⟧$/su);
    }
  });

  it('y en castellano dicen exactamente lo de la tabla', () => {
    const peldano = peldanoDelPortal(UN_FALLO_POR_CLAVE['sin-identidad'], traducir);

    expect(peldano.titulo).toBe(TEXTOS_DEL_PORTAL['sin-identidad'].titulo);
    expect(peldano.remedio).toBe(TEXTOS_DEL_PORTAL['sin-identidad'].remedio);
  });

  it('el inventario de claves es el de la tabla, sin repetidos', () => {
    // Lo lee `el-locale-esta-completo.test.ts`: los textos se traducen con una variable, asi que
    // `i18next-cli` no los ve y el locale los DERIVA de aqui.
    const claves = clavesDeLaEscalera();

    expect(claves).toHaveLength(CLAVES.length * 3);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
