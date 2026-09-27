import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { enQueArchivosEsta } from '../verificaciones/marcas-de-la-demostracion.ts';

/**
 * **La medicion de verdad: sobre el paquete de PRODUCCION que `yarn build` produce** (issue 27).
 *
 * `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts` mira el TEXTO de los archivos y vigila
 * las dos formas conocidas de romper el plegado. Esto mira **el resultado**, que es lo unico que no
 * se puede discutir: si el `import()` sobrevivio, Vite emite su trozo con el nombre del modulo
 * dentro y el trozo que lo pide lo nombra para pedirlo. Si Rollup lo plego, no hay ni trozo ni
 * mencion.
 *
 * <h2>Por que construye aqui, en vez de mirar el `dist/` que ya hay</h2>
 *
 * Porque el `dist/` que sirve este arnes **es el de demostracion** a proposito (`playwright.config.ts`,
 * `build:arnes`): lo que el arnes recorre es el recorrido del artboard. Asi que este camino construye
 * el de produccion en OTRO directorio y compara los dos.
 *
 * Y comparar los dos es lo que hace que la prueba valga: sin la mitad que exige el trozo **dentro**
 * del paquete de demostracion, «no esta en el de produccion» pasaria en verde el dia que el modulo
 * dejara de existir, se renombrara, o el `import()` se cayera por un motivo que no es la bandera.
 *
 * <h2>Y los DATOS del artboard tampoco (issue 58)</h2>
 *
 * Hasta el issue 58 esto solo afirmaba que no viajaba **la fuente**: los datos si, porque ocho
 * archivos de produccion importaban `src/datos/demostracion.ts` por su cuenta —el reductor para su
 * estado inicial, la barra para la usuaria, el paso 2 para el contribuyente…—. Ahora los aporta la
 * fuente, y los dos ultimos caminos lo miden sobre lo construido: **ninguna marca de los datos**
 * —nombres, documentos, correo, comprobantes, direcciones, fichas, placa, el numero de Yape— en el
 * paquete de produccion, y **todas** en el del arnes, que es la mitad que demuestra que la busqueda
 * encuentra lo que busca. Las marcas salen de `demostracion.ts` y no de una lista escrita aqui
 * (`verificaciones/marcas-de-la-demostracion.ts`).
 *
 * No abre navegador. Se queda aqui igualmente porque lo que mide es un `vite build`, y
 * `yarn verificar` no construye nada: meterle uno —aunque fuera en memoria, con `write: false`— le
 * anadiria diez segundos a la orden que se ejecuta veinte veces al dia (medido el 2026-09-27:
 * `yarn build`, 9.6 s). Y no hace falta para enterarse pronto: la forma conocida de romperlo, un
 * `import` estatico de `demostracion.ts` en un archivo de produccion, ya la dice `yarn verificar`
 * (`verificaciones/la-demostracion-no-viaja-al-bundle.test.ts`). Lo que solo sabe el paquete —una
 * marca que llega por otro camino: copiada a mano, por el locale, por un modulo de pruebas importado
 * sin querer— lo dice aqui el arnes, que la CI corre en cada PR.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/** El nombre del modulo. Si el `import()` sobrevive, Vite bautiza su trozo con el. */
const MODULO = 'fuenteDeDemostracion';

/** Donde se construye el de produccion. No se versiona (`.gitignore`) y se borra al acabar. */
const DE_PRODUCCION = join(FRONTEND, 'dist-de-produccion');

/** El de demostracion, que es el que este arnes sirve y ya esta construido cuando esto corre. */
const DEL_ARNES = join(FRONTEND, 'dist');

/** Los nombres de los trozos de JavaScript de un paquete. Sin los `.map`: ver abajo. */
function trozosDe(dist: string): readonly string[] {
  // `.js` y no `.map`: los mapas de origen llevan el codigo fuente entero dentro (`sourcemap: true`
  // en `vite.config.ts`), asi que ahi el nombre aparece por otro motivo y no dice nada del paquete.
  return readdirSync(join(dist, 'assets')).filter((archivo) => archivo.endsWith('.js'));
}

test.beforeAll(() => {
  rmSync(DE_PRODUCCION, { recursive: true, force: true });
  // El de produccion, con la orden de siempre y sin `NODE_ENV` delante: es exactamente lo que
  // construiria una imagen o la CI.
  execFileSync('npx', ['vite', 'build', '--outDir', DE_PRODUCCION], { cwd: FRONTEND, stdio: 'pipe' });
});

