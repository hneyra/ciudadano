// @vitest-environment node
//
// Solo funciones puras y un archivo del disco: ni jsdom, ni React, ni red.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Fecha, Importe } from '@kamayuk/formato';
import { sumarImportes } from '@kamayuk/formato';
import { describe, expect, it } from 'vitest';

import type {
  ImporteConFecha,
  MunicipalidadDelContrato,
  ObligacionDelContrato,
  SituacionDelContrato,
} from './contrato.ts';
import { cuentaDe, totalDe } from './cuentas.ts';
import { deLaSituacion, fechaDelImporte } from './deLaSituacion.ts';

/**
 * **El adaptador de `GET /portal/situacion`** (issue 26).
 *
 * Dos clases de entrada, y la diferencia se dice en voz alta:
 *
 *  1. **la respuesta MEDIDA**, `diseno/medidas/situacion-2026-09-16.json`, leida del disco tal cual
 *     llego de la plataforma local. Es la unica que demuestra algo sobre lo que el servidor
 *     contesta hoy;
 *  2. **respuestas CONSTRUIDAS A MANO** (todas las de `describe`s marcados «a mano»), derivadas del
 *     contrato y de las clases Java que lo sirven. No son mediciones y no pretenden serlo: son la
 *     forma que el contrato promete para las ramas que la plataforma local todavia no produce —hay
 *     un 401 de `catastro` en medio, que es de otro repositorio—. El dia que esas ramas se puedan
 *     medir, se vendorizan al lado de la primera y estas se van.
 */

/** La fecha de corte de todo lo construido a mano: la misma que la de la respuesta medida. */
const AL_DIA: Fecha = '2026-09-16';

/** Un importe del contrato: texto decimal y el dia al que esta actualizado. Nunca uno sin el otro. */
function con(texto: Importe, fecha: Fecha = AL_DIA): ImporteConFecha {
  return { importe: texto, actualizadoA: fecha };
}

/** Una obligacion construida a mano, con los cinco importes que el contrato declara. */
function obligacion(campos: Partial<ObligacionDelContrato> & Pick<ObligacionDelContrato, 'tributo' | 'ejercicio'>): ObligacionDelContrato {
  return {
    predioId: null,
    vehiculoId: null,
    insoluto: con('0.00'),
    reajuste: con('0.00'),
    interes: con('0.00'),
    gasto: con('0.00'),
    total: con('0.00'),
    ...campos,
  };
}

/** Una municipalidad construida a mano. Sus saldos son los que se le pasen: aqui nadie suma por su cuenta. */
function municipalidad(campos: Partial<MunicipalidadDelContrato> = {}): MunicipalidadDelContrato {
  return {
    ubigeo: '200104',
    nombre: 'Municipalidad Distrital de Catacaos',
    codigoContribuyente: '00017341',
    nombreContribuyente: 'RUIZ SANDOVAL, FLOR MARIA',
    activo: true,
    resumenDeSaldos: {
      insoluto: con('0.00'),
      reajuste: con('0.00'),
      interes: con('0.00'),
      gasto: con('0.00'),
      total: con('0.00'),
      estadoDeLaConsulta: `Sin deuda pendiente al ${AL_DIA}`,
    },
    obligaciones: [],
    predios: [],
    ...campos,
  };
}

/** Una respuesta construida a mano. */
function respuesta(campos: Partial<SituacionDelContrato> = {}): SituacionDelContrato {
  return {
    tipoDocumento: 'DNI',
    numeroDocumento: '00000014',
    aLaFecha: AL_DIA,
    municipalidadesRecorridas: 1,
    totalConsolidado: con('0.00'),
    notaDelTotal: null,
    sinRegistros: false,
    municipalidades: [],
    ...campos,
  };
}

/** El predio unico de la municipalidad de las pruebas de abajo. */
const CASA = {
  codigoReferenciaCatastral: '200104-01-0231-0007',
  tipo: 'Casa habitación',
  direccion: 'Calle Santa Rosa 116',
  porcentajeTitularidad: '100.00',
};

const OTRO_PREDIO = {
  codigoReferenciaCatastral: '200104-01-0231-0008',
  tipo: 'Terreno sin construir',
  direccion: 'Calle Junín 402',
  porcentajeTitularidad: '50.00',
};

/**
 * Las tres obligaciones: predial, arbitrio y vehicular, con las cifras que el servidor sumaria.
 *
 * Los cinco importes de cada una cuadran entre si —insoluto + reajuste + interes + gasto = total—
 * porque asi los compone el servidor (`ObligacionPublica#total`), y eso es lo que deja comparar
 * `totalDe` con `totalDelServidor` sin haberlo escrito dos veces.
 */
