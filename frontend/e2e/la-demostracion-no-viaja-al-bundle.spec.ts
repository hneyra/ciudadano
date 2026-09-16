import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

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
 * <h2>Lo que este camino NO afirma</h2>
 *
 * Que los datos del artboard no esten en el paquete: hoy si estan, porque el recorrido de pasos
 * sigue siendo el de la demostracion y `src/recorrido/recorrido.ts` los importa. Eso lo cambia el
 * issue 28. Lo que se mide aqui es que **la FUENTE de demostracion** —el objeto que contesta en vez
 * del servidor— no llega al paquete de produccion, que es lo que impide que un portal construido
 * para una municipalidad pueda leer de ella.
 *
 * No abre navegador, y es el unico camino de este arnes que no lo hace. Se queda aqui igualmente
 * porque lo que mide es un `vite build`, y `yarn verificar` no construye nada: meterle uno le
 * anadiria trece segundos a la orden que se ejecuta veinte veces al dia.
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
