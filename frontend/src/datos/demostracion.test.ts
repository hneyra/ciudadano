import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { formatearFecha, formatearImporte } from '@kamayuk/formato';
import { describe, expect, it } from 'vitest';

import { RAIZ } from '../../verificaciones/artboards.ts';
import {
  COMPROBANTE,
  CONTRIBUYENTE,
  DEUDAS,
  ENTIDAD,
  FECHA_DE_CORTE,
  HISTORIAL,
  MEDIOS,
  ORDENANZA,
  UNIDADES,
  USUARIO,
} from './demostracion.ts';

/**
 * **Los datos de demostracion son la copia literal del artboard**, comprobada campo a campo.
 *
 * No hay tabla de expectativas escrita a mano: se leen las lineas 740-924 del artboard
 * VENDORIZADO (cuya huella vigila `los-artboards-estan.test.ts`), se evaluan —son literales de
 * objeto, sin una sola llamada— y cada campo se compara con el de `demostracion.ts`, pasado por la
 * UNICA transformacion que el issue 3 permite: importes a texto con dos decimales, fechas a ISO y
 * tuplas a objetos con nombre. Una tabla escrita a mano seria una segunda copia, y la prueba
 * compararia dos copias entre si.
 *
 * Tambien se exige lo contrario: que el artboard no traiga un campo que aqui no se porta. Sin eso,
 * un campo nuevo en el prototipo pasaria en verde sin llegar nunca a los datos.
 */

const ARTBOARD = readFileSync(join(RAIZ, 'diseno/Ciudadano.dc.html'), 'utf8');
const LINEAS = ARTBOARD.split('\n');

/** Las lineas del artboard donde viven los datos, contadas desde 1 como las cuenta un editor. */
const PRIMERA = 740;
const ULTIMA = 924;

/** El numero de linea (desde 1) de la primera que contiene ese texto a partir de `desde`. */
function lineaDe(texto: string, desde = 1): number {
  const indice = LINEAS.findIndex((linea, i) => i + 1 >= desde && linea.includes(texto));
  return indice + 1;
}

// ── Las formas del prototipo, tal cual ──────────────────────────────────────────────────────

interface DetalleDelArtboard {
  titulo: string;
  min: string;
  cols: [string, 0 | 1][];
  filas: string[][];
  insignia?: number;
  nota: string;
}

interface DeudaDelArtboard {
  id: string;
  concepto: string;
  unidad: string;
  cuotas: string;
  vence: string;
  insoluto: number;
  interes: number;
  gastos: number;
  estado: string;
  tono: string;
  detalle: DetalleDelArtboard;
}

interface MedioDelArtboard {
  id: string;
  label: string;
  nota: string;
  icon: string[];
  titulo: string;
  detalleNota: string;
  campos?: { k: string; l: string; ph: string; ancho: number; ayuda?: string }[];
  codigoEtiqueta?: string;
  codigo?: string;
  codigoNota?: string;
  pasos?: string[];
  bancos?: [string, string][];
  aviso: string;
  boton: string;
}

interface UnidadDelArtboard {
  titulo: string;
  detalle: string;
  baseEtiqueta: string;
  base: string;
  datos: string[];
  origen: string;
}

interface DatosDelArtboard {
  DEUDAS: DeudaDelArtboard[];
  MEDIOS: MedioDelArtboard[];
  HISTORIAL: [string, string, string, string, string][];
  UNIDADES: UnidadDelArtboard[];
}

/** Lo que se declara en el bloque y NO se porta a los datos, con su porque. */
const NO_SE_PORTAN: Readonly<Record<string, string>> = {
  ICO: 'los trazados de los iconos de «capacidades» del paso 1: son de la pantalla, no del dominio',
};

/**
 * Si el bloque se movio, se dice ANTES de evaluarlo. Evaluar 185 lineas que empiezan a mitad de
 * una sentencia revienta con un «SyntaxError: Unexpected token» que no dice que lo que cambio fue
 * la numeracion, y las citas de linea de `demostracion.ts` son lo que habria que corregir.
 */