const PREDIAL = obligacion({
  tributo: 'PREDIAL',
  ejercicio: 2026,
  predioId: 41,
  insoluto: con('1842.60'),
  reajuste: con('12.40'),
  interes: con('212.44'),
  gasto: con('12.00'),
  total: con('2079.44'),
});

const ARBITRIO = obligacion({
  tributo: 'ARBITRIO',
  ejercicio: 2026,
  predioId: 41,
  insoluto: con('291.60'),
  interes: con('18.44'),
  total: con('310.04'),
});

const VEHICULAR = obligacion({
  tributo: 'VEHICULAR',
  ejercicio: 2024,
  vehiculoId: 7,
  insoluto: con('614.00'),
  reajuste: con('31.20'),
  interes: con('182.44'),
  gasto: con('96.00'),
  total: con('923.64'),
});

/** Los saldos de esa municipalidad, sumados como los sumaria el servidor. */
const SALDOS = {
  insoluto: con('2748.20'),
  reajuste: con('43.60'),
  interes: con('413.32'),
  gasto: con('108.00'),
  total: con('3313.12'),
  estadoDeLaConsulta: `3 obligaciones con saldo al ${AL_DIA}`,
};

/** La municipalidad con las tres obligaciones y un solo predio. */
const CON_LAS_TRES = municipalidad({
  resumenDeSaldos: SALDOS,
  obligaciones: [PREDIAL, ARBITRIO, VEHICULAR],
  predios: [CASA],
});

describe('la respuesta MEDIDA (diseno/medidas/situacion-2026-09-16.json)', () => {
  const RUTA = join(dirname(fileURLToPath(import.meta.url)), '../../diseno/medidas/situacion-2026-09-16.json');
  const crudo: unknown = JSON.parse(readFileSync(RUTA, 'utf8'));
  const medida = crudo as SituacionDelContrato;

  it('EL CENTINELA: la captura vendorizada sigue siendo la que se midio', () => {
    // Sin esto, todo lo de abajo seguiria en verde sobre un archivo retocado — que es como una
    // medicion deja de serlo sin que nada lo diga.
    expect(crudo).toStrictEqual({
      tipoDocumento: 'DNI',
      numeroDocumento: '00000014',
      aLaFecha: '2026-09-16',
      municipalidadesRecorridas: 1,
      totalConsolidado: null,
      notaDelTotal:
        'No se pudo consultar Municipalidad Provincial de Sullana, asi que no se puede dar un total de todo.',
      sinRegistros: true,
      municipalidades: [],
    });
  });

  it('se clasifica como «no-se-pudo-consultar», aunque venga `sinRegistros: true`', () => {
    // El orden de las preguntas: falto una municipalidad, asi que no se puede afirmar que la
    // persona no figure en ninguna.
    expect(deLaSituacion(medida).estado).toBe('no-se-pudo-consultar');
  });

  it('lo que se ensena es la nota del servidor, palabra por palabra', () => {
    expect(deLaSituacion(medida).notaDelTotal).toBe(
      'No se pudo consultar Municipalidad Provincial de Sullana, asi que no se puede dar un total de todo.',
    );
  });

  it('no trae deudas, ni municipalidades, ni un total inventado', () => {
    const situacion = deLaSituacion(medida);

    expect(situacion.deudas).toEqual([]);
    expect(situacion.municipalidades).toEqual([]);
    // `null`, y NO '0.00': un total al que le falta una municipalidad es plausible y equivocado.
    expect(situacion.totalConsolidado).toBeNull();
  });

  it('y lo que si dice el servidor de la persona se conserva', () => {
    const situacion = deLaSituacion(medida);

    expect(situacion.tipoDeDocumento).toBe('DNI');
    expect(situacion.numeroDeDocumento).toBe('00000014');
    expect(situacion.aLaFecha).toBe('2026-09-16');
    expect(situacion.municipalidadesRecorridas).toBe(1);
  });
});

