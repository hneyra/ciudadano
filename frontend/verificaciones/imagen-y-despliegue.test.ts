// @vitest-environment node
//
// Lee archivos del disco —el `Dockerfile`, `nginx.conf`, `.dockerignore`—: no es un DOM lo que necesita.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * **Que el portal se pueda empaquetar, y que lo que se sirve sea lo que se dice** (issue 37).
 *
 * Portada de `rentas/frontend/verificaciones/imagen-y-despliegue.test.ts` (rentas#44 y rentas#75),
 * y adaptada a lo que este portal tiene y `rentas` no:
 *
 *   · **Se sirve BAJO `/portal/`**, no en la raiz. `rentas` confia en que el ingreso quite el prefijo
 *     (`stripPrefix`) y por eso su `nginx` sirve en `/`; aqui el prefijo llega entero, que es lo que
 *     dice el issue, y el `dist/` se copia a `html/portal/`. La cuenta que ata las tres cosas
 *     —`base` de Vite, `root` de nginx y el destino del `COPY`— se DERIVA abajo, no se escribe.
 *   · **Todo 404 sale sin cache** y por UN sitio (`error_page 404 @no_existe`), no solo el de los
 *     activos: el issue pide «sin cachear errores», y un 404 que se guarda es un 404 que sobrevive al
 *     arreglo.
 *   · **Aqui no hay compose, ni descriptor, ni workflow de publicacion**: eso vive en `infrastructure`
 *     y la CI de la cuenta esta bloqueada. Quien pasa el contexto con nombre hoy es la orden del
 *     `README.md`, y es contra ella contra lo que se cruza el nombre.
 *
 * <h2>Lo que NO puede vigilar, y por eso no se finge aqui</h2>
 *
 * Que la imagen levante y sirva: eso es `docker build` + `docker run` + pedirle una pagina, y esta
 * suite corre sin demonio de Docker. Las mediciones estan en el PR del issue 37. Lo que el `dist/` de
 * la imagen lleva dentro lo mide `lo-servido-esta-limpio.test.ts` (el guion, contra muestras) y
 * `e2e/el-dist-de-la-imagen-esta-limpio.spec.ts` (contra un paquete construido como la imagen).
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');
const REPOSITORIO = join(FRONTEND, '..');

/**
 * Leer sin reventar si falta. Leerlo a secas se llevaria por delante el archivo de pruebas entero en
 * la RECOLECCION —la leccion de `andamiaje.test.ts`— y el rojo hablaria de `readFileSync`.
 */
const leer = (ruta: string) => (existsSync(ruta) ? readFileSync(ruta, 'utf8') : '');

const DOCKERFILE = leer(join(FRONTEND, 'Dockerfile'));
const NGINX = leer(join(FRONTEND, 'nginx.conf'));
const DOCKERIGNORE = leer(join(FRONTEND, '.dockerignore'));
const README = leer(join(REPOSITORIO, 'README.md'));
const VITE = leer(join(FRONTEND, 'vite.config.ts'));

/** Las lineas de una configuracion, sin comentarios: `#` a principio de linea no es una directiva. */
const sinComentarios = (texto: string) =>
  texto
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n');

/** El `Dockerfile` sin comentarios: la prosa que explica una directiva no cuenta como la directiva. */
const INSTRUCCIONES = sinComentarios(DOCKERFILE);

/** Las etapas que el propio Dockerfile declara, en orden: `FROM … AS <nombre>`. */
const etapas = [...INSTRUCCIONES.matchAll(/^FROM\s+(\S+)\s+AS\s+(\S+)/gm)].map((m) => ({
  base: m[1] ?? '',
  nombre: m[2] ?? '',
  desde: m.index,
}));

/** El texto de una etapa: de su `FROM` al siguiente, o al final. */
function etapa(nombre: string): string {
  const i = etapas.findIndex((e) => e.nombre === nombre);
  if (i === -1) return '';
  return INSTRUCCIONES.slice(etapas[i]?.desde, etapas[i + 1]?.desde ?? INSTRUCCIONES.length);
}

/** Las reglas del `.dockerignore`, sin comentarios ni lineas vacias. */
const REGLAS = sinComentarios(DOCKERIGNORE)
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l !== '');

