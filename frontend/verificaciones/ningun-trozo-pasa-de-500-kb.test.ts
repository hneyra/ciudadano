// @vitest-environment node
//
// Importa `vite.config.ts` de verdad —arrastra a esbuild, que bajo jsdom no arranca— y lee `src/`.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { OutputBundle, PluginContext } from 'rollup';
import { describe, expect, it } from 'vitest';

import configuracion from '../vite.config.ts';
import {
  TOPE_DE_UN_TROZO_KB,
  ningunTrozoPasaDelTope,
  paqueteDe,
  trozoDeProveedor,
  trozosQuePasanDelTope,
} from '../trozos.ts';
import { RAIZ } from './artboards.ts';

/** Los `.ts` y `.tsx` de `src/`, sin pruebas. */
function codigoDe(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return codigoDe(ruta);
    return /\.tsx?$/.test(entrada.name) && !entrada.name.includes('.test.') ? [ruta] : [];
  });
}

/**
 * **Ningun trozo de JavaScript del bundle pasa de 500 kB, y el aviso no se calla subiendo el liston**
 * (nota del revisor del issue 11).
 *
 * <h2>Quien hace cumplir el tope, y que mide esta guarda</h2>
 *
 * Lo hace cumplir `ningunTrozoPasaDelTope()` (`trozos.ts`), que hace FALLAR `yarn build` —en local, en
 * el job `verificar` y en el `arnes`, que construye antes de servir—. Esta guarda no construye (seria
 * un `vite build` entero en cada `yarn test`); mide que esa pieza siga ahi y siga mordiendo:
 *
 * · que el complemento este puesto en `vite.config.ts`;
 * · que `chunkSizeWarningLimit` no se haya subido —la salida facil que el revisor descarto—;
 * · que el reparto siga declarado (`manualChunks`) y que las pantallas sigan siendo `import()`: una
 *   importacion estatica de una pantalla la devuelve al trozo de entrada, y Vite solo lo AVISA;
 * · y que el complemento, con un bundle de mentira, falle por encima del tope y no por debajo.
 */

/** Los complementos, aplanados: Vite admite listas anidadas. */
function aplanar(valor: unknown): { name?: string }[] {
  if (Array.isArray(valor)) return valor.flatMap((x: unknown) => aplanar(x));
  if (valor === null || valor === undefined || valor === false) return [];
  return [valor as { name?: string }];
}

/** Un bundle de mentira con trozos del tamano pedido, en bytes. */
function bundleDe(trozos: Record<string, number>): OutputBundle {
  return Object.fromEntries(
    Object.entries(trozos).map(([nombre, bytes]) => [nombre, { type: 'chunk', fileName: nombre, code: 'x'.repeat(bytes) }]),
  ) as unknown as OutputBundle;
}

/** Corre el `generateBundle` del complemento y devuelve el error con que para la construccion, si para. */
function construirCon(bundle: OutputBundle): string | undefined {
  const complemento = ningunTrozoPasaDelTope();
  const generar = complemento.generateBundle as (this: PluginContext, o: unknown, b: OutputBundle) => void;
  let error: string | undefined;
  const contexto = {
    error: (mensaje: string) => {
      error = mensaje;
      throw new Error(mensaje);
    },
  } as unknown as PluginContext;
  try {
    generar.call(contexto, {}, bundle);
  } catch {
    // El mensaje ya quedo en `error`.
  }
  return error;
}