test.afterAll(() => {
  rmSync(DE_PRODUCCION, { recursive: true, force: true });
});

test('EL CENTINELA: el paquete del arnes SI trae la fuente de demostracion', () => {
  // La otra mitad de la prueba de abajo. Sin esta, «no esta en produccion» seria verde tambien con
  // un modulo renombrado, borrado o desconectado — o sea, sin decir nada de la bandera.
  const conElNombre = trozosDe(DEL_ARNES).filter((archivo) => archivo.startsWith(MODULO));

  expect(
    conElNombre.length,
    'El paquete que sirve el arnes (`build:arnes`, con NODE_ENV=development) tendria que traer el\n' +
      `  trozo de «${MODULO}»: es el modo demostracion. Si no lo trae, la bandera no enciende nada\n` +
      '  y la prueba de abajo no estaria midiendo el plegado.',
  ).toBe(1);
});

test('y el paquete de PRODUCCION no la trae, ni la nombra', () => {
  const trozos = trozosDe(DE_PRODUCCION);
  expect(trozos.length, 'no hay ningun trozo en el paquete de produccion: ¿se construyo?').toBeGreaterThan(0);

  const conElNombre = trozos.filter((archivo) => archivo.startsWith(MODULO));
  expect(
    conElNombre,
    `Vite emitio un trozo para «${MODULO}»: el \`import()\` dinamico sobrevivio a la construccion.\n` +
      '  Las dos condiciones de `src/datos/laFuente.ts` tienen que ser constantes AL CONSTRUIR para\n' +
      '  que Rollup pliegue la condicion y se lleve el modulo por delante.',
  ).toEqual([]);

  const nombrada = trozos.filter((archivo) =>
    readFileSync(join(DE_PRODUCCION, 'assets', archivo), 'utf8').includes(MODULO),
  );
  expect(
    nombrada,
    `Estos trozos del paquete de produccion nombran «${MODULO}»:\n  ${nombrada.join('\n  ')}\n\n` +
      '  Con la demostracion dentro, un portal construido para una municipalidad puede leer de ella.',
  ).toEqual([]);
});

test('lo que SI queda en produccion es el cliente de la plataforma, con su ruta', () => {
  // Sin esto, lo de arriba pasaria en verde con un paquete que no consulta nada: lo que queda cuando
  // la demostracion se cae tiene que ser la fuente de verdad.
  const conLaRuta = trozosDe(DE_PRODUCCION).filter((archivo) =>
    readFileSync(join(DE_PRODUCCION, 'assets', archivo), 'utf8').includes('/portal/situacion'),
  );

  expect(conLaRuta.length, 'el paquete no pide `GET /portal/situacion` desde ningun sitio').toBeGreaterThan(0);
});

test('LAS MARCAS: el paquete del arnes SI trae todos los datos del artboard', () => {
  // La mitad que hace valer a la de abajo: si una marca no se encuentra ni donde tiene que estar —un
  // acento que el minificador escribe como `\u00ed`, un valor que se trocea—, «no esta en produccion»
  // seria verde sin haber buscado nada.
  const faltan = enQueArchivosEsta(DEL_ARNES)
    .filter(({ archivos }) => archivos.length === 0)
    .map(({ marca }) => marca);

  expect(
    faltan,
    'Estas marcas no aparecen en el paquete del arnes, que es la demostracion entera:\n' +
      `  ${faltan.join('\n  ')}\n\n` +
      '  Tal como se buscan, no se encontrarian tampoco en el de produccion.',
  ).toEqual([]);
});

test('y el paquete de PRODUCCION no trae ninguno: ni un nombre, ni un documento, ni un predio', () => {
  const encontradas = enQueArchivosEsta(DE_PRODUCCION)
    .filter(({ archivos }) => archivos.length > 0)
    .map(({ marca, archivos }) => `«${marca}» en ${archivos.join(', ')}`);

  expect(
    encontradas,
    'Los datos del artboard viajan en el paquete de PRODUCCION:\n' +
      `  ${encontradas.join('\n  ')}\n\n` +
      '  Los aporta la fuente de demostracion (`LaDemostracion`), y a ella solo se llega por el\n' +
      '  `import()` de `src/datos/laFuente.ts`. Un archivo de produccion que importe\n' +
      '  `src/datos/demostracion.ts` —o su locale, `es.demostracion.json`— los mete en el paquete.',
  ).toEqual([]);
});