/** Si una regla del `.dockerignore` cubre ese nombre: igual, o un patron con `*` al final que lo casa. */
const cubierto = (archivo: string) =>
  REGLAS.some((r) => r === archivo || (r.endsWith('*') && archivo.startsWith(r.slice(0, -1))));

describe('los tres archivos, y las dos etapas', () => {
  it('estan los tres archivos que definen la imagen', () => {
    for (const archivo of ['Dockerfile', 'nginx.conf', '.dockerignore']) {
      expect(existsSync(join(FRONTEND, archivo)), `falta frontend/${archivo}`).toBe(true);
    }
  });

  it('EL CENTINELA: el Dockerfile declara sus dos etapas, «construccion» e «interfaz», en ese orden', () => {
    // Sin esto, todo lo de abajo que mira «la etapa X» miraria una cadena vacia y cada `not.toMatch`
    // saldria verde sobre nada.
    expect(etapas.map((e) => e.nombre)).toEqual(['construccion', 'interfaz']);
  });

  it('construye con el Node de `.nvmrc` y sirve con un nginx CLAVADO', () => {
    // La mayor del Node la vigila tambien `el-motor-es-uno-solo.test.ts`, que cuenta el Dockerfile
    // como un sitio mas que dice el motor. Aqui se mira la forma: alpine, y la etapa que se publica
    // con una version exacta —no `stable-alpine` ni `1.31`— para que un escaneo sepa de que habla.
    expect(etapas[0]?.base).toMatch(/^node:\d+-alpine$/);
    expect(etapas[1]?.base).toMatch(/^nginx:\d+\.\d+\.\d+-alpine$/);
  });
});

describe('la imagen no corre como root, y dice si esta viva', () => {
  /**
   * El uid EN NUMERO (rentas#44). `runAsNonRoot: true` no puede comprobar un nombre: el kubelet se
   * niega a arrancar el contenedor con un `CreateContainerConfigError`, y eso solo aparece al
   * desplegar.
   */
  it('el USER es numerico, y lo hay', () => {
    const usuarios = [...INSTRUCCIONES.matchAll(/^USER\s+(\S+)/gm)].map((m) => m[1]);
    expect(usuarios, 'sin USER, nginx corre como root').not.toHaveLength(0);
    for (const u of usuarios) {
      expect(u, `«USER ${String(u)}» no es numerico: runAsNonRoot no lo puede comprobar`).toMatch(/^\d+$/);
    }
  });

  it('declara su HEALTHCHECK, y pide el index.html POR SU NOMBRE y bajo /portal/', () => {
    const sonda = /^HEALTHCHECK\s[\s\S]*?CMD\s+(.+)$/m.exec(INSTRUCCIONES)?.[1] ?? '';
    expect(sonda, 'sin HEALTHCHECK').not.toBe('');
    // `/portal/` a secas lo contestaria cualquier nginx con un `index.html`; pedir el archivo por su
    // nombre y donde el portal vive es lo unico que distingue «nginx levantado» de «nginx levantado
    // sobre el dist que se copio, en el sitio donde se sirve».
    expect(sonda).toContain('/portal/index.html');
  });
});

describe('el .dockerignore: lo que no entra en el contexto', () => {
  it('EL CENTINELA: hay reglas que leer', () => {
    expect(REGLAS.length).toBeGreaterThan(3);
  });

  it('deja fuera node_modules y el dist de fuera', () => {
    expect(REGLAS).toContain('node_modules');
    expect(cubierto('dist'), '«dist» entraria: la imagen podria publicar el de otro commit').toBe(true);
  });

  /**
   * **Todos** los archivos de entorno que Vite lee, y no solo los que `.gitignore` nombra: es el
   * hallazgo de `caja`#47 que `rentas`#44 porto. Y el que ESTE arbol tiene versionado,
   * `.env.development`, enciende la demostracion.
   */
  it('deja fuera TODOS los archivos de entorno de Vite', () => {
    for (const archivo of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development']) {
      expect(cubierto(archivo), `«${archivo}» entraria en el contexto y Vite lo hornearia`).toBe(true);
    }
  });

  it('deja fuera la salida del arnes y los paquetes que construye', () => {
    // Los nombres de los paquetes se leen de `.gitignore` —son los que el arnes deja en el disco— y
    // no se escriben aqui: el dia que el arnes construya uno mas, el `.gitignore` lo tendra que decir,
    // y esta prueba lo exigira tambien del contexto.
    const paquetes = leer(join(REPOSITORIO, '.gitignore'))
      .split('\n')
      .map((l) => l.trim().replace(/\/$/, ''))
      .filter((l) => /^dist-/.test(l));
    expect(paquetes.length, 'EL CENTINELA: el .gitignore no nombra ningun dist-*').toBeGreaterThan(1);
    for (const salida of [...paquetes, 'playwright-report', 'test-results']) {
      expect(cubierto(salida), `«${salida}» entraria en el contexto de la imagen`).toBe(true);
    }
  });
});

