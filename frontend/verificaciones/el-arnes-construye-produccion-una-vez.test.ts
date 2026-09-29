import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import configuracion from '../playwright.config.ts';
import { DIST_CON_PLATAFORMA, URL_CON_PLATAFORMA } from '../puerto-del-arnes.mjs';
import { RAIZ } from './artboards.ts';

/**
 * **El arnes construye el paquete de produccion UNA vez, y como la imagen** (issue 63).
 *
 * `yarn e2e` construia cuatro paquetes: el de demostracion que recorre el artboard, el de produccion
 * que sirve el segundo servidor, y otros dos de produccion que construian por su cuenta
 * `la-demostracion-no-viaja-al-bundle.spec.ts` y `el-dist-de-la-imagen-esta-limpio.spec.ts`. Medido,
 * los tres de produccion salian identicos byte a byte. Ahora las dos especificaciones leen el que sirve
 * el segundo servidor, y ese se construye con la orden y la bandera del `Dockerfile`.
 *
 * Lo que se pierde sin esta guarda no se ve en ningun rojo: si el servidor dejara de construir como la
 * imagen, las dos especificaciones seguirian en verde midiendo OTRO paquete que el que se publica; y si
 * una volviera a construir el suyo, solo se notaria en el reloj.
 */

/** Las especificaciones que miden el paquete de produccion. */
const LEEN_PRODUCCION = [
  'e2e/la-demostracion-no-viaja-al-bundle.spec.ts',
  'e2e/el-dist-de-la-imagen-esta-limpio.spec.ts',
] as const;

/** El servidor del arnes que sirve el paquete con plataforma: el que contesta en su URL. */
function servidorConPlataforma(): { readonly command: string; readonly env?: Record<string, string> } | undefined {
  return [configuracion.webServer].flat().find((servidor) => servidor?.url === URL_CON_PLATAFORMA);
}

/**
 * Lo que la etapa `construccion` del `Dockerfile` pone en el entorno ANTES de `RUN yarn build`: sus
 * `ENV`, sin los comentarios (que citan la bandera para contar por que).
 */
function entornoDeLaImagen(): { readonly entorno: Readonly<Record<string, string>>; readonly construye: boolean } {
  const lineas = readFileSync(join(RAIZ, 'Dockerfile'), 'utf8')
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('#'));
  const desde = lineas.findIndex((linea) => /^FROM\s+\S+\s+AS\s+construccion\s*$/.test(linea));
  const hasta = lineas.findIndex((linea, i) => i > desde && /^RUN\s+yarn\s+build\s*$/.test(linea));
  const entorno: Record<string, string> = {};
  for (const linea of lineas.slice(desde, hasta)) {
    const [, clave, valor] = /^ENV\s+([A-Z0-9_]+)[=\s]\s*(\S+)\s*$/.exec(linea) ?? [];
    if (clave !== undefined && valor !== undefined) entorno[clave] = valor;
  }
  return { entorno, construye: desde >= 0 && hasta > desde };
}

/** Solo las variables de Vite: las unicas que el paquete hornea. */
const deVite = (entorno: Readonly<Record<string, string>> | undefined) =>
  Object.fromEntries(Object.entries(entorno ?? {}).filter(([clave]) => clave.startsWith('VITE_')));

const PROCESOS = new Set(['execFileSync', 'execSync', 'spawnSync', 'spawn', 'exec', 'execFile', 'fork']);

/** Una orden que construye: `build`, `build:arnes`, `vite build`, `yarn build …`. */
const CONSTRUYE = /(^|\s)build(:\S+)?(\s|$)/;

/**
 * Lo que un modulo manda construir: las cadenas que pasa a un proceso hijo (`execFileSync`,
 * `spawnSync`…) y que son una orden de construir, y el `build` de Vite importado para llamarlo.
 *
 * Por el arbol del compilador, y no por texto: los mensajes y los comentarios de estas especificaciones
 * nombran `vite build` para contar que miden, y eso no construye nada.
 */