describe('a mano: una municipalidad con tres obligaciones (predial, arbitrio, vehicular)', () => {
  const situacion = deLaSituacion(respuesta({ totalConsolidado: SALDOS.total, municipalidades: [CON_LAS_TRES] }));
  const [predial, arbitrio, vehicular] = situacion.deudas;

  it('hay una deuda por obligacion, y la situacion es «con-deuda»', () => {
    expect(situacion.estado).toBe('con-deuda');
    expect(situacion.deudas).toHaveLength(3);
  });

  it('el concepto es el tributo en castellano con su ejercicio', () => {
    expect(situacion.deudas.map((deuda) => deuda.concepto)).toEqual([
      'Impuesto predial 2026',
      'Arbitrios municipales 2026',
      'Impuesto vehicular 2024',
    ]);
  });

  it('un tributo que el portal no sabe nombrar va en crudo, no traducido a ojo', () => {
    const rara = municipalidad({ obligaciones: [obligacion({ tributo: 'MULTA_TRANSITO', ejercicio: 2025 })] });
    const conRara = deLaSituacion(respuesta({ municipalidades: [rara] }));

    expect(conRara.deudas[0]?.concepto).toBe('MULTA_TRANSITO 2025');
  });

  it('la unidad es el predio cuando la municipalidad publica uno solo', () => {
    expect(predial?.unidad).toBe('Casa habitación · Calle Santa Rosa 116');
    expect(arbitrio?.unidad).toBe('Casa habitación · Calle Santa Rosa 116');
  });

  it('con dos predios no se adivina cual es: «Sin detalle del predio»', () => {
    const conDos = municipalidad({ obligaciones: [PREDIAL], predios: [CASA, OTRO_PREDIO] });

    expect(deLaSituacion(respuesta({ municipalidades: [conDos] })).deudas[0]?.unidad).toBe('Sin detalle del predio');
  });

  it('de un vehiculo no hay ni lista que mirar: «Sin detalle del vehículo»', () => {
    expect(vehicular?.unidad).toBe('Sin detalle del vehículo');
  });

  it('y una obligacion que no cuelga de ninguna unidad lo dice', () => {
    const suelta = municipalidad({ obligaciones: [obligacion({ tributo: 'PREDIAL', ejercicio: 2023 })] });

    expect(deLaSituacion(respuesta({ municipalidades: [suelta] })).deudas[0]?.unidad).toBe('Sin unidad asociada');
  });

  it('cada deuda tiene un id propio y estable, derivado de lo que la identifica', () => {
    expect(situacion.deudas.map((deuda) => deuda.id)).toEqual([
      '200104-predial-2026-predio-41',
      '200104-arbitrio-2026-predio-41',
      '200104-vehicular-2024-vehiculo-7',
    ]);
    // Y leer dos veces lo mismo da los mismos ids: sin eso, una marca no sobrevive a releer.
    expect(deLaSituacion(respuesta({ municipalidades: [CON_LAS_TRES] })).deudas.map((d) => d.id)).toEqual(
      situacion.deudas.map((deuda) => deuda.id),
    );
  });
});

