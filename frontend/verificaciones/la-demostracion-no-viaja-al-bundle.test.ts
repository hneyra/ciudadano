// @vitest-environment node
//
// Lee archivos del disco. No es un DOM lo que necesita.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * **La fuente de demostracion es SOLO de desarrollo, y se puede comprobar sin construir** (issue 27).
 *
 * Portada de `rentas/frontend/verificaciones/la-siembra-es-solo-de-desarrollo.test.ts` (rentas#114).
 *
 * <h2>Que vigila, y por que estatico</h2>
 *
 * La medicion de verdad es sobre el `dist/`, y la hace `e2e/la-demostracion-no-viaja-al-bundle.spec.ts`
 * contra el bundle construido. Esta guarda vigila **las dos formas conocidas de romperlo**, y lo hace
 * en `yarn verificar`, que es donde se entera quien escribe el cambio:
 *
 *   · **leer la bandera en tiempo de ejecucion.** Con la condicion detras de una funcion —o de
 *     `configuracion()`, o de `globalThis`— Rollup no puede plegarla, el `import()` dinamico se queda
 *     y la demostracion viaja entera. En `rentas` eso se midio: 227 205 bytes con «Rufina Medina
 *     Medina» dentro frente a 193 592 sin ella;
 *   · **importar la fuente de demostracion estaticamente.** Un `import { fuenteDeDemostracion } from …`
 *     en cualquier archivo de produccion mete el modulo en el paquete pase lo que pase con la
 *     bandera, y no hay condicion que lo salve.
 *
 * Las dos salen en verde en `yarn dev`, que es lo que las hace peligrosas: quien las escribe ve su
 * pantalla funcionando igual.
 *
 * <h2>Lo que esta guarda NO afirma, y hay que decirlo entero</h2>
 *
 * **Que los datos del artboard no esten en el paquete.** Hoy SI estan: el recorrido de pasos sigue
 * siendo el de la demostracion —lo cambia el issue 28— y `src/recorrido/recorrido.ts` lee `DEUDAS` de
 * forma estatica, con lo que `src/datos/demostracion.ts` entra en el bundle por ahi, no por la fuente.
 * Lo que esta entrega saca del paquete de produccion es **la fuente**: el objeto que contesta en vez
 * del servidor. Con el fuera, un bundle de produccion no tiene forma de leer de la demostracion
 * aunque alguien encienda la bandera al construir.
 *
 * Y para que eso no crezca en silencio, {@link ALCANZAN_LA_DEMOSTRACION} fija **quienes** la alcanzan
 * hoy: el dia que uno mas la importe, esta guarda lo dice y hay que decidirlo a proposito.
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
 * Los archivos de produccion que hoy alcanzan `src/datos/demostracion.ts` —los DATOS, no la fuente—.
 *
 * Son los del recorrido de la demostracion, que sigue viviendo en el paquete: el portal construido
 * con la bandera encendida ES ese recorrido. Escritos aqui **para que crecer la lista sea una
 * decision**: sin esto, un import mas pasaria sin que nada lo dijera y el «no viaja al bundle» del
 * titulo se iria quedando cada vez menos cierto.
 *
 * <h2>Lo que el issue 28 movio, y por que la lista no menguo</h2>
 *
 * · `src/pasos/buscar/Buscar.tsx` **sale**: lo unico que sacaba de la demostracion era `ORDENANZA`,
 *   el aviso de la amnistia, y eso se mudo a `src/piezas/PortadaDelPortal.tsx`, que las dos puertas
 *   de entrada comparten (el paso 1 de demostracion y el «Entrar» con plataforma).
 * · `src/piezas/PortadaDelPortal.tsx` **entra** por lo mismo.
 * · `src/recorrido/recorrido.ts` **se queda**, y ahora tambien por `CONTRIBUYENTE`: el estado del
 *   recorrido arranca con la deuda y el contribuyente del artboard, y con plataforma los sustituye
 *   `situacionLeida`. Sacar los datos del paquete pide que el recorrido no tenga estado inicial de
 *   demostracion, que es otra entrega.
 *
 * El neto es cero: uno entra, uno sale.
 */
const ALCANZAN_LA_DEMOSTRACION: readonly string[] = [
  DEMOSTRACION,
  'src/marco/Barra.tsx',
  'src/pasos/comprobante/Comprobante.tsx',
  'src/pasos/deudas/Deudas.tsx',
  'src/pasos/historial/textosDelHistorial.ts',
  'src/pasos/pagar/Pagar.tsx',
  'src/pasos/pagar/textosDeLosMedios.ts',
  'src/piezas/PortadaDelPortal.tsx',
  'src/recorrido/recorrido.ts',
];

/**
 * **Lo que un archivo IMPORTA**, y no lo que nombra.
 *
 * La diferencia es la guarda entera: nombrar la demostracion en prosa —para contar por que el
 * `import()` es dinamico, que es justo lo que hay que contar— no mete nada en el paquete; importarla,
 * si. Con una busqueda de texto a secas, esta guarda se pondria roja por sus propios comentarios y la
 * salida seria borrarlos.
 *
 * Coge las tres formas: `from '…'`, `import('…')` e `import '…'`.
 */
function importaDe(texto: string): readonly string[] {
  return [...texto.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map((coincidencia) => coincidencia[1] ?? '');
}

/** Si ese archivo importa algo cuyo especificador case con el patron. */
function importa(ruta: string, patron: RegExp): boolean {
  return importaDe(leer(ruta)).some((especificador) => patron.test(especificador));
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
    expect(importa('src/datos/fuente.ts', /fuenteDeDemostracion/)).toBe(false);
  });
});

