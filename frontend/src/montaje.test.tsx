import { act, fireEvent, findByRole, getByRole, waitFor } from '@testing-library/react';
import { createElement, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n, { IDIOMA_MARCADO, IDIOMA_POR_OMISION } from './i18n/i18n.ts';
import { AVISO_SIN_PORTAL } from './inicio.ts';
import { montar } from './montaje.tsx';
import { marcado } from './pruebas/portal.tsx';

/**
 * **Lo que revienta DESPUES de montar no deja la pagina en blanco** (issue 67).
 *
 * `montar()` captura lo que rechaza al montar —la fuente, el arranque—, pero `render` no devuelve
 * nada que rechazar: un error en un dibujo posterior (tras un clic, un cambio de estado) sube hasta la
 * raiz, y React 19 la desmonta entera. Aqui se monta el portal con `montar()` de verdad y una
 * `Aplicacion` que revienta al pulsar un boton, que es algo que esta FUERA del enrutador: lo que la
 * recoge es el limite de la raiz.
 */

/** Si el tema revienta tambien, el limite de la raiz no puede dibujar su aviso. */
const tema = vi.hoisted(() => ({ roto: false }));

vi.mock('@kamayuk/ui', async (original) => {
  const real = await original<typeof import('@kamayuk/ui')>();
  return {
    ...real,
    ProveedorDeTema: (props: Parameters<typeof real.ProveedorDeTema>[0]) => {
      if (tema.roto) throw new Error('el tema revento');
      return createElement(real.ProveedorDeTema, props);
    },
  };
});

vi.mock('./aplicacion.tsx', async (original) => {
  const real = await original<typeof import('./aplicacion.tsx')>();
  /** Se dibuja bien al montar, y revienta en el dibujo que sigue a pulsar «Romper». */
  function Aplicacion() {
    const [rota, romper] = useState(false);
    if (rota) throw new Error('un dibujo posterior revento');
    return (
      <button type="button" onClick={() => romper(true)}>
        Romper
      </button>
    );
  }
  return { ...real, Aplicacion };
});

let raiz: HTMLElement;

beforeEach(() => {
  raiz = document.createElement('div');
  raiz.id = 'raiz';
  document.body.append(raiz);
  // React cuenta en la consola lo que el limite recogio: es lo esperado aqui, y no se mide.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  tema.roto = false;
  raiz.remove();
  vi.restoreAllMocks();
  await i18n.changeLanguage(IDIOMA_POR_OMISION);
});

/** Pulsa y devuelve lo que React relanzo: bajo `act`, un error que nadie recoge sale por aqui. */
function pulsar(boton: HTMLElement): unknown {
  try {
    fireEvent.click(boton);
    return null;
  } catch (error) {
    return error;
  }
}

describe('AC2 — un error en un dibujo posterior deja el aviso, no la raiz vacia', () => {
  it('fuera del enrutador: el aviso del limite de la raiz, con «Volver a cargar»', async () => {
    await act(() => montar(raiz));

    const escapado = pulsar(getByRole(raiz, 'button', { name: 'Romper' }));

    expect(raiz, 'la raiz se quedo vacia').not.toBeEmptyDOMElement();
    expect(escapado, 'el error salio de React sin que nadie lo recogiera').toBeNull();
    const aviso = await findByRole(raiz, 'alert');
    expect(getByRole(aviso, 'button', { name: 'Volver a cargar' })).toBeInTheDocument();
    expect(aviso).toHaveTextContent('No se pudo mostrar esta pantalla');
    expect(aviso).toHaveTextContent(
      'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
    );
    // Lo que revento es para la consola, no para quien iba a pagar.
    expect(aviso).not.toHaveTextContent('un dibujo posterior revento');
  });

  it('y lo que dice pasa por `t()`', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    await act(() => montar(raiz));

    pulsar(getByRole(raiz, 'button', { name: 'Romper' }));

    const aviso = await findByRole(raiz, 'alert');
    expect(getByRole(aviso, 'button', { name: marcado('Volver a cargar') })).toBeInTheDocument();
    expect(aviso.textContent).toBe(
      [
        'No se pudo mostrar esta pantalla',
        'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
        'Volver a cargar',
      ]
        .map(marcado)
        .join(''),
    );
  });

  it('y si hasta el aviso revienta, queda el de la entrada, escrito sin React', async () => {
    await act(() => montar(raiz));
    tema.roto = true;

    // Fuera de `act`, como en el navegador: es la unica forma de que React avise por `onUncaughtError`
    // en vez de relanzar el error a quien pulso.
    const conAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    try {
      getByRole(raiz, 'button', { name: 'Romper' }).click();

      await waitFor(() => expect(getByRole(raiz, 'alert')).toHaveTextContent(AVISO_SIN_PORTAL.titulo));
    } finally {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = conAct;
    }
    expect(getByRole(raiz, 'alert')).toHaveTextContent(AVISO_SIN_PORTAL.remedio);
  });
});
