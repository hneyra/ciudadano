/**
 * **Las cifras de `CLAUDE.md` las escribe un guion, no una mano** (issue 64).
 *
 * Portado de `kamayuk-lib/paquetes/verificaciones/cifras.mjs` (kamayuk-lib#128), que es el modelo y
 * se lee antes de cambiar nada de aqui: `@kamayuk/verificaciones` no lo exporta, y es un guion y no
 * una prohibicion. Lo que cambia: aqui no hay paquetes que repartir, sino dos suites —la de `vitest`
 * y el arnes de Playwright—, y `CLAUDE.md` vive en la raiz del repositorio, un nivel por encima.
 *
 * <h2>El defecto del que sale</h2>
 *
 * `CLAUDE.md` decia cuantas pruebas y cuantos caminos del arnes hay, escritos a mano en cada PR: se
 * quedaban viejos sin que nada se pusiera rojo, y dos PR a la vez chocaban en la misma cifra.
 *
 * <h2>Que hace</h2>
 *
 *     yarn cifras                                   # corre la suite, mide y reescribe
 *     yarn cifras --comprobar --informe <json>      # lee el informe de una corrida y sale con RC=1
 *                                                   # si alguna cifra escrita no es la medida
 *
 * Las pruebas se cuentan del **informe JSON de una corrida de `vitest run`** con los argumentos de
 * `yarn test` (leidos de `package.json`, no copiados). `yarn verificar` le pide ese informe a su propio
 * `yarn test` y se lo pasa a `--comprobar`, asi que comprobar no vuelve a correr nada: medido en el
 * issue 64, `vitest list` tardaba 4 min 36 s en esta maquina —mas que la suite entera—. Los caminos
 * del arnes se cuentan con `playwright test --list --reporter=json`, que no construye ni sirve nada
 * (1.5 s). Reescribe **solo** el texto entre dos marcadores de una misma linea:
 *
 *     <!-- cifras:<clave> -->…<!-- /cifras -->
 *
 * con las claves de `CLAVES`. Lo de fuera de los marcadores no lo toca. **Un conflicto en una cifra se
 * resuelve ejecutando esto, no sumando.**
 *
 * <h2>Lo que NO deja pasar en verde</h2>
 *
 *   - una clave que falta en `CLAUDE.md`, o un marcador con una clave que no existe;
 *   - un marcador que abre y no cierra en la misma linea;
 *   - un `.md` del repositorio con un marcador que no esta en `DONDE_HAY_CIFRAS`;
 *   - una medida vacia: si no se recogiera ni una prueba, reescribir seria escribir ceros.
 *
 * Las cifras que exigen construir —los trozos del paquete y sus kB— no se miden aqui: `CLAUDE.md`
 * las da como medida fechada de un issue.
 */

import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** La raiz de `frontend/`, donde vive este guion. */
const RAIZ = dirname(fileURLToPath(import.meta.url));

/** La raiz del repositorio, donde viven `CLAUDE.md` y los demas `.md`. */
const RAIZ_DEL_REPO = join(RAIZ, '..');

/**
 * Donde hay cifras, desde la raiz del repositorio. Una lista escrita y no un barrido de todos los
 * `.md`: los ADR de `docs/adr/` citan cifras de su dia, y reescribirlas seria falsificar la historia.
 *
 * @type {readonly string[]}
 */
export const DONDE_HAY_CIFRAS = ['CLAUDE.md'];

/**
 * Las claves que se miden, y la que tiene que llevar cada archivo de `DONDE_HAY_CIFRAS`.
 *
 * @type {readonly ('pruebas' | 'arnes')[]}
 */
export const CLAVES = ['pruebas', 'arnes'];

/** Un marcador entero, con su texto: abre y cierra en la misma linea. */
const MARCADOR = /<!-- cifras:([a-z0-9-]+) -->(.*?)<!-- \/cifras -->/g;

/** Solo la apertura: sirve para contar las que no cierran. */
const APERTURA = /<!-- cifras:([a-z0-9-]+) -->/g;