if (LINEAS[PRIMERA - 1] !== 'const DEUDAS = [' || LINEAS[ULTIMA - 1] !== '};') {
  throw new Error(
    `Las lineas ${String(PRIMERA)}-${String(ULTIMA)} del artboard ya no son el bloque de datos: ` +
      `la ${String(PRIMERA)} dice «${LINEAS[PRIMERA - 1] ?? ''}» y la ${String(ULTIMA)}, «${LINEAS[ULTIMA - 1] ?? ''}». ` +
      `«const DEUDAS = [» esta ahora en la ${String(lineaDe('const DEUDAS = ['))}. ` +
      'Corrige las citas de linea de src/datos/demostracion.ts y de esta prueba.',
  );
}

const BLOQUE = LINEAS.slice(PRIMERA - 1, ULTIMA).join('\n');

const DECLARADAS = [...BLOQUE.matchAll(/^const (\w+) = /gm)].map((m) => m[1]);

/**
 * Evalua un literal del artboard en un contexto aparte y lo trae a ESTE.
 *
 * El viaje por JSON no es cosmetico: los objetos de otro contexto de `vm` tienen otro `Object` y
 * otro `Array`, y `toStrictEqual` los da por distintos diciendo «Compared values have no visual
 * difference». Los literales del artboard son solo texto, numeros y listas, asi que JSON no pierde
 * nada.
 */
function evaluar(codigo: string): unknown {
  return JSON.parse(JSON.stringify(runInNewContext(codigo, {})));
}

const DEL_ARTBOARD = evaluar(`${BLOQUE}\n;({ ${DECLARADAS.join(', ')} })`) as DatosDelArtboard;

// ── Las transformaciones que el issue 3 permite, y ninguna mas ──────────────────────────────

/** `293.72` → `'293.72'`; `0` → `'0.00'`. Revienta si el artboard trae mas de dos decimales. */
function importeDe(valor: number): string {
  const texto = valor.toFixed(2);
  if (Number(texto) !== valor) {
    throw new Error(`El artboard trae un importe con mas de dos decimales: ${String(valor)}`);
  }
  return texto;
}

/** `'12/08/2026'` → `'2026-08-12'`. */
function fechaIsoDe(texto: string): string {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (partes === null) throw new Error(`Fecha del artboard con otra forma: «${texto}»`);
  return `${partes[3]}-${partes[2]}-${partes[1]}`;
}

