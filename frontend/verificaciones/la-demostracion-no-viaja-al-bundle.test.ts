// @vitest-environment node
//
// Lee archivos del disco. No es un DOM lo que necesita.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type Importacion, alcanzados, importacionesDe, importacionesDelCodigo, seCarga } from './grafo-de-imports.ts';

/**
 * **La demostracion —la fuente y sus DATOS— es SOLO de desarrollo, y se puede comprobar sin construir**
 * (issues 27 y 58).
 *
 * Portada de `rentas/frontend/verificaciones/la-siembra-es-solo-de-desarrollo.test.ts` (rentas#114).
 *
 * <h2>Que vigila, y por que estatico</h2>
 *
 * La medicion de verdad es sobre el `dist/`, y la hace `e2e/la-demostracion-no-viaja-al-bundle.spec.ts`
 * contra el bundle construido: ni la fuente, ni una sola marca de los datos del artboard (issue 58).
 * Esta guarda vigila **las formas conocidas de romperlo**, y lo hace en `yarn verificar`, que es donde
 * se entera quien escribe el cambio:
 *
 *   · **leer la bandera en tiempo de ejecucion.** Con la condicion detras de una funcion —o de
 *     `configuracion()`, o de `globalThis`— Rollup no puede plegarla, el `import()` dinamico se queda
 *     y la demostracion viaja entera. En `rentas` eso se midio: 227 205 bytes con «Rufina Medina
 *     Medina» dentro frente a 193 592 sin ella;
 *   · **importar la fuente de demostracion estaticamente.** Un `import { fuenteDeDemostracion } from …`
 *     en cualquier archivo de produccion mete el modulo en el paquete pase lo que pase con la
 *     bandera, y no hay condicion que lo salve;
 *   · **importar sus DATOS estaticamente** (issue 58): un `import { USUARIO } from …/demostracion.ts`
 *     —o de su locale, `es.demostracion.json`— hace lo mismo con el nombre, los documentos, el correo,
 *     los comprobantes y los predios del artboard, aunque la fuente se quede fuera.
 *
 * Las tres salen en verde en `yarn dev`, que es lo que las hace peligrosas: quien las escribe ve su
 * pantalla funcionando igual.
 *
 * <h2>Lo que cambio el issue 58</h2>
 *
 * Hasta el issue 58 esta cabecera decia por escrito que los datos del artboard SI viajaban: ocho
 * archivos de produccion importaban `src/datos/demostracion.ts` por su cuenta —el reductor para su
 * estado inicial, la barra para la usuaria, el paso 2 para el contribuyente, «Pagar» para los medios,
 * los dos modulos de textos para derivar el locale…—, y con ellos los datos entraban en el paquete por
 * ahi, no por la fuente. Ahora los aporta la fuente (`FuenteDelPortal.demostracion`) y los recibe
 * todo lo demas; lo que del artboard no es de nadie —la entidad, la ordenanza, el dia de corte— vive
 * en `src/datos/constantes.ts`, que si viaja. {@link ALCANZAN_LA_DEMOSTRACION} queda en un solo
 * archivo: la propia fuente de demostracion.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

const leer = (ruta: string) => readFileSync(join(FRONTEND, ruta), 'utf8');

/** La bandera. Escrita una vez aqui: si cambia de nombre, todo lo de abajo lo dice a la vez. */
const BANDERA = 'VITE_KAMAYUK_SIN_PLATAFORMA';

/** La fuente de demostracion, y el unico archivo de produccion que puede alcanzarla. */
const DEMOSTRACION = 'src/datos/fuenteDeDemostracion.ts';
const ELECCION = 'src/datos/laFuente.ts';

/**
 * El andamiaje de pruebas que SI la importa, y por que se le deja.
 *
 * `src/pruebas/portal.tsx` monta el portal en las pruebas y le pasa la fuente de demostracion por
 * omision. No entra en el paquete porque no cuelga de `main.tsx`: **solo lo importan los `*.test.tsx`**,
 * y eso no se confia a la palabra — lo comprueba la prueba de mas abajo. Un archivo de produccion que
 * lo importara meteria la demostracion en el bundle por la puerta de atras.
 */
const ANDAMIAJE = 'src/pruebas/portal.tsx';

