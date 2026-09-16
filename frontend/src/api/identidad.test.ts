import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RAIZ } from '../../verificaciones/artboards.ts';
import { ESTADO_INICIAL } from '../recorrido/recorrido.ts';
import { RUTA_DEL_PASO } from '../recorrido/rutas.ts';
import { DESTINO_POR_OMISION, configuracionDeLaPuerta, identidad } from './identidad.ts';

/**
 * **Las seis decisiones que este portal le pasa a `@kamayuk/sesion`** (issue 13).
 *
 * Aqui NO se prueba el flujo PKCE: el codigo de autorizacion, el reto S256, la sonda del emisor, el
 * canje y los dos frenos del rebote son de la libreria y tienen su prueba alli
 * (`kamayuk-lib/paquetes/sesion/identidad.test.ts`). Repetirla seria tener dos verdades sobre lo
 * mismo, y la que se quedaria vieja es esta.
 *
 * Lo que se prueba es **lo unico que la libreria no puede saber**, que es lo que este archivo
 * decide — y cada una de esas seis cosas se puede romper sin que nada cambie de aspecto hasta que
 * alguien intente entrar de verdad.
 */

afterEach(() => {
  delete window.__KAMAYUK_CIUDADANO__;
});

describe('la puerta se configura con las senias de ESTE portal', () => {
  it('el realm, el cliente y el alcance salen de la cadena de `configuracion.ts`', () => {
    // O sea que no estan escritos aqui: un `ConfigMap` puede cambiarlos sin reconstruir el bundle.
    window.__KAMAYUK_CIUDADANO__ = {
      oidcRealm: 'https://muni.example/realms/portal',
      oidcCliente: 'portal-de-la-muni',
      oidcAlcance: 'openid profile email',
    };

    expect(configuracionDeLaPuerta()).toMatchObject({
      realm: 'https://muni.example/realms/portal',
      cliente: 'portal-de-la-muni',
      alcance: 'openid profile email',
    });
  });

  it('y sin nada servido son las senias medidas de la plataforma local', () => {
    expect(configuracionDeLaPuerta()).toMatchObject({
      realm: 'http://localhost:18180/realms/kamayuk-ciudadano',
      cliente: 'kamayuk-portal',
      alcance: 'openid profile',
    });
  });

  it('el retorno es la raiz de la APLICACION, no la del sitio', () => {
    // `vitest.config.ts` fija la misma `base` que `vite.config.ts` —`/portal/`— justamente para
    // que esta prueba pueda distinguir el acierto del defecto: con `base: '/'` los dos valores
    // coinciden y `origin + '/'` pasaria igual. Eso es lo que en `rentas` costo el acceso a
    // produccion (rentas#71): el `code` y el `iss` correctos, y un 404 al volver.
    expect(import.meta.env.BASE_URL).toBe('/portal/');
    expect(configuracionDeLaPuerta().retorno).toBe(`${window.location.origin}/portal/`);
    expect(configuracionDeLaPuerta().retorno).not.toBe(`${window.location.origin}/`);
  });

  it('y cae dentro de lo que el client `kamayuk-portal` declara', () => {
    // Medido el 2026-09-16: sus `redirectUris` incluyen `http://localhost:5174/portal/*`, que es
    // lo que sirve `yarn dev` (puerto 5174 estricto, `base: '/portal/'`). Un retorno fuera de esa
    // lista da «Invalid parameter: redirect_uri» en el formulario de Keycloak, no en ninguna
    // prueba.
    expect(new URL(configuracionDeLaPuerta().retorno, 'http://localhost:5174').pathname).toBe(
      '/portal/',
    );
  });

  it('el destino por omision es el hash del PRIMER paso del recorrido', () => {
    // La cadena se escribe en `identidad.ts` —importar `rutas.ts` alli arrastraria React, el
    // enrutador y los datos de demostracion a un modulo que se carga ANTES de montar nada—, y esta
    // prueba es lo que impide que se quede vieja: si el recorrido empezara por otro paso, o si la
    // ruta de ese paso cambiara, sale roja aqui.
    expect(DESTINO_POR_OMISION).toBe(`#${RUTA_DEL_PASO[ESTADO_INICIAL.paso]}`);
    expect(configuracionDeLaPuerta().destinoPorOmision).toBe(DESTINO_POR_OMISION);
  });

  it('el prefijo de claves es el de este portal, el mismo que el del tema', () => {
    // Las interfaces del producto comparten `sessionStorage` cuando se sirven del mismo origen.
    // Con `kamayuk.rentas` aqui, abrir las dos en la misma pestana se pisaria el verificador PKCE
    // de la primera — y el sintoma seria «no se pudo completar la ida», sin causa a la vista.
    expect(configuracionDeLaPuerta().prefijoDeClaves).toBe('kamayuk.ciudadano');

    const aplicacion = readFileSync(join(RAIZ, 'src/aplicacion.tsx'), 'utf8');
    expect(aplicacion).toContain("prefijoDeClaves: 'kamayuk.ciudadano'");
  });
});

describe('la puerta se construye UNA vez, y con la configuracion ya servida', () => {
  it('`identidad` es siempre el mismo objeto', () => {
    // `crearIdentidad` guarda la configuracion al construir y no vuelve a leerla. Una puerta nueva
    // por llamada tendria su propio token en memoria: el canje llenaria una y las peticiones
    // preguntarian a otra.
    expect(identidad).toBe(identidad);
    expect(identidad.token()).toBeNull();
  });

  it('y `index.html` carga `configuracion.js` como guion CLASICO, antes del modulo', () => {
    // Es lo unico que hace que la puerta se construya con las senias puestas: un `type="module"`
    // se difiere hasta despues del analisis del documento, asi que llegaria TARDE y esta constante
    // congelaria `localhost:18180` en cada municipalidad.
    const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
    const clasico = html.indexOf('<script src="/configuracion.js"></script>');
    const modulo = html.indexOf('<script type="module"');

    expect(clasico, '`index.html` ya no carga `configuracion.js`').toBeGreaterThanOrEqual(0);
    expect(clasico, '`configuracion.js` tiene que ir ANTES del modulo').toBeLessThan(modulo);
    expect(html).not.toMatch(/<script type="module" src="\/configuracion\.js"/);
  });

  it('y el archivo servido viaja VACIO: los valores por omision estan en un solo sitio', () => {
    const guion = readFileSync(join(RAIZ, 'public/configuracion.js'), 'utf8');

    expect(guion).toContain('window.__KAMAYUK_CIUDADANO__ = window.__KAMAYUK_CIUDADANO__ || {}');
    // Dos copias de «el emisor local es localhost:18180» se separan, y la que se separaria es
    // esta, que no la lee ningun compilador.
    expect(guion.split('\n').filter((l) => /oidc(Realm|Cliente|Alcance)\s*:/.test(l))).toEqual([]);
  });
});