describe('el tope de 500 kB se hace cumplir en la construccion', () => {
  const complementos = aplanar(configuracion.plugins ?? []).map((c) => c.name ?? '');

  it('EL CENTINELA: la configuracion trae complementos, y el tope es el de Vite', () => {
    expect(complementos.length).toBeGreaterThan(1);
    expect(TOPE_DE_UN_TROZO_KB).toBe(500);
  });

  it('el complemento que hace fallar `yarn build` esta puesto en `vite.config.ts`', () => {
    expect(
      complementos,
      'Sin `ningunTrozoPasaDelTope()`, un trozo de mas de 500 kB vuelve a salir con un aviso amarillo y la CI\n' +
        'en verde.',
    ).toContain('ciudadano:ningun-trozo-pasa-del-tope');
  });

  it('y `chunkSizeWarningLimit` NO se ha subido: el aviso se atiende repartiendo, no callandolo', () => {
    const limite = configuracion.build?.chunkSizeWarningLimit;
    expect(
      limite === undefined || limite <= TOPE_DE_UN_TROZO_KB,
      `vite.config.ts sube chunkSizeWarningLimit a ${String(limite)}.`,
    ).toBe(true);
  });

  it('el reparto de las dependencias sigue declarado', () => {
    const salida = configuracion.build?.rollupOptions?.output;
    expect(Array.isArray(salida) ? undefined : salida?.manualChunks).toBe(trozoDeProveedor);
  });

  it('por encima del tope, la construccion FALLA nombrando el trozo y su tamano', () => {
    const error = construirCon(bundleDe({ 'assets/index.js': 500_001, 'assets/Buscar.js': 7_000 }));
    expect(error).toContain('assets/index.js  500.00 kB');
    expect(error).not.toContain('Buscar');
    expect(error).toContain('No se sube `chunkSizeWarningLimit`');
  });

  it('y justo en el tope, o por debajo, no', () => {
    expect(construirCon(bundleDe({ 'assets/index.js': 500_000, 'assets/react.js': 222_330 }))).toBeUndefined();
  });

  it('se miden BYTES, no caracteres: un trozo con tildes no se cuela por debajo', () => {
    // 250 001 «ó» son 250 001 caracteres (lo que mide Vite) y 500 002 bytes: pasa del tope.
    const bundle = { 'assets/index.js': { type: 'chunk', fileName: 'assets/index.js', code: 'ó'.repeat(250_001) } };
    expect(construirCon(bundle as unknown as OutputBundle)).toContain('assets/index.js  500.00 kB');
  });

  it('las hojas y las imagenes no cuentan: el aviso de Vite es de JavaScript', () => {
    const bundle = { 'assets/escudo.png': { type: 'asset', fileName: 'assets/escudo.png', source: new Uint8Array(600_000) } };
    expect(construirCon(bundle as unknown as OutputBundle)).toBeUndefined();
    expect(trozosQuePasanDelTope([{ nombre: 'a.js', bytes: 600_000 }])).toEqual([{ nombre: 'a.js', bytes: 600_000 }]);
  });
});

describe('el reparto', () => {
  it('cada familia de dependencias a su trozo, por el nombre del paquete', () => {
    const casos: Record<string, string | undefined> = {
      '/r/frontend/node_modules/react-dom/cjs/react-dom-client.production.js': 'react',
      '/r/frontend/node_modules/react/index.js': 'react',
      '/r/frontend/node_modules/react-router/dist/index.mjs': 'enrutador',
      '/r/frontend/node_modules/@radix-ui/react-menu/dist/index.mjs': 'radix',
      '/r/frontend/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs': 'radix',
      '/r/frontend/node_modules/@tanstack/query-core/build/modern/index.js': 'consultas',
      '/r/frontend/node_modules/i18next/dist/esm/i18next.js': 'i18n',
      // Lo que no es de ninguna familia se queda donde Rollup lo ponga: `zod` viaja con los formularios.
      '/r/frontend/node_modules/zod/v4/core/schemas.js': undefined,
      // Y lo de la libreria, que llega por `link:` y Vite ve en el clon hermano, tampoco.
      '/r/kamayuk-lib/paquetes/ui/shadcn/boton.tsx': undefined,
    };
    for (const [id, trozo] of Object.entries(casos)) expect(trozoDeProveedor(id), id).toBe(trozo);
  });

  it('el paquete se lee del ULTIMO `node_modules`, con su ambito', () => {
    expect(paqueteDe('/a/node_modules/radix-ui/node_modules/@radix-ui/react-slot/dist/index.mjs')).toBe(
      '@radix-ui/react-slot',
    );
    expect(paqueteDe('/a/src/main.tsx')).toBeUndefined();
  });

  it('las pantallas solo se importan con `import()` desde `src/pasos/pantallas.tsx`', () => {
    // Una importacion estatica de una pantalla desde fuera de su carpeta la mete en el trozo que la
    // importa, y Rollup solo avisa («dynamic import will not move module into another chunk»).
    const PANTALLA =
      /from\s+['"][^'"]*\/pasos\/(entrar|buscar|deudas|identificar|pagar|comprobante|historial)\/[A-Z][A-Za-z]*\.tsx['"]/;
    const estaticas = codigoDe(join(RAIZ, 'src'))
      .filter((ruta) => !ruta.includes(`${join('src', 'pasos')}/`) || ruta.endsWith('pantallas.tsx'))
      .filter((ruta) => PANTALLA.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(RAIZ, ruta));
    expect(estaticas).toEqual([]);

    const pantallas = readFileSync(join(RAIZ, 'src', 'pasos', 'pantallas.tsx'), 'utf8');
    // Siete desde el issue 28: los cinco pasos del artboard, el historial y «Entrar».
    expect(pantallas.match(/import\('\.\/[a-z]+\/[A-Z][A-Za-z]+\.tsx'\)/g)).toHaveLength(7);
  });
});