/**
 * Los archivos de produccion que alcanzan `src/datos/demostracion.ts` —los DATOS, no la fuente— y la
 * parte del locale que los traduce, `src/i18n/locales/es.demostracion.json`. **Solo uno: la fuente de
 * demostracion**, a la que se llega por el `import()` plegable de `laFuente.ts` (issue 58).
 *
 * Escritos aqui **para que crecer la lista sea una decision**: un archivo de produccion mas que los
 * importe mete los datos en el paquete, y en `yarn dev` se ve todo igual.
 *
 * <h2>Lo que el issue 58 saco de la lista, y a donde fue cada uno</h2>
 *
 * · `src/recorrido/recorrido.ts`: la deuda y el contribuyente de partida, el sello y el correo de la
 *   cuenta, de `DatosLeidos.demostracion` (lo pone el proveedor, de la fuente).
 * · `src/marco/Barra.tsx`, `src/pasos/deudas/Deudas.tsx`, `src/pasos/pagar/Pagar.tsx`: la usuaria, el
 *   contribuyente y los medios, de `laDemostracion(estado)`.
 * · `src/pasos/comprobante/Comprobante.tsx` y `src/piezas/PortadaDelPortal.tsx`: solo querian la
 *   ordenanza, que no es de nadie y vive en `src/datos/constantes.ts`.
 * · `src/pasos/pagar/textosDeLosMedios.ts` y `src/pasos/historial/textosDelHistorial.ts`: derivan las
 *   claves del locale de los datos que se les dan, y quien se los da es la prueba del locale.
 * · `src/pasos/buscar/Buscar.tsx` e `src/pasos/identificar/Identificar.tsx` no la importaban, pero
 *   ESCRIBIAN el codigo y el DNI del contribuyente como ejemplo: ahora son `LaDemostracion.ejemplos`.
 *   Eso no lo ve esta guarda —no es un `import`—; lo vio la del paquete construido.
 */
const ALCANZAN_LA_DEMOSTRACION: readonly string[] = [DEMOSTRACION];

/** Los DATOS del artboard (issue 58) y la parte del locale que los traduce. */
const DEMOSTRACION_DATOS = 'src/datos/demostracion.ts';
const DATOS = [DEMOSTRACION_DATOS, 'src/i18n/locales/es.demostracion.json'] as const;

/** Las marcas con que el arnes busca los datos en el paquete: importan los datos para sacarlas. */
const MARCAS = 'verificaciones/marcas-de-la-demostracion.ts';

/**
 * **Lo que un archivo IMPORTA**, y no lo que nombra.
 *
 * La diferencia es la guarda entera: nombrar la demostracion en prosa —para contar por que el
 * `import()` es dinamico, que es justo lo que hay que contar— no mete nada en el paquete; importarla,
 * si. Desde el issue 63 lo dice el grafo de `import` del compilador (`grafo-de-imports.ts`): las dos
 * comillas, `export … from`, `import()` y `require`, y el archivo al que de verdad lleva cada uno. La
 * expresion regular de antes solo veia comillas simples. Un `import type` no cuenta: se borra al
 * compilar y no carga nada.
 */
function importa(ruta: string, destino: string): boolean {
  return importacionesDe(ruta).some((i) => seCarga(i) && i.archivo === destino);
}

/** Todos los `.ts`/`.tsx` bajo `src/`, con su ruta relativa al frontend. */
function fuentes(desde = join(FRONTEND, 'src')): readonly string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.tsx?$/.test(entrada) ? [relative(FRONTEND, ruta)] : [];
  });
}

const deProduccion = fuentes().filter((ruta) => !/\.test\.tsx?$/.test(ruta));

