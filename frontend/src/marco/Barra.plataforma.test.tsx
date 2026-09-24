import type { Cliente } from '@kamayuk/api';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { identidad } from '../api/identidad.ts';
import { USUARIO } from '../datos/demostracion.ts';
import { crearFuenteDeLaPlataforma } from '../datos/fuenteDeLaPlataforma.ts';
import {
  limpiarElPortal,
  montarElPortal,
  remendarJsdomParaElMenu,
  plazosDelPortal,
} from '../pruebas/portal.tsx';

/**
 * **La sesion del marco, con plataforma** (issue 27).
 *
 * Con la plataforma detras, la barra deja de hablar del recorrido de la demostracion:
 *
 *   · «Iniciar sesión» llama a `entrar()` —la puerta de verdad— en vez de abrir el paso «Mis datos»;
 *   · quien entro sale de los **claims del token** (`tipo_documento`, `numero_documento`), no de
 *     `USUARIO` del artboard;
 *   · «Cerrar sesión» llama a `salir()`, que cierra tambien en el emisor con `id_token_hint`. Sin
 *     eso, en un equipo compartido —que es donde se paga un tributo— el siguiente arranque entraria
 *     solo con la misma cuenta.
 *
 * Que en demostracion NADA de esto cambia lo sigue midiendo `Barra.test.tsx`, que monta sin
 * plataforma y no se toca en este issue.
 */

/** Un cliente que no llega a contestar: lo que la barra hace no depende de la consulta. */
const CALLADO = {
  solicitar: vi.fn(() => new Promise(() => {})),
  solicitarRespuesta: vi.fn(),
  descargar: vi.fn(),
  subir: vi.fn(),
} as unknown as Cliente;

const conPlataforma = () => crearFuenteDeLaPlataforma(CALLADO);

/** Un JWT de mentira con esos claims. La firma no se comprueba en el navegador (`src/api/claims.ts`). */
function tokenCon(cuerpo: Record<string, unknown>): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  return `${base64url('{"alg":"RS256"}')}.${base64url(JSON.stringify(cuerpo))}.firma-de-mentira`;
}

const barra = () => screen.getByRole('banner');

beforeAll(remendarJsdomParaElMenu);

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('sin sesion', () => {
  it('«Iniciar sesión» va a la PUERTA, y no al paso «Mis datos»', async () => {
    const ida = vi.spyOn(identidad, 'entrar').mockResolvedValue(null);
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    fireEvent.click(within(barra()).getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(ida).toHaveBeenCalledTimes(1));
    // Y no se movio el recorrido: quien va a la puerta se va de la pagina, no cambia de paso. El
    // primer paso con plataforma es «Entrar» desde el issue 28, no «Buscar mi deuda».
    expect(window.location.hash).toBe('#/entrar');
  });

  it('y si no se pudo ni llegar al emisor, se dice en vez de no hacer nada visible', async () => {
    vi.spyOn(identidad, 'entrar').mockResolvedValue({
      emisor: 'http://localhost:18180/realms/kamayuk-ciudadano',
      url: 'http://localhost:18180/realms/kamayuk-ciudadano/.well-known/openid-configuration',
      motivo: 'la peticion no llego a completarse',
    });
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    fireEvent.click(within(barra()).getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await screen.findByText('No pudimos llevarle al acceso: la peticion no llego a completarse.'),
    ).toBeInTheDocument();
  });
});

describe('con sesion', () => {
  it('el nombre y el documento salen del TOKEN, no de la demostracion', async () => {
    identidad.fijarToken(tokenCon({ name: 'Rufina Medina Medina', tipo_documento: 'DNI', numero_documento: '03593174' }));
    montarElPortal({ hash: '#/deudas', fuente: conPlataforma() });

    const disparador = within(barra()).getByRole('button', { expanded: false, name: /Rufina Medina Medina/ });
    expect(disparador).toHaveTextContent('DNI 03593174');
    // Lo que NO se ensena: la persona del artboard, que es otra.
    expect(within(barra()).queryByText(USUARIO.nombre)).toBeNull();
    expect(within(barra()).queryByText(USUARIO.correo)).toBeNull();

    act(() => disparador.focus());
    fireEvent.keyDown(disparador, { key: 'Enter' });
    // El codigo de contribuyente y el correo no vienen en el token, asi que el menu no los inventa.
    expect(screen.queryByText(/Contribuyente 0000/)).toBeNull();
    expect(screen.getAllByRole('menuitem').map((opcion) => opcion.textContent)).toEqual([
      'Mis pagos',
      'Mis predios y vehículos',
      'Cambiar mi clave',
      'Cerrar sesión',
    ]);
  });

  it('«Cerrar sesión» llama a `salir()`: tambien en el emisor, con `id_token_hint`', async () => {
    const salida = vi.spyOn(identidad, 'salir').mockImplementation(() => {});
    identidad.fijarToken(tokenCon({ name: 'Rufina Medina Medina', tipo_documento: 'DNI', numero_documento: '03593174' }));
    montarElPortal({ hash: '#/deudas', fuente: conPlataforma() });

    const disparador = within(barra()).getByRole('button', { expanded: false, name: /Rufina Medina Medina/ });
    act(() => disparador.focus());
    fireEvent.keyDown(disparador, { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(salida).toHaveBeenCalledTimes(1));
    // Y no se levanta el aviso de la demostracion: la pagina se va al emisor.
    expect(screen.queryByText('Sesión cerrada.')).toBeNull();
  });

  it('sin `name` en el token, la barra no se queda muda: se la nombra por su cuenta', async () => {
    identidad.fijarToken(tokenCon({ tipo_documento: 'CE', numero_documento: '001234567' }));
    montarElPortal({ hash: '#/deudas', fuente: conPlataforma() });

    const disparador = within(barra()).getByRole('button', { expanded: false, name: /Su cuenta/ });
    expect(disparador).toHaveTextContent('CE 001234567');
  });
});

describe('issue 49, casos 3 y 4 — el marco no afirma nada falso con plataforma', () => {
  it('«Cambiar mi clave» no promete abrir nada: dice que el portal no lo permite', async () => {
    identidad.fijarToken(tokenCon({ name: 'Rufina Medina Medina', tipo_documento: 'DNI', numero_documento: '03593174' }));
    montarElPortal({ hash: '#/deudas', fuente: conPlataforma() });

    const disparador = within(barra()).getByRole('button', { expanded: false, name: /Rufina Medina Medina/ });
    act(() => disparador.focus());
    fireEvent.keyDown(disparador, { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cambiar mi clave' }));

    expect(await screen.findByText('El portal todavía no permite cambiar la clave.')).toBeInTheDocument();
    expect(screen.queryByText('Abriría el cambio de clave.')).toBeNull();
  });

  it('el pie no dice que los datos son de demostracion: con plataforma son los de la persona', () => {
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    const pie = screen.getByRole('contentinfo');
    expect(
      within(pie).getByText(
        'Municipalidad Distrital de Catacaos — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00.',
      ),
    ).toBeInTheDocument();
    expect(pie.textContent).not.toMatch(/demostración/);
  });
});
