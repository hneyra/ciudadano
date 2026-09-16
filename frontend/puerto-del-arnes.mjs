import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readlinkSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * **El puerto del arnes sale del ARBOL, no de una constante.** Portado de
 * `rentas/frontend/puerto-del-arnes.mjs` (rentas#148) en el issue 11, con la base `/portal/`.
 *
 * <h2>Lo que paso en `rentas`, y esta medido alli</h2>
 *
 * `playwright.config.ts` fijaba el 4173 en tres sitios —`baseURL`, `webServer.url` y el `--port`—.
 * Con seis worktrees trabajando a la vez, el arnes de una rama midio el bundle de otra al cerrar
 * rentas#140, y dio `Received: 0`: un rojo que no dice nada del puerto y se parece a un defecto propio.
 * Aqui el riesgo es el mismo, y con un vecino mas: el arnes de `rentas` corre en la misma maquina, y
 * los worktrees de este repositorio tambien.
 *
 * <h2>Por que el mecanismo es peor que una molestia</h2>
 *
 * Playwright comprueba el puerto UNA vez, antes de lanzar el comando
 * (`_startProcess` → `isAlreadyAvailable`), y despues **carrera** el fin del proceso contra
 * la disponibilidad de la URL (`_waitForProcess` → `Promise.race`). Entre las dos cosas hay
 * un `yarn build` entero. Si el servidor ajeno aparece ahi dentro, el `vite preview` de esta
 * rama muere por `--strictPort`... y la URL contesta igual, porque contesta el otro. La
 * corrida sigue, y mide el bundle equivocado. Verde, midiendo otra cosa.
 *
 * <h2>Por que derivado de la ruta y no un puerto libre cualquiera</h2>
 *
 * Lo midio rentas#148: un `listen(0)` da un puerto distinto en cada corrida, y entonces un
 * `vite preview` colgado no vuelve a estorbar a nadie y se acumula sin que nadie lo vea. Derivado de
 * la ruta del arbol, **el puerto se puede nombrar antes de correr**, la corrida de ayer y la de hoy
 * chocan con el mismo obstaculo, y un `preview` colgado de ESTE arbol lo caza la comprobacion de abajo.
 *
 * <h2>`--strictPort` se queda</h2>
 *
 * Sin el, Vite se mueve de puerto en silencio y el `baseURL` se queda donde estaba — que es
 * exactamente «medir el servidor del otro». El problema nunca fue la rigidez: era que el
 * puerto fuese fijo.
 */

/** Este directorio: la raiz del frontend. El arbol al que pertenece este arnes. */
const RAIZ = dirname(fileURLToPath(import.meta.url));

/**
 * El puerto de siempre, y el que se usa **en CI**.
 *
 * Ahi hay un solo arbol y ningun vecino: el puerto por omision de `vite preview`, y una variable menos
 * de la que dudar cuando un arnes falle en la nube.
 */
const PUERTO_DE_CI = 4173;

/**
 * La banda de la que sale el puerto de un arbol de trabajo: **entre los dos puertos de Vite**.
 *
 * Empieza en el siguiente al de `vite preview` (4173) y termina en el anterior al de
 * `vite dev` (5173), asi que ni el arnes de CI ni un `yarn dev` abierto —el de `rentas`, 5173, o el de
 * este portal, 5174— caen nunca dentro. Son 999 puertos; si dos arboles caen en el mismo, lo dice
 * `comprobarQueElPuertoEstaLibre`.
 */
const PRIMERO = 4174;
const ULTIMO = 5172;

/** La variable con que se pide otro puerto a mano, cuando el derivado esta ocupado por algo fijo. */
export const VARIABLE = 'KAMAYUK_E2E_PUERTO';

/**
 * El puerto de un arbol, derivado de su ruta absoluta.
 *
 * SHA-256 y no una suma casera: `ciudadano-10` y `ciudadano-11` se diferencian en un caracter, y
 * un hash debil los manda al mismo sitio (rentas#148 lo midio con sus ocho rutas: ocho puertos).
 *
 * @param {string} raiz Ruta absoluta del arbol.
 * @returns {number}
 */
export function puertoDerivadoDe(raiz) {
  const revuelto = createHash('sha256').update(raiz).digest().readUInt32BE(0);
  return PRIMERO + (revuelto % (ULTIMO - PRIMERO + 1));
}

/**
 * De donde sale el puerto de esta corrida. Puro: la prueba lo llama con entornos de mentira.
 *
 * @param {{ raiz: string, ci: boolean, pedido?: string | undefined }} entorno
 * @returns {{ puerto: number, motivo: string }}
 */
export function elegirElPuerto({ raiz, ci, pedido }) {
  if (pedido !== undefined && pedido !== '') {
    const puerto = Number(pedido);
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535)
      throw new Error(`«${VARIABLE}=${pedido}» no es un puerto: tiene que ser un entero de 1 a 65535.`);
    return { puerto, motivo: `pedido por ${VARIABLE}` };
  }
  // En CI hay un solo arbol: el de siempre, para que un arnes que falle alli no obligue a
  // averiguar antes en que puerto corrio.
  if (ci) return { puerto: PUERTO_DE_CI, motivo: 'el de siempre, porque esto es CI' };
  return { puerto: puertoDerivadoDe(raiz), motivo: `derivado de «${raiz}»` };
}