describe('AC1 — la fuente de demostracion existe y vive sola en su archivo', () => {
  it('EL CENTINELA: el archivo esta donde se dice, y `src/` se puede leer', () => {
    // Sin esto, un archivo movido dejaria a las comprobaciones de abajo mirando cadenas que no estan
    // en ninguna parte, y todas saldrian verdes afirmando que no hay nada que reprochar.
    expect(existsSync(join(FRONTEND, DEMOSTRACION)), `falta «${DEMOSTRACION}»`).toBe(true);
    expect(existsSync(join(FRONTEND, ELECCION)), `falta «${ELECCION}»`).toBe(true);
    expect(deProduccion.length).toBeGreaterThan(20);
  });

  it('y no la exporta `fuente.ts`, que es lo que importa cada pantalla por sus ganchos', () => {
    // Era su sitio hasta este issue, y es el sitio que la mete en el paquete: `src/datos/fuente.ts`
    // lo importan las pantallas para `useHistorial` y compania. Nombrarla en su cabecera —para
    // contar donde se fue— no la mete en ningun sitio; importarla, si.
    expect(importa('src/datos/fuente.ts', DEMOSTRACION)).toBe(false);
  });
});

describe('AC1 — nada de produccion alcanza la fuente si no es por el `import()` plegable', () => {
  it('solo `laFuente.ts` la nombra, y ningun otro archivo de produccion', () => {
    const culpables = deProduccion.filter(
      (ruta) =>
        ruta !== ELECCION && ruta !== DEMOSTRACION && ruta !== ANDAMIAJE && importa(ruta, DEMOSTRACION),
    );

    expect(
      culpables,
      'Estos archivos de produccion alcanzan la fuente de demostracion:\n' +
        `  ${culpables.join('\n  ')}\n\n` +
        `  Solo \`${ELECCION}\` puede, y solo por el \`import()\` dinamico detras de las dos\n` +
        '  condiciones constantes. Desde cualquier otro sitio, la demostracion viaja al paquete.',
    ).toEqual([]);
  });

  it('y el andamiaje de pruebas que la importa NO lo importa nadie de produccion', () => {
    // La excepcion de arriba vale lo que valga esto: `src/pruebas/portal.tsx` puede importarla
    // estaticamente porque no cuelga del arbol de `main.tsx`. Si un dia colgara, la demostracion
    // entraria en el paquete con el andamiaje detras.
    const culpables = deProduccion.filter((ruta) => ruta !== ANDAMIAJE && importa(ruta, ANDAMIAJE));

    expect(culpables, `Estos archivos de produccion importan \`${ANDAMIAJE}\`:\n  ${culpables.join('\n  ')}`).toEqual([]);
  });

  it('la nombra UNA vez, en un `import()` dinamico y no en un `import … from`', () => {
    // Un `import { fuenteDeDemostracion } from './fuenteDeDemostracion.ts'` mete el modulo en el
    // paquete pase lo que pase con la bandera: no hay condicion que pliegue un import estatico.
    const formas = importacionesDe(ELECCION)
      .filter((i) => i.archivo === DEMOSTRACION)
      .map((i) => i.forma);
    expect(formas, '`laFuente.ts` importa la demostracion ESTATICAMENTE: entonces viaja al paquete siempre.').toEqual([
      'dinamica',
    ]);
  });

  it('LAS DOS CONDICIONES SE LEEN AL CONSTRUIR, y van delante del `import()`', () => {
    // Es la propiedad entera del AC, y la unica forma conocida de romperla sin que nada mas se
    // entere. Por eso se comprueba el TEXTO: lo que importa no es que la condicion sea cierta, sino
    // que el empaquetador pueda evaluarla.
    const esperado = new RegExp(
      String.raw`if \(!import\.meta\.env\.DEV\) return [A-Za-z]+;` +
        String.raw`[\s\S]{0,200}?` +
        String.raw`if \(import\.meta\.env\.${BANDERA} !== 'true'\) return [A-Za-z]+;` +
        String.raw`[\s\S]{0,400}?` +
        String.raw`await import\('\./fuenteDeDemostracion\.ts'\)`,
    );

    expect(
      esperado.test(leer(ELECCION)),
      'Las dos condiciones que guardan el `import()` de la demostracion ya no se leen al CONSTRUIR.\n' +
        'Se esperaba, en este orden y antes del import:\n' +
        '  if (!import.meta.env.DEV) return <la de plataforma>;\n' +
        `  if (import.meta.env.${BANDERA} !== 'true') return <la de plataforma>;\n\n` +
        '  Vite sustituye las dos por su literal al construir y Rollup pliega la condicion, que es\n' +
        '  lo que se lleva por delante el `import()` con la demostracion dentro. Detras de una\n' +
        '  funcion, de `configuracion()` o de `globalThis`, el modulo VIAJA — y en desarrollo no se\n' +
        '  nota: la pantalla se ve igual.',
    ).toBe(true);
  });
});

