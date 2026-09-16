// @vitest-environment node
//
// En `node` y no en jsdom, que es el entorno por omision de este proyecto: este archivo importa
// `vite.config.ts` **de verdad** —en vez de leerlo como texto, que es lo que permitiria que la
// configuracion dijera una cosa y la prueba comprobara otra— y eso arrastra a esbuild, que bajo
// jsdom muere con «Invariant violation: new TextEncoder().encode("") instanceof Uint8Array is
// incorrectly false». Aqui no hay DOM que necesitar: lo que se mide son archivos y objetos.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PROHIBICIONES } from '../eslint.prohibiciones.mjs';
import { PREFIJO } from '../src/api/prefijo.ts';
import configuracion from '../vite.config.ts';

/**
 * **El camino a la API**: que exista, que sea uno solo, y que nadie se lo salte (issue 13).
 *
 * Portada de `rentas/frontend/verificaciones/camino-a-la-api.test.ts`, con la parte que aqui tiene
 * sujeto: `rentas` comprueba ademas que lo declarado servido lo publique su contrato, y este portal
 * todavia no declara ninguna operacion (eso es el issue 14).
 *
 * <h2>Por que estas comprobaciones son estaticas y no de comportamiento</h2>
 *
 * Porque las tres cosas que vigilan **no producen ningun sintoma cuando se rompen**:
 *
 *   · sin `server.proxy`, `/rentas/api/v1/...` lo atiende el propio servidor de Vite y devuelve el
 *     `index.html` con un **200**. Un exito con HTML donde la pantalla espera JSON: no parece un
 *     error, asi que nadie lo busca;
 *   · con la raiz escrita en dos sitios y desalineada, cada mitad funciona sola y el desajuste solo
 *     aparece con las dos puestas a la vez;
 *   · un `http://localhost:18080` dentro de `src/` funciona en el puesto de quien lo escribio y en
 *     ningun otro, y el sintoma sale en el navegador de quien atiende, no en una prueba.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '..');

/** Todos los `.ts`/`.tsx` bajo `src/`, con su ruta relativa al frontend. */
function fuentes(desde = join(FRONTEND, 'src')): readonly string[] {
  return readdirSync(desde).flatMap((entrada) => {
    const ruta = join(desde, entrada);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.tsx?$/.test(entrada) ? [relative(FRONTEND, ruta)] : [];
  });
}

const deProduccion = fuentes().filter((ruta) => !/\.test\.tsx?$/.test(ruta));

describe('`vite.config.ts` declara el camino a la API', () => {
  const proxy = configuracion.server?.proxy ?? {};

  it('declara una regla para la raiz del sistema, y no para otra cosa', () => {
    // Sin esto la peticion no sale del servidor de Vite. Y el backend de `rentas` NO publica
    // ninguna cabecera `Access-Control-Allow-Origin` —cero `CorsConfiguration`, cero
    // `@CrossOrigin`—, asi que el mismo origen es la unica via sin tocarlo.
    expect(Object.keys(proxy)).toEqual([PREFIJO]);
  });

  it('el destino por omision es Traefik en el 18080, y sale de una variable de entorno', () => {
    const regla = proxy[PREFIJO];

    // Lo medido el 2026-09-16 en la plataforma local.
    expect(typeof regla === 'object' ? regla.target : regla).toBe('http://localhost:18080');
    // Que se pueda cambiar sin editar el archivo: un archivo de configuracion editado a mano acaba
    // en un commit que nadie queria.
    expect(readFileSync(join(FRONTEND, 'vite.config.ts'), 'utf8')).toContain(
      'process.env.KAMAYUK_BACKEND',
    );
  });

  it('cruza el origen, que es para lo que existe', () => {
    const regla = proxy[PREFIJO];

    expect(typeof regla === 'object' ? regla.changeOrigin : undefined).toBe(true);
  });

  it('y NO reescribe la ruta: Traefik enruta por PathPrefix(/rentas)', () => {
    const regla = proxy[PREFIJO];

    // Quitarle el prefijo seria quitarle justo aquello por lo que se enruta, y el sintoma seria un
    // 404 de Traefik que parece un 404 del backend.
    expect(typeof regla === 'object' ? regla.rewrite : undefined).toBeUndefined();
  });
});

