// @vitest-environment node
//
// Lee el DISCO —`package.json`, `.nvmrc` y el workflow, aqui y en el clon hermano—: no es un DOM
// lo que necesita.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import type { Declaracion, Exigencia } from './motor.ts';
import {
  comoTabla,
  declaracionesDelMotor,
  elDelDockerfile,
  elDelNvmrc,
  elDeEngines,
  loQueExigenLosEnlaces,
  losDelWorkflow,
  mayorDelMotor,
  motoresDistintos,
} from './motor.ts';

/**
 * **Un solo motor de Node, dicho en cinco sitios y sin poder desviarse** (issue 39, y 37).
 *
 * Eran cuatro hasta el issue 37: el `FROM node:…` de la etapa que construye la imagen es el quinto, y
 * el unico que no lee nadie mas que Docker — o sea, el que mas facil se queda atras.
 *
 * El porque entero —los tres motores que este mismo arbol prometia a la vez, y por que el minimo
 * del hermano se lee y no se escribe— esta en `motor.ts`, junto a la funcion que lo compara.
 *
 * Lo que este archivo vigila son las dos mitades:
 *
 *   1. Que los cinco sitios digan **el mismo** motor: `engines.node`, `.nvmrc`, el
 *      `node-version` de los DOS trabajos del workflow y el `FROM node:` del `Dockerfile`.
 *   2. Que ese motor **no quede por debajo** del que exigen los paquetes de `kamayuk-lib` que este
 *      frontend enlaza — leido de su `package.json`, no escrito aqui.
 *
 * Las dos se caen en silencio, que es el motivo por el que se comprueban: un `node-version`
 * cambiado en un solo trabajo es una linea que nadie revisa dos veces, y un `engines.node` corto no
 * rompe nada **hasta** que la libreria use algo del motor que promete.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const REPOSITORIO = join(FRONTEND, '..');

const DECLARACIONES = declaracionesDelMotor(FRONTEND, REPOSITORIO);
const EXIGENCIAS = loQueExigenLosEnlaces(FRONTEND);

const temporales: string[] = [];

afterAll(() => {
  for (const espacio of temporales) rmSync(espacio, { recursive: true, force: true });
});

/**
 * Un espacio de trabajo de mentira con la MISMA disposicion que el de verdad —`ciudadano/frontend`
 * con su `link:`, y `kamayuk-lib` al lado—, cuyo hermano declara el motor que se le diga.
 *
 * `kamayuk-lib` no se toca desde un issue de este repositorio, asi que esta es la unica forma de
 * demostrar que el minimo se lee de verdad: cambiarlo en un hermano que si es nuestro.
 */
function exigenciaDeUnHermanoQueDice(dice: string | undefined): Exigencia[] {
  const espacio = mkdtempSync(join(tmpdir(), 'kamayuk-motor-'));
  temporales.push(espacio);

  const frontend = join(espacio, 'ciudadano', 'frontend');
  mkdirSync(frontend, { recursive: true });
  writeFileSync(
    join(frontend, 'package.json'),
    JSON.stringify({ dependencies: { '@kamayuk/ui': 'link:../../kamayuk-lib/paquetes/ui' } }),
  );

  const hermano = join(espacio, 'kamayuk-lib');
  mkdirSync(hermano, { recursive: true });
  writeFileSync(
    join(hermano, 'package.json'),
    JSON.stringify(dice === undefined ? {} : { engines: { node: dice } }),
  );

  return loQueExigenLosEnlaces(frontend);
}