describe('AC1 — la bandera esta declarada, y dice lo mismo en los tres sitios que la ponen', () => {
  it('`.env.development` la enciende: `yarn dev` a secas es la demostracion', () => {
    expect(leer('.env.development')).toContain(`${BANDERA}=true`);
  });

  it('`dev:con-plataforma` existe de verdad en el manifiesto, y la apaga', () => {
    const manifiesto = JSON.parse(leer('package.json')) as { scripts: Record<string, string | undefined> };

    expect(manifiesto.scripts['dev:con-plataforma']).toBe(`${BANDERA}=false vite`);
  });

  it('y `vitest.config.ts` la enciende igual: las pruebas corren SIN plataforma', () => {
    // Vitest corre en modo `test` y Vite carga `.env.development` solo en modo `development`. Sin
    // esta linea, las 400 y pico pruebas montarian el portal contra la plataforma: saldrian a la red
    // y a Keycloak, que es justo lo que este issue promete que no pasa.
    expect(leer('vitest.config.ts')).toContain(`env: { ${BANDERA}: 'true' }`);
  });

  it('y el ARNES construye en modo demostracion, que es lo unico que le deja recorrer el artboard', () => {
    // Medido: `vite build` fija `NODE_ENV=production` por su cuenta, asi que `import.meta.env.DEV`
    // sale `false` **tambien con `--mode development`** y el `import()` se pliega igual. La unica
    // forma de construir un paquete en modo demostracion es poner `NODE_ENV` por delante.
    //
    // Sin esto, el arnes serviria el paquete de produccion: el paso 1 consultaria a un backend que
    // en CI no esta y «Iniciar sesión» se iria a Keycloak, o sea que los cuatro caminos del
    // recorrido del artboard se caerian a la vez. El recorrido CON plataforma es del issue 28.
    const manifiesto = JSON.parse(leer('package.json')) as { scripts: Record<string, string | undefined> };

    expect(manifiesto.scripts['build:arnes']).toBe('NODE_ENV=development vite build --mode development');
    expect(leer('playwright.config.ts')).toContain('yarn build:arnes &&');
    // Y `yarn build` a secas SIGUE siendo el de produccion: es el que mide el camino del arnes.
    expect(manifiesto.scripts.build).toBe('vite build');
  });

  it('EL DOCKERFILE apaga la bandera ANTES de construir (issue 37)', () => {
    // Hasta el issue 37 esta prueba afirmaba que no habia `Dockerfile`, para ponerse roja el dia que
    // apareciera: es exactamente cuando hay que acordarse de apagar la bandera dentro. Aparecio, y se
    // convierte en lo que anunciaba: la valla de `rentas` (rentas#114), `ENV …=false` antes de
    // `RUN yarn build`. `imagen-y-despliegue.test.ts` lo mira tambien, dentro de SU etapa.
    const dockerfile = leer('Dockerfile')
      .split('\n')
      .filter((linea) => !linea.trimStart().startsWith('#'))
      .join('\n');
    const apagada = dockerfile.indexOf(`ENV ${BANDERA}=false`);
    expect(apagada, `el Dockerfile no declara \`ENV ${BANDERA}=false\``).toBeGreaterThan(-1);
    expect(apagada, 'la bandera se apaga DESPUES de construir: no sirve de nada').toBeLessThan(
      dockerfile.indexOf('RUN yarn build'),
    );
  });
});