/** Los campos de `o`, con los `undefined` fuera: `toEqual` no distinguiria uno ausente de uno vacio. */
function sinHuecos(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

describe('el bloque de datos del artboard es el que se cita', () => {
  it(`las lineas ${String(PRIMERA)}-${String(ULTIMA)} empiezan en DEUDAS y acaban en el cierre de ICO`, () => {
    // Si el artboard se reordena, las citas de linea de `demostracion.ts` dejan de ser verdad.
    expect(LINEAS[PRIMERA - 1]).toBe('const DEUDAS = [');
    expect(LINEAS[ULTIMA - 1]).toBe('};');
    expect(LINEAS[ULTIMA]?.trim()).toBe('');
  });

  it('declara exactamente las cuatro listas que se portan, mas lo que se dice por que no', () => {
    expect(DECLARADAS).toEqual(['DEUDAS', 'MEDIOS', 'HISTORIAL', 'UNIDADES', ...Object.keys(NO_SE_PORTAN)]);
  });
});

describe('DEUDAS coincide campo a campo con el artboard', () => {
  const CAMPOS = [
    'id', 'concepto', 'unidad', 'cuotas', 'vence', 'insoluto', 'interes', 'gastos', 'estado', 'tono', 'detalle',
  ];
  const CAMPOS_DEL_DETALLE = ['titulo', 'min', 'cols', 'filas', 'insignia', 'nota'];

  it('son los mismos cuatro conceptos, en el mismo orden', () => {
    expect(DEUDAS.map((d) => d.id)).toEqual(DEL_ARTBOARD.DEUDAS.map((d) => d.id));
    expect(DEUDAS.map((d) => d.id)).toEqual(['pred26', 'arb26', 'pred24', 'veh24']);
  });

  it.each(DEL_ARTBOARD.DEUDAS.map((original, i) => ({ id: original.id, original, i })))(
    '$id',
    ({ original, i }) => {
      const linea = lineaDe(`id: '${original.id}'`, PRIMERA);
      const dondeEsta = `${original.id} (artboard, linea ${String(linea)})`;
      const portada = DEUDAS[i];
      if (portada === undefined) throw new Error(`Falta ${dondeEsta} en DEUDAS`);

      expect(Object.keys(original).filter((c) => !CAMPOS.includes(c)), `${dondeEsta}: campos sin portar`).toEqual([]);
      expect(
        Object.keys(original.detalle).filter((c) => !CAMPOS_DEL_DETALLE.includes(c)),
        `${dondeEsta}.detalle: campos sin portar`,
      ).toEqual([]);

      const esperada = {
        id: original.id,
        concepto: original.concepto,
        unidad: original.unidad,
        cuotas: original.cuotas,
        vence: original.vence,
        insoluto: importeDe(original.insoluto),
        interes: importeDe(original.interes),
        gastos: importeDe(original.gastos),
        estado: original.estado,
        tono: original.tono,
      };
      for (const [campo, valor] of Object.entries(esperada)) {
        expect(portada[campo as keyof typeof esperada], `${dondeEsta}.${campo}`).toBe(valor);
      }

      const detalle = original.detalle;
      expect(portada.detalle.titulo, `${dondeEsta}.detalle.titulo`).toBe(detalle.titulo);
      expect(portada.detalle.anchoMinimo, `${dondeEsta}.detalle.min`).toBe(detalle.min);
      expect(portada.detalle.columnas, `${dondeEsta}.detalle.cols`).toEqual(
        detalle.cols.map(([rotulo, cifra]) => ({ rotulo, cifra: cifra === 1 })),
      );
      expect(portada.detalle.filas, `${dondeEsta}.detalle.filas`).toEqual(detalle.filas);
      expect(portada.detalle.columnaDeInsignia, `${dondeEsta}.detalle.insignia`).toBe(detalle.insignia);
      expect(portada.detalle.nota, `${dondeEsta}.detalle.nota`).toBe(detalle.nota);
      // Y nada de mas: un campo inventado en la copia tampoco es literal.
      expect(Object.keys(portada).sort(), `${dondeEsta}: campos de mas`).toEqual([...CAMPOS].sort());
    },
  );
});

describe('MEDIOS coincide campo a campo con el artboard', () => {
  it.each(DEL_ARTBOARD.MEDIOS.map((original, i) => ({ id: original.id, original, i })))(
    '$id',
    ({ original, i }) => {
      const dondeEsta = `${original.id} (artboard, linea ${String(lineaDe(`id: '${original.id}'`, PRIMERA))})`;
      const { label, icon, campos, bancos, ...iguales } = original;

      const esperado = sinHuecos({
        ...iguales,
        rotulo: label,
        icono: icon,
        campos: campos?.map((c) =>
          sinHuecos({ clave: c.k, etiqueta: c.l, ejemplo: c.ph, ancho: c.ancho, ayuda: c.ayuda }),
        ),
        bancos: bancos?.map(([nombre, canales]) => ({ nombre, canales })),
      });

      expect(sinHuecos({ ...MEDIOS[i] }), dondeEsta).toStrictEqual(esperado);
    },
  );
});

describe('HISTORIAL coincide campo a campo con el artboard', () => {
  it.each(DEL_ARTBOARD.HISTORIAL.map((fila, i) => ({ comprobante: fila[3], fila, i })))(
    '$comprobante',
    ({ fila, i }) => {
      const [fecha, concepto, medio, comprobante, importe] = fila;
      expect(HISTORIAL[i], `${comprobante} (artboard, linea ${String(lineaDe(comprobante))})`).toStrictEqual({
        fecha: fechaIsoDe(fecha),
        concepto,
        medio,
        comprobante,
        // En el artboard ya es texto: pasa tal cual si tiene la forma de un importe servido.
        importe,
      });
    },
  );
});

describe('UNIDADES coincide campo a campo con el artboard', () => {
  it.each(DEL_ARTBOARD.UNIDADES.map((original, i) => ({ titulo: original.titulo, original, i })))(
    '$titulo',
    ({ original, i }) => {
      const portada = UNIDADES[i];
      if (portada === undefined) throw new Error(`Falta «${original.titulo}» en UNIDADES`);
      const { base, ...iguales } = original;

      // El artboard escribe la base formateada («S/ 132,196.75»); aqui es un importe, y
      // formateado tiene que volver a dar exactamente lo que el artboard pinta.
      expect(formatearImporte(portada.base), `${original.titulo}.base`).toBe(base);
      expect({ ...portada, base: undefined }, original.titulo).toEqual(iguales);
      expect(Object.keys(portada).sort()).toEqual(Object.keys(original).sort());
    },
  );
});

describe('los literales que la logica del artboard escribe fuera del bloque', () => {
  it('el contribuyente (lineas 1104-1107)', () => {
    const [, nombre, detalle] =
      /contribuyente: \{\s*nombre: '([^']*)',\s*detalle: '([^']*)'/.exec(ARTBOARD) ?? [];
    const c = CONTRIBUYENTE;

    expect(nombre).toBe(c.nombre);
    expect(detalle).toBe(
      `Código ${c.codigo} · ${c.tipoDeDocumento} ${c.numeroDeDocumento} · ` +
        `${String(c.predios)} predios y ${String(c.vehiculos)} vehículo`,
    );
    // El comprobante lo repite, y tiene que decir lo mismo.
    expect(ARTBOARD).toContain(`['Contribuyente', '${c.nombre}'],`);
    expect(ARTBOARD).toContain(`['Código', '${c.codigo}'],`);
  });

  it('el usuario con sesion (linea 1045)', () => {
    const literal = /usuario: (\{[^}]*\})/.exec(ARTBOARD)?.[1];
    const original = evaluar(`(${literal ?? 'null'})`) as Record<string, string>;
    const u = USUARIO;

    expect(original).toStrictEqual({
      iniciales: u.iniciales,
      nombre: u.nombre,
      doc: `${u.tipoDeDocumento} ${u.numeroDeDocumento}`,
      codigo: `Contribuyente ${u.codigo}`,
      correo: u.correo,
    });
  });

  it('el comprobante (linea 1037), la entidad (1042), la ordenanza (177) y el dia de corte (1338)', () => {
    expect(LINEAS[lineaDe(`numero: '${COMPROBANTE.numero}'`) - 1]).toContain(
      `numero: '${COMPROBANTE.numero}', operacion: '${COMPROBANTE.operacion}',`,
    );
    expect(LINEAS[1037 - 1]).toContain(`fecha: '${formatearFecha(COMPROBANTE.fecha)} · ${COMPROBANTE.hora}'`);
    expect(LINEAS[1042 - 1]).toContain(`this.props.entidad || '${ENTIDAD}'`);
    expect(LINEAS[177 - 1]).toContain(`La ${ORDENANZA} condona el 100 % del interés moratorio.`);
    expect(LINEAS[1338 - 1]).toContain(`[['${formatearFecha(FECHA_DE_CORTE)}', pagoSel`);
    expect(COMPROBANTE.fecha).toBe(FECHA_DE_CORTE);
  });
});
