// @vitest-environment node
//
// Solo el esquema, la frontera y un archivo del disco: ni jsdom, ni React, ni red.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatearFecha, formatearImporte } from '@kamayuk/formato';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import {
  ESQUEMA_DE_LA_MUNICIPALIDAD,
  ESQUEMA_DE_LA_OBLIGACION,
  ESQUEMA_DE_LA_SITUACION,
  ESQUEMA_DEL_IMPORTE,
  ESQUEMA_DEL_PREDIO,
  ESQUEMA_DEL_RESUMEN,
  ESQUEMA_DEL_TIPO_DE_DOCUMENTO,
  leerLaSituacion,
  type ImporteConFecha,
  type MunicipalidadDelContrato,
  type ObligacionDelContrato,
  type PredioDelContrato,
  type ResumenDeSaldosDelContrato,
  type SituacionDelContrato,
  type TipoDeDocumentoDelContrato,
} from './contrato.ts';
import { RespuestaQueNoEntiendo } from './respuestaQueNoEntiendo.ts';

/**
 * **La frontera: lo que llega de `GET /portal/situacion` se valida antes de tocar nada** (issue 34).
 *
 * Tres cosas se miden aqui, y las tres son del issue:
 *
 *   · **la captura medida pasa tal cual** —leida del disco, no copiada: una copia podria cuadrar
 *     con el esquema y la captura no—;
 *   · **una respuesta rota da un error CON NOMBRE**, `RespuestaQueNoEntiendo`, y cada rotura del
 *     issue dice DONDE esta: el rojo de cada caso compara la ruta exacta del fallo, asi que dos
 *     roturas no pueden esconderse detras del mismo mensaje;
 *   · **la asimetria**: un campo de mas no rompe nada (el backend puede crecer sin romper al
 *     portal) y uno de menos o de otro tipo, si.
 *
 * Y un cuarto que no se ejecuta sino que se compila: los tipos se DERIVAN del esquema. Las
 * aserciones `expectTypeOf` de abajo las comprueba `yarn typecheck`, que incluye las pruebas.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** La respuesta REAL de la plataforma local, como texto: ni un `as` entre el disco y el esquema. */
const CAPTURA: unknown = JSON.parse(
  readFileSync(join(AQUI, '../../diseno/medidas/situacion-2026-09-16.json'), 'utf8'),
);

const con = (importe: string, actualizadoA = '2026-09-16') => ({ importe, actualizadoA });

/**
 * Una respuesta valida CON obligaciones, construida a mano con la forma del contrato.
 *
 * La captura medida no trae ninguna municipalidad (es la rama «no se pudo consultar»), asi que sin
 * esta la mitad del esquema —obligaciones, predios, el resumen— no la ejercitaria nadie.
 */
function valida() {
  return {
    tipoDocumento: 'DNI',
    numeroDocumento: '03593174',
    aLaFecha: '2026-09-16',
    municipalidadesRecorridas: 1,
    totalConsolidado: con('1842.60'),
    notaDelTotal: null,
    sinRegistros: false,
    municipalidades: [
      {
        ubigeo: '200104',
        nombre: 'Municipalidad Distrital de Catacaos',
        codigoContribuyente: '00000025673',
        nombreContribuyente: 'Suc. Rufina Medina Medina',
        activo: true,
        resumenDeSaldos: {
          insoluto: con('1500.00'),
          reajuste: con('42.60'),
          interes: con('200.00'),
          gasto: con('100.00'),
          total: con('1842.60'),
          estadoDeLaConsulta: '1 obligacion con saldo al 16/09/2026',
        },
        obligaciones: [
          {
            tributo: 'PREDIAL',
            ejercicio: 2024,
            predioId: 41,
            vehiculoId: null,
            insoluto: con('1500.00'),
            reajuste: con('42.60', '2026-09-15'),
            interes: con('200.00'),
            gasto: con('100.00'),
            total: con('1842.60'),
          },
        ],
        predios: [
          {
            codigoReferenciaCatastral: '200104-001-0041',
            tipo: 'Casa habitación',
            direccion: 'Calle Santa Rosa 116',
            porcentajeTitularidad: '100.00',
          },
        ],
      },
    ],
  };
}