describe('los DATOS del artboard: solo los alcanza la fuente de demostracion (issue 58)', () => {
  it.each(DATOS)('`%s` solo lo importa la fuente de demostracion', (datos) => {
    expect(existsSync(join(FRONTEND, datos)), `falta «${datos}»`).toBe(true);
    const alcanzan = deProduccion.filter((ruta) => importa(ruta, datos)).sort((a, b) => a.localeCompare(b, 'es'));

    expect(
      alcanzan,
      `Cambio quien alcanza \`${datos}\` desde produccion.\n` +
        '  Un archivo de produccion que importe los datos del artboard los mete en el paquete, pase lo\n' +
        '  que pase con la bandera: el nombre, los documentos, el correo, los comprobantes, los predios.\n' +
        '  Se reciben de la fuente (`FuenteDelPortal.demostracion`, o `laDemostracion(estado)` en una\n' +
        '  pantalla de la demostracion); lo que no es de nadie esta en `src/datos/constantes.ts`.',
    ).toEqual([...ALCANZAN_LA_DEMOSTRACION].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('y las marcas con que se busca en el paquete tampoco las importa nadie de produccion', () => {
    // `verificaciones/marcas-de-la-demostracion.ts` importa los datos para sacar de ellos lo que buscar;
    // desde `src/` meteria en el paquete justo lo que busca.
    const culpables = deProduccion.filter((ruta) => importa(ruta, MARCAS));
    expect(culpables).toEqual([]);
  });
});

/**
 * **Desde la entrada del paquete, ni la fuente, ni sus datos, ni el andamiaje** (issue 63).
 *
 * Lo de arriba mira quien importa cada cosa DE PRIMERA MANO. Esto sigue el grafo entero desde
 * `src/main.tsx` —lo que `index.html` carga—, como lo seguiria Rollup: los `import` estaticos, los
 * `export … from` y los `import()`, que parten el paquete en trozos pero viajan todos. Menos UNO, el
 * de `laFuente.ts` a la fuente de demostracion, que es el que las dos condiciones pliegan. Asi se ve
 * tambien lo que llega por un modulo intermedio que las listas no nombran: un `.js` del arbol, un
 * modulo de fuera de `src/`, un `export … from` de paso.
 */
describe('desde `src/main.tsx`, lo de la demostracion solo se alcanza por el `import()` plegable', () => {
  const ENTRADA = 'src/main.tsx';
  const esElPlegable = (i: Importacion, de: string) => de === ELECCION && i.archivo === DEMOSTRACION && i.forma === 'dinamica';
  const LO_DE_LA_DEMOSTRACION = [DEMOSTRACION, ...DATOS, ANDAMIAJE, MARCAS];

  it('EL CENTINELA: con ese `import()`, la fuente y sus datos SI se alcanzan, y por el', () => {
    // La otra mitad: sin ella, «no se alcanza» seria verde con un grafo que no resolviera nada.
    const todo = alcanzados([ENTRADA], seCarga);
    for (const datos of [DEMOSTRACION, ...DATOS]) {
      expect(todo.get(datos), `desde ${ENTRADA} no se llega a ${datos} ni por su \`import()\``).toContain(ELECCION);
    }
  });

  it('y sin el, no se alcanza nada de ella: ni la fuente, ni sus datos, ni el andamiaje, ni las marcas', () => {
    const alcanzado = alcanzados([ENTRADA], (i, de) => seCarga(i) && !esElPlegable(i, de));
    const caminos = LO_DE_LA_DEMOSTRACION.flatMap((destino) => {
      const camino = alcanzado.get(destino);
      return camino === undefined ? [] : [camino.join(' → ')];
    });

    expect(
      caminos,
      'Esto llega al paquete por otro camino que el `import()` plegable de `laFuente.ts`:\n' +
        `  ${caminos.join('\n  ')}\n\n` +
        '  Viaja pase lo que pase con la bandera.',
    ).toEqual([]);
  });

  it('EL CENTINELA del lector: las dos comillas, `export … from`, `import()`, `require`, y un `import type` que no carga', () => {
    const leidas = importacionesDelCodigo(
      [
        'import { USUARIO } from "./demostracion.ts";',
        "export { CONTRIBUYENTE } from './demostracion.ts';",
        "const f = () => import('./fuenteDeDemostracion.ts');",
        "const g = require('./demostracion.ts');",
        "import type { LaDemostracion } from './tipos.ts';",
        "// import { nada } from './comentario.ts';",
      ].join('\n'),
      'src/datos/sintetico.ts',
    );
    expect(leidas.map((i) => [i.forma, i.archivo, i.soloTipos])).toEqual([
      ['estatica', DEMOSTRACION_DATOS, false],
      ['reexporta', DEMOSTRACION_DATOS, false],
      ['dinamica', DEMOSTRACION, false],
      ['require', DEMOSTRACION_DATOS, false],
      ['estatica', 'src/datos/tipos.ts', true],
    ]);
  });
});