describe('el motor lo dicen los cinco sitios, y es el mismo', () => {
  it('EL CENTINELA: hay cinco declaraciones, dos son las del workflow y una la del Dockerfile', () => {
    // Sin esto, borrar el `.nvmrc` o quedarse con un solo trabajo en el workflow dejaria a la
    // comparacion de abajo recorriendo una lista mas corta y **pasando en verde**: comparar tres
    // numeros iguales no dice nada si el cuarto ya no se mira.
    expect(
      DECLARACIONES.length,
      `El motor tiene que decirse en CINCO sitios, y se lee en ${String(DECLARACIONES.length)}:\n` +
        comoTabla(DECLARACIONES),
    ).toBe(5);
    const delWorkflow = DECLARACIONES.filter((d) => d.donde.includes('workflows/frontend.yml'));
    expect(delWorkflow.length, 'los dos trabajos del workflow fijan su motor').toBe(2);
    const delDockerfile = DECLARACIONES.filter((d) => d.donde.startsWith('frontend/Dockerfile'));
    expect(delDockerfile.length, 'la etapa de construccion de la imagen fija su motor, y solo una vez').toBe(1);
  });

  it('ninguna se calla: las cinco dicen un numero', () => {
    const mudas = DECLARACIONES.filter((d) => d.mayor === null);
    expect(
      mudas.map((d) => d.donde),
      'Hay sitios que tenian que decir el motor y no lo dicen:\n' +
        `${comoTabla(mudas)}\n\n` +
        '  Un sitio que falta no es un sitio que coincide: mientras no lo diga, cada quien corre\n' +
        '  el Node que tenga puesto y nadie se entera.',
    ).toEqual([]);
  });

  it('y las cinco dicen EL MISMO', () => {
    expect(
      motoresDistintos(DECLARACIONES),
      'El arbol promete mas de un motor de Node a la vez:\n' +
        `${comoTabla(DECLARACIONES)}\n\n` +
        '  Con la CI bloqueada, TODA la evidencia de los PR es local: si el motor de aqui y el del\n' +
        '  workflow no son el mismo, «verde en mi maquina» y «verde en CI» dejan de ser la misma\n' +
        '  afirmacion — y no hay quien lo note hasta que la CI vuelva.',
    ).toHaveLength(1);
  });
});

describe('y el motor prometido alcanza al que exige `kamayuk-lib`', () => {
  it('EL CENTINELA: el clon hermano exige un motor, y se leyo', () => {
    // Sin esto, un hermano ausente —o uno que dejara de declarar `engines`— dejaria la
    // comprobacion de abajo comparando contra la lista vacia y pasando en verde, que es como una
    // guarda se queda sin sujeto. Quien explica la ausencia del clon, nombrando el `git clone`,
    // es `enlace-con-kamayuk-lib.test.ts`; aqui solo hay que notar que no se leyo nada.
    expect(
      EXIGENCIAS.map((e) => e.donde),
      'Ningun paquete enlazado ni su clon declaran `engines.node`: no hay minimo contra el que\n' +
        '  comparar. Si el clon hermano falta, lo dice `enlace-con-kamayuk-lib.test.ts`.',
    ).not.toEqual([]);
  });

  it('lo que este frontend promete no queda por debajo de lo que la libreria exige', () => {
    // Solo los sitios que dicen un numero: de los que se callan ya habla la prueba de arriba, y
    // contarlos aqui como «prometen 0» ensuciaria este rojo con un dato que no es suyo. Sin
    // ninguno, el 0 deja esto en rojo tambien — que es lo que hay que decir.
    const dichos = DECLARACIONES.map((d) => d.mayor).filter((m) => m !== null);
    const prometido = dichos.length === 0 ? 0 : Math.min(...dichos);
    const cortas = EXIGENCIAS.filter((e) => e.mayor > prometido).map(
      (e) => `  ${e.donde}: exige «${e.dice}» y aqui se promete ${String(prometido)}`,
    );
    expect(
      cortas,
      'Este frontend promete un motor MENOR que el que exigen los paquetes que enlaza:\n' +
        `${cortas.join('\n')}\n\n` +
        '  Los cinco `@kamayuk/*` llegan como FUENTE y los compila este arbol. El dia que la\n' +
        '  libreria use algo que el motor prometido no tiene, quien sale en rojo es este\n' +
        '  repositorio, y el error no habla de versiones.',
    ).toEqual([]);
  });
});

