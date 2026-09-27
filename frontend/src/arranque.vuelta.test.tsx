import type { Cliente } from '@kamayuk/api';
import { TEXTOS_DE_LA_PUERTA } from '@kamayuk/sesion';
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clavesDelEmisor } from './api/emisor.ts';
import { identidad } from './api/identidad.ts';
import { arrancar } from './arranque.ts';
import { crearFuenteDeLaPlataforma } from './datos/fuenteDeLaPlataforma.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from './i18n/i18n.ts';
import { limpiarElPortal, montarElPortal, plazosDelPortal } from './pruebas/portal.tsx';

/**
 * **Volver del sistema de identidad: lo que la persona VE** (issue 56).
 *
 * `arranque.test.ts` mide lo que el arranque deja dicho; `aplicacion.puerta.test.tsx`, la pantalla
 * con una falla escrita a mano. Aqui se juntan, con la barra de direcciones de verdad, la puerta de
 * `@kamayuk/sesion` de verdad y el portal entero con plataforma: que cancelar no sea un callejon sin
 * salida, que un canje que revienta no deje la pagina en blanco, y que ninguna palabra de la
 * libreria o del emisor llegue a la pantalla sin pasar por `t()`.
 */

/** Un cliente que no llega a contestar: lo que se mide es la vuelta, no la deuda. */
const CALLADO = {
  solicitar: vi.fn(() => new Promise(() => {})),
  solicitarRespuesta: vi.fn(),
  descargar: vi.fn(),
  subir: vi.fn(),
} as unknown as Cliente;

/** Vuelve del emisor con `busqueda` en la barra, arranca con plataforma y monta el portal entero. */
async function volverCon(busqueda: string, hash = '#/deudas'): Promise<void> {
  window.history.replaceState(null, '', `/portal/${busqueda}${hash}`);
  // Un canje silencioso que no deberia llegar a usarse: se volvia del emisor.
  const silencio = { intentar: vi.fn(() => Promise.resolve({ estado: 'identificado' } as const)) };

  await arrancar(() => montarElPortal({ hash, fuente: crearFuenteDeLaPlataforma(CALLADO) }), {
    conEmisor: true,
    silencio,
  });
  expect(silencio.intentar, 'se pregunto en silencio a quien volvia del emisor').not.toHaveBeenCalled();
}

/** Deja guardada la ida, como la deja `entrar()`, para que la vuelta con `?code=` cuadre. */
function conLaIdaGuardada(): string {
  sessionStorage.setItem('kamayuk.ciudadano.pkce.verificador', 'un-verificador');
  sessionStorage.setItem('kamayuk.ciudadano.pkce.estado', 'un-estado');
  return '?code=un-codigo&state=un-estado';
}

beforeEach(() => {
  identidad.fijarToken(null);
  sessionStorage.clear();
});

