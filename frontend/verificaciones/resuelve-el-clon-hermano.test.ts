import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { formatearImporte, sumarImportes } from '@kamayuk/formato';
import { Importe } from '@kamayuk/ui';

/**
 * **El enlace con `kamayuk-lib` resuelve de verdad** (rentas#74). Portada de `rentas`.
 *
 * Un `link:` que nadie importa no demuestra que el enlace funcione: demuestra que yarn escribio
 * un symlink. Esto lo atraviesa — `tsc` compila las fuentes del hermano, `vitest` las ejecuta y
 * `vite build` las empaqueta, los tres resolviendo el symlink a su ruta real.
 *
 * <h2>Lo que cambia respecto a `rentas`</h2>
 *
 * Alli se ejercitan `@kamayuk/formato`, `@kamayuk/api` y `@kamayuk/sesion`. Aqui no hay ni cliente
 * HTTP ni identidad, asi que los paquetes son `@kamayuk/formato` y **un componente de
 * `@kamayuk/ui`**, montado en jsdom. Y es el caso que mas enseña: `Importe` importa React y
 * `@kamayuk/formato` **desde el clon hermano**, o sea que montarlo prueba a la vez que el enlace
 * resuelve, que las `peerDependencies` se toman de ESTE frontend y que hay una sola copia de React
 * —con dos, lo que sale es `Cannot read properties of null (reading 'useId')` o un render vacio—.
 * Por eso corre en jsdom, no en `node` como su vecina de `rentas`. Y sigue siendo `.ts` —con
 * `createElement` en vez de JSX— para conservar el nombre que tiene en `rentas` y en el issue.
 *
 * <h2>Este archivo SI puede morir sin el clon hermano, y es correcto</h2>
 *
 * Sin `kamayuk-lib`, estos imports fallan en la recoleccion y las pruebas de aqui desaparecen. Es
 * aceptable **porque `enlace-con-kamayuk-lib.test.ts` ya hablo**: aquel no importa nada del
 * hermano, asi que carga siempre y dice el `git clone` que falta.
 */

describe('y el enlace RESUELVE: los paquetes se importan y se ejecutan', () => {
  it('@kamayuk/formato formatea y suma un importe sin tocar `Number`', () => {
    expect(formatearImporte('1842.6')).toBe('S/ 1,842.60');
    expect(sumarImportes(['1842.60', '0.40'])).toBe('1843.00');
  });

  it('@kamayuk/ui monta un componente de verdad, con React de este frontend', () => {
    render(createElement(Importe, { valor: '1842.60', fechaCalculo: '2026-09-06' }));

    // El importe formateado sale del componente de la libreria, que llama a `@kamayuk/formato`
    // por ruta relativa DENTRO del hermano: la cadena cruza la frontera de repositorio dos veces.
    expect(screen.getByText('S/ 1,842.60')).toBeInTheDocument();
    // Y la fecha, que es obligatoria (regla 9): sin ella no hay importe que mostrar.
    expect(screen.getByText(/06\/09\/2026/)).toBeInTheDocument();
  });
});