type Respuesta = ReturnType<typeof valida>;

/** Una respuesta valida retocada por `romper`. Se clona entera: ningun caso ensucia al siguiente. */
function rota(romper: (respuesta: Record<string, unknown> & Respuesta) => void): unknown {
  const respuesta = structuredClone(valida()) as Record<string, unknown> & Respuesta;
  romper(respuesta);
  return respuesta;
}

/** Lo que lanza `leerLaSituacion`, o un fallo de la prueba si no lanza. */
function loQueLanza(respuesta: unknown): unknown {
  try {
    leerLaSituacion(respuesta);
  } catch (error) {
    return error;
  }
  throw new Error('leerLaSituacion dio por buena una respuesta que no lo es');
}

/** Las rutas de los fallos que encontro el esquema, escritas como se leen: `a.0.b`. */
function rutasDelFallo(respuesta: unknown): string[] {
  const error = loQueLanza(respuesta);
  expect(error).toBeInstanceOf(RespuestaQueNoEntiendo);
  return (error as RespuestaQueNoEntiendo).fallos.map((fallo) => fallo.path.join('.'));
}

const OBLIGACION = 'municipalidades.0.obligaciones.0';

describe('AC1 — la captura medida valida sin tocarla', () => {
  it('`situacion-2026-09-16.json` pasa la frontera y sale igual que entro', () => {
    expect(leerLaSituacion(CAPTURA)).toEqual(CAPTURA);
  });
});

describe('una respuesta valida con obligaciones', () => {
  it('pasa entera: obligaciones, predios y resumen', () => {
    expect(leerLaSituacion(valida())).toEqual(valida());
  });

  it('y los cuatro anulables del contrato admiten `null`', () => {
    const conNulos = rota((r) => {
      r.totalConsolidado = null as never;
      r.notaDelTotal = 'Falto una municipalidad.' as never;
      r.municipalidades[0]!.obligaciones[0]!.predioId = null as never;
      r.municipalidades[0]!.obligaciones[0]!.vehiculoId = 7 as never;
    });

    expect(() => leerLaSituacion(conNulos)).not.toThrow();
  });
});

describe('AC2 — las cinco roturas del issue, cada una con su rojo', () => {
  it('falta `aLaFecha`', () => {
    expect(rutasDelFallo(rota((r) => delete (r as Partial<Respuesta>).aLaFecha))).toEqual(['aLaFecha']);
  });

  it('`importe` llega como numero en vez de texto', () => {
    const respuesta = rota((r) => {
      (r.municipalidades[0]!.obligaciones[0]!.insoluto as { importe: unknown }).importe = 1500;
    });

    expect(rutasDelFallo(respuesta)).toEqual([`${OBLIGACION}.insoluto.importe`]);
  });

  it('`municipalidades` no es una lista', () => {
    expect(rutasDelFallo(rota((r) => (r.municipalidades = {} as never)))).toEqual(['municipalidades']);
  });

  it('`ejercicio` llega como texto', () => {
    const respuesta = rota((r) => {
      (r.municipalidades[0]!.obligaciones[0] as { ejercicio: unknown }).ejercicio = '2024';
    });

    expect(rutasDelFallo(respuesta)).toEqual([`${OBLIGACION}.ejercicio`]);
  });

  it('`totalConsolidado` trae `importe` sin `actualizadoA`', () => {
    const respuesta = rota((r) => (r.totalConsolidado = { importe: '1842.60' } as never));

    expect(rutasDelFallo(respuesta)).toEqual(['totalConsolidado.actualizadoA']);
  });

  it('y el error lo dice por su nombre, con la peticion y las rutas, para quien depure', () => {
    const error = loQueLanza(rota((r) => (r.municipalidades = {} as never)));

    expect(error).toBeInstanceOf(RespuestaQueNoEntiendo);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('RespuestaQueNoEntiendo');
    expect((error as Error).message).toContain('GET /portal/situacion');
    expect((error as Error).message).toContain('municipalidades');
  });
});

