// @vitest-environment node
//
// Solo mira el disco: no es un DOM lo que necesita.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ARCHIVO_RESERVADO_EN_DATOS, DIRECTORIO_DE_MUESTRAS } from '../rutasDeMuestra.mjs';
import { RAIZ } from './artboards.ts';

/**
 * **Las rutas reservadas para las muestras de ESLint no existen de verdad** (issue 55, revision
 * del PR #65, ronda 1).
 *
 * `eslint.config.js` exceptua `DIRECTORIO_DE_MUESTRAS` y `ARCHIVO_RESERVADO_EN_DATOS` de
 * `allowDefaultProject` para que `reglas-de-eslint.test.ts` y `los-datos-no-cuentan-a-mano.test.ts`
 * puedan juzgar sus muestras en una ruta que el «project service» no rechace por no existir en el
 * disco. El nombre `__no_existe_de_verdad__` ya hace la colision con un archivo real casi
 * imposible —nadie llama asi a un archivo de produccion—, pero «casi imposible» no es lo mismo que
 * imposible: si algun dia una de estas rutas empezara a existir de verdad, ese archivo caeria en
 * el mismo `allowDefaultProject` y perderia su chequeo de tipos **en silencio**, sin que ninguna
 * otra guarda lo dijera.
 *
 * Esta prueba importa las MISMAS constantes que `eslint.config.js` usa en `allowDefaultProject`
 * —no una copia escrita aqui, que podria divergir de lo que el config de verdad exceptua— y
 * comprueba que el disco las desmiente.
 */
describe('DIRECTORIO_DE_MUESTRAS y ARCHIVO_RESERVADO_EN_DATOS no existen en el disco', () => {
  it('EL CENTINELA: las dos constantes traen el nombre reservado', () => {
    // Sin esto, si algun dia se reescribieran a rutas normales (perdiendo el `__no_existe_de_verdad__`),
    // las comprobaciones de abajo seguirian pasando en verde sobre unas rutas que ya no protegen
    // nada: el nombre reservado es la propiedad que las hace seguras, no su mera ausencia de hoy.
    expect(DIRECTORIO_DE_MUESTRAS).toContain('__no_existe_de_verdad__');
    expect(ARCHIVO_RESERVADO_EN_DATOS).toContain('__no_existe_de_verdad__');
  });

  it('el directorio de las muestras genericas no existe', () => {
    expect(
      existsSync(join(RAIZ, DIRECTORIO_DE_MUESTRAS)),
      `«${DIRECTORIO_DE_MUESTRAS}» empezo a existir de verdad. Es la ruta que \`eslint.config.js\`\n` +
        'reserva en `allowDefaultProject` para que las guardas de ESLint juzguen sus muestras: un\n' +
        'directorio real con ese nombre perderia el chequeo de tipos en silencio. Mueve lo que sea\n' +
        'que se haya creado ahi a otro sitio.',
    ).toBe(false);
  });

  it('el archivo reservado dentro de `src/datos/` no existe', () => {
    expect(
      existsSync(join(RAIZ, ARCHIVO_RESERVADO_EN_DATOS)),
      `«${ARCHIVO_RESERVADO_EN_DATOS}» empezo a existir de verdad. Es la ruta que \`eslint.config.js\`\n` +
        'reserva en `allowDefaultProject` DENTRO de `src/datos/`: un archivo real con ese nombre\n' +
        'perderia el chequeo de tipos en silencio. Renombra el archivo real.',
    ).toBe(false);
  });
});
