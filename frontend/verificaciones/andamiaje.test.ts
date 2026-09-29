import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { type Paso, type Trabajo, leerElWorkflow, lineasDe } from './workflow.ts';

/**
 * El andamiaje no se afloja solo. Portada de `rentas/frontend/verificaciones/andamiaje.test.ts`.
 *
 * Las tres cosas que este archivo vigila no son gustos: son las que hacen que TODO lo
 * demas verifique algo.
 *
 *   · Sin `strict` y sus companeras, el compilador deja pasar el `undefined` que
 *     luego se muestra al ciudadano como «NaN».
 *   · Si `verificar` deja de encadenar uno de sus cuatro pasos, el PR sigue saliendo verde y ya
 *     no dice lo mismo. Es un cambio de una linea y nadie lo revisa dos veces.
 *   · Si el workflow pierde su filtro o su comando, la CI del frontend deja de existir sin
 *     que ningun archivo se borre.
 *
 * Las tres se caen en silencio, que es el motivo por el que se comprueban.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const REPOSITORIO = join(RAIZ, '..');

const leer = (ruta: string) => readFileSync(ruta, 'utf8');

/**
 * Un `tsconfig` es **JSONC**, no JSON: admite comentarios, y los dos de este frontend los usan.
 *
 * `JSON.parse` a secas revienta con `Expected double-quoted property name in JSON at position
 * 183` —medido—, que es un mensaje sobre comillas para un archivo que no tiene ningun problema de
 * comillas. Y revienta **en la recoleccion**, o sea que se lleva por delante las pruebas de este
 * archivo entero en vez de fallar una.
 *
 * Se recorre caracter a caracter y no con expresiones regulares, porque hay que saber si se esta
 * DENTRO de una cadena: una ruta con `https://` dentro se comeria el resto de la linea.
 */
function comoJsonc(texto: string): unknown {
  let salida = '';
  let enCadena = false;
  let escapado = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i] ?? '';
    if (enCadena) {
      salida += c;
      if (escapado) escapado = false;
      else if (c === '\\') escapado = true;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') {
      enCadena = true;
      salida += c;
      continue;
    }
    if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      salida += '\n';
      continue;
    }
    if (c === '/' && texto[i + 1] === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) i += 1;
      i += 1;
      salida += ' ';
      continue;
    }
    salida += c;
  }
  return JSON.parse(salida);
}

describe('el compilador es tan estricto como el issue pide', () => {
  const opciones = (comoJsonc(leer(join(RAIZ, 'tsconfig.base.json'))) as {
    compilerOptions: Record<string, unknown>;
  }).compilerOptions;

  it.each([
    ['strict', 'sin el, el resto de banderas no significan nada'],
    [
      'noUncheckedIndexedAccess',
      'sin el, `cuotas[0].total` compila y revienta con la lista vacia',
    ],
    ['verbatimModuleSyntax', 'sin el, un `import type` se cuela en el bundle y arrastra el modulo'],
    [
      'allowImportingTsExtensions',
      'sin el, los `import` con `.ts` —la forma de todo este arbol y de la libreria enlazada— no compilan',
    ],
    [
      'preserveSymlinks',
      // Su ausencia NO se nota en local, donde el clon hermano si tiene su `node_modules`: se
      // nota en CI y en la imagen, donde el hermano se clona y no se instala, y el rojo habla de
      // `Cannot find module 'react'` sobre archivos de la libreria. Su motivo entero esta en
      // `tsconfig.base.json`, junto a la bandera.
      'sin el, la libreria enlazada resuelve sus dependencias desde el clon hermano, que en CI no las tiene',
    ],
  ])('%s esta encendido — %s', (bandera) => {
    expect(opciones[bandera]).toBe(true);
  });
});