describe('LA MUESTRA: la guarda muerde, sobre declaraciones inventadas', () => {
  /** Los cinco sitios de acuerdo, para retocar uno y ver que se nota. */
  const deAcuerdo = (): Declaracion[] => [
    elDeEngines(JSON.stringify({ engines: { node: '>=24' } })),
    elDelNvmrc('24\n'),
    ...losDelWorkflow('        node-version: "24"\n        node-version: "24"\n'),
    ...elDelDockerfile('FROM node:24-alpine AS construccion\nFROM nginx:1.31.5-alpine AS interfaz\n'),
  ];

  it('con los cinco de acuerdo no dice nada', () => {
    expect(deAcuerdo()).toHaveLength(5);
    expect(motoresDistintos(deAcuerdo())).toEqual([24]);
  });

  it('si `engines.node` se queda atras mientras el resto avanza, se ve', () => {
    const torcidas = deAcuerdo();
    torcidas[0] = elDeEngines(JSON.stringify({ engines: { node: '>=22' } }));
    expect(motoresDistintos(torcidas)).toEqual([22, 24]);
  });

  it('si el `.nvmrc` no esta, se ve — que un sitio falte no es que coincida', () => {
    const torcidas = deAcuerdo();
    torcidas[1] = { donde: 'frontend/.nvmrc', dice: '(no existe)', mayor: null };
    expect(motoresDistintos(torcidas)).toEqual([24, null]);
  });

  it('y si se desvia UN SOLO trabajo del workflow, tambien', () => {
    // Es la rotura que nadie revisa dos veces: el otro trabajo sigue diciendo lo de siempre y el
    // diff es una linea.
    const torcidas = [
      ...deAcuerdo().slice(0, 2),
      ...losDelWorkflow('        node-version: "24"\n        node-version: "22"\n'),
    ];
    expect(motoresDistintos(torcidas)).toEqual([24, 22]);
  });

  it('y si la imagen se construye con otro Node —el 22 que pedia el issue 37—, tambien', () => {
    // Es la rotura que el issue 37 traia escrita: «construccion con Node 22 (la que declara
    // `engines`)», cuando `engines` ya decia 24. Con la imagen en 22, lo que se publica se habria
    // construido con un motor que ni este arbol ni `kamayuk-lib` prometen.
    const torcidas = [
      ...deAcuerdo().slice(0, 4),
      ...elDelDockerfile('# node:24 es lo que dice el .nvmrc\nFROM node:22-alpine AS construccion\n'),
    ];
    expect(torcidas.map((d) => d.dice)).toEqual(['>=24', '24', '24', '24', '22-alpine']);
    expect(motoresDistintos(torcidas)).toEqual([24, 22]);
  });

  it('y la etapa de nginx no cuenta como un motor de Node', () => {
    expect(elDelDockerfile('FROM nginx:1.31.5-alpine AS interfaz\n')).toEqual([]);
  });

  it('los comentarios del workflow NO cuentan como declaracion', () => {
    // El comentario que explica de donde sale el motor nombra el numero. Sin este filtro contaria
    // como una declaracion mas —y seguiria contando el dia que el `node-version` de verdad
    // cambiara—, que es justo lo que `andamiaje.test.ts` descubrio de su propia copia de `rentas`.
    const conComentario =
      '      # el motor sale del .nvmrc\n' +
      '      #   node-version: "22"\n' +
      '        node-version: "24"\n';
    expect(losDelWorkflow(conComentario).map((d) => d.dice)).toEqual(['24']);
  });

  it('el minimo del hermano se LEE de su package.json, no esta escrito aqui', () => {
    // La mitad que no se puede demostrar rompiendo el arbol de verdad: `kamayuk-lib` es un clon
    // hermano y desde un issue de este repositorio no se toca. Asi que se monta un hermano de
    // mentira, se le cambia el `engines.node` y se comprueba que lo que sale cambia con el. Si el
    // 24 estuviera escrito en esta guarda, estas dos afirmaciones darian lo mismo.
    expect(exigenciaDeUnHermanoQueDice('>=24').map((e) => e.mayor)).toEqual([24]);
    expect(exigenciaDeUnHermanoQueDice('>=30').map((e) => e.mayor)).toEqual([30]);
  });

  it('y sin `engines` en el hermano no exige nada — por eso el centinela de arriba', () => {
    // Lo que deja a la comprobacion sin sujeto: un hermano que deja de declarar `engines` haria
    // pasar en verde cualquier motor de aqui. El centinela es lo unico que lo nota.
    expect(exigenciaDeUnHermanoQueDice(undefined)).toEqual([]);
  });

  it('y el numero se lee de cualquier forma de escribirlo', () => {
    // `.nvmrc` no admite rangos y `engines` no admite una version desnuda: comparar el mayor es
    // lo unico que los cuatro sitios tienen en comun.
    expect([
      mayorDelMotor('>=24'),
      mayorDelMotor('24'),
      mayorDelMotor('v24.19.0'),
      mayorDelMotor('^24.1'),
      mayorDelMotor('lts/*'),
    ]).toEqual([24, 24, 24, 24, null]);
  });
});