describe('y lo que tampoco es la forma del contrato', () => {
  it.each<[string, unknown]>([
    ['nada', null],
    ['el `index.html` que contesta el proxy cuando la ruta esta mal escrita', '<!doctype html><html>'],
    ['una lista', []],
  ])('%s', (_caso, respuesta) => {
    expect(loQueLanza(respuesta)).toBeInstanceOf(RespuestaQueNoEntiendo);
  });

  it('un entero que no es entero: `ejercicio` 2024.5 y `municipalidadesRecorridas` 1.5', () => {
    const respuesta = rota((r) => {
      r.municipalidadesRecorridas = 1.5;
      r.municipalidades[0]!.obligaciones[0]!.ejercicio = 2024.5;
    });

    expect(rutasDelFallo(respuesta)).toEqual(['municipalidadesRecorridas', `${OBLIGACION}.ejercicio`]);
  });

  it('un septimo tipo de documento', () => {
    expect(rutasDelFallo(rota((r) => (r.tipoDocumento = 'LIBRETA')))).toEqual(['tipoDocumento']);
  });

  it('un `null` donde el contrato no declara anulable', () => {
    const respuesta = rota((r) => {
      (r.municipalidades[0]!.obligaciones[0] as { tributo: unknown }).tributo = null;
      (r.municipalidades[0] as { activo: unknown }).activo = null;
    });

    expect(rutasDelFallo(respuesta).sort()).toEqual(['municipalidades.0.activo', `${OBLIGACION}.tributo`].sort());
  });
});

describe('la forma del importe y de la fecha: la que `@kamayuk/formato` sabe dibujar', () => {
  /**
   * El esquema no se inventa la forma: acepta exactamente lo que `formatearImporte` y
   * `formatearFecha` aceptan, porque cualquier otra cosa revienta despues, al dibujarla, con un
   * `Error` suelto en mitad de la pantalla —justo lo que este issue viene a quitar—. Se mide
   * contra la libreria y no contra una lista escrita: si la libreria cambia de forma, esto lo dice.
   */
  const IMPORTES = ['1842.60', '1842.6', '0', '-10.00', '0.05', '1,842.60', '1842.605', 'S/ 10.00', '', '.50', '1e3'];
  const FECHAS = ['2026-09-16', '2026-9-16', '16/09/2026', '2026-09-16T00:00:00Z', ''];

  const dibujable = (formatear: (valor: string) => string, valor: string) => {
    try {
      formatear(valor);
      return true;
    } catch {
      return false;
    }
  };

  it.each(IMPORTES)('importe «%s»: el esquema lo admite si y solo si la libreria lo dibuja', (importe) => {
    expect(ESQUEMA_DEL_IMPORTE.safeParse(con(importe)).success).toBe(dibujable(formatearImporte, importe));
  });

  it.each(FECHAS)('fecha «%s»: el esquema la admite si y solo si la libreria la dibuja', (fecha) => {
    expect(ESQUEMA_DEL_IMPORTE.safeParse(con('1.00', fecha)).success).toBe(dibujable(formatearFecha, fecha));
  });

  it('y la lista de arriba ejercita las dos salidas, no solo una', () => {
    const admitidos = IMPORTES.filter((importe) => dibujable(formatearImporte, importe));
    expect(admitidos.length).toBeGreaterThan(0);
    expect(admitidos.length).toBeLessThan(IMPORTES.length);
  });
});

describe('AC3 — la asimetria: un campo DE MAS no rompe nada', () => {
  it('en la raiz, en una municipalidad, en una obligacion y en un importe', () => {
    const creciente = rota((r) => {
      (r as Record<string, unknown>).moneda = 'PEN';
      (r.municipalidades[0] as Record<string, unknown>).telefono = '073-123456';
      (r.municipalidades[0]!.obligaciones[0] as Record<string, unknown>).cuotas = [];
      (r.municipalidades[0]!.obligaciones[0]!.total as Record<string, unknown>).origen = 'LIBRO';
    });

    // Pasa, y lo de mas se DESCARTA: lo que nadie valido no sigue adelante, asi que ninguna
    // pantalla puede empezar a depender de un campo que la frontera no conoce.
    expect(leerLaSituacion(creciente)).toEqual(valida());
  });
});