describe('«yarn verificar» encadena las cuatro comprobaciones', () => {
  const scripts = JSON.parse(leer(join(RAIZ, 'package.json'))).scripts as Record<string, string>;

  // `i18n` tambien: es `i18next-cli status`, el unico paso que dice que el codigo usa una clave que
  // el locale no tiene. Fuera de la cadena, una frase nueva sin su entrada pasaria en verde.
  it.each(['lint', 'typecheck', 'i18n', 'test'])('llama a «yarn %s»', (comprobacion) => {
    expect(
      scripts['verificar'],
      `«verificar» dejo de llamar a «${comprobacion}». Una cadena a la que le falta un\n` +
        'eslabon sigue saliendo verde, y eso es peor que no tenerla.',
    ).toContain(`yarn ${comprobacion}`);
  });

  it('«build» produce un bundle de verdad, no un alias del typecheck', () => {
    expect(scripts['build']).toBe('vite build');
  });
});

/**
 * Donde vive el workflow del frontend.
 *
 * Lo que verifica sigue siendo el CONTENIDO —el filtro, la orden y el candado—, y que el
 * archivo EXISTA: si alguien lo borra, sale rojo aqui antes de que nadie note que los PR
 * del frontend dejaron de verificarse.
 */
const SITIO_DEL_WORKFLOW = '.github/workflows/frontend.yml';

/**
 * El workflow, leido como YAML (issue 63): lo que se mira son sus DATOS —`on`, `jobs`, los pasos de
 * cada trabajo en su orden—, y no sus lineas. Hasta el issue 63 se quitaban los comentarios a mano y
 * se cortaba cada trabajo por su sangria: medido al portarlo de `rentas`, con
 * `yarn install --frozen-lockfile` cambiado por `yarn install` la prueba del candado seguia en VERDE,
 * porque la cadena salia en los comentarios que explican el paso. Con el lector, un comentario no es un
 * dato. Sin el archivo, el workflow sale vacio y NO una excepcion: leerlo a secas reventaria el
 * modulo entero con un `ENOENT` durante la recoleccion, y el rojo hablaria de `readFileSync`.
 */
const RUTA_DEL_WORKFLOW = join(REPOSITORIO, SITIO_DEL_WORKFLOW);
const LEIDO = leerElWorkflow(existsSync(RUTA_DEL_WORKFLOW) ? leer(RUTA_DEL_WORKFLOW) : '');
const TRABAJOS = LEIDO.workflow.jobs ?? {};

/** Los pasos de un trabajo, en su orden; ninguno si el trabajo no esta. */
const pasosDe = (trabajo: Trabajo | undefined): readonly Paso[] => trabajo?.steps ?? [];

/** El indice del paso que corre exactamente esa orden (una linea), o -1. */
const pasoQueCorre = (trabajo: Trabajo | undefined, orden: string): number =>
  pasosDe(trabajo).findIndex((paso) => paso.run?.trim() === orden);

/** El paso que clona un repositorio en una ruta (`actions/checkout`). */
const checkout = (trabajo: Trabajo | undefined, ruta: string): Paso | undefined =>
  pasosDe(trabajo).find((paso) => paso.uses?.startsWith('actions/checkout@') === true && paso.with?.['path'] === ruta);