const ELEGIDO = elegirElPuerto({
  raiz: RAIZ,
  ci: process.env.CI !== undefined,
  pedido: process.env[VARIABLE],
});

/** El puerto en que sirve —y solo en el que sirve— el arnes de ESTE arbol. */
export const PUERTO = ELEGIDO.puerto;

/** Como se eligio, en una frase, para poder decirlo en los mensajes. */
export const MOTIVO = ELEGIDO.motivo;

/**
 * La raiz de la aplicacion servida.
 *
 * `/portal/` es la `base` de `vite.config.ts`. Con otra, `vite preview` contesta 404 en la raiz y el
 * arnes esperaria 120 s a un servidor que si esta.
 */
export const URL_DEL_ARNES = `http://localhost:${PUERTO}/portal/`;

/**
 * **El segundo servidor del arnes: el paquete CON PLATAFORMA** (issue 28).
 *
 * El arnes sirve el paquete de demostracion, porque lo que recorre es el recorrido del artboard
 * (`playwright.config.ts`). El recorrido con plataforma es otro portal —empieza por entrar y la
 * deuda la trae el servidor—, y el unico sitio donde existe es el paquete de PRODUCCION. Asi que se
 * construye aparte, se sirve aparte, y `e2e/recorrido-con-plataforma.spec.ts` lo recorre con un
 * backend falso puesto por el propio arnes (`page.route`).
 *
 * El puerto es **el siguiente**, y no otro derivado: la banda tiene 999 puertos y la derivacion ya
 * separa los arboles; pedir un segundo hash daria dos numeros sueltos que hay que mirar por separado
 * cuando algo se atasca, y este se puede nombrar de memoria. Si el ultimo de la banda cae aqui, se
 * vuelve al primero.
 */
export const PUERTO_CON_PLATAFORMA = PUERTO === ULTIMO ? PRIMERO : PUERTO + 1;

/** Donde se construye el paquete con plataforma. No se versiona (`.gitignore`). */
export const DIST_CON_PLATAFORMA = 'dist-con-plataforma';

/** La raiz del paquete con plataforma, servido por el segundo `vite preview`. */
export const URL_CON_PLATAFORMA = `http://localhost:${PUERTO_CON_PLATAFORMA}/portal/`;

/** Las dos caras de «localhost». Vite escucha en `::1`; un servidor ajeno puede estar en cualquiera. */
const LOOPBACK = ['127.0.0.1', '::1'];

/**
 * Si el puerto esta ocupado en alguna de las dos caras de `localhost`.
 *
 * Se intenta ABRIR y no conectar, a proposito: conectar solo ve servidores que aceptan, y lo
 * que le importa al arnes es si `vite preview` va a poder escuchar. Medido: `vite preview`
 * abre en `[::1]` y no en `127.0.0.1`, asi que mirar una sola cara dice «libre» de un puerto
 * que no lo esta.
 *
 * @param {number} puerto
 * @returns {Promise<boolean>}
 */
export async function estaOcupado(puerto) {
  for (const host of LOOPBACK) {
    const ocupado = await new Promise((resolver) => {
      const servidor = createServer();
      servidor.once('error', (/** @type {NodeJS.ErrnoException} */ error) => {
        // `EADDRNOTAVAIL`: esta maquina no tiene esa cara de localhost. No es ocupacion.
        resolver(error.code === 'EADDRINUSE');
      });
      servidor.listen(puerto, host, () => servidor.close(() => resolver(false)));
    });
    if (ocupado) return true;
  }
  return false;
}

