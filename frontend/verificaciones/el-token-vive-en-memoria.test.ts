import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PROHIBICIONES } from '../eslint.prohibiciones.mjs';
import { identidad } from '../src/api/identidad.ts';

/**
 * **El token vive en memoria, y lo que se guarda se nombra** (issue 13).
 *
 * En jsdom y no en `node`, aunque lea archivos: la mitad que de verdad importa —que fijar un token
 * no deje nada en el almacenamiento— se mide ejerciendola, y para eso hace falta un
 * `sessionStorage` de verdad.
 *
 * <h2>Las tres cosas que vigila, y por que ninguna se ve sola</h2>
 *
 * 1. **Que la prohibicion siga encendida en TODO el arbol.** El monolito guardaba el token en
 *    `localStorage.setItem('sgtm.token', …)`. Un `salvo: ['src/api/']` en esta regla la apagaria
 *    justo en el unico directorio donde hay un token, y nada mas cambiaria.
 * 2. **Que el token no llegue al almacenamiento**, que es lo que la regla de ESLint **no puede
 *    ver**: ella mira el nombre de la clave, asi que `sessionStorage.setItem('x', token)` la pasa
 *    limpia. Aqui se mira el valor.
 * 3. **Que lo que `@kamayuk/sesion` SI guarda este dicho, una por una.** Son cinco claves y ninguna
 *    es una credencial: el verificador PKCE solo vale para el canje que lo genero —sin el codigo de
 *    autorizacion, que viaja por la barra de direcciones una sola vez, no sirve de nada—, y las
 *    otras cuatro son el estado, el destino, la cuenta de idas y la marca de salida. Escribirlas
 *    aqui es lo que hace que anadir una sexta sea una decision y no un descuido.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/** Todos los `.ts`/`.tsx` de produccion bajo `src/`. */
function fuentes(desde = join(FRONTEND, 'src')): readonly string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.tsx?$/.test(entrada) ? [relative(FRONTEND, ruta)] : [];
  });
}

const deProduccion = fuentes().filter((ruta) => !/\.test\.tsx?$/.test(ruta));

/**
 * El codigo SIN comentarios, y esto no es una comodidad: es un hallazgo medido.
 *
 * La primera version leia el archivo entero y senalo CUATRO —`src/api/identidad.ts`,
 * `src/marco/impresionEnClaro.ts`, `src/pasos/identificar/Identificar.tsx` y
 * `src/pasos/pagar/Pagar.tsx`—, y los cuatro **nombran el almacenamiento para decir que NO lo
 * usan**: «nada la escribe en `localStorage` ni en `sessionStorage`». Una guarda que no distingue
 * «lo usa» de «lo menciona» se acaba desactivando para poder escribir un comentario, y entonces no
 * vigila nada. Es la misma correccion que `andamiaje.test.ts` hizo con el workflow, al reves.
 *
 * Se recorre caracter a caracter y no con expresiones regulares porque hay que saber si se esta
 * DENTRO de una cadena: un `'https://…'` se comeria el resto de la linea.
 */
function sinComentarios(texto: string): string {
  let salida = '';
  let comilla: string | null = null;
  let escapado = false;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i] ?? '';
    if (comilla !== null) {
      salida += c;
      if (escapado) escapado = false;
      else if (c === '\\') escapado = true;
      else if (c === comilla) comilla = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      comilla = c;
      salida += c;
      continue;
    }
    if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      salida += '\n';
      continue;
    }
    if (c === '/' && texto[i + 1] === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) i += 1;
      i += 1;
      salida += ' ';
      continue;
    }
    salida += c;
  }
  return salida;
}

/** Las cinco claves que la libreria compone con el prefijo de este portal. */
const PREFIJO_DE_CLAVES = 'kamayuk.ciudadano';
const LO_QUE_SE_GUARDA: Readonly<Record<string, string>> = {
  [`${PREFIJO_DE_CLAVES}.pkce.verificador`]:
    'el verificador PKCE: el secreto de un solo uso que demuestra que quien canja es quien pidio',
  [`${PREFIJO_DE_CLAVES}.pkce.estado`]: 'el `state`, que es lo que ata la vuelta a la ida',
  [`${PREFIJO_DE_CLAVES}.pkce.destino`]: 'el hash al que volver cuando la vuelta no lo dice',
  [`${PREFIJO_DE_CLAVES}.pkce.idas`]: 'cuantas idas seguidas van, para parar un rebote sin fin',
  [`${PREFIJO_DE_CLAVES}.pkce.salida`]: 'que se acaba de cerrar sesion, para no entrar solo otra vez',
};

describe('la prohibicion sigue encendida, y sin excepcion', () => {
  it('`token-en-almacenamiento` esta en la lista', () => {
    expect(PROHIBICIONES.map((p) => p.clave)).toContain('token-en-almacenamiento');
  });

  it('y NO gano excepcion con el cliente: vale en todo el arbol', () => {
    const suya = PROHIBICIONES.find((p) => p.clave === 'token-en-almacenamiento');

    // La unica prohibicion con excepcion es la del `fetch`. Si esta ganara una, seria justo en el
    // directorio donde vive la puerta.
    expect(suya?.salvo).toBeUndefined();
  });
});