/**
 * @typedef {{ archivos: number, casos: number }} Suite
 * @typedef {{ pruebas: Suite, arnes: Suite }} Medida
 * @typedef {{ archivo: string, linea: number, clave: string, escrito: string, medido: string }} Diferencia
 */

// ---------------------------------------------------------------------------------------------
// Leer las ordenes de `package.json`
// ---------------------------------------------------------------------------------------------

/**
 * Parte una orden de `package.json` en palabras, como lo haria el shell para una orden SIMPLE:
 * espacios, y comillas simples o dobles. Una orden compuesta (`&&`, `;`, `|`) o con comillas sin
 * cerrar se dice lanzando, en vez de contar otra cosa.
 *
 * @param {string} orden
 * @returns {string[]}
 */
export function partirOrden(orden) {
  /** @type {string[]} */
  const palabras = [];
  let actual = '';
  let hayPalabra = false;
  /** @type {string | null} */
  let comilla = null;
  for (const letra of orden) {
    if (comilla !== null) {
      if (letra === comilla) comilla = null;
      else actual += letra;
      continue;
    }
    if (letra === "'" || letra === '"') {
      comilla = letra;
      hayPalabra = true;
      continue;
    }
    if (/\s/.test(letra)) {
      if (hayPalabra) palabras.push(actual);
      actual = '';
      hayPalabra = false;
      continue;
    }
    if (letra === '&' || letra === ';' || letra === '|') {
      throw new Error(`«${orden}» es una orden compuesta, y esto solo sabe leer una simple.`);
    }
    actual += letra;
    hayPalabra = true;
  }
  if (comilla !== null) throw new Error(`«${orden}» deja una comilla ${comilla} sin cerrar.`);
  if (hayPalabra) palabras.push(actual);
  return palabras;
}

/**
 * Los argumentos que la orden `test` le pasa a `vitest run`, para correr la misma suite al medir.
 *
 * @param {string | undefined} orden
 * @returns {string[]}
 */
export function argumentosDeVitest(orden) {
  if (orden === undefined) {
    throw new Error('`package.json` no tiene la orden «test», y es la que dice que se cuenta.');
  }
  const palabras = partirOrden(orden);
  if (palabras[0] !== 'vitest' || palabras[1] !== 'run') {
    throw new Error(
      `La orden «test» es «${orden}» y no empieza por «vitest run»: no se sabe que cuenta. ` +
        'Contar otra cosa que lo que corre seria escribir una cifra de otra suite.',
    );
  }
  return palabras.slice(2);
}

// ---------------------------------------------------------------------------------------------
// Medir
// ---------------------------------------------------------------------------------------------

/**
 * Cuantos casos y en cuantos archivos, del informe JSON de `vitest run --reporter=json`: un
 * `testResults` por archivo, y `numTotalTests`.
 *
 * @param {{ numTotalTests?: unknown, testResults?: readonly unknown[] }} informe
 * @returns {Suite}
 */
export function suiteDeVitest(informe) {
  if (typeof informe.numTotalTests !== 'number' || !Array.isArray(informe.testResults)) {
    throw new Error('El informe no es el de `vitest run --reporter=json`: le faltan `numTotalTests` o `testResults`.');
  }
  return { archivos: informe.testResults.length, casos: informe.numTotalTests };
}

/**
 * Cuantos caminos y en cuantas especificaciones, del informe JSON de `playwright test --list`: los
 * `specs` de cada `suite`, anidadas, y un camino por cada `test` de cada `spec` (uno por proyecto).
 *
 * @param {{ suites?: readonly unknown[] }} informe
 * @returns {Suite}
 */
export function suiteDePlaywright(informe) {
  /** @type {Set<string>} */
  const archivos = new Set();
  let casos = 0;
  /** @param {any} suite */
  const recorrer = (suite) => {
    for (const spec of suite.specs ?? []) {
      archivos.add(String(spec.file));
      casos += (spec.tests ?? []).length;
    }
    for (const hija of suite.suites ?? []) recorrer(hija);
  };
  for (const suite of informe.suites ?? []) recorrer(suite);
  return { archivos: archivos.size, casos };
}