describe('la bandera de la demostracion, apagada AL CONSTRUIR', () => {
  it('se construye con VITE_KAMAYUK_SIN_PLATAFORMA=false, escrito y no supuesto, y antes del build', () => {
    // `vite build` no lee `.env.development`, asi que en teoria bastaria con no hacer nada. Pero «el
    // paquete sale sin la demostracion porque nadie se acordo de encenderla» se pierde el dia que
    // alguien cree un `.env.production` (rentas#114). Escrito aqui es una decision.
    const construccion = etapa('construccion');
    expect(construccion).toMatch(/^ENV VITE_KAMAYUK_SIN_PLATAFORMA=false$/m);
    expect(construccion.indexOf('VITE_KAMAYUK_SIN_PLATAFORMA=false')).toBeLessThan(
      construccion.indexOf('RUN yarn build'),
    );
    expect(construccion.indexOf('RUN yarn build'), 'la etapa no construye').toBeGreaterThan(-1);
  });
});

describe('lo que se sirve: sin mapas, y comprobado en la ULTIMA etapa', () => {
  it('los mapas se retiran con el guion, despues de construir', () => {
    const construccion = etapa('construccion');
    const quitar = construccion.indexOf('imagen/sin-mapas.sh dist');
    expect(quitar, 'la etapa de construccion no retira los mapas').toBeGreaterThan(-1);
    expect(quitar).toBeGreaterThan(construccion.indexOf('RUN yarn build'));
  });

  /**
   * La leccion entera de rentas#44: una comprobacion sobre un artefacto intermedio no afirma nada
   * sobre el que se publica. Alli, un `COPY` de `src/` puesto en la ultima etapa servia
   * `/src/api/identidad.ts` con 200 y el `docker build` en VERDE, porque la comprobacion ya habia
   * corrido en otra etapa. Asi que va en `interfaz` y DESPUES de su ultimo `COPY`.
   */
  it('la comprobacion corre en la etapa que se publica, despues de su ultimo COPY', () => {
    const interfaz = etapa('interfaz');
    const comprobacion = interfaz.indexOf('imagen/lo-servido-esta-limpio.sh');
    expect(comprobacion, 'la etapa «interfaz» no comprueba lo que sirve').toBeGreaterThan(-1);

    const ultimoCopy = Math.max(...[...interfaz.matchAll(/^COPY\s/gm)].map((m) => m.index));
    expect(comprobacion, 'hay un COPY despues de la comprobacion: lo que copie no lo mira nadie').toBeGreaterThan(
      ultimoCopy,
    );
    // Y mira el directorio servido ENTERO, no solo el del portal: lo que se copie al lado tambien se sirve.
    expect(interfaz).toMatch(/lo-servido-esta-limpio\.sh \/usr\/share\/nginx\/html /);
  });

  it('el guion llega por un montaje, y NO se queda en la imagen', () => {
    // Un `COPY` del guion lo dejaria dentro de lo que se publica; montado de la etapa de construccion
    // solo existe mientras corre ese `RUN`.
    expect(etapa('interfaz')).toMatch(/RUN --mount=type=bind,from=construccion,/);
  });
});