function loQueConstruye(codigo: string): readonly string[] {
  const archivo = ts.createSourceFile('modulo.ts', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hallazgos: string[] = [];
  const cadenas = (nodo: ts.Node): string[] =>
    ts.isStringLiteralLike(nodo) || ts.isTemplateHead(nodo) || ts.isTemplateMiddle(nodo) || ts.isTemplateTail(nodo)
      ? [nodo.text]
      : nodo.getChildren().flatMap(cadenas);
  const visitar = (nodo: ts.Node): void => {
    if (ts.isCallExpression(nodo)) {
      const llamada = ts.isPropertyAccessExpression(nodo.expression) ? nodo.expression.name : nodo.expression;
      if (ts.isIdentifier(llamada) && PROCESOS.has(llamada.text)) {
        const orden = nodo.arguments.flatMap(cadenas);
        if (orden.some((trozo) => CONSTRUYE.test(trozo))) hallazgos.push(`${llamada.text}(${orden.join(' ')})`);
      }
    }
    if (
      ts.isImportDeclaration(nodo) &&
      ts.isStringLiteral(nodo.moduleSpecifier) &&
      nodo.moduleSpecifier.text === 'vite' &&
      nodo.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(nodo.importClause.namedBindings) &&
      nodo.importClause.namedBindings.elements.some((e) => (e.propertyName ?? e.name).text === 'build')
    ) {
      hallazgos.push("import { build } from 'vite'");
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(archivo);
  return hallazgos;
}

/** Si el modulo importa `DIST_CON_PLATAFORMA` de `puerto-del-arnes.mjs`, que es de donde sale el directorio. */
function leeElDirectorioDelServidor(codigo: string): boolean {
  const archivo = ts.createSourceFile('modulo.ts', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return archivo.statements.some(
    (sentencia) =>
      ts.isImportDeclaration(sentencia) &&
      ts.isStringLiteral(sentencia.moduleSpecifier) &&
      sentencia.moduleSpecifier.text === '../puerto-del-arnes.mjs' &&
      sentencia.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(sentencia.importClause.namedBindings) &&
      sentencia.importClause.namedBindings.elements.some((e) => e.name.text === 'DIST_CON_PLATAFORMA'),
  );
}

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

describe('el servidor con plataforma construye EL paquete de produccion, como la imagen', () => {
  it('con la orden de la imagen, en el directorio que sirve', () => {
    const servidor = servidorConPlataforma();

    expect(servidor, `ningun servidor de playwright.config.ts contesta en ${URL_CON_PLATAFORMA}`).toBeDefined();
    const [construir, servir] = servidor?.command.split(' && ') ?? [];
    expect(construir, 'el segundo servidor no construye como el Dockerfile (`RUN yarn build`)').toBe(
      `yarn build --outDir ${DIST_CON_PLATAFORMA}`,
    );
    expect(servir).toContain(`yarn preview --outDir ${DIST_CON_PLATAFORMA} `);
  });

  it('y con el entorno de la imagen: las mismas variables de Vite, con el mismo valor', () => {
    const { entorno, construye } = entornoDeLaImagen();
    // El centinela: sin la etapa o sin su `RUN yarn build`, el entorno saldria vacio y «el mismo» seria
    // verde con cualquier servidor.
    expect(construye, 'el Dockerfile no tiene una etapa «construccion» con `RUN yarn build`').toBe(true);
    expect(Object.keys(deVite(entorno))).toContain('VITE_KAMAYUK_SIN_PLATAFORMA');

    expect(
      deVite(servidorConPlataforma()?.env),
      'El segundo servidor del arnes no construye con el entorno del Dockerfile: las especificaciones que ' +
        'leen su paquete medirian otro que el que se publica',
    ).toEqual(deVite(entorno));
  });
});

describe('las especificaciones leen ese paquete, y ninguna construye otro', () => {
  it.each(LEEN_PRODUCCION)('%s lee `DIST_CON_PLATAFORMA`', (ruta) => {
    expect(
      leeElDirectorioDelServidor(leer(ruta)),
      `${ruta} no importa \`DIST_CON_PLATAFORMA\` de \`puerto-del-arnes.mjs\`: no mide el paquete que sirve el arnes`,
    ).toBe(true);
  });

  it('ningun archivo de e2e/ manda construir nada', () => {
    const construyen = readdirSync(join(RAIZ, 'e2e'))
      .filter((nombre) => nombre.endsWith('.ts'))
      .flatMap((nombre) => loQueConstruye(leer(join('e2e', nombre))).map((orden) => `e2e/${nombre}: ${orden}`));

    expect(
      construyen,
      'Estas especificaciones construyen su propio paquete: el de produccion lo construye y lo sirve el ' +
        `segundo servidor del arnes, en \`${DIST_CON_PLATAFORMA}\`, y se lee de ahi:\n  ${construyen.join('\n  ')}\n`,
    ).toEqual([]);
  });

  it('EL CENTINELA: el lector ve una construccion por cualquiera de sus formas, y no la ve en un mensaje', () => {
    expect(loQueConstruye("execFileSync('npx', ['vite', 'build', '--outDir', x], { cwd });")).toHaveLength(1);
    expect(loQueConstruye('execSync(`yarn build --outDir ${x}`);')).toHaveLength(1);
    expect(loQueConstruye("cp.spawnSync('yarn', ['build:arnes']);")).toHaveLength(1);
    expect(loQueConstruye("import { build as construir } from 'vite';")).toHaveLength(1);
    expect(loQueConstruye("expect(x, '`vite build` ya no emite mapas').toBe(1); // vite build")).toEqual([]);
    expect(loQueConstruye("execFileSync('sh', ['imagen/sin-mapas.sh', dist]);")).toEqual([]);
  });
});
