import { ErrorDeLaApi, type CuerpoDeProblema } from '@kamayuk/api';
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
 * **La escalera habla como el portal, no como la ventanilla** (issues 13 y 33).
 *
 * Las claves son de `@kamayuk/sesion` y la clasificacion tambien; lo que se mide aqui es que
 * **ninguna llegue a la pantalla con el texto de funcionario de la libreria**, que es lo que
 * pasaria si este archivo se quedara corto: un peldano sin entrada saldria `undefined`, o —peor, si
 * alguien lo «arreglara» con un respaldo— mandaria a un ciudadano a avisar a soporte.
 *
 * <h2>Nueve claves, y la libreria enlazada puede distinguir solo siete</h2>
 *
 * `conflicto` y `orden-no-admitido` los trae kamayuk-lib#96, que se mezcla **pareado** con la rama
 * de este issue. Mientras ese PR siga abierto, la libreria enlazada aqui manda el 409 a `averia` y
 * el 422 `ORDEN_NO_ADMITIDO` a `no-valido`, y **afirmarlo distinto seria afirmar un hecho que no
 * ocurre**.
 *
 * Por eso `DISTINGUIDAS` se **mide** llamando a `peldanoDe`, y no se escribe: lo que depende de la
 * libreria se comprueba sobre lo que la libreria da hoy, y lo que es decision del portal —los
 * textos, que esten los nueve, que ninguno hable como la ventanilla— se comprueba sobre los nueve.
 * Asi este archivo dice la verdad a los dos lados del pareado y no hay que tocarlo cuando #96 entre.
 */

/** Un fallo del backend con su estado y su codigo, como el que lanza `@kamayuk/api`. */
const falloDeLaApi = (estado: number, codigo?: string, mensaje?: string) =>
  new ErrorDeLaApi(estado, 'GET /portal/situacion', {
    status: estado,
    ...(codigo === undefined ? {} : { codigo }),
    ...(mensaje === undefined ? {} : { mensaje }),
  });

/**
 * Un fallo con miembros que la libreria ENLAZADA puede no declarar todavia.
 *
 * `incidencia`, `detalles` y `parametroQueFalta` entran en `CuerpoDeProblema` con kamayuk-lib#96.
 * Escribirlos en un literal tipado daria un rojo de compilacion con la libreria de hoy —y el rojo
 * seria del andamiaje, no del portal—, asi que el cuerpo se arma suelto y se afirma al entrar: lo
 * que se mide es que el portal no los ensena, y para eso basta con que viajen.
 */
const falloConCuerpo = (estado: number, cuerpo: object) =>
  new ErrorDeLaApi(estado, 'GET /portal/situacion', cuerpo as CuerpoDeProblema);

/** Un fallo por cada clave, para recorrer la escalera entera sin escribir la tabla dos veces. */
const UN_FALLO_POR_CLAVE: Readonly<Record<ClaveDelPeldano, unknown>> = {
  'sin-identidad': falloDeLaApi(401, 'NO_AUTENTICADO'),
  'sin-municipalidad': falloDeLaApi(403, 'SIN_MUNICIPALIDAD'),
  'sin-privilegio': falloDeLaApi(403, 'SIN_PRIVILEGIO'),
  'no-permitido': falloDeLaApi(403, 'SIN_DOCUMENTO'),
  'no-encontrado': falloDeLaApi(404),
  conflicto: falloDeLaApi(409, 'CONFLICTO'),
  'orden-no-admitido': falloDeLaApi(422, 'ORDEN_NO_ADMITIDO'),
  'no-valido': falloDeLaApi(422, 'VALIDACION'),
  averia: new TypeError('Failed to fetch'),
};

const CLAVES = Object.keys(UN_FALLO_POR_CLAVE) as readonly ClaveDelPeldano[];

/**
 * Los dos peldanos que decide este portal ANTES de que la libreria los de (issue 33).
 *
 * Son los unicos que se admite que la libreria enlazada todavia no distinga. Cualquier otro que
 * falte es una clave inventada en la tabla del portal, y eso se pone rojo abajo.
 */
