import { avisar } from '@kamayuk/ui';
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { limpiarElPortal, montarElPortal, plazosDelPortal, remendarJsdomParaElMenu } from './portal.tsx';

/**
 * **Limpiar el portal no deja ningun temporizador vivo** (revision del PR #46, issue 42).
 *
 * Un `yarn verificar` en verde —790 de 790— salio con rc=1 por esto:
 *
 *     ReferenceError: window is not defined
 *      ❯ resolveUpdatePriority react-dom-client.development.js:1498
 *      ❯ node_modules/sonner/dist/index.mjs:1011   (removeToast → setToasts)
 *      ❯ Timeout._onTimeout node_modules/sonner/dist/index.mjs:635
 *     This error originated in "src/marco/Barra.test.tsx" … caught after test environment was torn down.
 *
 * La ultima prueba de `Barra.test.tsx` deja un aviso a la vista, y `limpiarElPortal` lo retiraba con
 * `avisar.dismiss()` **con el portal aun montado**. Con el `requestAnimationFrame` sincrono de
 * `remendarJsdomParaElMenu`, `sonner` marca el aviso para borrar y programa `removeToast` a 200 ms
 * (`TIME_BEFORE_UNMOUNT`) con el `setTimeout` de Node, que sobrevive a jsdom. Si el entorno se
 * desmonta dentro de esos 200 ms, el `setState` de React lee `window.event` y revienta: intermitente,
 * segun cuanto tarde el desmontaje.
 *
 * El arreglo es el orden: desmontar primero (`cleanup`) y retirar los avisos despues, cuando ya no hay
 * un `Toaster` que los anime. Aqui se mide la causa, no el sintoma: durante la limpieza no se programa
 * ni un temporizador. Sin el arreglo salen `[4000, 200]`.
 */

beforeAll(remendarJsdomParaElMenu);
afterEach(limpiarElPortal);

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('limpiar el portal', () => {
  it('con un aviso a la vista, no programa ningun temporizador que sobreviva al entorno', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true } });
    act(() => {
      avisar('Un aviso');
    });
    expect(await screen.findByText('Un aviso')).toBeInTheDocument();

    const nativo = globalThis.setTimeout;
    const programados: number[] = [];
    globalThis.setTimeout = ((fn: () => void, ms?: number, ...resto: unknown[]) => {
      programados.push(ms ?? 0);
      return nativo(fn, ms, ...resto);
    }) as typeof setTimeout;
    try {
      // Lo que hacen los `afterEach`: el del archivo y, detras, el de `vitest.setup.ts`.
      await limpiarElPortal();
      cleanup();
      // Y dos vueltas del bucle, para que lo que `sonner` deje en cola llegue a programarse.
      await new Promise((listo) => setImmediate(listo));
      await new Promise((listo) => setImmediate(listo));
    } finally {
      globalThis.setTimeout = nativo;
    }

    expect(programados, 'temporizadores programados al limpiar el portal').toEqual([]);
  });
});