/**
 * Quien tiene el puerto, con su nombre y su directorio si se puede saber.
 *
 * Es lo que convierte «el 4173 esta ocupado» en algo accionable: **dice si lo tiene el arnes
 * de otro arbol o cualquier otra cosa**, que es la pregunta que uno se hace al leerlo. La
 * derivacion ya separa los arboles, asi que un puerto ocupado casi siempre es (a) un
 * `vite preview` propio que quedo vivo —se mata— o (b) un servicio ajeno —se pide otro
 * puerto—; y los dos se distinguen leyendo el `cmdline` del proceso.
 *
 * Mejor esfuerzo: si no hay `ss`, ni `lsof`, ni `/proc`, se devuelve `null` y el mensaje
 * sigue nombrando el puerto, que es lo que no puede faltar.
 *
 * @param {number} puerto
 * @returns {{ pid: number, descripcion: string } | null}
 */
export function quienLoTiene(puerto) {
  const pid = pidDelQueEscucha(puerto);
  if (pid === null) return null;
  const orden = leerDeProc(pid, 'cmdline')?.replaceAll('\0', ' ').trim();
  const donde = leerDeProc(pid, 'cwd');
  const partes = [`pid ${pid}`];
  if (orden !== undefined && orden !== '') partes.push(orden);
  if (donde !== undefined) partes.push(`desde «${donde}»`);
  return { pid, descripcion: partes.join('\n           ') };
}

/** Lo que se lee cuando no hay forma de saber quien escucha. */
const NADIE = 'otro proceso (ni «ss» ni «lsof» dijeron cual)';

/**
 * El pid del que escucha en un puerto, por `ss` y si no por `lsof`.
 *
 * @param {number} puerto
 * @returns {number | null}
 */