describe('el frontend tiene su propia CI', () => {
  const verificar = TRABAJOS['verificar'];

  it('el workflow esta instalado', () => {
    expect(
      existsSync(RUTA_DEL_WORKFLOW) ? RUTA_DEL_WORKFLOW : undefined,
      `No hay workflow del frontend en «${SITIO_DEL_WORKFLOW}».\n` +
        'Sin el, «yarn verificar» solo se ejecuta en la maquina de quien lo escribe.',
    ).toBeDefined();
  });

  it('EL CENTINELA: es YAML que se lee, y tiene un trabajo `verificar`', () => {
    expect(LEIDO.error).toBeNull();
    expect(verificar, 'No hay trabajo `verificar` en el workflow del frontend.').toBeDefined();
  });

  it('se dispara solo con lo suyo', () => {
    // El filtro se pone desde el principio: el dia que entre otra cosa —documentacion, un arnes—, un
    // cambio suyo no tiene por que gastar una instalacion de npm, y quitarlo sin querer es un cambio de
    // una linea que nadie revisa.
    for (const evento of ['push', 'pull_request']) {
      expect(LEIDO.workflow.on?.[evento]?.paths, `on.${evento}.paths`).toContain('frontend/**');
    }
  });

  it('el workflow es tambien lo suyo: un cambio en el se verifica a si mismo', () => {
    for (const evento of ['push', 'pull_request']) {
      expect(LEIDO.workflow.on?.[evento]?.paths, `on.${evento}.paths`).toContain('.github/workflows/frontend.yml');
    }
  });

  it('ejecuta la misma orden que se ejecuta en local', () => {
    // Si la CI corriera `yarn lint && yarn test` por su cuenta, «verde en CI» y «verde en
    // mi maquina» dejarian de ser la misma afirmacion en cuanto una de las dos cambie.
    expect(pasoQueCorre(verificar, 'yarn verificar')).toBeGreaterThanOrEqual(0);
  });

  it('instala con el candado, no con lo que haya en el registro', () => {
    expect(pasoQueCorre(verificar, 'yarn install --frozen-lockfile')).toBeGreaterThanOrEqual(0);
  });

  it('y construye el bundle, que `yarn verificar` no construye', () => {
    expect(pasoQueCorre(verificar, 'yarn build')).toBeGreaterThan(pasoQueCorre(verificar, 'yarn verificar'));
  });

  it('y clona `kamayuk-lib` AL LADO, que es donde los `link:` lo buscan', () => {
    // Sin el hermano, `yarn install --frozen-lockfile` sale en verde igual (rentas#113) y el rojo
    // llega despues hablando de modulos. La ruta tiene que ser exactamente la del `link:`: con
    // `../../kamayuk-lib` desde `ciudadano/frontend`, el hermano cae en `kamayuk-lib`.
    expect(checkout(verificar, 'kamayuk-lib')?.with?.['repository']).toBe('hneyra/kamayuk-lib');
    expect(checkout(verificar, 'ciudadano')).toBeDefined();
  });
});

/**
 * **`kamayuk-lib` se clona en un SHA fijo, no en la punta de `main`** (issue 55).
 *
 * Sin `ref`, una corrida en verde no dice contra que commit de la libreria salio verde, y un
 * cambio alla puede romper esta CI sin que nada cambie en este repositorio — el mismo problema, en
 * espejo, que ya tiene el filtro `paths` (arriba). El SHA vive en `KAMAYUK_LIB_SHA`, en la raiz del
 * repositorio: subir de version es escribir el SHA nuevo ahi, y lo dice `CLAUDE.md`.
 *
 * Los DOS trabajos clonan la libreria por su cuenta, asi que los dos tienen que leer el archivo y
 * pasarlo como `ref:`; de ahi `it.each` sobre los dos trabajos, y no solo sobre uno.
 */
