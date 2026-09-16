import { afterEach, describe, expect, it, vi } from 'vitest';

import { fuenteDeDemostracion } from './fuenteDeDemostracion.ts';
import { fuenteDeLaPlataforma } from './fuenteDeLaPlataforma.ts';
import { laFuente } from './laFuente.ts';

/**
 * **La bandera elige, y elige las dos cosas** (issue 27).
 *
 * Lo que NO se puede probar aqui es lo que de verdad importa —que el `import()` se pliegue al
 * construir—: eso no es comportamiento, es empaquetado, y lo miden
 * `verificaciones/la-demostracion-no-viaja-al-bundle.test.ts` sobre el texto y
 * `e2e/la-demostracion-no-viaja-al-bundle.spec.ts` sobre el `dist/`. Lo que si se prueba aqui es que
 * la eleccion **hace lo que dice en los dos sentidos**, que es lo que impide que la bandera sea un
 * adorno: sin la segunda prueba, una condicion invertida daria la demostracion siempre y todo
 * seguiria verde.
 *
 * Que en las pruebas la bandera valga `true` no es casualidad ni herencia: lo declara
 * `vitest.config.ts`, porque Vitest corre en modo `test` y `.env.development` solo se carga en modo
 * `development`.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('laFuente', () => {
  it('con la bandera encendida (lo que declara `vitest.config.ts`), la de DEMOSTRACION', async () => {
    expect(import.meta.env.VITE_KAMAYUK_SIN_PLATAFORMA).toBe('true');

    expect(await laFuente()).toBe(fuenteDeDemostracion);
  });

  it('apagada, la de la PLATAFORMA', async () => {
    vi.stubEnv('VITE_KAMAYUK_SIN_PLATAFORMA', 'false');

    expect(await laFuente()).toBe(fuenteDeLaPlataforma);
  });

  it('y sin declarar tampoco es la demostracion: solo `true` la enciende', async () => {
    // Es lo que pasa en el navegador de quien construye sin `.env.development`, y en `yarn build`.
    // Cualquier otro valor —vacio, `1`, `si`— tiene que caer del lado de la plataforma.
    vi.stubEnv('VITE_KAMAYUK_SIN_PLATAFORMA', '');
    expect(await laFuente()).toBe(fuenteDeLaPlataforma);

    vi.stubEnv('VITE_KAMAYUK_SIN_PLATAFORMA', '1');
    expect(await laFuente()).toBe(fuenteDeLaPlataforma);
  });

  it('la de demostracion NO tiene consulta, y la de la plataforma SI', () => {
    // Es la mitad que ven las pantallas (`hayPlataforma`): si las dos tuvieran consulta, el doble
    // modo existiria en el arranque y no en la pantalla, que es donde se nota.
    expect(fuenteDeDemostracion.consulta).toBeNull();
    expect(fuenteDeLaPlataforma.consulta).not.toBeNull();
  });
});
