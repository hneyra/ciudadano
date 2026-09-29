// @vitest-environment node
//
// Corre `git ls-files` y lee archivos del disco: no es un DOM lo que necesita.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RAIZ } from './artboards.ts';

/**
 * **Cada ADR que el codigo cita existe, y cada ADR lo cita alguien** (issue 64).
 *
 * La historia de las decisiones vive en `docs/adr/` y el comentario junto al codigo se queda con el
 * porque operativo y un enlace (`docs/adr/README.md`). Un enlace a un ADR que no existe —una errata, un
 * ADR renombrado— es un comentario que promete una explicacion que no hay; y un ADR que nadie cita es
 * historia que nadie va a encontrar. Las dos cosas se miden aqui, en todo el arbol versionado.
 *
 * Tambien que el indice del `README.md` y los archivos digan lo mismo, que la numeracion no tenga
 * huecos ni repetidos, y que cada ADR lleve las secciones de la plantilla.
 */

const RAIZ_DEL_REPO = join(RAIZ, '..');
const DIRECTORIO = 'docs/adr';

/** Un ADR de este repositorio, por su nombre de archivo. */
const NOMBRE_DE_ADR = /^CIU-(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/** Una cita en un texto: el numero, y el nombre de archivo si lo trae. */
const CITA = /CIU-(\d{4})(-[a-z0-9]+(?:-[a-z0-9]+)*\.md)?/g;

/** Las secciones de la plantilla, en su orden. */
const SECCIONES = ['## Contexto', '## Decisión', '## Consecuencias', '## Qué se midió', '## Qué se descartó'];

/** Los archivos versionados (y los nuevos sin versionar) del repositorio, desde su raiz. */
function archivosDelRepo(): string[] {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: RAIZ_DEL_REPO,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`git ls-files fallo (rc=${String(r.status)}): ${r.stderr}`);
  return r.stdout
    .split('\n')
    .filter((ruta) => ruta !== '' && existsSync(join(RAIZ_DEL_REPO, ruta)))
    .filter((ruta) => /\.(tsx?|mjs|js|json|md|yml|conf|sh|html)$/.test(ruta) || /(^|\/)Dockerfile$/.test(ruta))
    .filter((ruta) => !ruta.endsWith('yarn.lock') && !ruta.startsWith('frontend/diseno/'));
}

/** Las citas de un texto, cada una con su linea. */
export function citasDe(texto: string): { linea: number; numero: string; archivo: string | null }[] {
  return texto.split('\n').flatMap((linea, i) =>
    [...linea.matchAll(CITA)].map((casa) => ({
      linea: i + 1,
      numero: casa[1] ?? '',
      archivo: casa[2] === undefined ? null : `CIU-${casa[1] ?? ''}${casa[2]}`,
    })),
  );
}

const ADRS = readdirSync(join(RAIZ_DEL_REPO, DIRECTORIO))
  .filter((nombre) => NOMBRE_DE_ADR.test(nombre))
  .sort();
const INDICE = readFileSync(join(RAIZ_DEL_REPO, DIRECTORIO, 'README.md'), 'utf8');
const ARCHIVOS = archivosDelRepo();
const CITAS = ARCHIVOS.flatMap((ruta) =>
  citasDe(readFileSync(join(RAIZ_DEL_REPO, ruta), 'utf8')).map((cita) => ({ ruta, ...cita })),
);

describe('los ADR que se citan existen, y cada ADR lo cita alguien', () => {
  it('EL CENTINELA: hay ADR, hay indice, y se leyo el codigo y `CLAUDE.md`', () => {
    // Sin esto, un directorio movido o un `git ls-files` roto dejarian las listas vacias y todo verde.
    expect(ADRS.length, `no hay ADR en ${DIRECTORIO}/`).toBeGreaterThanOrEqual(6);
    expect(ARCHIVOS).toEqual(expect.arrayContaining(['CLAUDE.md', 'frontend/src/api/prefijo.ts']));
    expect(CITAS.filter((c) => c.ruta.startsWith('frontend/src/')).length).toBeGreaterThan(0);
  });

  it('cada cita con nombre de archivo apunta a un ADR que existe', () => {
    const rotas = CITAS.filter((c) => c.archivo !== null && !ADRS.includes(c.archivo)).map(
      (c) => `  ${c.ruta}:${String(c.linea)} cita ${String(c.archivo)}`,
    );
    expect(rotas, `Citas a ADR que no existen en ${DIRECTORIO}/:\n${rotas.join('\n')}`).toEqual([]);
  });

  it('y cada cita por numero, a un numero que existe', () => {
    const numeros = new Set(ADRS.map((nombre) => nombre.slice(4, 8)));
    const rotas = CITAS.filter((c) => !numeros.has(c.numero)).map(
      (c) => `  ${c.ruta}:${String(c.linea)} cita CIU-${c.numero}`,
    );
    expect(rotas, `Citas a un numero de ADR que no existe:\n${rotas.join('\n')}`).toEqual([]);
  });

  it('cada ADR lo cita el codigo o `CLAUDE.md`: la historia que nadie enlaza no la encuentra nadie', () => {
    const citados = new Set(CITAS.filter((c) => !c.ruta.startsWith(`${DIRECTORIO}/`)).map((c) => c.numero));
    expect(ADRS.filter((nombre) => !citados.has(nombre.slice(4, 8)))).toEqual([]);
  });

  it('el indice del README enlaza cada ADR, y solo los que existen', () => {
    const enlazados = [...INDICE.matchAll(/\]\((CIU-\d{4}-[^)]+\.md)\)/g)].map((casa) => casa[1]);
    expect([...new Set(enlazados)].sort()).toEqual(ADRS);
  });

  it('la numeracion empieza en 0001 y no tiene huecos ni repetidos', () => {
    expect(ADRS.map((nombre) => nombre.slice(0, 8))).toEqual(
      ADRS.map((_, i) => `CIU-${String(i + 1).padStart(4, '0')}`),
    );
  });

  it.each(ADRS)('%s lleva su titulo, su estado y las secciones de la plantilla', (nombre) => {
    const texto = readFileSync(join(RAIZ_DEL_REPO, DIRECTORIO, nombre), 'utf8');
    expect(texto.startsWith(`# ${nombre.slice(0, 8)} — `), 'el titulo empieza por su numero').toBe(true);
    expect(texto).toMatch(/^- \*\*Estado\*\*: /m);
    const posiciones = SECCIONES.map((seccion) => texto.indexOf(`\n${seccion}\n`));
    expect(posiciones.filter((p) => p < 0).length, `faltan secciones: ${SECCIONES.join(', ')}`).toBe(0);
    expect([...posiciones].sort((a, b) => a - b), 'las secciones van en el orden de la plantilla').toEqual(posiciones);
  });

  it('`citasDe` ve la cita con y sin nombre de archivo, y no confunde otra cosa con una', () => {
    // Partida en trozos para que este archivo no se cite a si mismo un ADR que no existe.
    const ciu = 'CIU-';
    expect(citasDe(`ver \`docs/adr/${ciu}0001-la-raiz.md\` y ${ciu}0002\nnada: ${ciu}12, ADR-0020`)).toEqual([
      { linea: 1, numero: '0001', archivo: `${ciu}0001-la-raiz.md` },
      { linea: 1, numero: '0002', archivo: null },
    ]);
  });
});