// ---------------------------------------------------------------------------------------------
// Escribir
// ---------------------------------------------------------------------------------------------

/** @param {number} n @param {string} una @param {string} varias */
function cuantas(n, una, varias) {
  return `${String(n)} ${n === 1 ? una : varias}`;
}

/**
 * El texto que va entre los marcadores: la forma que `CLAUDE.md` ya escribia a mano.
 *
 * @param {string} clave
 * @param {Medida} medida
 * @returns {string}
 */
export function textoDe(clave, medida) {
  if (clave === 'pruebas') {
    return `**${cuantas(medida.pruebas.archivos, 'archivo', 'archivos')}, ${cuantas(medida.pruebas.casos, 'prueba', 'pruebas')}**`;
  }
  if (clave === 'arnes') {
    return `**${cuantas(medida.arnes.archivos, 'especificacion', 'especificaciones')}, ${cuantas(medida.arnes.casos, 'camino', 'caminos')}**`;
  }
  throw new Error(`«${clave}» no es ninguna clave de cifras.`);
}

/**
 * Reescribe las cifras de un archivo, y dice que cambio y que no pudo leer. Pura: recibe el texto y
 * devuelve el texto.
 *
 * @param {string} texto
 * @param {Medida} medida
 * @param {string} archivo
 * @returns {{ texto: string, diferencias: Diferencia[], problemas: string[] }}
 */
export function reescribir(texto, medida, archivo) {
  /** @type {Diferencia[]} */
  const diferencias = [];
  /** @type {string[]} */
  const problemas = [];
  /** @type {Set<string>} */
  const vistas = new Set();

  const lineas = texto.split('\n').map((linea, indice) => {
    const numero = indice + 1;
    if ([...linea.matchAll(APERTURA)].length !== [...linea.matchAll(MARCADOR)].length) {
      problemas.push(
        `${archivo}:${String(numero)}: un marcador «cifras» abre y no cierra en la misma linea con ` +
          '«<!-- /cifras -->». Lo que habria entre medias no lo leeria nadie.',
      );
      return linea;
    }
    return linea.replace(MARCADOR, (entero, clave, escrito) => {
      if (!(/** @type {readonly string[]} */ (CLAVES)).includes(clave)) {
        problemas.push(
          `${archivo}:${String(numero)}: «cifras:${clave}» no es ninguna clave. Las claves son: ${CLAVES.join(', ')}.`,
        );
        return entero;
      }
      vistas.add(clave);
      const medido = textoDe(clave, medida);
      if (escrito !== medido) diferencias.push({ archivo, linea: numero, clave, escrito, medido });
      return `<!-- cifras:${clave} -->${medido}<!-- /cifras -->`;
    });
  });

  for (const clave of CLAVES) {
    if (!vistas.has(clave)) {
      problemas.push(
        `${archivo}: falta el marcador «cifras:${clave}». Una cifra sin marcador no la mide nadie, y se ` +
          'queda vieja en verde.',
      );
    }
  }

  return { texto: lineas.join('\n'), diferencias, problemas };
}

/**
 * Los `.md` que llevan un marcador de cifras y no estan en `DONDE_HAY_CIFRAS`, con la linea del
 * primero: un marcador asi parece una cifra medida y no lo mide nadie.
 *
 * @param {readonly { archivo: string, texto: string }[]} archivos  Rutas desde la raiz del repositorio.
 * @returns {string[]}  `archivo:linea`
 */
export function marcadoresSinMedir(archivos) {
  const unMarcador = new RegExp(APERTURA.source);
  return archivos.flatMap(({ archivo, texto }) => {
    if (DONDE_HAY_CIFRAS.includes(archivo)) return [];
    const indice = texto.split('\n').findIndex((linea) => unMarcador.test(linea));
    return indice < 0 ? [] : [`${archivo}:${String(indice + 1)}`];
  });
}

/**
 * Como se dice una diferencia: lo escrito y lo medido, enteros.
 *
 * @param {Diferencia} diferencia
 * @returns {string}
 */
