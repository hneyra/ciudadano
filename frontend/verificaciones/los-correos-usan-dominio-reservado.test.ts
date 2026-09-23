// @vitest-environment node
//
// Corre `git ls-files` y lee archivos del disco: no es un DOM lo que necesita.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type CorreoEncontrado, correosNoReservados, esDominioReservado } from './dominios-de-correo.ts';

/**
 * **Ningun archivo versionado contiene un correo de dominio registrable** (issue 51).
 *
 * El correo del usuario de demostracion viajaba hasta en el paquete de produccion
 * (`src/datos/demostracion.ts`) con forma de correo real en un dominio de webmail de verdad, y
 * otras tres direcciones de este arbol apuntaban a dominios que cualquiera puede registrar manana.
 * Una prueba, un placeholder o el artboard no tienen por que nombrar el buzon de un tercero:
 * `dominios-de-correo.ts` dice cuales dominios son reservados (RFC 2606/6761) y esta guarda los
 * exige en **todo el arbol versionado**, leido con `git ls-files` y no con un recorrido de
 * `readdir` — asi alcanza tambien `CLAUDE.md`, el artboard y `e2e/`, que `colores-propios.ts`
 * (acotada a `src/`) no mira.
 *
 * <h2>Esta misma hoja se mide con lo que describe</h2>
 *
 * Al ser un archivo versionado, esta hoja tambien pasa por la guarda que define: por eso sus
 * propios ejemplos de correo NO reservado se arman por concatenacion (`['gmail', 'com'].join('.')`)
 * en vez de escribirse enteros — un correo entero en el texto de esta prueba se senalaria a si
 * mismo, y asi lo hizo la primera version (medido en CI, no en local: `git ls-files` solo ve
 * archivos YA versionados, y en local esta hoja todavia estaba sin `git add`).
 *
 * <h2>Lo que se excluye, y por que se nombra</h2>
 *
 * Las extensiones binarias (`escudo-catacaos.png`): un correo ahi seria una coincidencia de bytes,
 * no texto. Y `frontend/yarn.lock`, nombrado exacto y no por patron: lo genera yarn a partir del
 * registro de npm, y una version futura de una dependencia podria traer el correo de un mantenedor
 * de verdad que esta guarda no tiene por que perseguir ni bloquear una instalacion.
 *
 * <h2>Las excepciones, por direccion exacta</h2>
 *
 * `EXENCIONES` eximiria una direccion legitima —la de una atribucion de commit, por ejemplo, si
 * llegara a aparecer en un archivo versionado— por su direccion exacta y con el motivo escrito, no
 * por un patron que se coma otras. Hoy esta vacia: ninguna direccion asi vive en el arbol.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const RAIZ_DEL_REPO = join(FRONTEND, '..');

/** Un correo en un archivo binario es una coincidencia de bytes, no texto que alguien escribio. */
const EXTENSIONES_BINARIAS = /\.(?:png|jpe?g|gif|ico|webp|avif|woff2?|ttf|eot)$/i;

/** Ver «Lo que se excluye» arriba: nombrado exacto, no por patron. */
const EXCLUIDOS = new Set(['frontend/yarn.lock']);

/** Ver «Las excepciones» arriba: cada entrada, con su motivo. */
const EXENCIONES: Readonly<Record<string, string>> = {};