describe('AC1 — nada de produccion alcanza la fuente si no es por el `import()` plegable', () => {
  it('solo `laFuente.ts` la nombra, y ningun otro archivo de produccion', () => {
    const culpables = deProduccion.filter(
      (ruta) =>
        ruta !== ELECCION && ruta !== DEMOSTRACION && ruta !== ANDAMIAJE && importa(ruta, /fuenteDeDemostracion/),
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
    const culpables = deProduccion.filter((ruta) => ruta !== ANDAMIAJE && importa(ruta, /pruebas\/portal/));

    expect(culpables, `Estos archivos de produccion importan \`${ANDAMIAJE}\`:\n  ${culpables.join('\n  ')}`).toEqual([]);
  });

  it('la nombra UNA vez, en un `import()` dinamico y no en un `import … from`', () => {
    const eleccion = leer(ELECCION);

    // Un `import { fuenteDeDemostracion } from './fuenteDeDemostracion.ts'` mete el modulo en el
    // paquete pase lo que pase con la bandera: no hay condicion que pliegue un import estatico.
    expect(
      /from\s+'[^']*fuenteDeDemostracion/.test(eleccion),
      '`laFuente.ts` importa la demostracion ESTATICAMENTE: entonces viaja al paquete siempre.',
    ).toBe(false);
    expect(eleccion.match(/import\('\.\/fuenteDeDemostracion\.ts'\)/g)).toHaveLength(1);
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

describe('AC1 — los DATOS del artboard: quienes los alcanzan hoy, y no uno mas', () => {
  it('la lista es exactamente la del recorrido de la demostracion, y no uno mas', () => {
    const alcanzan = deProduccion
      .filter((ruta) => importa(ruta, /(^|\/)demostracion\.ts$/))
      .sort((a, b) => a.localeCompare(b, 'es'));

    expect(
      alcanzan,
      'Cambio quien alcanza `src/datos/demostracion.ts` desde produccion.\n' +
        '  Los datos del artboard estan en el paquete por estos archivos, y no por la fuente. Si la\n' +
        '  lista CRECE, hay que decidirlo a proposito; si MENGUA, se actualiza aqui y se cuenta en\n' +
        '  el PR.',
    ).toEqual([...ALCANZAN_LA_DEMOSTRACION].sort((a, b) => a.localeCompare(b, 'es')));
  });
});