function pidDelQueEscucha(puerto) {
  const ss = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
  if (ss.status === 0) {
    // La cuarta columna es la direccion local: `[::1]:4173` o `127.0.0.1:4173`. Se compara el
    // final y no la linea entera, que tambien lleva el puerto del par y el pid.
    const fila = ss.stdout
      .split('\n')
      .find((linea) => linea.split(/\s+/)[3]?.endsWith(`:${puerto}`) === true);
    const pid = fila?.match(/pid=(\d+)/)?.[1];
    if (pid !== undefined) return Number(pid);
  }
  const lsof = spawnSync('lsof', ['-nP', '-t', `-iTCP:${puerto}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
  });
  const primero = lsof.stdout?.trim().split('\n')[0];
  return primero !== undefined && /^\d+$/.test(primero) ? Number(primero) : null;
}

/**
 * Lo que `/proc` sabe de un proceso, o nada. En Linux; en otro sistema devuelve `undefined` y
 * el mensaje se queda con el pid, que ya es accionable.
 *
 * @param {number} pid
 * @param {'cmdline' | 'cwd'} que
 * @returns {string | undefined}
 */
function leerDeProc(pid, que) {
  try {
    // `cwd` es un enlace simbolico: se lee con `readlinkSync`, no con `readFileSync`.
    return que === 'cwd'
      ? readlinkSync(`/proc/${pid}/cwd`)
      : readFileSync(`/proc/${pid}/cmdline`, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * **La comprobacion que corre ANTES de construir** (AC2 de rentas#148).
 *
 * Si el puerto esta ocupado, esto falla nombrandolo. Lo que se evita no es el fallo —el
 * `--strictPort` tambien falla— sino el fallo MUDO: sin esto, la corrida se pasa dos minutos
 * construyendo, el `preview` muere, la URL la contesta el intruso y los caminos miden lo que
 * ese intruso sirva.
 *
 * @returns {Promise<void>}
 */
export async function comprobarQueElPuertoEstaLibre() {
  // Los DOS: el del paquete de demostracion y el del paquete con plataforma (issue 28). Si el
  // segundo estuviera ocupado, su `vite preview` moriria por `--strictPort` DESPUES de que el
  // primero levantara, y la corrida seguiria midiendo lo que sirva el intruso.
  for (const puerto of [PUERTO, PUERTO_CON_PLATAFORMA]) await comprobarUno(puerto);
}

/**
 * @param {number} puerto
 * @returns {Promise<void>}
 */
async function comprobarUno(puerto) {
  if (!(await estaOcupado(puerto))) return;
  const dueno = quienLoTiene(puerto);
  throw new Error(
    `El puerto ${puerto} ya esta ocupado, y el arnes no puede medir su propio bundle en el.\n\n` +
      `  puerto   ${puerto}, ${puerto === PUERTO ? MOTIVO : `el siguiente al del arnes (${MOTIVO})`}\n` +
      `  lo tiene ${dueno?.descripcion ?? NADIE}\n\n` +
      'El arnes NO se mueve de puerto: con `--strictPort` y un `baseURL` fijo, servir en otro\n' +
      'seria medir el bundle de quien tenga este (rentas#148). Asi que: o se libera el puerto\n' +
      '—si es un `vite preview` que quedo vivo de una corrida anterior, se mata—\n' +
      (dueno === null ? '' : `\n    kill ${dueno.pid}\n`) +
      '\n...o se dice cual usar:\n\n' +
      // Se sugiere el de DESPUES del segundo servidor: el siguiente al del arnes ya lo usa el
      // paquete con plataforma (issue 28), y pedirlo daria el mismo choque un paso mas alla.
      `    ${VARIABLE}=${PUERTO_CON_PLATAFORMA === ULTIMO ? PRIMERO : PUERTO_CON_PLATAFORMA + 1} yarn e2e\n`,
  );
}

/**
 * **Y la que corre DESPUES de levantar: que lo servido sea lo que este arbol acaba de construir.**
 *
 * Es la otra mitad, y la que de verdad asusta: un puerto libre al empezar puede dejar de
 * serlo durante el `yarn build`, y entonces Playwright ve la URL contestar —la contesta el
 * intruso— y sigue adelante. Aqui se compara byte a byte el `index.html` servido con el
 * `dist/index.html` recien construido. Si no son el mismo, no hay corrida: los nombres de los
 * ficheros de `assets/` llevan el hash del contenido, asi que dos ramas distintas no pueden
 * dar el mismo `index.html`... y si lo dan, es que el bundle es identico y medirlo da igual.
 *
 * @returns {Promise<void>}
 */
export async function comprobarQueElBundleServidoEsElMio() {
  const construido = readFileSync(join(RAIZ, 'dist', 'index.html'), 'utf8');
  const servido = await pedirElIndice();
  if (servido === construido) return;
  throw new Error(
    `Lo que se sirve en ${URL_DEL_ARNES} NO es el bundle de este arbol.\n\n` +
      `  puerto   ${PUERTO}, ${MOTIVO}\n` +
      `  servido  ${huella(servido)}\n` +
      `  propio   ${huella(construido)} (${join(RAIZ, 'dist', 'index.html')})\n` +
      `  lo tiene ${quienLoTiene(PUERTO)?.descripcion ?? NADIE}\n\n` +
      'Alguien ocupo el puerto mientras este arbol construia. Medir eso es lo que rentas#148 cierra:\n' +
      'un arnes en verde sobre el bundle de otra rama es peor que uno en rojo.\n',
  );
}

/** Las ocho primeras del SHA-256, que es todo lo que hace falta para decir «no es el mismo». */
function huella(/** @type {string} */ texto) {
  return `sha256:${createHash('sha256').update(texto).digest('hex').slice(0, 8)}`;
}

/**
 * El `index.html` que sirve el servidor, sin comprimir.
 *
 * `identity`: `vite preview` comprime por omision, y un cuerpo en gzip nunca seria igual al
 * fichero del disco. Por `node:http` y no por `fetch`, que en este arbol esta prohibido en todas
 * partes (`fetch-fuera-del-cliente`, sin excepcion: el portal no tiene backend).
 *
 * @returns {Promise<string>}
 */
function pedirElIndice() {
  return new Promise((resolver, rechazar) => {
    const peticion = request(
      URL_DEL_ARNES,
      { headers: { 'accept-encoding': 'identity' } },
      (respuesta) => {
        if (respuesta.statusCode !== 200) {
          respuesta.resume();
          rechazar(new Error(`${URL_DEL_ARNES} contesto ${respuesta.statusCode}, no 200.`));
          return;
        }
        let cuerpo = '';
        respuesta.setEncoding('utf8');
        respuesta.on('data', (trozo) => (cuerpo += trozo));
        respuesta.on('end', () => resolver(cuerpo));
      },
    );
    peticion.on('error', rechazar);
    peticion.end();
  });
}

/**
 * Como CLI: la comprobacion previa, delante del `yarn build` de `webServer.command`.
 *
 * El puerto se anuncia SIEMPRE, y por `stderr` porque es el unico canal que Playwright
 * muestra de un `webServer` (su `stdout` va a `ignore` por omision). Es una linea, y es la
 * que falto en rentas#140: sin ella, una corrida no deja escrito en que puerto midio.
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stderr.write(`El arnes de «${RAIZ}» sirve en ${URL_DEL_ARNES} — ${MOTIVO}.\n`);
  try {
    await comprobarQueElPuertoEstaLibre();
  } catch (error) {
    process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