function archivosVersionados(): string[] {
  const r = spawnSync('git', ['ls-files'], { cwd: RAIZ_DEL_REPO, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ls-files fallo (rc=${String(r.status)}): ${r.stderr}`);
  return r.stdout.split('\n').filter((linea) => linea.length > 0);
}

describe('`esDominioReservado`: RFC 2606 y RFC 6761, exacto o por subdominio', () => {
  it.each([
    ['example.com', true],
    ['EXAMPLE.COM', true],
    ['example.org', true],
    ['example.net', true],
    ['ventanilla.example.com', true],
    ['a.b.example.org', true],
    ['localhost', true],
    ['servidor.localhost', true],
    ['acme.example', true],
    ['algo.test', true],
    ['x.invalid', true],
    // Cualquier dominio real y registrable vale para probar el «no»; se evitan a proposito los
    // tres que este issue saca del arbol (ver el porque en el comentario de arriba del archivo).
    ['contoso.com', false],
    ['acme-tributos.pe', false],
    ['webmail-de-verdad.org', false],
    // Bordes: contiene el nombre reservado pero no lo ES.
    ['fakeexample.com', false],
    ['example.company', false],
    ['notexample.com', false],
  ])('%s -> %s', (dominio, esperado) => {
    expect(esDominioReservado(dominio)).toBe(esperado);
  });
});

describe('`correosNoReservados`: cada direccion senalada, con su linea', () => {
  it('EL CENTINELA: sobre un texto vacio no hay nada que senalar', () => {
    expect(correosNoReservados('')).toEqual([]);
  });

  it('LA MUESTRA: un correo de un dominio de webmail conocido, puesto en una prueba, sale en su linea', () => {
    // Esto es la mitad de la demostracion del AC «la guarda nueva sale roja con un correo de un
    // dominio de webmail conocido puesto en una prueba»: aqui, sobre un texto inventado y sin
    // tocar el arbol. Los dos correos de mentira se arman por concatenacion (ver el porque en el
    // comentario de arriba del archivo): esta hoja tambien esta versionada.
    const webmail = ['gmail', 'com'].join('.');
    const otroRegistrable = ['correo', 'pe'].join('.');
    const texto = [
      "const CORREO = 'maria@example.com';",
      `expect(destino).toBe('fruiz159@${webmail}');`,
      `// un comentario que menciona ana@${otroRegistrable} tambien cuenta: no hay exencion para comentarios`,
    ].join('\n');

    expect(correosNoReservados(texto)).toEqual<CorreoEncontrado[]>([
      { linea: 2, correo: `fruiz159@${webmail}`, dominio: webmail },
      { linea: 3, correo: `ana@${otroRegistrable}`, dominio: otroRegistrable },
    ]);
  });

  it('varias direcciones en la misma linea salen todas', () => {
    const webmail = ['gmail', 'com'].join('.');
    const otroRegistrable = ['correo', 'com'].join('.');
    const texto = `de 'a@${webmail}' a 'b@${otroRegistrable}', y 'c@example.com' se queda fuera`;
    expect(correosNoReservados(texto).map((h) => h.correo)).toEqual([`a@${webmail}`, `b@${otroRegistrable}`]);
  });

  it('no confunde un paquete con ambito ni una version con un correo', () => {
    const texto = ['"@kamayuk/api": "link:../../kamayuk-lib/paquetes/api"', '"@babel/core": "^7.26.10"'].join('\n');
    expect(correosNoReservados(texto)).toEqual([]);
  });
});

describe('el arbol versionado, entero', () => {
  const rutas = archivosVersionados().filter((r) => !EXTENSIONES_BINARIAS.test(r) && !EXCLUIDOS.has(r));

  it('EL CENTINELA: `git ls-files` devuelve archivos, y estan `CLAUDE.md` y el artboard', () => {
    // Sin esto, un `git ls-files` que fallara (fuera de un repo, por ejemplo) dejaria la lista
    // vacia y la prueba de abajo en verde sobre la nada.
    expect(rutas).toContain('CLAUDE.md');
    expect(rutas).toContain('frontend/diseno/Ciudadano.dc.html');
    expect(rutas.length).toBeGreaterThan(100);
  });

  it('ningun archivo trae un correo de dominio NO reservado', () => {
    const hallazgos = rutas.flatMap((ruta) =>
      correosNoReservados(readFileSync(join(RAIZ_DEL_REPO, ruta), 'utf8'))
        .filter((h) => !(h.correo in EXENCIONES))
        .map((h) => ({ ...h, ruta })),
    );

    expect(
      hallazgos,
      'Hay correos de dominio registrable en el arbol:\n' +
        `${hallazgos.map((h: CorreoEncontrado & { ruta: string }) => `  ${h.ruta}:${h.linea} — ${h.correo}`).join('\n')}\n\n` +
        '  Un correo de mentira usa un dominio reservado (RFC 2606/6761): example.com/.org/.net,\n' +
        '  *.example, *.test, *.invalid o localhost. Si la direccion es legitima (una atribucion,\n' +
        '  por ejemplo), se exime por su direccion EXACTA en `EXENCIONES`, con el motivo escrito.',
    ).toEqual([]);
  });
});