describe('la libreria se clona en el SHA fijado, no en la punta de `main`', () => {
  const rutaSha = join(REPOSITORIO, 'KAMAYUK_LIB_SHA');
  const sha = existsSync(rutaSha) ? leer(rutaSha).trim() : '';

  it('EL CENTINELA: `KAMAYUK_LIB_SHA` existe, en la raiz del repositorio, y es un SHA de 40 caracteres', () => {
    expect(
      sha,
      'No hay `KAMAYUK_LIB_SHA` en la raiz del repositorio, o no es un SHA de 40 caracteres.',
    ).toMatch(/^[0-9a-f]{40}$/);
  });

  const trabajos: ReadonlyArray<readonly [string, Trabajo | undefined]> = [
    ['verificar', TRABAJOS['verificar']],
    ['arnes', TRABAJOS['arnes']],
  ];
  /** El paso que lee el SHA: el que el checkout de la libreria nombra en su `ref:`. */
  const pasoDelSha = (trabajo: Trabajo | undefined) => pasosDe(trabajo).find((paso) => paso.id === 'sha-de-kamayuk-lib');

  it.each(trabajos)('el trabajo `%s` existe', (_nombre, trabajo) => {
    expect(trabajo, 'No hay trabajo con ese nombre en el workflow del frontend.').toBeDefined();
  });

  it.each(trabajos)('el trabajo `%s` lee `KAMAYUK_LIB_SHA` del checkout de este repositorio', (_nombre, trabajo) => {
    // La misma orden que escribe el workflow: leer el archivo YA CLONADO (el checkout de este
    // repositorio va primero) y exponerlo como salida del paso, para que el checkout de la
    // libreria —que viene despues— lo use en `ref:`.
    expect(lineasDe(pasoDelSha(trabajo))).toContain('sha="$(cat ciudadano/KAMAYUK_LIB_SHA)"');
    const pasos = pasosDe(trabajo);
    const paso = pasoDelSha(trabajo);
    expect(pasos.indexOf(checkout(trabajo, 'ciudadano') as Paso), 'el SHA se lee antes de clonar este repositorio').toBeLessThan(
      pasos.indexOf(paso as Paso),
    );
    expect(pasos.indexOf(paso as Paso), 'la libreria se clona antes de leer su SHA').toBeLessThan(
      pasos.indexOf(checkout(trabajo, 'kamayuk-lib') as Paso),
    );
  });

  it.each(trabajos)(
    'y el trabajo `%s` VALIDA ese SHA antes de exponerlo, en vez de dejarlo pasar vacio',
    (_nombre, trabajo) => {
      // Ronda 1 del PR #65: `cat` sobre un archivo ausente o vacio no hace fallar la asignacion
      // —`sha="$(cat …)"` sale con `rc=0` igual, con `sha` vacio, porque bash no propaga el fallo
      // de un `$(...)` a menos que algo lo mire aparte— y el paso de arriba escribia esa cadena
      // vacia como salida igual: un `ref:` vacio en el checkout de la libreria clona la PUNTA de
      // `main` sin decirlo, el silencio exacto que este issue queria quitar. Sin esta linea, esa
      // rotura pasaba el centinela de arriba (que solo mira que el archivo `KAMAYUK_LIB_SHA`
      // exista en el REPOSITORIO) y solo se notaba mas tarde, con la libreria ya clonada.
      const guion = lineasDe(pasoDelSha(trabajo));
      const valida = guion.indexOf('if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then');
      const expone = guion.indexOf('echo "sha=$sha" >> "$GITHUB_OUTPUT"');
      expect(valida, 'el paso no valida el SHA').toBeGreaterThanOrEqual(0);
      expect(guion.slice(valida)).toContain('exit 1');
      expect(expone, 'el paso expone el SHA antes de validarlo').toBeGreaterThan(guion.indexOf('exit 1', valida));
    },
  );

  it.each(trabajos)('y el trabajo `%s` clona `kamayuk-lib` en ESE SHA, con `ref:`', (_nombre, trabajo) => {
    // Esto es lo que se pone rojo si alguien vuelve a clonar sin `ref` — el defecto que el
    // issue nombra. Medido quitando esta linea del workflow: rojo en el trabajo tocado, y en el
    // otro, que la seguia teniendo, verde.
    expect(checkout(trabajo, 'kamayuk-lib')?.with?.['ref']).toBe('${{ steps.sha-de-kamayuk-lib.outputs.sha }}');
  });
});

/**
 * **El arnes de Playwright corre en la CI, en su propio trabajo** (issue 11).
 *
 * Un arnes que solo corre en la maquina de quien lo escribe se apaga el dia que alguien no lo corre, y
 * nada se pone rojo. Lo que aqui se vigila es lo que el issue pide del trabajo —que espere a `verificar`,
 * que tenga su tope de tiempo, que instale Chromium, que corra `yarn e2e` y que suba el informe AUNQUE
 * falle— y de la configuracion, lo que hace que mida el bundle y no otra cosa.
 */
