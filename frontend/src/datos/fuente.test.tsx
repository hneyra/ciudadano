import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CONTRIBUYENTE, DEUDAS, HISTORIAL, UNIDADES } from './demostracion.ts';
import type { FuenteDelPortal } from './fuente.ts';
import { FuenteActiva, LLAVES, useHistorial, useSituacion, useUnidades } from './fuente.ts';
import type { Situacion } from './tipos.ts';

/**
 * **Los ganchos leen de la fuente inyectada, y la guardan en la cache con sus llaves.**
 *
 * La fuente falsa contesta cosas que la de demostracion NO tiene —un solo concepto, un
 * contribuyente con otro nombre—: si el gancho leyera de `fuenteDeDemostracion` a pesar de la
 * inyeccion, la prueba no podria pasar por casualidad.
 */

/** Un cliente por prueba: compartido, la respuesta de una se quedaria en la cache de la siguiente. */
function arnes(fuente?: FuenteDelPortal) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const envoltorio = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={cliente}>
      {fuente === undefined ? children : <FuenteActiva value={fuente}>{children}</FuenteActiva>}
    </QueryClientProvider>
  );
  return { cliente, envoltorio };
}

const SITUACION_FALSA: Situacion = {
  contribuyente: { ...CONTRIBUYENTE, nombre: 'Contribuyente de la prueba' },
  deudas: DEUDAS.slice(3),
};

function fuenteFalsa(cambios: Partial<FuenteDelPortal> = {}): FuenteDelPortal {
  return {
    situacion: vi.fn(() => Promise.resolve(SITUACION_FALSA)),
    historial: vi.fn(() => Promise.resolve(HISTORIAL.slice(0, 1))),
    unidades: vi.fn(() => Promise.resolve([])),
    ...cambios,
  };
}

describe('useSituacion', () => {
  it('lee de la fuente inyectada, con el documento buscado, y la guarda en su llave', async () => {
    const fuente = fuenteFalsa();
    const { cliente, envoltorio } = arnes(fuente);

    const { result } = renderHook(() => useSituacion('03593174'), { wrapper: envoltorio });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(SITUACION_FALSA);
    expect(fuente.situacion).toHaveBeenCalledWith('03593174');
    expect(fuente.situacion).toHaveBeenCalledTimes(1);
    expect(cliente.getQueryData(LLAVES.situacion('03593174'))).toBe(SITUACION_FALSA);
    // Otro documento es otra llave: no hereda la respuesta del primero.
    expect(cliente.getQueryData(LLAVES.situacion('20525118447'))).toBeUndefined();
  });

  it('si la fuente falla, lo dice y no reintenta', async () => {
    const fuente = fuenteFalsa({
      situacion: vi.fn(() => Promise.reject(new Error('sin servicio'))),
    });
    const { envoltorio } = arnes(fuente);

    const { result } = renderHook(() => useSituacion('03593174'), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('sin servicio');
    expect(fuente.situacion).toHaveBeenCalledTimes(1);
  });

  it('sin inyectar nada, lee los datos de demostracion', async () => {
    const { envoltorio } = arnes();

    const { result } = renderHook(() => useSituacion('00000025673'), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toStrictEqual({ contribuyente: CONTRIBUYENTE, deudas: DEUDAS });
  });
});

describe('useHistorial y useUnidades', () => {
  it('leen de la fuente inyectada, cada uno en su llave', async () => {
    const fuente = fuenteFalsa();
    const { cliente, envoltorio } = arnes(fuente);

    const historial = renderHook(() => useHistorial(), { wrapper: envoltorio });
    const unidades = renderHook(() => useUnidades(), { wrapper: envoltorio });

    await waitFor(() => expect(historial.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(unidades.result.current.isSuccess).toBe(true));

    expect(historial.result.current.data).toStrictEqual(HISTORIAL.slice(0, 1));
    expect(unidades.result.current.data).toStrictEqual([]);
    expect(cliente.getQueryData(LLAVES.historial)).toStrictEqual(HISTORIAL.slice(0, 1));
    expect(cliente.getQueryData(LLAVES.unidades)).toStrictEqual([]);
  });

  it('sin inyectar nada, leen los datos de demostracion', async () => {
    const { envoltorio } = arnes();

    const historial = renderHook(() => useHistorial(), { wrapper: envoltorio });
    const unidades = renderHook(() => useUnidades(), { wrapper: envoltorio });

    await waitFor(() => expect(historial.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(unidades.result.current.isSuccess).toBe(true));
    expect(historial.result.current.data).toBe(HISTORIAL);
    expect(unidades.result.current.data).toBe(UNIDADES);
  });
});

describe('LLAVES', () => {
  it('cuelgan todas de la misma rama, para invalidar el portal entero de una vez', () => {
    const [rama] = LLAVES.rama;
    expect(LLAVES.situacion('1')[0]).toBe(rama);
    expect(LLAVES.historial[0]).toBe(rama);
    expect(LLAVES.unidades[0]).toBe(rama);
  });
});