const LOS_PAREADOS: readonly ClaveDelPeldano[] = ['conflicto', 'orden-no-admitido'];

/** Las claves que la libreria ENLAZADA distingue hoy. Medido, no escrito: ver la cabecera. */
const DISTINGUIDAS = CLAVES.filter((clave) => peldanoDe(UN_FALLO_POR_CLAVE[clave]).clave === clave);

/** El traductor de verdad, el que usarian las pantallas. */
const traducir = (texto: string) => i18n.t(texto);

afterEach(async () => {
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

describe('EL CENTINELA: la tabla cubre la escalera entera', () => {
  it('cada fallo que la libreria distingue cae en su clave, y no hay dos en la misma', () => {
    // Sin esto, un fallo mal construido —un 403 sin codigo donde se esperaba `SIN_PRIVILEGIO`—
    // dejaria dos casos midiendo el mismo peldano y uno sin ejercitar, en verde.
    const caidas = DISTINGUIDAS.map((clave) => peldanoDe(UN_FALLO_POR_CLAVE[clave]).clave);

    expect(caidas).toEqual(DISTINGUIDAS);
  });

  it('y lo unico que la libreria enlazada puede no distinguir son los dos de kamayuk-lib#96', () => {
    // El centinela del centinela. `DISTINGUIDAS` se mide, asi que una clave inventada en la tabla
    // del portal —una que ningun fallo real produce— se caeria de la lista y las pruebas de arriba
    // ni la mirarian: pasarian en verde sobre una entrada que no existe en ninguna escalera.
    const pendientes = CLAVES.filter((clave) => !DISTINGUIDAS.includes(clave));

    expect(
      pendientes.filter((clave) => !LOS_PAREADOS.includes(clave)),
      'Hay peldanos en la tabla del portal que ninguna libreria produce',
    ).toEqual([]);
  });

  it('y los siete de siempre estan distinguidos, con la libreria que sea', () => {
    // Al reves que el anterior: si la libreria dejara de dar uno de los siete de hoy, `DISTINGUIDAS`
    // encogeria sin ruido y media docena de pruebas dejarian de medir nada.
    expect(DISTINGUIDAS).toEqual(
      expect.arrayContaining(CLAVES.filter((clave) => !LOS_PAREADOS.includes(clave))),
    );
  });

  it('y la tabla del portal decide las nueve, ni una mas', () => {
    expect(Object.keys(TEXTOS_DEL_PORTAL).sort()).toEqual([...CLAVES].sort());
  });
});

describe('las nueve tienen texto propio, y ninguno es el de la libreria', () => {
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

  it('y los dos de kamayuk-lib#96 NO prometen que insistir arregle nada', () => {
    // El defecto entero que trae el issue 33: hasta #96 el 409 caia en `averia`, o sea en «vuelva a
    // intentarlo en unos minutos», y volver a mandar lo mismo trae el mismo 409 — el remedio
    // CONTRARIO. Lo mismo con el orden que el servidor no admite: pedirlo otra vez no lo admite.
    // Estos dos remedios mandan a mirar como esta la cuenta y, si sigue igual, a la ventanilla.
    const prometen = LOS_PAREADOS.filter((clave) =>
      /vuelva a intentarlo|reintente|insista|en unos minutos/i.test(TEXTOS_DEL_PORTAL[clave].remedio),
    );

    expect(
      prometen,
      'Un peldano que no cambia por insistir no puede decirle a nadie que insista',
    ).toEqual([]);
  });

  it('y el de `orden-no-admitido` no le pide al ciudadano que corrija nada', () => {
    // Hasta #96 compartia texto con `no-valido`, que dice «Revise lo que escribió». Aqui no hay
    // nada escrito por el ciudadano: el orden lo pidio la pantalla. Mandarle a revisar algo suyo
    // seria mandarle a dar vueltas por un defecto que no es suyo.
    const textos = TEXTOS_DEL_PORTAL['orden-no-admitido'];

    expect(`${textos.titulo} ${textos.detalle} ${textos.remedio}`).not.toMatch(
      /revise lo que|corrija|corríjalo/i,
    );
  });
});

describe('la clasificacion sigue siendo la de la libreria', () => {
  it.each(DISTINGUIDAS)('«%s» conserva `pideIdentidad` y `esAveria`', (clave) => {
    // Los textos son de aqui; **que hacer** con ellos, no: si la pantalla ofrece volver a entrar y
    // si esto es una averia lo decide el codigo del contrato, igual en los cinco sistemas.
    //
    // Sobre `DISTINGUIDAS` y no sobre `CLAVES`: mientras kamayuk-lib#96 no este mezclado, la
    // libreria manda el 409 a `averia`, y exigir aqui `nuestro.clave === 'conflicto'` seria exigir
    // que la libreria enlazada haga algo que todavia no hace.
    const suyo = peldanoDe(UN_FALLO_POR_CLAVE[clave]);
    const nuestro = peldanoDelPortal(UN_FALLO_POR_CLAVE[clave], traducir);

    expect(nuestro.clave).toBe(clave);
    expect(nuestro.pideIdentidad).toBe(suyo.pideIdentidad);
    expect(nuestro.esAveria).toBe(suyo.esAveria);
  });

  it('solo el 401 pide volver a identificarse, y solo lo que no contesta es averia', () => {
    // Escrito, y no derivado: es la decision que la pantalla lee para poner el boton «Entrar» y
    // para elegir el tono. Si la libreria cambiara de opinion, esto lo dice.
    expect(DISTINGUIDAS.filter((c) => peldanoDelPortal(UN_FALLO_POR_CLAVE[c], traducir).pideIdentidad)).toEqual([
      'sin-identidad',
    ]);
    expect(DISTINGUIDAS.filter((c) => peldanoDelPortal(UN_FALLO_POR_CLAVE[c], traducir).esAveria)).toEqual([
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

describe('NI los tres miembros que `ErrorDeLaApi` conserva desde kamayuk-lib#96', () => {
  /** El identificador de un 500, lo que viaja en `detalles` y la cifra normativa que falta. */
  const INCIDENCIA = '2f0f7f2e-9a1c-4f1e-9a55-1c3f5c2f0a11';
  const DETALLES = 'Campo pedido: fechaDeVencimiento';
  const LLAVE = 'ARBITRIO:LIMPIEZA';

  /** Un 500 que trae los tres, tal como los publica `ManejadorDeErrores.java`. */
  const CON_LOS_TRES = falloConCuerpo(500, {
    status: 500,
    mensaje: 'No se pudo completar la operacion.',
    incidencia: INCIDENCIA,
    detalles: [DETALLES],
    parametroQueFalta: { ejercicio: 2026, llave: LLAVE },
  });

  it('el peldano dice EXACTAMENTE lo de la tabla, traducido, y nada mas', () => {
    // La guarda fuerte, y por igualdad y no por ausencia: cualquier cosa del backend que alguien
    // pegue al texto —el `mensaje`, la incidencia «para que soporte la tenga», el campo del
    // orden— rompe la igualdad, se busque o no se busque su contenido.
    const peldano = peldanoDelPortal(CON_LOS_TRES, traducir);
    const textos = TEXTOS_DEL_PORTAL[peldano.clave];

    expect([peldano.titulo, peldano.detalle, peldano.remedio]).toEqual([
      traducir(textos.titulo),
      traducir(textos.detalle),
      traducir(textos.remedio),
    ]);
  });

  it('y ninguno de los tres asoma por ningun lado', () => {
    // La misma decision dicha nombrando a los culpables, para que el rojo diga CUAL se escapo.
    // Ver el porque de cada uno en la cabecera de `escalera.ts`: no hay soporte al que dar la
    // incidencia, el ciudadano no pidio ningun orden, y la hoja de Publicacion no es de este portal.
    const peldano = peldanoDelPortal(CON_LOS_TRES, traducir);
    const enPantalla = `${peldano.titulo} ${peldano.detalle} ${peldano.remedio}`;
    const escapados = [INCIDENCIA, DETALLES, LLAVE, '2026', 'No se pudo completar la operacion.'].filter(
      (dicho) => enPantalla.includes(dicho),
    );

    expect(escapados, 'El portal ensena algo que escribio el backend').toEqual([]);
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
