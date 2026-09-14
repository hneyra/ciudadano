import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

import { PROHIBICIONES } from '../eslint.prohibiciones.mjs';
import { RAIZ } from './artboards.ts';

/**
 * **`src/datos/` cumple las prohibiciones de importes, y las prohibiciones muerden ahi** (issue 3).
 *
 * `reglas-de-eslint.test.ts` ya demuestra que cada prohibicion caza su muestra, pero la juzga como
 * si viviera en `src/pantallas/`. Las cuentas del portal viven en `src/datos/`, y es justo el
 * directorio donde uno esperaria una excepcion —«aqui es donde se suma»—. Esta prueba lo mira en
 * su sitio: lo que hay hoy pasa limpio, y un `a.insoluto + a.interes` escrito en esa misma ruta
 * sale rojo con el mensaje de la libreria.
 *
 * Y comprueba lo otro que el issue pide de esos archivos: que `cuentas.ts`, `demostracion.ts` y
 * `tipos.ts` no traen React. Sin React se pueden usar desde una prueba de Node, desde el arnes o
 * desde un backend simulado sin montar nada.
 */

const DATOS = join(RAIZ, 'src/datos');

const eslint = new ESLint({ cwd: RAIZ });

/**
 * Lo que un archivo importa: los `from '…'`, los `import '…'` sueltos y los `import('…')`.
 *
 * Una expresion regular y no el analizador de TypeScript, a proposito: lo que se busca es un
 * nombre de paquete entre comillas detras de `from` o de `import`, y los tres archivos que se miran
 * no tienen cadenas que lo imiten.
 */
function importadosPor(codigo: string): string[] {
  return [...codigo.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1] ?? m[2] ?? '',
  );
}

/** El mensaje de la libreria para esa clave: la prueba compara contra ESE texto, no una copia. */
function mensajeDe(clave: string): string {
  const prohibicion = PROHIBICIONES.find((p) => p.clave === clave);
  if (prohibicion === undefined) throw new Error(`No hay prohibicion «${clave}»`);
  return prohibicion.message;
}

async function mensajesEn(codigo: string, ruta: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: join(RAIZ, ruta) });
  return (resultado?.messages ?? []).map((m) => m.message);
}

// El arranque en frio de ESLint no cabe en los 5 s de una prueba (rentas#36).
beforeAll(async () => {
  await eslint.lintText('export const listo = 1;\n', { filePath: join(DATOS, 'calentamiento.ts') });
}, 60_000);

describe('lo que hay en src/datos/ pasa ESLint limpio', () => {
  it('ni un aviso en todo el directorio', async () => {
    const resultados = await eslint.lintFiles([DATOS]);
    const avisos = resultados.flatMap((r) =>
      r.messages.map((m) => `${r.filePath.slice(RAIZ.length + 1)}:${String(m.line)} — ${m.message}`),
    );

    expect(resultados.map((r) => r.filePath.slice(DATOS.length + 1)).sort()).toEqual(
      expect.arrayContaining(['cuentas.ts', 'demostracion.ts', 'fuente.ts', 'tipos.ts']),
    );
    expect(avisos, `src/datos/ tiene avisos de ESLint:\n${avisos.join('\n')}`).toEqual([]);
  });
});

describe('y las prohibiciones de importes muerden en src/datos/', () => {
  it('`a.insoluto + a.interes` en src/datos/cuentas.ts sale rojo', async () => {
    const aMano = `
      import type { Deuda } from './tipos.ts';

      export function totalDe(a: Deuda) {
        return a.insoluto + a.interes;
      }
    `;

    expect(await mensajesEn(aMano, 'src/datos/cuentas.ts')).toContain(mensajeDe('aritmetica-con-importes'));
  });

  it('un `.reduce` sobre los importes de la deuda sale rojo', async () => {
    const conReduce = `
      export function interesDe(deuda: { interes: string[] }) {
        return deuda.interes.reduce((uno, otro) => uno + otro, '0.00');
      }
    `;

    expect(await mensajesEn(conReduce, 'src/datos/cuentas.ts')).toContain(mensajeDe('aritmetica-con-importes'));
  });

  it('un importe declarado `number` en src/datos/tipos.ts sale rojo', async () => {
    const conNumber = `
      export interface Deuda {
        readonly insoluto: number;
      }
    `;

    expect(await mensajesEn(conNumber, 'src/datos/tipos.ts')).toContain(mensajeDe('importe-declarado-number'));
  });

  it('`Number(deuda.insoluto)` en src/datos/demostracion.ts sale rojo', async () => {
    const convertido = `
      export const insoluto = (deuda: { insoluto: string }) => Number(deuda.insoluto);
    `;

    expect(await mensajesEn(convertido, 'src/datos/demostracion.ts')).toContain(
      mensajeDe('importe-convertido-a-number'),
    );
  });
});

/**
 * **Lo que las prohibiciones NO cazan en estos datos, medido y no supuesto.**
 *
 * Las prohibiciones de importes miran el NOMBRE del campo contra `CAMPOS_DE_DINERO` de
 * `@kamayuk/verificaciones` (`monto|importe|saldo|deuda|total|insoluto|interes|…`). Dos campos de
 * dinero de este portal no estan en esa lista: `gastos` (los gastos de emision y las costas) y
 * `conAmnistia` (lo que se cobra). Sobre ellos un `+` escrito a mano pasa ESLint en verde.
 *
 * No se arregla aqui: la lista es de la libreria y este repositorio no la modifica. Tampoco se
 * renombran los campos para que caigan en la lista —`importeDeGastos`—, porque el issue 3 los
 * nombra asi y el nombre tiene que decir que es, no esquivar una regla. Lo que protege estos dos
 * campos hoy es que `cuentas.ts` es el unico sitio que suma y lo hace con `sumarImportes`.
 *
 * Esta prueba fija el hueco para que no se olvide: **el dia que la libreria anada esos nombres,
 * sale roja**, y lo que hay que hacer es darle la vuelta (`toContain`) en vez de borrarla.
 */
describe('hueco medido: `gastos` y `conAmnistia` no son dinero para la libreria', () => {
  it.each(['gastos', 'conAmnistia'])('una suma a mano sobre «%s» pasa ESLint sin aviso', async (campo) => {
    const aMano = `
      export function suma(a: { ${campo}: string }, b: { ${campo}: string }) {
        return a.${campo} + b.${campo};
      }
    `;

    expect(await mensajesEn(aMano, 'src/datos/cuentas.ts')).toEqual([]);
  });
});

describe('las cuentas y los datos no traen React', () => {
  it.each(['cuentas.ts', 'demostracion.ts', 'tipos.ts'])('%s', (archivo) => {
    const importados = importadosPor(readFileSync(join(DATOS, archivo), 'utf8'));
    // Que el lector lee: sin esto, un lector roto que no devolviera nada pasaria en verde.
    expect(importados).toContain('@kamayuk/formato');

    expect(
      importados.filter((e) => /^(react|react-dom|@tanstack\/react-query|@kamayuk\/ui)(\/|$)/.test(e)),
      `src/datos/${archivo} importa React o algo que lo arrastra`,
    ).toEqual([]);
  });
});
