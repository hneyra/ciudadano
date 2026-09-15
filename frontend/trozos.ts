import type { Plugin } from 'vite';

/**
 * **Como se reparte el bundle, y el tope que ningun trozo puede pasar** (issue 11, nota del revisor).
 *
 * <h2>Lo que habia</h2>
 *
 * Un solo trozo de JavaScript de **792.30 kB** (medido con `yarn build` sobre `main`, antes de este
 * issue), y Vite avisando «(!) Some chunks are larger than 500 kB after minification». El aviso tiene
 * una salida facil —`build.chunkSizeWarningLimit`— que no cambia nada de lo que el telefono del
 * contribuyente descarga y compila antes de ver «Buscar mi deuda». Esa salida NO se toma: lo vigila
 * `verificaciones/ningun-trozo-pasa-de-500-kb.test.ts`.
 *
 * <h2>Como se reparte</h2>
 *
 * 1. **Cada pantalla, un `import()`** (`src/pasos/pantallas.tsx`): solo con eso, el trozo de entrada
 *    bajo a 591.56 kB. Todavia por encima.
 * 2. **Las dependencias grandes, cada familia en su trozo** (`manualChunks`, abajo). Lo que pesaba el
 *    trozo de entrada, medido sobre su mapa de fuentes: `react-dom` 209.9 kB, `react-router` 92.3 kB,
 *    `i18next` 44.0 kB, `sonner` 34.8 kB, `tailwind-merge` 27.8 kB, `@tanstack/query-core` 25.0 kB, y
 *    Radix con `@floating-ui` repartidos en decenas de paquetes pequenos. Una familia por trozo, y no un
 *    trozo por paquete: cuatro trozos de 3 kB son cuatro peticiones que no ahorran nada.
 *
 * <h2>Y el tope se hace cumplir, no se espera</h2>
 *
 * `ningunTrozoPasaDelTope()` hace **fallar** `yarn build` si algun trozo de JavaScript emitido pasa de
 * `TOPE_DE_UN_TROZO_KB`. El aviso de Vite es amarillo y la CI sale verde con el: se lee una vez y se
 * olvida. Se mide en BYTES (UTF-8) del codigo ya minificado, que es al menos lo que Vite mide
 * (`chunk.code.length / 1e3`, en caracteres): si esto pasa, el aviso no puede salir.
 */

/** El mismo numero que el `chunkSizeWarningLimit` por omision de Vite, en kB (1 kB = 1000 bytes). */
export const TOPE_DE_UN_TROZO_KB = 500;

/**
 * Las familias de dependencias que van a su propio trozo, por el nombre del paquete.
 *
 * El orden importa: gana la primera que case. Lo que no case con ninguna se queda donde Rollup lo
 * ponga —en el trozo de entrada o en el de la pantalla que lo use—, que es lo correcto para lo que
 * solo usa una pantalla (`zod` y `react-hook-form` viajan con los formularios, no con la barra).
 */
const FAMILIAS: readonly (readonly [trozo: string, paquetes: RegExp])[] = [
  ['react', /^(react|react-dom|scheduler)$/],
  ['enrutador', /^(react-router|react-router-dom)$/],
  ['i18n', /^(i18next|react-i18next)$/],
  ['radix', /^(radix-ui|@radix-ui\/.+|@floating-ui\/.+|react-remove-scroll.*|aria-hidden|use-sidecar|use-callback-ref|detect-node-es|get-nonce|tslib)$/],
  ['consultas', /^@tanstack\/.+$/],
  ['estilo', /^(tailwind-merge|clsx|class-variance-authority)$/],
  ['avisos', /^sonner$/],
];

/** El paquete de `node_modules` al que pertenece un modulo, o `undefined` si no es de `node_modules`. */
export function paqueteDe(id: string): string | undefined {
  const tramo = id.split('/node_modules/').at(-1);
  if (tramo === undefined || tramo === id) return undefined;
  const [primero, segundo] = tramo.split('/');
  if (primero === undefined) return undefined;
  return primero.startsWith('@') && segundo !== undefined ? `${primero}/${segundo}` : primero;
}

/** El trozo de proveedor de un modulo, para `build.rollupOptions.output.manualChunks`. */
export function trozoDeProveedor(id: string): string | undefined {
  const paquete = paqueteDe(id);
  if (paquete === undefined) return undefined;
  return FAMILIAS.find(([, paquetes]) => paquetes.test(paquete))?.[0];
}

/** Un trozo emitido, con lo que el tope necesita saber de el. */
export interface TrozoEmitido {
  readonly nombre: string;
  readonly bytes: number;
}

/** Los trozos que pasan del tope, del mas grande al mas pequeno. Puro: la guarda lo prueba sin construir. */
export function trozosQuePasanDelTope(trozos: readonly TrozoEmitido[], topeKb = TOPE_DE_UN_TROZO_KB): TrozoEmitido[] {
  return trozos.filter(({ bytes }) => bytes / 1000 > topeKb).sort((a, b) => b.bytes - a.bytes);
}

/** El mensaje con que falla la construccion. */
export function mensajeDelTope(pasados: readonly TrozoEmitido[], topeKb = TOPE_DE_UN_TROZO_KB): string {
  return (
    `Hay ${pasados.length === 1 ? 'un trozo' : `${pasados.length} trozos`} de JavaScript de mas de ${topeKb} kB:\n` +
    pasados.map(({ nombre, bytes }) => `  ${nombre}  ${(bytes / 1000).toFixed(2)} kB`).join('\n') +
    '\n\nNo se sube `chunkSizeWarningLimit`: se reparte el codigo (`src/pasos/pantallas.tsx` y las\n' +
    'familias de `trozos.ts`). El porque esta en la cabecera de `trozos.ts` (issue 11).'
  );
}

/** El complemento que hace fallar `vite build` si algun trozo de JavaScript pasa del tope. */
export function ningunTrozoPasaDelTope(topeKb = TOPE_DE_UN_TROZO_KB): Plugin {
  return {
    name: 'ciudadano:ningun-trozo-pasa-del-tope',
    apply: 'build',
    // Despues de minificar: el tamano que cuenta es el que se descarga.
    enforce: 'post',
    generateBundle(_opciones, bundle) {
      const trozos = Object.values(bundle).flatMap((salida) =>
        salida.type === 'chunk' ? [{ nombre: salida.fileName, bytes: Buffer.byteLength(salida.code, 'utf8') }] : [],
      );
      const pasados = trozosQuePasanDelTope(trozos, topeKb);
      if (pasados.length > 0) this.error(mensajeDelTope(pasados, topeKb));
    },
  };
}