describe('la raiz de la API es UNA, y el proxy y el cliente leen la misma', () => {
  it('se escribe una sola vez, en `src/api/prefijo.ts`', () => {
    const hoja = readFileSync(join(FRONTEND, 'src/api/prefijo.ts'), 'utf8');

    expect(/export const PREFIJO = '([^']+)'/.exec(hoja)?.[1]).toBe('/rentas/api/v1');
    // Y ese archivo no importa nada: es lo unico que deja que `vite.config.ts` —que se ejecuta en
    // Node, donde no hay `import.meta.env`— lea la misma constante que el cliente del navegador.
    expect(hoja.split('\n').filter((l) => /^import\s/.test(l))).toEqual([]);
  });

  it('el cliente la usa, no la vuelve a escribir', () => {
    const cliente = readFileSync(join(FRONTEND, 'src/api/cliente.ts'), 'utf8');

    expect(cliente).toContain("from './prefijo.ts'");
    expect(cliente).toContain('prefijo: PREFIJO');
    expect(cliente, 'la raiz esta escrita otra vez en el cliente').not.toContain("'/rentas/api/v1'");
  });

  it('y `vite.config.ts` tampoco: enruta con la importada', () => {
    const config = readFileSync(join(FRONTEND, 'vite.config.ts'), 'utf8');

    expect(config).toContain("from './src/api/prefijo.ts'");
    expect(config).toContain('[PREFIJO]: {');
    expect(config).not.toContain("'/rentas/api/v1'");
  });

  it('ninguna fuente de produccion escribe la URL del backend: la API es del mismo origen', () => {
    const culpables = deProduccion.filter((ruta) =>
      /localhost:18080|127\.0\.0\.1:18080/.test(readFileSync(join(FRONTEND, ruta), 'utf8')),
    );

    expect(culpables).toEqual([]);
  });
});

describe('solo `src/api/` puede llamar a `fetch`', () => {
  it('la prohibicion sigue viva, y su unica excepcion es ese directorio', () => {
    const delFetch = PROHIBICIONES.find((p) => p.clave === 'fetch-fuera-del-cliente');

    expect(delFetch, 'la prohibicion del `fetch` desaparecio de la lista').toBeDefined();
    // Una excepcion mas y `solicitar()` deja de ser el unico camino — y con el se van el token, el
    // `problem+json` y la clave de idempotencia, que se enchufan en un sitio o en veinte.
    expect([...(delFetch?.salvo ?? [])]).toEqual(['src/api/']);
    expect(PROHIBICIONES.filter((p) => p.salvo !== undefined)).toHaveLength(1);
  });

  it('y ningun archivo fuera de `src/api/` lo llama', () => {
    // ESLint lo senala al lintar, pero solo si el archivo no lleva un `eslint-disable` encima. Esto
    // lo mide sobre el texto, que es lo que un `eslint-disable` no puede apagar.
    const culpables = deProduccion.filter(
      (ruta) =>
        !ruta.startsWith('src/api/') && /\bfetch\s*\(/.test(readFileSync(join(FRONTEND, ruta), 'utf8')),
    );

    expect(culpables).toEqual([]);
  });

  it('hoy tampoco lo llama `src/api/`: quien lo hace es `@kamayuk/api`', () => {
    // La excepcion se situa igual, porque es donde la llamada tendria su sitio. Que hoy no haya
    // ninguna es la mitad buena de enlazar la libreria: el unico `fetch` del producto vive en un
    // paquete con su propia prueba de lo que sale por el cable.
    const conFetch = deProduccion.filter(
      (ruta) =>
        ruta.startsWith('src/api/') && /\bfetch\s*\(/.test(readFileSync(join(FRONTEND, ruta), 'utf8')),
    );

    expect(conFetch).toEqual([]);
  });
});