describe('ningun archivo de produccion toca el almacenamiento', () => {
  it('ni `localStorage` ni `sessionStorage` aparecen en `src/`', () => {
    // En `rentas` este mismo caso admite UN archivo —su copia de `identidad.ts`, que implementa el
    // rebote—. Aqui el rebote es de `@kamayuk/sesion`, asi que la afirmacion es mas fuerte: cero.
    // El tema tampoco cuenta: lo guarda `ProveedorDeTema` dentro de la libreria.
    const tocan = deProduccion.filter((ruta) =>
      /\b(localStorage|sessionStorage)\b/.test(sinComentarios(readFileSync(join(FRONTEND, ruta), 'utf8'))),
    );

    expect(tocan).toEqual([]);
  });

  it('LA MUESTRA: un archivo que SI lo tocara se senalaria, aunque lo llame como quiera', () => {
    // Sin este caso, el filtro de comentarios de arriba podria llevarse por delante tambien el
    // codigo —un error en el recorrido de cadenas— y la guarda quedaria en verde sobre la nada.
    const culpable = `
      // Aqui no se guarda ningun token en sessionStorage, de verdad.
      const cualquiera = '//sessionStorage';
      export function guardar(algo: string) {
        window.sessionStorage.setItem('destino', algo);
      }
    `;
    const limpio = `
      /* Nada se escribe en localStorage ni en sessionStorage: el token vive en memoria. */
      export const enMemoria = { token: null };
    `;

    expect(/\b(localStorage|sessionStorage)\b/.test(sinComentarios(culpable))).toBe(true);
    expect(/\b(localStorage|sessionStorage)\b/.test(sinComentarios(limpio))).toBe(false);
  });
});

describe('el token se queda en memoria: se ejerce, no se supone', () => {
  it('fijarlo no deja nada en `sessionStorage` ni en `localStorage`', () => {
    sessionStorage.clear();
    localStorage.clear();

    identidad.fijarToken('un.token.de.mentira', 'un.id_token.de.mentira');

    expect(identidad.token()).toBe('un.token.de.mentira');
    expect(
      [...Array(sessionStorage.length).keys()].map((i) => sessionStorage.key(i)),
      'algo del canje acabo en `sessionStorage`',
    ).toEqual([]);
    expect([...Array(localStorage.length).keys()].map((i) => localStorage.key(i))).toEqual([]);

    identidad.fijarToken(null);
    expect(identidad.token()).toBeNull();
  });

  it('y ningun almacenamiento contiene el texto del token', () => {
    // La mitad que la regla de ESLint no ve: ella mira el NOMBRE de la clave, asi que
    // `sessionStorage.setItem('destino', token)` le pasa limpia.
    sessionStorage.clear();
    identidad.fijarToken('el-secreto-que-no-se-guarda');

    expect(JSON.stringify(sessionStorage)).not.toContain('el-secreto-que-no-se-guarda');
    expect(JSON.stringify(localStorage)).not.toContain('el-secreto-que-no-se-guarda');

    identidad.fijarToken(null);
  });
});

describe('lo que `@kamayuk/sesion` guarda esta dicho, una clave por una', () => {
  const requerir = createRequire(import.meta.url);
  const fuenteDeLaLibreria = readFileSync(
    join(dirname(requerir.resolve('@kamayuk/sesion')), 'identidad.ts'),
    'utf8',
  );

  /** Las claves que la libreria compone: `const X = `${prefijoDeClaves}.lo.que.sea``. */
  const compuestas = [...fuenteDeLaLibreria.matchAll(/`\$\{prefijoDeClaves\}\.([\w.]+)`/g)].map(
    (c) => `${PREFIJO_DE_CLAVES}.${c[1] ?? ''}`,
  );

  it('EL CENTINELA: la libreria compone sus claves con el prefijo, y se encuentran', () => {
    // Sin esto, un cambio de forma alla —claves escritas enteras, o un solo objeto— dejaria lo de
    // abajo comparando dos listas vacias, en verde, con el prefijo de este portal sin aplicarse.
    expect(compuestas.length, 'no se encontro ni una clave compuesta en `@kamayuk/sesion`').toBeGreaterThan(0);
  });

  it('son exactamente las cinco que este archivo nombra', () => {
    expect(
      [...new Set(compuestas)].sort(),
      'La libreria guarda algo que este portal no ha decidido guardar. Anadelo a\n' +
        '`LO_QUE_SE_GUARDA` diciendo QUE es — o quitalo, si no tenia que estar.',
    ).toEqual(Object.keys(LO_QUE_SE_GUARDA).sort());
  });

  it('y ninguna es una credencial, ni lo parece', () => {
    // Que no lo parezca tambien importa: una clave acabada en «.sesion» invita a meter dentro lo que
    // esta prohibido guardar, y la regla de ESLint la senalaria a quien intentara leerla.
    const sospechosas = Object.keys(LO_QUE_SE_GUARDA).filter((clave) =>
      /token|jwt|bearer|credencial|contrasena|clave|acceso|sesion/i.test(clave),
    );

    expect(sospechosas).toEqual([]);
  });

  it('y todas llevan el prefijo de ESTE portal', () => {
    // Las interfaces del producto comparten `sessionStorage` cuando se sirven del mismo origen: sin
    // prefijo propio, abrir dos en la misma pestana se pisa el verificador de la primera.
    const sinPrefijo = Object.keys(LO_QUE_SE_GUARDA).filter(
      (clave) => !clave.startsWith(`${PREFIJO_DE_CLAVES}.`),
    );

    expect(sinPrefijo).toEqual([]);
  });
});
