import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { destinoDelEnlace, enlacesDeclarados } from './enlace.ts';
import { raizDelClon } from './remedio.mjs';

/**
 * **El motor de Node que este arbol promete, leido de los cuatro sitios que lo dicen** (issue 39).
 *
 * Vive aparte de su prueba por el mismo motivo que `enlace.ts`: asi la prueba puede ejercer la
 * comparacion sobre declaraciones INVENTADAS —una donde los cuatro no coinciden— y demostrar que
 * muerde sin tocar el disco de verdad.
 *
 * <h2>El defecto que esto cierra, medido el 2026-09-20</h2>
 *
 * El mismo arbol prometia tres motores a la vez: `engines.node` decia `>=22`, los dos jobs del
 * workflow fijaban `node-version: "22"`, no habia `.nvmrc`, y la maquina donde se estaba
 * verificando TODO —con la CI de la cuenta bloqueada por facturacion desde el 2026-09-16— corria
 * **v24.19.0**. O sea que «verde en mi maquina» y «verde en CI» habian dejado de ser la misma
 * afirmacion, y no habia quien lo notara hasta que la CI volviera.
 *
 * <h2>Y por que no basta con que los cuatro coincidan</h2>
 *
 * Porque los cinco paquetes de `kamayuk-lib` llegan por `link:` como **fuente**, y los compila este
 * arbol. La libreria declara `engines.node` en su raiz —hoy `>=24`—, asi que prometer menos aqui es
 * prometer que se ejecuta con un motor que la libreria no admite. El dia que use algo que el motor
 * prometido no tiene, quien sale en rojo es este repositorio, con un error que no habla de
 * versiones. Por eso el minimo del hermano se **lee** de su `package.json` y no se escribe a mano:
 * escrito a mano seria el minimo del dia en que alguien lo copio.
 */

/** Donde vive el workflow que fija el motor de la CI, desde la raiz del repositorio. */
export const SITIO_DEL_WORKFLOW = '.github/workflows/frontend.yml';

/** Lo que dice un sitio sobre el motor, y el numero que de ahi sale. */
export interface Declaracion {
  /** El archivo y el campo, tal como se nombran al leerlos: para el rojo. */
  readonly donde: string;
  /** Lo declarado, literal: `>=24`, `24`, o `(no existe)` si el archivo falta. */
  readonly dice: string;
  /** El mayor que promete, o `null` si no se pudo leer ninguno. */
  readonly mayor: number | null;
}

/** Lo que un paquete enlazado —o el clon del que cuelga— exige por `engines.node`. */
export interface Exigencia {
  readonly donde: string;
  readonly dice: string;
  readonly mayor: number;
}

/**
 * De cualquier forma de escribir un motor al numero mayor que promete.
 *
 * `>=24` -> 24, `24` -> 24, `v24.19.0` -> 24, `^24.1` -> 24. Basta para comparar mayores, que es
 * lo unico que las cuatro declaraciones tienen en comun: `.nvmrc` no admite rangos y `engines`
 * no admite una version desnuda.
 */
export function mayorDelMotor(dice: string): number | null {
  const numero = /(\d+)/.exec(dice)?.[1];
  return numero === undefined ? null : Number(numero);
}

/** Una declaracion a partir de lo que se leyo, o la que dice que no habia nada que leer. */
function declara(donde: string, dice: string | undefined): Declaracion {
  if (dice === undefined) return { donde, dice: '(no lo dice)', mayor: null };
  return { donde, dice, mayor: mayorDelMotor(dice) };
}

/** `engines.node` de un `package.json` ya leido. */
export function elDeEngines(crudo: string, donde = 'frontend/package.json → engines.node'): Declaracion {
  const manifiesto = JSON.parse(crudo) as { engines?: { node?: string } };
  return declara(donde, manifiesto.engines?.node);
}

/** El de un `.nvmrc` ya leido: una linea, sin rango y a veces con `v` delante. */
export function elDelNvmrc(crudo: string, donde = 'frontend/.nvmrc'): Declaracion {
  const linea = crudo
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l !== '' && !l.startsWith('#'));
  return declara(donde, linea);
}

/**
 * Cada `node-version` del workflow, uno por trabajo.
 *
 * SIN COMENTARIOS, por lo que `andamiaje.test.ts` aprendio al demostrar que mordia: un workflow que
 * habla de lo que hace no puede contar como un workflow que lo hace. El comentario que explica de
 * donde sale el motor nombra el numero, y sin este filtro contaria como una declaracion mas — y
 * peor: seguiria contando el dia que el `node-version` de verdad cambiara.
 */