afterEach(async () => {
  identidad.fijarToken(null);
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('AC3 — cancelar en el sistema de identidad no es un callejon sin salida', () => {
  it('volver con `error=access_denied` monta el portal ANONIMO, con «Entrar» a la vista y sin aviso de error', async () => {
    await volverCon('?error=access_denied&error_description=User+cancelled+login&state=un-estado');

    expect(screen.queryByText('No se pudo abrir su sesión')).toBeNull();
    const principal = within(screen.getByRole('main'));
    expect(await principal.findByRole('heading', { level: 1, name: 'Entre con su cuenta del portal' })).toBeInTheDocument();
    expect(principal.getByRole('button', { name: 'Entrar con mi cuenta' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    // Y la barra, limpia: recargar no vuelve a leer el `?error=`.
    expect(window.location.search).toBe('');
  });
});

describe('AC2 — un canje que revienta no deja la pagina en blanco', () => {
  it('si `canjearSiVuelve` lanza, se ve «No se pudo abrir su sesión», y el recorrido no', async () => {
    vi.spyOn(identidad, 'canjearSiVuelve').mockRejectedValue(new Error('sessionStorage no disponible'));

    await volverCon(conLaIdaGuardada());

    expect(await screen.findByText('No se pudo abrir su sesión')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Volvimos del sistema de identidad sin poder entrar: No se pudo completar la entrada. ' +
          'Algo falló al leer la vuelta: sessionStorage no disponible',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('banner')).toBeNull();
  });
});

describe('REVISION del PR #66 — un enlace fabricado no pinta su texto dentro del aviso', () => {
  // La libreria no comprueba el `state` en la rama de `?error=`: cualquiera puede mandar un enlace
  // con `?error=…&error_description=…` y, hasta esta revision, el portal pintaba esa descripcion
  // —y el codigo— dentro del aviso de la municipalidad. React lo escapa (no hay XSS); es suplantacion.
  const EL_ENGANO = 'Su deuda vence hoy. Yapee S/ 350 al 999 888 777 para no perder su predio';

  it.each([
    ['con un codigo conocido', 'server_error'],
    ['con un codigo inventado', 'yapee_al_999_888_777'],
  ])('%s: ni la descripcion ni el codigo llegan a la pantalla', async (_caso, error) => {
    await volverCon(`?error=${error}&error_description=${encodeURIComponent(EL_ENGANO)}`);

    expect(await screen.findByText('No se pudo abrir su sesión')).toBeInTheDocument();
    const lo = document.body.textContent ?? '';
    expect(lo, 'el aviso municipal pinto un texto que venia en la barra').not.toContain(EL_ENGANO);
    expect(lo).not.toMatch(/999/);
    expect(lo, 'el aviso ensena el codigo de error tal como vino en la barra').not.toContain(error);
  });
});

/**
 * Cada forma en que la vuelta puede fallar, con lo que hace falta para provocarla de verdad: la barra,
 * el almacenamiento y la red. Son TODAS las ramas `fallo` de `canjearSiVuelve` de la libreria, mas
 * los dos `?error=` (con y sin descripcion) y la excepcion.
 */
const LAS_VUELTAS_FALLIDAS: ReadonlyArray<readonly [string, () => string]> = [
  ['un `?error=` con descripcion', () => '?error=invalid_scope&error_description=Invalid+scopes%3A+openid+profile'],
  ['un `?error=` sin descripcion', () => '?error=server_error'],
  ['un `?error=` que el portal no conoce', () => '?error=invalid_request_uri'],
  ['un `state` que no cuadra', () => '?code=un-codigo&state=de-otra-pestana'],
  [
    'un canje que no llega',
    () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
      return conLaIdaGuardada();
    },
  ],
  [
    'un canje rechazado',
    () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 400 }))));
      return conLaIdaGuardada();
    },
  ],
  [
    'un canje sin token',
    () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"id_token":"x"}', { status: 200 }))));
      return conLaIdaGuardada();
    },
  ],
  [
    'un canje que revienta',
    () => {
      vi.spyOn(identidad, 'canjearSiVuelve').mockRejectedValue(new Error('id_token ilegible'));
      return conLaIdaGuardada();
    },
  ],
];

/**
 * Las frases de `@kamayuk/sesion`, las que hasta el issue 56 llegaban tal cual a la pantalla. Menos
 * las dos que el portal dice con las MISMAS palabras («La vuelta no cuadra con la ida», y la de
 * «access_token»): esas son claves suyas y pasan por `t()`, que es lo que mide el caso de arriba.
 */
const LAS_DE_LA_LIBRERIA = Object.values(TEXTOS_DE_LA_PUERTA).filter(
  (v): v is string => typeof v === 'string' && !clavesDelEmisor().includes(v),
);

describe('AC4 — ningun texto del emisor ni de la libreria llega a la pantalla sin pasar por `t()`', () => {
  it.each(LAS_VUELTAS_FALLIDAS)('%s: la frase, el motivo y el detalle salen MARCADOS', async (_caso, preparar) => {
    await i18n.changeLanguage(IDIOMA_MARCADO);

    await volverCon(preparar());

    const aviso = (await screen.findByText(`${ABRE}No se pudo abrir su sesión${CIERRA}`)).parentElement;
    expect(aviso).not.toBeNull();
    const frase = within(aviso as HTMLElement).getByText(/Volvimos del sistema de identidad/).textContent ?? '';
    // La frase, marcada por fuera, y DENTRO de ella el motivo y el detalle, marcados cada uno: lo
    // que no paso por `t()` queda fuera de los `⟦…⟧` y no cuadra con esta forma.
    const MARCADO = /^⟦Volvimos del sistema de identidad sin poder entrar: ⟦([^⟦⟧]+)⟧\. ⟦([^⟦⟧]+)⟧⟧$/u;
    expect(frase, 'el motivo o el detalle llegaron a la pantalla sin pasar por `t()`').toMatch(MARCADO);
  });

  it.each(LAS_VUELTAS_FALLIDAS)('%s: y en castellano, ni «emisor» ni una frase de la libreria', async (_caso, preparar) => {
    await volverCon(preparar());

    await screen.findByText('No se pudo abrir su sesión');
    const lo = document.body.textContent ?? '';
    // «Emisor» es la palabra de quien opera Keycloak; a un contribuyente se le dice «sistema de
    // identidad» (issue 35). Y las frases de la libreria son sin tildes y de funcionario.
    expect(lo).not.toMatch(/emisor/i);
    expect(LAS_DE_LA_LIBRERIA.filter((frase) => lo.includes(frase))).toEqual([]);
  });
});
