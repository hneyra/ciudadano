import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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

describe('el frontend tiene su propia CI', () => {
  const ruta = join(REPOSITORIO, SITIO_DEL_WORKFLOW);
  const encontrado = existsSync(ruta) ? ruta : undefined;

  it('el workflow esta instalado', () => {
    expect(
      encontrado,
      `No hay workflow del frontend en «${SITIO_DEL_WORKFLOW}».\n` +
        'Sin el, «yarn verificar» solo se ejecuta en la maquina de quien lo escribe.',
    ).toBeDefined();
  });

  // Sin el archivo, `workflow` es la cadena vacia y NO una excepcion. Leerlo a secas
  // reventaba el modulo entero con un `ENOENT` durante la recoleccion: los doce casos de
  // este archivo desaparecian y el rojo hablaba de `readFileSync`, no de la CI que falta.
  //
  // Y SIN COMENTARIOS, que es lo que esta copia anade a la de `rentas`. Medido al demostrar que
  // mordia: con `yarn install --frozen-lockfile` cambiado por `yarn install` a secas, la prueba
  // del candado seguia en VERDE, porque la cadena sale tambien en los comentarios que explican el
  // paso. Un workflow que habla de lo que hace no puede contar como un workflow que lo hace.
  const workflow = (encontrado === undefined ? '' : leer(encontrado))
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('#'))
    .join('\n');

  it('se dispara solo con lo suyo', () => {
    // Hoy todo el repositorio es `frontend/`, pero el filtro se pone desde el principio: el dia
    // que entre otra cosa —documentacion, un arnes—, un cambio suyo no tiene por que gastar una
    // instalacion de npm, y quitarlo sin querer es un cambio de una linea que nadie revisa.
    expect(workflow).toMatch(/paths:\s*\[?"?frontend\/\*\*/);
  });

  it('el workflow es tambien lo suyo: un cambio en el se verifica a si mismo', () => {
    expect(workflow).toMatch(/paths:\s*\[[^\]]*"\.github\/workflows\/frontend\.yml"/);
  });

  it('ejecuta la misma orden que se ejecuta en local', () => {
    // Si la CI corriera `yarn lint && yarn test` por su cuenta, «verde en CI» y «verde en
    // mi maquina» dejarian de ser la misma afirmacion en cuanto una de las dos cambie.
    expect(workflow).toMatch(/^\s*run:\s*yarn verificar\s*$/m);
  });

  it('instala con el candado, no con lo que haya hoy en el registro', () => {
    expect(workflow).toMatch(/^\s*run:\s*yarn install --frozen-lockfile\s*$/m);
  });

  it('y construye el bundle, que `yarn verificar` no construye', () => {
    expect(workflow).toMatch(/^\s*run:\s*yarn build\s*$/m);
  });

  it('y clona `kamayuk-lib` AL LADO, que es donde los `link:` lo buscan', () => {
    // Sin el hermano, `yarn install --frozen-lockfile` sale en verde igual (rentas#113) y el rojo
    // llega despues hablando de modulos. La ruta tiene que ser exactamente la del `link:`: con
    // `../../kamayuk-lib` desde `ciudadano/frontend`, el hermano cae en `kamayuk-lib`.
    expect(workflow).toMatch(/^\s*repository:\s*hneyra\/kamayuk-lib\s*$/m);
    expect(workflow).toMatch(/^\s*path:\s*kamayuk-lib\s*$/m);
    expect(workflow).toMatch(/^\s*path:\s*ciudadano\s*$/m);
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
  const ruta = join(REPOSITORIO, SITIO_DEL_WORKFLOW);
  const workflow = (existsSync(ruta) ? leer(ruta) : '')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('#'))
    .join('\n');
  // El bloque del trabajo: desde `  arnes:` hasta el siguiente trabajo (dos espacios y un nombre) o el final.
  const trabajo = workflow.match(/^ {2}arnes:\n((?: {4,}.*\n?|\s*\n)*)/m)?.[1] ?? '';
  const config = existsSync(join(RAIZ, 'playwright.config.ts')) ? leer(join(RAIZ, 'playwright.config.ts')) : '';
  const scripts = JSON.parse(leer(join(RAIZ, 'package.json'))).scripts as Record<string, string>;

  it('EL CENTINELA: el workflow tiene un trabajo `arnes`', () => {
    expect(trabajo, 'No hay trabajo `arnes` en el workflow del frontend.').not.toBe('');
  });

  it('espera a `verificar` y tiene su tope de 20 minutos', () => {
    expect(trabajo).toMatch(/^\s*needs:\s*verificar\s*$/m);
    expect(trabajo).toMatch(/^\s*timeout-minutes:\s*20\s*$/m);
  });

  it('con los dos clones hermanos y el candado', () => {
    expect(trabajo).toMatch(/^\s*path:\s*ciudadano\s*$/m);
    expect(trabajo).toMatch(/^\s*repository:\s*hneyra\/kamayuk-lib\s*$/m);
    expect(trabajo).toMatch(/^\s*path:\s*kamayuk-lib\s*$/m);
    expect(trabajo).toMatch(/^\s*run:\s*yarn install --frozen-lockfile\s*$/m);
  });

  it('instala Chromium y corre el arnes, en ese orden', () => {
    const navegador = trabajo.search(/^\s*run:\s*yarn e2e:navegador\s*$/m);
    const arnes = trabajo.search(/^\s*run:\s*yarn e2e\s*$/m);
    expect(navegador, 'el trabajo no instala Chromium').toBeGreaterThanOrEqual(0);
    expect(arnes, 'el trabajo no corre `yarn e2e`').toBeGreaterThan(navegador);
  });

  it('y sube el informe SIEMPRE, tambien cuando el arnes falla', () => {
    expect(trabajo).toMatch(/uses:\s*actions\/upload-artifact@v\d+\s*\n\s*if:\s*always\(\)/);
    expect(trabajo).toMatch(/^\s*path:\s*ciudadano\/frontend\/playwright-report\/\s*$/m);
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