export function describir(diferencia) {
  return (
    `  · ${diferencia.archivo}:${String(diferencia.linea)}, «cifras:${diferencia.clave}»\n` +
    `      escrito: ${diferencia.escrito}\n` +
    `      medido:  ${diferencia.medido}`
  );
}

/**
 * **Lo que decide el guion**: con la medida y el texto de cada archivo, que codigo de salida, que se
 * dice y que se escribe. No toca el disco ni corre nada; `principal()` solo lee, llama a esto y hace
 * lo que dice (lo comprueba `las-cifras-las-escribe-un-guion.test.ts` corriendo el guion como proceso).
 *
 * Los codigos: **2** si la medida viene vacia; **1** si hay una cifra que no se puede leer, en los dos
 * modos, o si con `--comprobar` alguna escrita no es la medida; **0** en lo demas.
 *
 * @param {{ comprobar: boolean, medida: Medida, archivos: readonly { archivo: string, texto: string }[] }} entrada
 * @returns {{ codigo: 0 | 1 | 2, informe: string[], porEscribir: { archivo: string, texto: string }[] }}
 */
export function decidir({ comprobar, medida, archivos }) {
  if (medida.pruebas.casos === 0 || medida.arnes.casos === 0) {
    return {
      codigo: 2,
      informe: ['MAL: la medida vino vacia (ni una prueba, o ni un camino). Escribir eso seria escribir ceros.'],
      porEscribir: [],
    };
  }

  /** @type {string[]} */
  const problemas = [];
  /** @type {Diferencia[]} */
  const diferencias = [];
  /** @type {{ archivo: string, texto: string }[]} */
  const porEscribir = [];
  for (const { archivo, texto } of archivos) {
    const resultado = reescribir(texto, medida, archivo);
    problemas.push(...resultado.problemas);
    diferencias.push(...resultado.diferencias);
    if (resultado.texto !== texto) porEscribir.push({ archivo, texto: resultado.texto });
  }

  if (problemas.length > 0) {
    return {
      codigo: 1,
      informe: ['', 'FALLO: hay cifras que no se pueden leer, y no se ha escrito nada.', '', ...problemas.map((p) => `  · ${p}`), ''],
      porEscribir: [],
    };
  }

  const resumen = `${textoDe('pruebas', medida)} y ${textoDe('arnes', medida)}`;
  if (comprobar) {
    if (diferencias.length > 0) {
      return {
        codigo: 1,
        informe: [
          '',
          'FALLO: las cifras escritas no son las medidas.',
          '',
          ...diferencias.map(describir),
          '',
          '  Una cifra no se corrige a mano: se ejecuta `yarn cifras`, que la vuelve a medir y reescribe',
          '  solo el texto entre sus marcadores.',
          '',
        ],
        porEscribir: [],
      };
    }
    return { codigo: 0, informe: [`Las cifras escritas son las medidas: ${resumen}`], porEscribir: [] };
  }

  if (diferencias.length === 0) return { codigo: 0, informe: [`Las cifras ya eran las medidas: ${resumen}`], porEscribir };
  return { codigo: 0, informe: ['Cifras reescritas con lo medido:', ...diferencias.map(describir)], porEscribir };
}

// ---------------------------------------------------------------------------------------------
// El guion
// ---------------------------------------------------------------------------------------------

// Se ejecuta SOLO cuando se invoca como guion: importarlo no hace nada, y asi su prueba llama a las
// funciones de arriba sin correr `vitest` dentro de `vitest`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal();
}

/**
 * El binario de un paquete de `node_modules`, resuelto desde este archivo.
 *
 * @param {string} paquete
 * @param {string} nombre
 */
function binarioDe(paquete, nombre) {
  const manifiesto = createRequire(import.meta.url).resolve(`${paquete}/package.json`);
  /** @type {{ bin: string | Record<string, string> }} */
  const leido = JSON.parse(readFileSync(manifiesto, 'utf8'));
  const bin = typeof leido.bin === 'string' ? leido.bin : leido.bin[nombre];
  if (bin === undefined) throw new Error(`«${paquete}» no publica el binario «${nombre}».`);
  return join(dirname(manifiesto), bin);
}