describe('#75 de rentas — el contexto con nombre, y la profundidad que lo sostiene', () => {
  const nombres = etapas.map((e) => e.nombre);
  const copiaDe = [...INSTRUCCIONES.matchAll(/--from=([^\s,]+)/gm)].map((m) => m[1] ?? '');
  const contextosQuePide = [...new Set(copiaDe.filter((n) => !nombres.includes(n)))];

  it('EL CENTINELA: el Dockerfile copia de algun sitio', () => {
    expect(copiaDe.length).toBeGreaterThan(0);
  });

  it('el unico contexto que pide es «kamayuk-lib», y el README dice como pasarlo', () => {
    // BuildKit resuelve un `--from=` desconocido como NOMBRE DE IMAGEN, o sea que se iria a buscar
    // `docker.io/library/kamayuk-lib:latest` y el rojo hablaria de una imagen que no existe. Por eso
    // el nombre se cruza con la orden que la construye.
    expect(contextosQuePide).toEqual(['kamayuk-lib']);
    expect(README, 'el README no dice como pasar el contexto con nombre').toContain('--build-context kamayuk-lib=');
  });

  it('LA PROFUNDIDAD: el `WORKDIR` deja `../../` donde el `COPY` pone al hermano', () => {
    // Se DERIVA de los tres archivos (rentas#75): `link:../../kamayuk-lib/paquetes/*` resuelto desde
    // el `WORKDIR` tiene que caer donde el `COPY --from=kamayuk-lib` dejo los paquetes. Acortar el
    // `WORKDIR` a `/obra/frontend` —que es lo que apetece— hace que `yarn install` no lo encuentre.
    const paquete = /"@kamayuk\/[a-z]+":\s*"link:([^"]+)"/.exec(leer(join(FRONTEND, 'package.json')))?.[1];
    const trabajo = /^WORKDIR\s+(\S+)/m.exec(INSTRUCCIONES)?.[1];
    const destinoDelCopy = /^COPY --from=kamayuk-lib\s+\S+\s+(\S+)/m.exec(INSTRUCCIONES)?.[1];

    expect(paquete, 'no hay ningun `link:` en el package.json').toBeDefined();
    expect(trabajo, 'el Dockerfile no declara WORKDIR').toBeDefined();
    expect(destinoDelCopy, 'el COPY del hermano no dice donde lo deja').toBeDefined();

    const resuelto = posix.join(trabajo ?? '', paquete ?? '');
    const puesto = posix.join(destinoDelCopy ?? '', '..');
    expect(
      resuelto.startsWith(puesto),
      `El «link:» lleva a «${resuelto}» y el COPY deja al hermano en «${puesto}».`,
    ).toBe(true);
  });

  it('del hermano se copia SOLO `paquetes/`: un contexto con nombre no lo acota ningun `.dockerignore`', () => {
    // Medido en rentas#75: `kamayuk-lib` no trae `.dockerignore`; un `COPY --from=kamayuk-lib .`
    // se llevaria dentro su `node_modules`, su `.git` y cualquier `.env`.
    expect(INSTRUCCIONES).toMatch(/^COPY --from=kamayuk-lib paquetes\/ /m);
    expect(INSTRUCCIONES).not.toMatch(/^COPY --from=kamayuk-lib \.\s/m);
  });
});

