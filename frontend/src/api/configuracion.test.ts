import { afterEach, describe, expect, it, vi } from 'vitest';

import { configuracion, procedencia } from './configuracion.ts';

/**
 * **Los tres escalones de las senias del ambiente** (issue 13), portada de `rentas` (rentas#44).
 *
 * Lo que se prueba aqui no es que haya valores por omision —eso se ve leyendo el archivo— sino las
 * decisiones que se pueden romper sin que nada cambie de aspecto:
 *
 *   · que lo SERVIDO gane a lo horneado, que es lo unico que hace que un bundle sirva para varias
 *     municipalidades;
 *   · que una cadena en blanco cuente como ausencia y no como valor;
 *   · y que los valores por omision sean los MEDIDOS de la plataforma local, que es lo que hace
 *     que `yarn dev` entre por la puerta sin configurar nada.
 */

afterEach(() => {
  delete window.__KAMAYUK_CIUDADANO__;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('lo que sirve el contenedor gana a lo que Vite horneo', () => {
  it('toma la senia servida', () => {
    window.__KAMAYUK_CIUDADANO__ = { oidcRealm: 'https://muni.example/keycloak/realms/portal' };

    expect(configuracion('oidcRealm')).toBe('https://muni.example/keycloak/realms/portal');
    expect(procedencia('oidcRealm')).toBe('servida');
  });

  it('sin nada servido cae a lo MEDIDO el 2026-09-16 en la plataforma local', () => {
    // Las tres juntas, y no una: son las que hacen que `yarn dev` llegue al formulario de Keycloak
    // sin que nadie ponga una variable. El realm es el del CIUDADANO —`kamayuk-ciudadano`—, que no
    // es el `kamayuk` del back-office, y el client es el publico con PKCE S256.
    expect(configuracion('oidcRealm')).toBe('http://localhost:18180/realms/kamayuk-ciudadano');
    expect(configuracion('oidcCliente')).toBe('kamayuk-portal');
    expect(configuracion('oidcAlcance')).toBe('openid profile');
    expect(procedencia('oidcRealm')).toBe('omision');
  });

  /** Cada senia se resuelve sola: servir una no puede arrastrar a las otras dos. */
  it('una senia servida no afecta a las demas', () => {
    window.__KAMAYUK_CIUDADANO__ = { oidcCliente: 'portal-de-otra-muni' };

    expect(configuracion('oidcCliente')).toBe('portal-de-otra-muni');
    expect(procedencia('oidcRealm')).toBe('omision');
  });

  it('y el global es el de ESTE portal: el de `rentas` no lo lee nadie aqui', () => {
    // Las cinco interfaces del producto pueden servirse del mismo origen. Si esta leyera
    // `__KAMAYUK_RENTAS__`, el `ConfigMap` del back-office —realm `kamayuk`, client
    // `kamayuk-backoffice`— le cambiaria la puerta al portal sin que nada lo dijera.
    (window as unknown as Record<string, unknown>)['__KAMAYUK_RENTAS__'] = {
      oidcRealm: 'http://localhost:18180/realms/kamayuk',
    };

    expect(configuracion('oidcRealm')).toBe('http://localhost:18180/realms/kamayuk-ciudadano');

    delete (window as unknown as Record<string, unknown>)['__KAMAYUK_RENTAS__'];
  });
});

/**
 * Una llave puesta y sin rellenar es un error de despliegue, no un valor.
 *
 * Y hay que separarlo porque el dano es concreto: con el realm en blanco, `@kamayuk/sesion` compone
 * `"/protocol/openid-connect/auth"` —una ruta del propio portal— y el navegador la pide a su mismo
 * origen. El servidor de estaticos contesta **200 con el `index.html` dentro**, o sea que el rebote
 * a Keycloak se convierte en una pagina en blanco sin un solo error.
 */
describe('una cadena en blanco cuenta como ausencia', () => {
  it.each(['', '   ', '\n'])('«%s» no se toma como valor', (vacia) => {
    window.__KAMAYUK_CIUDADANO__ = { oidcRealm: vacia };

    expect(configuracion('oidcRealm')).toBe('http://localhost:18180/realms/kamayuk-ciudadano');
    expect(procedencia('oidcRealm')).toBe('omision');
  });

  it('y una senia con espacios alrededor se limpia en vez de rechazarse', () => {
    window.__KAMAYUK_CIUDADANO__ = { oidcRealm: '  https://muni.example/realms/portal \n' };

    expect(configuracion('oidcRealm')).toBe('https://muni.example/realms/portal');
  });
});

/**
 * El escalon de en medio: lo que Vite horneo al construir.
 *
 * Se prueba con `resetModules` + `import()` porque `DE_LA_CONSTRUCCION` se evalua al importar el
 * modulo, que es exactamente lo que Vite hace al empaquetar.
 */
describe('el escalon horneado existe, y queda por debajo del servido', () => {
  it('se usa cuando no hay nada servido', async () => {
    vi.stubEnv('VITE_KAMAYUK_OIDC_REALM', 'https://horneado.example/realms/portal');
    vi.resetModules();
    const modulo = await import('./configuracion.ts');

    expect(modulo.configuracion('oidcRealm')).toBe('https://horneado.example/realms/portal');
    expect(modulo.procedencia('oidcRealm')).toBe('construccion');
  });

  it('pero lo servido lo gana, que es lo que hace que un bundle sirva para varias municipalidades', async () => {
    vi.stubEnv('VITE_KAMAYUK_OIDC_REALM', 'https://horneado.example/realms/portal');
    vi.resetModules();
    const modulo = await import('./configuracion.ts');
    window.__KAMAYUK_CIUDADANO__ = { oidcRealm: 'https://servido.example/realms/portal' };

    expect(modulo.configuracion('oidcRealm')).toBe('https://servido.example/realms/portal');
    expect(modulo.procedencia('oidcRealm')).toBe('servida');
  });

  it('las tres senias se leen literales: un indice calculado no lo sustituye Vite', async () => {
    vi.stubEnv('VITE_KAMAYUK_OIDC_CLIENTE', 'horneado-portal');
    vi.stubEnv('VITE_KAMAYUK_OIDC_ALCANCE', 'openid profile email');
    vi.resetModules();
    const modulo = await import('./configuracion.ts');

    // Con `import.meta.env[clave]` las tres saldrian por omision **en silencio**, porque la cadena
    // tiene un escalon mas debajo. Aqui se ejercitan las tres para que ninguna se quede sin lectura.
    expect(modulo.configuracion('oidcCliente')).toBe('horneado-portal');
    expect(modulo.configuracion('oidcAlcance')).toBe('openid profile email');
  });
});
