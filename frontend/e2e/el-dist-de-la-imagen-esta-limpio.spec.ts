import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { enQueArchivosEsta } from '../verificaciones/marcas-de-la-demostracion.ts';

/**
 * **El `dist/` que la imagen publicaria, medido sin Docker** (issue 37).
 *
 * `verificaciones/lo-servido-esta-limpio.test.ts` demuestra que el guion muerde, sobre muestras. Esto
 * lo corre sobre el paquete DE VERDAD, construido como lo construye el `Dockerfile`: `vite build` con
 * `VITE_KAMAYUK_SIN_PLATAFORMA=false`, `imagen/sin-mapas.sh` y `imagen/lo-servido-esta-limpio.sh`,
 * los mismos dos guiones que la imagen corre. Sin Docker, porque la suite no lo tiene; el `docker build`
 * lo repite dentro de la etapa que se publica, y esta en el PR del issue 37.
 *
 * Se queda en el arnes, y no en `yarn verificar`, por lo mismo que
 * `la-demostracion-no-viaja-al-bundle.spec.ts`: construye, y `yarn verificar` no construye nada a
 * proposito (issue 27). No abre navegador.
 *
 * <h2>Las dos mitades</h2>
 *
 * Antes de quitar los mapas el guion tiene que salir ROJO sobre este mismo paquete —`vite.config.ts`
 * pide `sourcemap: true`—, y despues, verde. Sin la primera, «esta limpio» seria verde tambien con un
 * guion que no mirara nada, o con un paquete que por otro motivo no tuviera mapas.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/** Donde se construye. No se versiona (`.gitignore`), no entra en la imagen (`.dockerignore`) y se borra al acabar. */
const DE_LA_IMAGEN = join(FRONTEND, 'dist-de-la-imagen');

/** La lista de marcas, escrita como la escribe la etapa de construccion (issue 58). Fuera del dist. */
const MARCAS = join(tmpdir(), `ciudadano-marcas-${String(process.pid)}.txt`);

const comprobar = () =>
  spawnSync('sh', [join(FRONTEND, 'imagen', 'lo-servido-esta-limpio.sh'), DE_LA_IMAGEN, FRONTEND, MARCAS], {
    encoding: 'utf8',
  });

test.beforeAll(() => {
  rmSync(DE_LA_IMAGEN, { recursive: true, force: true });
  // La bandera, apagada como en el `ENV` del `Dockerfile`. `vite build` a secas ya la dejaria sin
  // encender, pero lo que se mide es lo que la imagen hace, y la imagen la escribe.
  execFileSync('npx', ['vite', 'build', '--outDir', DE_LA_IMAGEN], {
    cwd: FRONTEND,
    stdio: 'pipe',
    env: { ...process.env, VITE_KAMAYUK_SIN_PLATAFORMA: 'false' },
  });
  // Y la lista de marcas, con el mismo generador que el `Dockerfile` (issue 58).
  writeFileSync(
    MARCAS,
    execFileSync(process.execPath, [join(FRONTEND, 'imagen', 'marcas-de-la-demostracion.mjs')], { cwd: FRONTEND, encoding: 'utf8' }),
  );
});

test.afterAll(() => {
  rmSync(DE_LA_IMAGEN, { recursive: true, force: true });
  rmSync(MARCAS, { force: true });
});

test('EL CENTINELA: recien construido, con sus mapas, el guion sale ROJO', () => {
  const mapas = readdirSync(join(DE_LA_IMAGEN, 'assets')).filter((archivo) => archivo.endsWith('.map'));
  expect(mapas.length, '`vite build` ya no emite mapas: la mitad roja no mediria nada').toBeGreaterThan(0);

  const antes = comprobar();
  expect(antes.stderr).toContain('mapa de simbolos: assets/');
  expect(antes.status).toBe(1);
});

test('y despues de sin-mapas.sh, como en la imagen, sale limpio', () => {
  execFileSync('sh', [join(FRONTEND, 'imagen', 'sin-mapas.sh'), DE_LA_IMAGEN], { stdio: 'pipe' });

  const despues = comprobar();
  expect(despues.stderr, 'el dist que la imagen publicaria no esta limpio').toBe('');
  expect(despues.stdout).toContain('lo servido esta limpio');
  // Con los datos de la demostracion buscados, como en la imagen (issue 58).
  expect(despues.stdout).toContain('sin los datos de la demostracion');
  expect(despues.status).toBe(0);
});

test('y lo que queda es un portal: la pagina, las senias, la vuelta del canje y sus trozos', () => {
  // Sin esto, «limpio» seria verde tambien sobre un directorio vacio.
  for (const archivo of ['index.html', 'configuracion.js', 'silencio.html']) {
    expect(existsSync(join(DE_LA_IMAGEN, archivo)), `falta «${archivo}»`).toBe(true);
  }
  expect(readdirSync(join(DE_LA_IMAGEN, 'assets')).filter((archivo) => archivo.endsWith('.js')).length).toBeGreaterThan(10);
});

test('y no lleva ni una marca de los datos del artboard (issue 58)', () => {
  // La misma busqueda que `la-demostracion-no-viaja-al-bundle.spec.ts` hace sobre `yarn build`, aqui
  // sobre lo que la imagen publicaria. La mitad que demuestra que la busqueda encuentra lo que busca
  // —todas las marcas en el paquete de demostracion— esta alli.
  const encontradas = enQueArchivosEsta(DE_LA_IMAGEN)
    .filter(({ archivos }) => archivos.length > 0)
    .map(({ marca, archivos }) => `«${marca}» en ${archivos.join(', ')}`);

  expect(encontradas, `La imagen publicaria los datos del artboard:\n  ${encontradas.join('\n  ')}`).toEqual([]);
});