/**
 * AC5 — **los tipos se derivan del esquema.** Esto no se ejecuta: lo comprueba `tsc`.
 *
 * Si alguien vuelve a escribir un tipo a mano y se desvia —`ejercicio: string`, un anulable que
 * deja de serlo, un `readonly` que se pierde—, `yarn typecheck` sale en rojo aqui. La segunda tanda
 * fija la forma campo a campo, para que tampoco se pueda aflojar el ESQUEMA (un `importe` que
 * admitiera numeros) sin que el tipo lo diga.
 */
describe('AC5 — los tipos son los del esquema', () => {
  it('cada tipo exportado es exactamente `z.infer` de su esquema', () => {
    expectTypeOf<SituacionDelContrato>().toEqualTypeOf<z.infer<typeof ESQUEMA_DE_LA_SITUACION>>();
    expectTypeOf<MunicipalidadDelContrato>().toEqualTypeOf<z.infer<typeof ESQUEMA_DE_LA_MUNICIPALIDAD>>();
    expectTypeOf<ObligacionDelContrato>().toEqualTypeOf<z.infer<typeof ESQUEMA_DE_LA_OBLIGACION>>();
    expectTypeOf<PredioDelContrato>().toEqualTypeOf<z.infer<typeof ESQUEMA_DEL_PREDIO>>();
    expectTypeOf<ResumenDeSaldosDelContrato>().toEqualTypeOf<z.infer<typeof ESQUEMA_DEL_RESUMEN>>();
    expectTypeOf<ImporteConFecha>().toEqualTypeOf<z.infer<typeof ESQUEMA_DEL_IMPORTE>>();
    expectTypeOf<TipoDeDocumentoDelContrato>().toEqualTypeOf<z.infer<typeof ESQUEMA_DEL_TIPO_DE_DOCUMENTO>>();
  });

  it('y la forma, campo a campo, es la del contrato', () => {
    expectTypeOf<ImporteConFecha>().toEqualTypeOf<{ readonly importe: string; readonly actualizadoA: string }>();
    expectTypeOf<TipoDeDocumentoDelContrato>().toEqualTypeOf<'DNI' | 'RUC' | 'CE' | 'PASAPORTE' | 'PARTIDA' | 'OTRO'>();
    expectTypeOf<ObligacionDelContrato['ejercicio']>().toEqualTypeOf<number>();
    expectTypeOf<ObligacionDelContrato['predioId']>().toEqualTypeOf<number | null>();
    expectTypeOf<ObligacionDelContrato['vehiculoId']>().toEqualTypeOf<number | null>();
    expectTypeOf<SituacionDelContrato['municipalidadesRecorridas']>().toEqualTypeOf<number>();
    expectTypeOf<SituacionDelContrato['totalConsolidado']>().toEqualTypeOf<ImporteConFecha | null>();
    expectTypeOf<SituacionDelContrato['notaDelTotal']>().toEqualTypeOf<string | null>();
    expectTypeOf<SituacionDelContrato['sinRegistros']>().toEqualTypeOf<boolean>();
    expectTypeOf<SituacionDelContrato['municipalidades']>().toEqualTypeOf<readonly MunicipalidadDelContrato[]>();
    expectTypeOf<MunicipalidadDelContrato['obligaciones']>().toEqualTypeOf<readonly ObligacionDelContrato[]>();
    expectTypeOf<MunicipalidadDelContrato['predios']>().toEqualTypeOf<readonly PredioDelContrato[]>();
    expectTypeOf<MunicipalidadDelContrato['activo']>().toEqualTypeOf<boolean>();
    expectTypeOf<ResumenDeSaldosDelContrato['gasto']>().toEqualTypeOf<ImporteConFecha>();
  });

  it('y lo que sale de la frontera es ese tipo', () => {
    expectTypeOf(leerLaSituacion).parameter(0).toEqualTypeOf<unknown>();
    expectTypeOf(leerLaSituacion).returns.toEqualTypeOf<SituacionDelContrato>();
  });
});