describe('a mano: los importes son texto, con su fecha', () => {
  const situacion = deLaSituacion(respuesta({ totalConsolidado: SALDOS.total, municipalidades: [CON_LAS_TRES] }));
  const predial = situacion.deudas[0];

  it('cada componente del saldo llega tal cual, con sus dos decimales', () => {
    // Un `Number` por el camino dejaria '1842.6' y '12.4': el centimo en cero se pierde.
    expect(predial?.insoluto).toBe('1842.60');
    expect(predial?.reajuste).toBe('12.40');
    expect(predial?.interes).toBe('212.44');
    expect(predial?.gastos).toBe('12.00');
    expect(predial?.totalDelServidor).toBe('2079.44');
  });

  it('y cada uno conserva su `actualizadoA`, que es la fecha que llevara su `<Importe>`', () => {
    expect(predial?.actualizadoA).toStrictEqual({
      insoluto: AL_DIA,
      reajuste: AL_DIA,
      interes: AL_DIA,
      gastos: AL_DIA,
    });
    expect(predial === undefined ? '' : fechaDelImporte(predial, 'interes')).toBe(AL_DIA);
  });

  it('las fechas NO se aplanan a una sola: si el servidor manda dos, llegan dos', () => {
    const vieja = municipalidad({
      obligaciones: [obligacion({ tributo: 'PREDIAL', ejercicio: 2024, interes: con('10.00', '2026-09-01') })],
    });
    const suya = deLaSituacion(respuesta({ municipalidades: [vieja] })).deudas[0];

    expect(suya?.actualizadoA.interes).toBe('2026-09-01');
    expect(suya?.actualizadoA.insoluto).toBe(AL_DIA);
  });

  it('el total de cada concepto lo da `cuentas.ts`, y cuadra con el que sumo el servidor', () => {
    // Si el reajuste se cayera por el camino —o se sumara con `+`—, estas tres saldrian rojas.
    for (const deuda of situacion.deudas) {
      expect(totalDe(deuda), `${deuda.concepto}: el total del portal no cuadra con el del servidor`).toBe(
        deuda.totalDelServidor,
      );
    }
  });

  it('el total de la seleccion tambien sale de `cuentas.ts`, sumando con `sumarImportes`', () => {
    const cuenta = cuentaDe(situacion.deudas);

    expect(cuenta).toStrictEqual({
      insoluto: '2748.20',
      reajuste: '43.60',
      interes: '413.32',
      gastos: '108.00',
      total: '3313.12',
      conAmnistia: '2899.80',
    });
    expect(cuenta.total).toBe(sumarImportes(situacion.deudas.map((deuda) => deuda.totalDelServidor)));
  });

  it('el `totalConsolidado` del servidor se ensena tal cual y NO se recalcula', () => {
    // Un total que NO es la suma de las partes: si el adaptador lo recompusiera, aqui saldria
    // '3313.12' y la prueba en rojo.
    const raro = deLaSituacion(
      respuesta({ totalConsolidado: con('9999.99', '2026-09-15'), municipalidades: [CON_LAS_TRES] }),
    );

    expect(raro.totalConsolidado).toStrictEqual({ importe: '9999.99', actualizadoA: '2026-09-15' });
  });

  it('y los cinco saldos de la municipalidad llegan con su fecha, sin recomponerse', () => {
    expect(situacion.municipalidades[0]?.saldos).toStrictEqual({
      insoluto: con('2748.20'),
      reajuste: con('43.60'),
      interes: con('413.32'),
      gastos: con('108.00'),
      total: con('3313.12'),
      estadoDeLaConsulta: `3 obligaciones con saldo al ${AL_DIA}`,
    });
  });
});

describe('a mano: lo que el contrato NO da llega ausente', () => {
  const situacion = deLaSituacion(respuesta({ totalConsolidado: SALDOS.total, municipalidades: [CON_LAS_TRES] }));

  it('`cuotas`, `vence`, `estado`, `tono` y `detalle` son `null` en las tres deudas', () => {
    // El portal real NO sabe el vencimiento: no hay cuota, ni fecha, ni «Vencida», ni desglose.
    for (const deuda of situacion.deudas) {
      expect({
        cuotas: deuda.cuotas,
        vence: deuda.vence,
        estado: deuda.estado,
        tono: deuda.tono,
        detalle: deuda.detalle,
      }).toStrictEqual({ cuotas: null, vence: null, estado: null, tono: null, detalle: null });
    }
  });

  it('y un concepto sin estado no se cuenta como vencido', () => {
    // `resumenDe` cuenta lo que NO esta «Por vencer»; con `null` no hay nada que contar.
    expect(situacion.deudas.filter((deuda) => deuda.estado !== null)).toEqual([]);
  });
});

describe('a mano: las cuatro situaciones', () => {
  it('«sin-registros» cuando la persona no figura en ninguna municipalidad', () => {
    const ninguna = respuesta({ sinRegistros: true, municipalidades: [] });

    expect(deLaSituacion(ninguna).estado).toBe('sin-registros');
  });

  it('«sin-deuda» cuando se leyo todo y no hay obligaciones', () => {
    const limpia = respuesta({ municipalidades: [municipalidad()] });

    expect(deLaSituacion(limpia).estado).toBe('sin-deuda');
    expect(deLaSituacion(limpia).deudas).toEqual([]);
  });

  it('«con-deuda» en cuanto hay una obligacion', () => {
    expect(deLaSituacion(respuesta({ municipalidades: [CON_LAS_TRES] })).estado).toBe('con-deuda');
  });

  it('«no-se-pudo-consultar» manda sobre las otras tres', () => {
    const fallida = respuesta({
      sinRegistros: true,
      totalConsolidado: null,
      notaDelTotal: 'No se pudo consultar Municipalidad Provincial de Sullana, asi que no se puede dar un total de todo.',
      municipalidades: [CON_LAS_TRES],
    });

    expect(deLaSituacion(fallida).estado).toBe('no-se-pudo-consultar');
    // Y lo que si se leyo se ensena igual: la deuda de la municipalidad que contesto no se esconde.
    expect(deLaSituacion(fallida).deudas).toHaveLength(3);
  });
});

