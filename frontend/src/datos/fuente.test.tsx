import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HISTORIAL } from './demostracion.ts';
import type { FuenteDelPortal } from './fuente.ts';
import { FuenteActiva, LLAVES, hayPlataforma, useHistorial, useLaSituacion, useUnidades } from './fuente.ts';
import { fuenteDeDemostracion } from './fuenteDeDemostracion.ts';
import type { SituacionDelServidor } from './tipos.ts';

/**
 * **Los ganchos leen de la fuente inyectada, y la guardan en la cache con sus llaves.**
 *
 * La fuente falsa contesta cosas que la de demostracion NO tiene: si un gancho leyera de otro sitio
 * a pesar de la inyeccion, la prueba no podria pasar por casualidad.
 *
 * Y la mitad nueva (issue 27): **sin plataforma, la consulta no se hace**. No es que falle ni que
 * devuelva vacio: no sale.
 */

/** Un cliente por prueba: compartido, la respuesta de una se quedaria en la cache de la siguiente. */
function arnes(fuente: FuenteDelPortal) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const envoltorio = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={cliente}>
      <FuenteActiva value={fuente}>{children}</FuenteActiva>
    </QueryClientProvider>
  );
  return { cliente, envoltorio };
}

const SITUACION_FALSA: SituacionDelServidor = {
  estado: 'sin-registros',
  tipoDeDocumento: 'DNI',
  numeroDeDocumento: '00000014',
  aLaFecha: '2026-09-16',
  municipalidadesRecorridas: 1,
  totalConsolidado: { importe: '0.00', actualizadoA: '2026-09-16' },
  notaDelTotal: null,
  municipalidades: [],
  deudas: [],
};

function fuenteFalsa(cambios: Partial<FuenteDelPortal> = {}): FuenteDelPortal {
  return {
    consulta: vi.fn(() => Promise.resolve(SITUACION_FALSA)),
    historial: vi.fn(() => Promise.resolve(HISTORIAL.slice(0, 1))),
    unidades: vi.fn(() => Promise.resolve([])),
    ...cambios,
  };
}

describe('useLaSituacion', () => {
  it('pide la consulta de la fuente inyectada, UNA vez, y la guarda en su llave', async () => {
    const fuente = fuenteFalsa();
    const { cliente, envoltorio } = arnes(fuente);

    const { result } = renderHook(() => useLaSituacion(), { wrapper: envoltorio });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(SITUACION_FALSA);
    expect(fuente.consulta).toHaveBeenCalledTimes(1);
    expect(cliente.getQueryData(LLAVES.situacion)).toBe(SITUACION_FALSA);
  });

  it('si la consulta falla, lo dice y NO reintenta: un 401 reintentado son tres 401', async () => {
    const fuente = fuenteFalsa({ consulta: vi.fn(() => Promise.reject(new Error('sin servicio'))) });
    const { envoltorio } = arnes(fuente);

    const { result } = renderHook(() => useLaSituacion(), { wrapper: envoltorio });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('sin servicio');
    expect(fuente.consulta).toHaveBeenCalledTimes(1);
  });

  it('SIN plataforma no se pide nada: la consulta queda apagada, no fallando', async () => {
    const { envoltorio } = arnes(fuenteDeDemostracion);

    const { result } = renderHook(() => useLaSituacion(), { wrapper: envoltorio });
    // Un turno de reloj: si algo fuera a salir, ya habria salido.
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('hayPlataforma', () => {
  it('lo dice la fuente, y no el entorno: con consulta si, sin consulta no', () => {
    expect(hayPlataforma(fuenteFalsa())).toBe(true);
    expect(hayPlataforma(fuenteDeDemostracion)).toBe(false);
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

  it('con la fuente de demostracion, los datos del artboard', async () => {
    const { envoltorio } = arnes(fuenteDeDemostracion);

    const historial = renderHook(() => useHistorial(), { wrapper: envoltorio });

    await waitFor(() => expect(historial.result.current.isSuccess).toBe(true));
    expect(historial.result.current.data).toBe(HISTORIAL);
  });
});

describe('LLAVES', () => {
  it('cuelgan todas de la misma rama, para invalidar el portal entero de una vez', () => {
    const [rama] = LLAVES.rama;
    expect(LLAVES.situacion[0]).toBe(rama);
    expect(LLAVES.historial[0]).toBe(rama);
    expect(LLAVES.unidades[0]).toBe(rama);
  });
});