describe('el arnes corre en la CI contra el bundle', () => {
  const trabajo = TRABAJOS['arnes'];
  const config = existsSync(join(RAIZ, 'playwright.config.ts')) ? leer(join(RAIZ, 'playwright.config.ts')) : '';
  const scripts = JSON.parse(leer(join(RAIZ, 'package.json'))).scripts as Record<string, string>;

  it('EL CENTINELA: el workflow tiene un trabajo `arnes`', () => {
    expect(trabajo, 'No hay trabajo `arnes` en el workflow del frontend.').toBeDefined();
  });

  it('espera a `verificar` y tiene su tope de 20 minutos', () => {
    expect([trabajo?.needs].flat()).toContain('verificar');
    expect(trabajo?.['timeout-minutes']).toBe(20);
  });

  it('con los dos clones hermanos y el candado', () => {
    expect(checkout(trabajo, 'ciudadano')).toBeDefined();
    expect(checkout(trabajo, 'kamayuk-lib')?.with?.['repository']).toBe('hneyra/kamayuk-lib');
    expect(pasoQueCorre(trabajo, 'yarn install --frozen-lockfile')).toBeGreaterThanOrEqual(0);
  });

  it('instala Chromium y corre el arnes, en ese orden', () => {
    const navegador = pasoQueCorre(trabajo, 'yarn e2e:navegador');
    const arnes = pasoQueCorre(trabajo, 'yarn e2e');
    expect(navegador, 'el trabajo no instala Chromium').toBeGreaterThanOrEqual(0);
    expect(arnes, 'el trabajo no corre `yarn e2e`').toBeGreaterThan(navegador);
  });

  /**
   * **Linux no trae Arial** (issue 36): sin una compatible en metricas, Chromium dibuja DejaVu Sans
   * —mas ancha— y las medidas fijas del artboard se corren. `e2e/se-ve.spec.ts` lo mide por CDP
   * (`laLetraDibujadaCalzaConArial`, en `e2e/portal.ts`) contra Arial o su lista de compatibles: el
   * paso que instala la fuente tiene que estar, y ANTES de `yarn e2e`, que es quien la necesita.
   */
  it('instala una fuente compatible con Arial antes de correr el arnes', () => {
    const fuentes = pasoQueCorre(trabajo, 'sudo apt-get update && sudo apt-get install -y fonts-liberation');
    const arnes = pasoQueCorre(trabajo, 'yarn e2e');
    expect(fuentes, 'el trabajo no instala `fonts-liberation`').toBeGreaterThanOrEqual(0);
    expect(arnes, 'el trabajo no corre `yarn e2e`').toBeGreaterThan(fuentes);
  });

  it('y sube el informe SIEMPRE, tambien cuando el arnes falla', () => {
    const informe = pasosDe(trabajo).find((paso) => paso.uses?.startsWith('actions/upload-artifact@') === true);
    expect(informe?.if).toBe('always()');
    expect(informe?.with?.['path']).toBe('ciudadano/frontend/playwright-report/');
  });

  it('los dos guiones: `e2e` y `e2e:navegador`', () => {
    expect(scripts['e2e']).toBe('node puerto-del-arnes.mjs && playwright test');
    expect(scripts['e2e:navegador']).toBe('playwright install chromium');
  });

  it('la configuracion mide el BUNDLE, en Chromium, de uno en uno y con trazas de lo que falle', () => {
    expect(config).toContain("testDir: './e2e'");
    expect(config).toContain('workers: 1');
    expect(config).toContain("trace: 'retain-on-failure'");
    expect(config).toContain("devices['Desktop Chrome']");
    // `build:arnes` y no `build` desde el issue 27: el arnes recorre el recorrido del ARTBOARD, y
    // eso solo existe en un paquete construido en modo demostracion. Que ese guion siga siendo el
    // que enciende la bandera lo comprueba `la-demostracion-no-viaja-al-bundle.test.ts`; aqui solo
    // se fija que el arnes construya y sirva, en ese orden y sin moverse de puerto.
    expect(config).toMatch(/command:\s*`yarn build:arnes && yarn preview --port \$\{PUERTO\} --strictPort`/);
    expect(config).toContain("globalSetup: './e2e/el-bundle-servido-es-el-mio.ts'");
  });
});