export function losDelWorkflow(crudo: string, donde = SITIO_DEL_WORKFLOW): Declaracion[] {
  const salida: Declaracion[] = [];
  crudo.split('\n').forEach((linea, indice) => {
    if (linea.trim().startsWith('#')) return;
    const dicho = /^\s*node-version:\s*"?([^"\s#]+)"?\s*$/.exec(linea)?.[1];
    if (dicho !== undefined) salida.push(declara(`${donde}:${indice + 1} → node-version`, dicho));
  });
  return salida;
}

/**
 * Las cuatro declaraciones del motor de este arbol, leidas del disco.
 *
 * Cada lectura va envuelta en `existsSync`: si `.nvmrc` o el workflow faltan, la respuesta es una
 * declaracion que dice `(no existe)` y **no** una excepcion. Leerlos a secas reventaria en la
 * RECOLECCION, que se lleva por delante el archivo de pruebas entero en vez de fallar uno —la
 * leccion de `andamiaje.test.ts`—, y el rojo hablaria de `readFileSync` y no del motor.
 */
export function declaracionesDelMotor(
  raizDelFrontend: string,
  raizDelRepositorio: string,
): Declaracion[] {
  const leer = (ruta: string): string | null =>
    existsSync(ruta) ? readFileSync(ruta, 'utf8') : null;

  const manifiesto = leer(join(raizDelFrontend, 'package.json'));
  const nvmrc = leer(join(raizDelFrontend, '.nvmrc'));
  const workflow = leer(join(raizDelRepositorio, SITIO_DEL_WORKFLOW));

  return [
    manifiesto === null
      ? declara('frontend/package.json → engines.node', undefined)
      : elDeEngines(manifiesto),
    nvmrc === null
      ? { donde: 'frontend/.nvmrc', dice: '(no existe)', mayor: null }
      : elDelNvmrc(nvmrc),
    ...(workflow === null
      ? [{ donde: SITIO_DEL_WORKFLOW, dice: '(no existe)', mayor: null }]
      : losDelWorkflow(workflow)),
  ];
}

/** La tabla de lo que dice cada sitio, para meterla en el rojo. */
export function comoTabla(declaraciones: readonly Declaracion[]): string {
  return declaraciones.map((d) => `  ${d.donde}: «${d.dice}»`).join('\n');
}

/**
 * Los mayores distintos que se han declarado. Uno solo = los sitios coinciden.
 *
 * `null` cuenta como un valor mas: un `.nvmrc` que falta es una forma de desviarse, no una
 * excepcion que perdonar.
 */
export function motoresDistintos(declaraciones: readonly Declaracion[]): (number | null)[] {
  return [...new Set(declaraciones.map((d) => d.mayor))];
}

/**
 * Lo que exigen por `engines.node` los paquetes enlazados y el clon del que cuelgan.
 *
 * Se miran los dos: hoy el minimo vive solo en la raiz de `kamayuk-lib` —sus seis paquetes no
 * declaran `engines`—, pero el dia que uno lo declare por su cuenta, este arbol lo compila igual.
 *
 * Sin el clon hermano devuelve la lista **vacia**, y no revienta: quien dice que falta, nombrando
 * el `git clone`, es `enlace-con-kamayuk-lib.test.ts`. Que la lista vacia no pase en verde lo
 * impide el centinela de la prueba.
 */
export function loQueExigenLosEnlaces(raizDelFrontend: string): Exigencia[] {
  const manifiesto = join(raizDelFrontend, 'package.json');
  if (!existsSync(manifiesto)) return [];

  // La ruta declarada, no la resuelta, es la que se nombra en el rojo: es la que se puede buscar
  // en el `package.json` de aqui. Y el `Map` deduplica el clon, que los cinco `link:` comparten.
  const candidatos = new Map<string, string>();
  for (const { declarada } of enlacesDeclarados(readFileSync(manifiesto, 'utf8'))) {
    const raiz = raizDelClon(declarada);
    if (raiz !== null) candidatos.set(destinoDelEnlace(raiz, raizDelFrontend), raiz);
    candidatos.set(destinoDelEnlace(declarada, raizDelFrontend), declarada);
  }

  const salida: Exigencia[] = [];
  for (const [destino, declarada] of candidatos) {
    const suyo = join(destino, 'package.json');
    if (!existsSync(suyo)) continue;
    const { engines } = JSON.parse(readFileSync(suyo, 'utf8')) as { engines?: { node?: string } };
    const dice = engines?.node;
    if (dice === undefined) continue;
    const mayor = mayorDelMotor(dice);
    if (mayor !== null) salida.push({ donde: `${declarada}/package.json → engines.node`, dice, mayor });
  }
  return salida;
}