describe('nginx: bajo /portal/, con sus cabeceras, sin cachear errores y sin redirigir', () => {
  const TEXTO = sinComentarios(NGINX);

  /** Los bloques `location` de la configuracion, con su cuerpo. */
  const bloques = (() => {
    const salida: { cabecera: string; cuerpo: string }[] = [];
    const patron = /location\s+([^{]+)\{/g;
    let m: RegExpExecArray | null;
    while ((m = patron.exec(TEXTO)) !== null) {
      let profundidad = 1;
      let i = patron.lastIndex;
      while (i < TEXTO.length && profundidad > 0) {
        if (TEXTO[i] === '{') profundidad += 1;
        if (TEXTO[i] === '}') profundidad -= 1;
        i += 1;
      }
      salida.push({ cabecera: (m[1] ?? '').trim(), cuerpo: TEXTO.slice(patron.lastIndex, i - 1) });
    }
    return salida;
  })();

  const bloque = (cabecera: string) => bloques.find((b) => b.cabecera === cabecera);
  const cacheDe = (cabecera: string) =>
    bloque(cabecera)?.cuerpo.match(/add_header\s+Cache-Control[^;]+;/)?.[0] ?? '(no declara Cache-Control)';

  const LAS_TRES = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy'];

  it('EL CENTINELA: el analizador encuentra los bloques de verdad', () => {
    // Si esto se rompe, todas las de abajo pasarian en verde sobre una lista vacia.
    expect(bloques.map((b) => b.cabecera)).toEqual(
      expect.arrayContaining(['/', '= /portal/', '/portal/', '/portal/assets/', '@no_existe']),
    );
  });

  /**
   * `add_header` **no se hereda**: un bloque que declara una cabecera propia descarta TODAS las del
   * nivel de arriba. Y `always`, porque sin el no salen en los errores —un 404 tambien se enmarca—.
   */
  it('CADA location declara las tres cabeceras de seguridad, con «always»', () => {
    for (const { cabecera, cuerpo } of bloques) {
      for (const nombre of LAS_TRES) {
        expect(cuerpo, `el bloque «location ${cabecera}» no declara «${nombre} … always»`).toMatch(
          new RegExp(`add_header\\s+${nombre}\\s+[^;]+always\\s*;`),
        );
      }
    }
  });

  it('y ninguna cabecera de seguridad se declara sin «always», ni fuera de un location', () => {
    for (const nombre of LAS_TRES) {
      for (const encontrada of TEXTO.match(new RegExp(`add_header\\s+${nombre}\\s+[^;]*;`, 'g')) ?? []) {
        expect(encontrada, 'sin «always» la cabecera no sale en los errores').toContain('always');
      }
    }
  });

  /**
   * **El mapa de rutas: `base` de Vite + `root` de nginx = destino del `COPY`.** Tres archivos que
   * tienen que decir lo mismo y que ninguno comprueba solo. Con `base: '/portal/'` y el `dist/`
   * copiado a la raiz de `html/`, el `index.html` pediria `/portal/assets/…` y nginx lo buscaria en
   * `html/portal/assets/`, que no existe: pantalla en blanco con cada activo en 404.
   */
  it('el dist se copia exactamente a donde nginx lo busca bajo la base de Vite', () => {
    // A principio de linea: la prosa de `vite.config.ts` cita `base: '/'` para contar por que no.
    const base = /^\s*base:\s*'([^']+)'/m.exec(VITE)?.[1];
    const raiz = /^\s*root\s+([^;]+);/m.exec(TEXTO)?.[1]?.trim();
    const destino = /^COPY --from=construccion\s+\S+\/dist\/\s+(\S+)$/m.exec(etapa('interfaz'))?.[1];
    expect(base, 'vite.config.ts no declara base').toBeDefined();
    expect(raiz, 'nginx.conf no declara root').toBeDefined();
    expect(destino, 'la etapa «interfaz» no copia el dist/').toBeDefined();
    expect(posix.join(destino ?? '', '/')).toBe(posix.join(raiz ?? '', base ?? '', '/'));
    expect(bloque(`= ${base ?? ''}`), `«${String(base)}» no se sirve`).toBeDefined();
  });

  it('`/portal/` sirve el index.html SIN redirigir, y sin cache', () => {
    const portada = bloque('= /portal/');
    expect(portada?.cuerpo).toMatch(/try_files\s+\/portal\/index\.html\s+=404\s*;/);
    expect(cacheDe('= /portal/')).toMatch(/"no-cache"\s+always/);
    expect(cacheDe('= /portal/index.html')).toMatch(/"no-cache"\s+always/);
  });

  /**
   * Las señas del ambiente se sustituyen en el despliegue montando otro `configuracion.js` encima
   * (como el `ConfigMap` de `rentas`): un navegador que se quedara con el anterior mandaria al
   * ciudadano al emisor OIDC del ambiente que fuera. `no-store`, no `no-cache`.
   */
  it('configuracion.js no se guarda, y silencio.html tampoco se cachea', () => {
    expect(cacheDe('= /portal/configuracion.js')).toMatch(/"no-store"\s+always/);
    expect(cacheDe('= /portal/silencio.html')).toMatch(/"no-cache"\s+always/);
  });

  /**
   * La cache de un ano va **sin** `always` (medido en rentas#44: con `always`, un activo que no
   * existe contestaba 404 con `immutable` dentro, y el navegador se quedaba un ano sin volver a
   * pedirlo). Es la unica cabecera sin `always`, y por eso se comprueba.
   */
  it('los activos con huella: cache de un ano, NO en los errores, y 404 si faltan', () => {
    const activos = bloque('/portal/assets/');
    expect(cacheDe('/portal/assets/')).toContain('immutable');
    expect(cacheDe('/portal/assets/'), 'con «always» un 404 de un activo se cachearia un ano').not.toContain('always');
    expect(activos?.cuerpo).toMatch(/try_files\s+\$uri\s+=404\s*;/);
    expect(activos?.cuerpo, 'un activo que falta daria el index.html con 200').not.toContain('index.html');
  });

  /**
   * **404 de verdad**, y sin el «200 que miente» de rentas#44: las rutas del portal viven en el hash,
   * asi que aqui NADIE cae al `index.html` —ni `/portal/lo-que-sea` ni un `.js` que falta—.
   */
  it('lo que no existe da 404: ningun try_files cae al index.html salvo la portada', () => {
    for (const { cabecera, cuerpo } of bloques) {
      if (cabecera === '= /portal/') continue;
      const intento = /try_files\s+([^;]+);/.exec(cuerpo)?.[1];
      if (intento !== undefined) expect(intento, `«location ${cabecera}»`).toMatch(/=404$/);
    }
    expect(bloque('/portal/')?.cuerpo).toMatch(/try_files\s+\$uri\s+=404\s*;/);
  });

  it('y TODO 404 sale por un solo sitio, sin cache', () => {
    // «Sin cachear errores»: un 404 guardado sobrevive al arreglo. Por eso todos pasan por el mismo
    // bloque con `no-store always`, y no cada uno con lo que su location dijera.
    expect(TEXTO).toMatch(/^\s*error_page\s+404\s+@no_existe\s*;/m);
    expect(cacheDe('@no_existe')).toMatch(/"no-store"\s+always/);
    expect(bloque('@no_existe')?.cuerpo).toMatch(/return\s+404\b/);
  });

  /**
   * El reves del bloque `/rentas/` de rentas#44: alli el ingreso QUITA el prefijo y una ruta que lo
   * trae es la averia; aqui el prefijo llega entero, y la averia es una ruta que NO lo trae. Sin
   * este bloque, un `stripPrefix` puesto por costumbre daria 404 mudos en todo el portal.
   */
  it('fuera de /portal/, 404 nombrando la causa', () => {
    const resto = bloque('/');
    expect(resto?.cuerpo).toMatch(/return\s+404\s+"/);
    expect(resto?.cuerpo).toContain('stripPrefix');
    expect(cacheDe('/')).toMatch(/"no-store"\s+always/);
  });

  /**
   * **Sin redirecciones**, ni una. Tampoco un reenvio a la API: el mismo origen lo pone el ingreso,
   * y un segundo camino a la API desde aqui seria uno que nadie revisa (rentas#44). Los nombres de
   * las directivas se componen para que la prosa de este archivo no cuente como una.
   */
  it('no hay ni una redireccion, ni un reenvio', () => {
    expect(TEXTO).not.toMatch(/return\s+30[1278]\b/);
    expect(TEXTO).not.toMatch(/^\s*rewrite\s/m);
    expect(NGINX.split(['proxy', 'pass'].join('_')).length - 1).toBe(0);
  });
});

describe('las senias del ambiente', () => {
  /**
   * El que viaja en la imagen esta VACIO a proposito: es el que se monta encima en el despliegue. Si
   * trajera valores, una municipalidad sin el suyo montado entraria por el emisor de otra —o por
   * `localhost`— sin que nada lo dijera.
   */
  it('el configuracion.js que viaja en la imagen no fija ninguna senia', () => {
    const publico = leer(join(FRONTEND, 'public', 'configuracion.js'));
    expect(publico).toContain('window.__KAMAYUK_CIUDADANO__');
    for (const senia of ['oidcRealm', 'oidcCliente', 'oidcAlcance']) {
      expect(sinComentarios(publico.replace(/\/\*[\s\S]*?\*\//g, '')), `«${senia}» no puede venir con valor`).not.toContain(
        senia,
      );
    }
  });
});