describe('a mano: la baja no esconde la deuda', () => {
  it('con `activo: false` la deuda se ensena igual, y la baja se dice', () => {
    const deBaja = municipalidad({ activo: false, resumenDeSaldos: SALDOS, obligaciones: [PREDIAL], predios: [CASA] });
    const situacion = deLaSituacion(respuesta({ totalConsolidado: SALDOS.total, municipalidades: [deBaja] }));

    // Ocultarla seria decirle que no debe nada: la deuda sobrevive a la baja del padron.
    expect(situacion.estado).toBe('con-deuda');
    expect(situacion.deudas).toHaveLength(1);
    expect(situacion.municipalidades[0]?.activo).toBe(false);
  });
});

describe('a mano: dos municipalidades, una con deuda y otra sin ella', () => {
  const sinDeuda = municipalidad({
    ubigeo: '200101',
    nombre: 'Municipalidad Provincial de Piura',
    codigoContribuyente: '99001',
    nombreContribuyente: 'RUIZ SANDOVAL, FLOR MARIA',
  });
  const situacion = deLaSituacion(
    respuesta({
      municipalidadesRecorridas: 2,
      totalConsolidado: SALDOS.total,
      municipalidades: [CON_LAS_TRES, sinDeuda],
    }),
  );

  it('las deudas son las de las dos juntas, en el orden en que llegaron', () => {
    expect(situacion.estado).toBe('con-deuda');
    expect(situacion.deudas.map((deuda) => deuda.concepto)).toEqual([
      'Impuesto predial 2026',
      'Arbitrios municipales 2026',
      'Impuesto vehicular 2024',
    ]);
  });

  it('cada municipalidad conserva las suyas, su nombre y el codigo del recibo', () => {
    expect(situacion.municipalidades.map((m) => [m.ubigeo, m.nombre, m.codigoDelContribuyente, m.deudas.length])).toEqual(
      [
        ['200104', 'Municipalidad Distrital de Catacaos', '00017341', 3],
        ['200101', 'Municipalidad Provincial de Piura', '99001', 0],
      ],
    );
  });

  it('y los ids no chocan entre municipalidades', () => {
    const conLasMismas = municipalidad({ ubigeo: '200101', obligaciones: [PREDIAL], predios: [CASA] });
    const dos = deLaSituacion(respuesta({ municipalidades: [CON_LAS_TRES, conLasMismas] }));

    expect(new Set(dos.deudas.map((deuda) => deuda.id)).size).toBe(dos.deudas.length);
  });
});

describe('a mano: `estadoDeLaConsulta`, en sus tres formas, tal cual', () => {
  const FORMAS = [
    `Sin deuda pendiente al ${AL_DIA}`,
    `1 obligacion con saldo al ${AL_DIA}`,
    `4 obligaciones con saldo al ${AL_DIA}`,
  ];

  it.each(FORMAS)('«%s» llega sin tocar', (frase) => {
    const una = municipalidad({ resumenDeSaldos: { ...SALDOS, estadoDeLaConsulta: frase } });

    // La compone el servidor (RNF-083) y el portal la ensena: aqui no se recompone ni se traduce.
    expect(deLaSituacion(respuesta({ municipalidades: [una] })).municipalidades[0]?.saldos.estadoDeLaConsulta).toBe(
      frase,
    );
  });
});

describe('a mano: los predios, sin identificador y con su porcentaje como texto', () => {
  it('llegan con el codigo catastral, el tipo, la direccion y el porcentaje', () => {
    const conDos = municipalidad({ predios: [CASA, OTRO_PREDIO] });

    expect(deLaSituacion(respuesta({ municipalidades: [conDos] })).municipalidades[0]?.predios).toStrictEqual([
      {
        codigoCatastral: '200104-01-0231-0007',
        tipo: 'Casa habitación',
        direccion: 'Calle Santa Rosa 116',
        porcentajeDeTitularidad: '100.00',
      },
      {
        codigoCatastral: '200104-01-0231-0008',
        tipo: 'Terreno sin construir',
        direccion: 'Calle Junín 402',
        porcentajeDeTitularidad: '50.00',
      },
    ]);
  });
});

describe('el adaptador es puro', () => {
  it('no toca lo que le dan, y dos llamadas con lo mismo dan lo mismo', () => {
    const entrada = respuesta({ totalConsolidado: SALDOS.total, municipalidades: [CON_LAS_TRES] });
    const copia = structuredClone(entrada);

    expect(deLaSituacion(entrada)).toStrictEqual(deLaSituacion(entrada));
    expect(entrada).toStrictEqual(copia);
  });
});
