import type { Cliente } from '@kamayuk/api';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { configuracionDeLaPuerta, identidad } from './api/identidad.ts';
import { crearSilencio } from './api/silencio.ts';
import { arrancar } from './arranque.ts';
import { crearFuenteDeLaPlataforma } from './datos/fuenteDeLaPlataforma.ts';
import { callado, conSesion, emisorFalso, sinSesion, type Contestacion } from './pruebas/emisorFalso.ts';
import { limpiarElPortal, montarElPortal } from './pruebas/portal.tsx';

/**
 * **Recargar con plataforma: lo que la persona VE despues del canje silencioso** (issue 35).
 *
 * `arranque.test.ts` mide que el arranque pregunte cuando toca; `api/silencio.test.ts`, que la
 * pregunta se haga bien. Aqui se juntan con el portal entero, que es donde el issue pone sus
 * criterios: con la sesion del emisor viva, la persona recarga y sigue dentro sin pulsar nada; sin
 * ella, ve el portal y el boton para entrar; y si el emisor no contesta, lee por que.
 *
 * El canje silencioso es uno NUEVO en cada caso (se inyecta, como la fuente), pero deja el token en
 * la puerta DEL PORTAL: es la que lee el recorrido al montar (`haySesion()`).
 */

/** Un cliente que no llega a contestar: lo que se mide es quien entro, no la deuda. */
const CALLADO = {
  solicitar: vi.fn(() => new Promise(() => {})),
  solicitarRespuesta: vi.fn(),
  descargar: vi.fn(),
  subir: vi.fn(),
} as unknown as Cliente;

function tokenDeMentira(): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  const cuerpo = JSON.stringify({ name: 'Rufina Medina Medina', tipo_documento: 'DNI', numero_documento: '03593174' });
  return `${base64url('{"alg":"RS256"}')}.${base64url(cuerpo)}.firma-de-mentira`;
}

let soltar = () => {};

/** Recarga el portal en `hash`, con el emisor contestando como se le diga, y lo monta. */
async function recargarCon(contestacion: Contestacion, hash = '#/deudas') {
  window.history.replaceState(null, '', `/portal/${hash}`);
  const emisor = emisorFalso(contestacion);
  soltar = emisor.soltar;
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ access_token: tokenDeMentira(), id_token: tokenDeMentira() }), { status: 200 }),
      ),
    ),
  );
  // Un tope corto: lo que se mide del emisor callado es QUE se explica, no cuanto se le espera.
  const silencio = crearSilencio({ configuracion: configuracionDeLaPuerta(), identidad, espera: 50 });

  await arrancar(() => montarElPortal({ hash, fuente: crearFuenteDeLaPlataforma(CALLADO) }), {
    conPlataforma: true,
    silencio,
  });
  return emisor;
}

afterEach(async () => {
  soltar();
  identidad.fijarToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await limpiarElPortal();
});

describe('recargar con plataforma', () => {
  it('AC1 — con la sesion del emisor viva, se sigue DENTRO sin pulsar nada', async () => {
    const aLaPuerta = vi.spyOn(identidad, 'entrar');

    await recargarCon(conSesion);

    const barra = screen.getByRole('banner');
    expect(await within(barra).findByRole('button', { name: /Rufina Medina Medina/ })).toBeInTheDocument();
    expect(within(barra).queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();
    // Y en el paso donde estaba —la deuda—, no devuelta a «Entrar».
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    expect(screen.queryByRole('heading', { name: 'Entre con su cuenta del portal' })).toBeNull();
    expect(aLaPuerta).not.toHaveBeenCalled();
  });

  it('AC2 — sin sesion en el emisor, el portal ANONIMO, sin redirigir, y el boton para entrar ahi', async () => {
    const aLaPuerta = vi.spyOn(identidad, 'entrar');

    await recargarCon(sinSesion('login_required'));

    const principal = within(screen.getByRole('main'));
    expect(await principal.findByRole('heading', { level: 1, name: 'Entre con su cuenta del portal' })).toBeInTheDocument();
    expect(principal.getByRole('button', { name: 'Entrar con mi cuenta' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    // A la puerta solo se va cuando alguien lo pide.
    expect(aLaPuerta).not.toHaveBeenCalled();
    expect(screen.queryByText('No se pudo abrir su sesión')).toBeNull();
  });

  it('AC4 — si el emisor no contesta, se ve «No se pudo abrir su sesión», y no una pantalla en blanco', async () => {
    await recargarCon(callado);

    expect(await screen.findByText('No se pudo abrir su sesión')).toBeInTheDocument();
    expect(screen.getByText(/sin poder entrar: El emisor no contesto\./)).toBeInTheDocument();
  });
});