/**
 * Corre un binario de Node y devuelve lo que escribio en el JSON que se le pide, por argumento o por
 * variable de entorno. Con `aunqueFalle`, un RC distinto de 0 no para si el JSON se escribio: una
 * prueba en rojo no cambia cuantas hay.
 *
 * @param {string} binario
 * @param {(salida: string) => string[]} argumentos
 * @param {(salida: string) => Record<string, string>} [entorno]
 * @param {{ aunqueFalle?: boolean }} [opciones]
 * @returns {any}
 */
function correrYLeer(binario, argumentos, entorno = () => ({}), { aunqueFalle = false } = {}) {
  const carpeta = mkdtempSync(join(tmpdir(), 'ciudadano-cifras-'));
  const salida = join(carpeta, 'lista.json');
  try {
    try {
      execFileSync(process.execPath, [binario, ...argumentos(salida)], {
        cwd: RAIZ,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ...entorno(salida) },
      });
    } catch (error) {
      if (!aunqueFalle || !existsSync(salida)) throw error;
    }
    return JSON.parse(readFileSync(salida, 'utf8'));
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
}

/**
 * Las opciones: `--comprobar`, y `--informe <ruta>` (desde `frontend/`). Cualquier otra, o un
 * `--informe` sin ruta, sale con RC=2.
 *
 * @param {readonly string[]} argumentos
 * @returns {{ comprobar: boolean, rutaDelInforme: string | null }}
 */
function leerLasOpciones(argumentos) {
  let comprobar = false;
  /** @type {string | null} */
  let rutaDelInforme = null;
  for (let i = 0; i < argumentos.length; i += 1) {
    const opcion = argumentos[i];
    if (opcion === '--comprobar') {
      comprobar = true;
    } else if (opcion === '--informe' && argumentos[i + 1] !== undefined) {
      rutaDelInforme = argumentos[i + 1] ?? null;
      i += 1;
    } else {
      console.error(`Opcion desconocida o incompleta: ${String(opcion)}. Son --comprobar e --informe <ruta>.`);
      process.exit(2);
    }
  }
  return { comprobar, rutaDelInforme };
}

/**
 * Lee, mide, llama a `decidir()` y hace lo que dice: escribe `porEscribir`, dice `informe` y sale con
 * `codigo`. No decide nada.
 */
function principal() {
  const { comprobar, rutaDelInforme } = leerLasOpciones(process.argv.slice(2));

  /** @type {{ scripts: Record<string, string> }} */
  const manifiesto = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  const deVitest = argumentosDeVitest(manifiesto.scripts.test);
  const pruebas = suiteDeVitest(
    rutaDelInforme === null
      ? correrYLeer(
          binarioDe('vitest', 'vitest'),
          (salida) => ['run', ...deVitest, '--reporter=json', `--outputFile.json=${salida}`],
          () => ({}),
          { aunqueFalle: true },
        )
      : JSON.parse(readFileSync(join(RAIZ, rutaDelInforme), 'utf8')),
  );
  const arnes = suiteDePlaywright(
    correrYLeer(
      binarioDe('@playwright/test', 'playwright'),
      () => ['test', '--list', '--reporter=json'],
      (salida) => ({ PLAYWRIGHT_JSON_OUTPUT_NAME: salida }),
    ),
  );

  const { codigo, informe, porEscribir } = decidir({
    comprobar,
    medida: { pruebas, arnes },
    archivos: DONDE_HAY_CIFRAS.map((archivo) => ({
      archivo,
      texto: readFileSync(join(RAIZ_DEL_REPO, archivo), 'utf8'),
    })),
  });

  for (const { archivo, texto } of porEscribir) writeFileSync(join(RAIZ_DEL_REPO, archivo), texto);
  for (const linea of informe) (codigo === 0 ? console.log : console.error)(linea);
  if (codigo !== 0) process.exit(codigo);
}
