import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TODOS_LOS_PASOS } from '../recorrido/recorrido.ts';
import { PANTALLAS, perezosa, precargarLasPantallas } from './pantallas.tsx';

/**
 * **Cada pantalla, en su trozo: lo que `src/pruebas/portal.tsx` deja de ver al precargar** (issue 11).
 *
 * Las pruebas del portal precargan las seis antes de montar, y asi `lazy` las dibuja en el mismo render.
 * Eso deja sin mirar dos cosas, que se miden aqui con pantallas perezosas NUEVAS (las de `PANTALLAS` ya
 * estan cargadas en cuanto alguien monta el portal):
 *
 * 1. que sin precargar, `lazy` SI suspende —el hueco ocupado y luego la pantalla—, que es lo que ocurre
 *    en el navegador con cada trozo que aun no llego;
 * 2. y que precargar es lo que evita ese hueco, y no otra cosa.
 */

const Hueco = () => <div aria-busy="true" data-testid="hueco" />;

function dibujar(Pantalla: React.ComponentType) {
  return render(
    <Suspense fallback={<Hueco />}>
      <Pantalla />
    </Suspense>,
  );
}

describe('una pantalla perezosa', () => {
  it('SIN precargar, suspende: primero el hueco ocupado, y la pantalla cuando llega su trozo', async () => {
    const { Pantalla } = perezosa(async () => () => <h1>La pantalla</h1>);

    dibujar(Pantalla);

    expect(screen.getByTestId('hueco')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('heading', { name: 'La pantalla' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'La pantalla' })).toBeInTheDocument();
    expect(screen.queryByTestId('hueco')).toBeNull();
  });

  it('precargada, se dibuja en el mismo render, sin hueco', async () => {
    const { Pantalla, precargar } = perezosa(async () => () => <h1>La pantalla</h1>);

    await precargar();
    dibujar(Pantalla);

    expect(screen.getByRole('heading', { name: 'La pantalla' })).toBeInTheDocument();
    expect(screen.queryByTestId('hueco')).toBeNull();
  });

  it('pide su trozo UNA vez, la precarguen o la dibujen las veces que sea', async () => {
    const cargar = vi.fn(async () => () => <h1>La pantalla</h1>);
    const { Pantalla, precargar } = perezosa(cargar);

    await Promise.all([precargar(), precargar()]);
    dibujar(Pantalla);
    await precargar();

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('y si el trozo no llega (la red), la siguiente vez lo vuelve a pedir en vez de quedarse con el fallo', async () => {
    const cargar = vi
      .fn<() => Promise<React.ComponentType>>()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(() => <h1>La pantalla</h1>);
    const { Pantalla, precargar } = perezosa(cargar);

    await expect(precargar()).rejects.toThrow('sin red');
    await precargar();
    dibujar(Pantalla);

    expect(cargar).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: 'La pantalla' })).toBeInTheDocument();
  });
});

describe('las del recorrido', () => {
  it('hay una por paso de los DOS recorridos, y ni una de mas', () => {
    expect(Object.keys(PANTALLAS).sort()).toEqual([...TODOS_LOS_PASOS].sort());
  });

  // Con plazo: es la primera vez que este archivo transforma todas las pantallas y lo que importan.
  it('y cada una carga la pantalla de su paso', { timeout: 30_000 }, async () => {
    const [entrar, buscar, deudas, identificar, pagar, comprobante, historial] = await Promise.all([
      import('./entrar/Entrar.tsx'),
      import('./buscar/Buscar.tsx'),
      import('./deudas/Deudas.tsx'),
      import('./identificar/Identificar.tsx'),
      import('./pagar/Pagar.tsx'),
      import('./comprobante/Comprobante.tsx'),
      import('./historial/Historial.tsx'),
    ]);

    expect(await PANTALLAS.entrar.precargar()).toBe(entrar.Entrar);
    expect(await PANTALLAS.buscar.precargar()).toBe(buscar.Buscar);
    expect(await PANTALLAS.deudas.precargar()).toBe(deudas.Deudas);
    expect(await PANTALLAS.identificar.precargar()).toBe(identificar.Identificar);
    expect(await PANTALLAS.pagar.precargar()).toBe(pagar.Pagar);
    expect(await PANTALLAS.comprobante.precargar()).toBe(comprobante.Comprobante);
    expect(await PANTALLAS.historial.precargar()).toBe(historial.Historial);
    await expect(precargarLasPantallas()).resolves.toBeUndefined();
  });
});
