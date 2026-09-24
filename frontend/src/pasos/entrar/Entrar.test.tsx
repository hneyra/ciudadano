import type { Cliente } from '@kamayuk/api';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identidad } from '../../api/identidad.ts';
import { crearFuenteDeLaPlataforma } from '../../datos/fuenteDeLaPlataforma.ts';
import i18n, { ABRE, CIERRA, IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';

/**
 * **Paso 1 con plataforma: «Entrar», y la franja renumerada** (issue 28, AC1).
 *
 * El recorrido con plataforma tiene **cuatro** pasos y empieza por entrar. Aqui se mide en la
 * pantalla lo que `recorrido.plataforma.test.ts` mide en el reductor: que la franja los dice, que
 * `#/deudas` sin sesion lleva a «Entrar», que con sesion `#/entrar` ya no se abre, y que la pantalla
 * conserva lo que el issue le pide conservar.
 */

/** Un cliente que no llega a contestar: en el paso 1 no hay consulta que dibujar. */
const CALLADO = {
  solicitar: vi.fn(() => new Promise(() => {})),
  solicitarRespuesta: vi.fn(),
  descargar: vi.fn(),
  subir: vi.fn(),
} as unknown as Cliente;

const conPlataforma = () => crearFuenteDeLaPlataforma(CALLADO);

/** Un JWT de mentira: la firma la comprueba el backend, no el navegador (`src/api/claims.ts`). */
function tokenDeMentira(): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  return `${base64url('{"alg":"RS256"}')}.${base64url('{"name":"Rufina Medina Medina"}')}.firma-de-mentira`;
}

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());
const franja = () => screen.getByRole('navigation');
const etiquetasDeLaFranja = () =>
  within(franja())
    .getAllByRole('button')
    .map((boton) => boton.getAttribute('aria-label'));

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('AC1 — la franja renumerada', () => {
  it('con plataforma son CUATRO pasos y el primero es «Entrar»', async () => {
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    await enMain().findByRole('heading', { level: 1, name: 'Entre con su cuenta del portal' });
    expect(etiquetasDeLaFranja()).toEqual(['Entrar', 'Elegir qué pago', 'Pagar', 'Comprobante']);
    expect(within(franja()).getByRole('button', { name: 'Entrar' })).toHaveAttribute('aria-current', 'step');
    // Los dos pasos que este recorrido no tiene no estan en la franja.
    expect(within(franja()).queryByRole('button', { name: 'Buscar mi deuda' })).toBeNull();
    expect(within(franja()).queryByRole('button', { name: 'Mis datos' })).toBeNull();
  });

  it('en demostracion la franja sigue siendo la de los cinco pasos del artboard', async () => {
    montarElPortal({ hash: '#/buscar' });

    await enMain().findByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' });
    expect(etiquetasDeLaFranja()).toEqual([
      'Buscar mi deuda',
      'Elegir qué pago',
      'Mis datos',
      'Pagar',
      'Comprobante',
    ]);
  });

  it('con la sesion abierta, «Entrar» esta hecho y ya no se repite: lo dice, y no navega', async () => {
    identidad.fijarToken(tokenDeMentira());
    montarElPortal({ hash: '#/deudas', fuente: conPlataforma() });

    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    fireEvent.click(within(franja()).getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Ese paso ya está hecho y no hace falta repetirlo.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/deudas');
    // Y no es el aviso del paso futuro, que aqui no tendria sentido: no falta ninguno.
    expect(screen.queryByText('Complete primero los pasos anteriores.')).toBeNull();
  });
});

describe('AC2 — sin sesion, la pantalla de entrar', () => {
  it('`#/deudas` sin sesion no ensena ninguna deuda: lleva al paso 1', async () => {
    montarElPortal({ hash: '#/deudas', fuente: conPlataforma() });

    await waitFor(() => expect(window.location.hash).toBe('#/entrar'));
    expect(enMain().getByRole('heading', { level: 1, name: 'Entre con su cuenta del portal' })).toBeInTheDocument();
  });

  it('y con sesion, `#/entrar` lleva al paso 2, que es donde esta su deuda', async () => {
    identidad.fijarToken(tokenDeMentira());
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    // Es el camino de vuelta del emisor: `@kamayuk/sesion` devuelve el navegador al hash de la ida.
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    expect(enMain().queryByRole('heading', { name: 'Entre con su cuenta del portal' })).toBeNull();
  });
});

describe('la pantalla de entrar', () => {
  it('explica el acceso, y el boton va a la PUERTA de verdad', async () => {
    const ida = vi.spyOn(identidad, 'entrar').mockResolvedValue(null);
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    expect(
      await enMain().findByText(/Su deuda está a nombre de su documento, así que lo primero es saber quién pregunta/),
    ).toBeInTheDocument();

    fireEvent.click(enMain().getByRole('button', { name: 'Entrar con mi cuenta' }));
    await waitFor(() => expect(ida).toHaveBeenCalledTimes(1));
    // Quien va a la puerta se va de la pagina: el recorrido no se mueve.
    expect(window.location.hash).toBe('#/entrar');
  });

  it('dice donde se abre la cuenta, y no ofrece crearla aqui', async () => {
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    expect(
      await enMain().findByText(/se la abren en la ventanilla de la municipalidad con su documento: aquí no se puede crear/),
    ).toBeInTheDocument();
    // El realm tiene el registro cerrado a proposito: un boton de registro seria un callejon.
    expect(enMain().queryByRole('button', { name: 'Crear una cuenta' })).toBeNull();
    expect(enMain().queryByRole('button', { name: 'Crear mi cuenta' })).toBeNull();
  });

  it('conserva «Qué puede hacer aquí», pero con lo que el portal hace DE VERDAD, y sin amnistia (issue 49)', async () => {
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    const seccion = await enMain().findByRole('region', { name: 'Qué puede hacer aquí' });
    expect(
      within(seccion)
        .getAllByRole('listitem')
        .map((capacidad) => capacidad.textContent),
    ).toEqual([
      'Ver lo que debeLo que debe en cada municipalidad del sistema, por tributo y año, con la fecha de cada importe.',
      'Ver sus prediosLos predios que figuran a su nombre, con su código catastral.',
      'Pagar en la ventanillaEl pago en línea todavía no está disponible: se paga con su documento en la municipalidad.',
    ]);
    // Lo que el artboard promete y aqui no hay: pagar con tarjeta o Yape, descargar comprobantes, el
    // vencimiento de cada cuota. Y el aviso de una amnistia que el contrato no trae.
    expect(principal().textContent).not.toMatch(/Pagar en línea|Descargar comprobantes|vencimiento|amnist[ií]a/i);
    expect(principal().textContent).not.toMatch(/podrá pagar/);
  });

  it('y si no se pudo ni llegar al emisor, se dice en vez de no hacer nada visible', async () => {
    vi.spyOn(identidad, 'entrar').mockResolvedValue({
      emisor: 'http://localhost:18180/realms/kamayuk-ciudadano',
      url: 'http://localhost:18180/realms/kamayuk-ciudadano/.well-known/openid-configuration',
      motivo: 'la peticion no llego a completarse',
    });
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    fireEvent.click(await enMain().findByRole('button', { name: 'Entrar con mi cuenta' }));

    expect(
      await screen.findByText('No pudimos llevarle al acceso: la peticion no llego a completarse.'),
    ).toBeInTheDocument();
  });

  it('todo lo que se lee pasa por `t()`', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/entrar', fuente: conPlataforma() });

    await enMain().findByRole('heading', { level: 1, name: marcado('Entre con su cuenta del portal') });
    const escapados: string[] = [];
    const recorrido = document.createTreeWalker(principal(), NodeFilter.SHOW_TEXT);
    for (let nodo = recorrido.nextNode(); nodo !== null; nodo = recorrido.nextNode()) {
      const texto = (nodo.textContent ?? '').trim();
      if (texto === '' || (texto.startsWith(ABRE) && texto.endsWith(CIERRA))) continue;
      escapados.push(texto);
    }
    expect(escapados).toEqual([]);
  });
});
