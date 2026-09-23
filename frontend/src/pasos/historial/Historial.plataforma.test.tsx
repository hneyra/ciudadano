import type { Cliente } from '@kamayuk/api';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identidad } from '../../api/identidad.ts';
import type { SituacionDelContrato } from '../../datos/contrato.ts';
import { crearFuenteDeLaPlataforma } from '../../datos/fuenteDeLaPlataforma.ts';
import { limpiarElPortal, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';

/**
 * **«Mis pagos» con plataforma: lo que SI hay, y lo que todavia no se publica** (issue 28).
 *
 * El backend solo ofrece `GET /portal/situacion`: no hay endpoint de pagos del ciudadano ni de sus
 * unidades. Esta pantalla, entonces, ensena lo que la consulta trajo —lo pendiente y los predios— y
 * **dice** que el historial de pagos no se publica todavia, en vez de dibujar un error de averia que
 * invita a insistir contra algo que no existe.
 *
 * Y lo pendiente se dibuja sin inventar: el contrato no trae vencimiento ni estado por concepto
 * (issue 26), asi que no hay insignia y bajo el concepto va su unidad.
 */

/** Un JWT de mentira: la firma la comprueba el backend, no el navegador (`src/api/claims.ts`). */
function tokenDeMentira(): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  const cuerpo = { name: 'Rufina Medina Medina', tipo_documento: 'DNI', numero_documento: '03593174' };
  return `${base64url('{"alg":"RS256"}')}.${base64url(JSON.stringify(cuerpo))}.firma-de-mentira`;
}

const CON_DEUDA_Y_PREDIO: SituacionDelContrato = {
  tipoDocumento: 'DNI',
  numeroDocumento: '03593174',
  aLaFecha: '2026-09-16',
  municipalidadesRecorridas: 1,
  totalConsolidado: { importe: '1842.60', actualizadoA: '2026-09-16' },
  notaDelTotal: null,
  sinRegistros: false,
  municipalidades: [
    {
      ubigeo: '200104',
      nombre: 'Municipalidad Distrital de Catacaos',
      codigoContribuyente: '00000025673',
      nombreContribuyente: 'Rufina Medina Medina',
      activo: true,
      resumenDeSaldos: {
        insoluto: { importe: '1842.60', actualizadoA: '2026-09-16' },
        reajuste: { importe: '0.00', actualizadoA: '2026-09-16' },
        interes: { importe: '0.00', actualizadoA: '2026-09-16' },
        gasto: { importe: '0.00', actualizadoA: '2026-09-16' },
        total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        estadoDeLaConsulta: '1 obligacion con saldo al 16/09/2026',
      },
      obligaciones: [
        {
          tributo: 'PREDIAL',
          ejercicio: 2024,
          predioId: 41,
          vehiculoId: null,
          insoluto: { importe: '1842.60', actualizadoA: '2026-09-16' },
          reajuste: { importe: '0.00', actualizadoA: '2026-09-16' },
          interes: { importe: '0.00', actualizadoA: '2026-09-16' },
          gasto: { importe: '0.00', actualizadoA: '2026-09-16' },
          total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        },
      ],
      predios: [
        {
          codigoReferenciaCatastral: '20010400001234',
          tipo: 'Casa habitación',
          direccion: 'Calle Santa Rosa 116',
          porcentajeTitularidad: '100.00',
        },
      ],
    },
  ],
};

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());

function clienteCon(respuesta: SituacionDelContrato): Cliente {
  return {
    solicitar: vi.fn(() => Promise.resolve(respuesta)),
    solicitarRespuesta: vi.fn(),
    descargar: vi.fn(),
    subir: vi.fn(),
  } as unknown as Cliente;
}

/**
 * En el historial, con la deuda ya leida: el paso 2 la deja en el recorrido y el historial la usa.
 *
 * Se entra por `#/deudas` —que es por donde se entra de verdad— y se navega desde el menu de la
 * barra no haria falta aqui: lo que se mide es la pantalla, y `estado.deudas` ya esta puesto.
 */
async function enElHistorial(): Promise<void> {
  identidad.fijarToken(tokenDeMentira());
  montarElPortal({ hash: '#/deudas', fuente: crearFuenteDeLaPlataforma(clienteCon(CON_DEUDA_Y_PREDIO)) });
  await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
  window.location.hash = '#/historial';
  await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });
}

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('«Pagos realizados» con plataforma', () => {
  it('dice que el portal todavia no publica el historial, y no lo llama averia', async () => {
    await enElHistorial();

    expect(
      await enMain().findByText(/El portal todavía no publica su historial de pagos/),
    ).toBeInTheDocument();
    // El aviso de averia de la demostracion invita a insistir contra algo que no existe.
    expect(enMain().queryByText('No pudimos traer sus pagos. Vuelva a intentarlo en unos minutos.')).toBeNull();
  });
});

describe('«Lo que queda pendiente» sale de la situacion', () => {
  it('con el concepto del servidor, su unidad y su importe, y SIN insignia de estado', async () => {
    await enElHistorial();

    expect(enMain().getByText('Impuesto predial 2024')).toBeInTheDocument();
    // El predio se pudo identificar porque la municipalidad publica uno solo (issue 26).
    expect(enMain().getByText('Casa habitación · Calle Santa Rosa 116')).toBeInTheDocument();
    expect(enMain().getAllByText('S/ 1,842.60').length).toBeGreaterThan(0);
    // Ni «Vencida» ni «Por vencer»: el contrato no dice el estado de nada.
    expect(principal().textContent).not.toMatch(/Vencida|Por vencer|En coactiva/);
  });
});

describe('«De dónde sale lo que paga» con plataforma', () => {
  it('ensena los predios del contrato, sin autovaluo inventado, y dice que no hay vehiculos', async () => {
    await enElHistorial();

    expect(enMain().getByRole('heading', { level: 2, name: 'De dónde sale lo que paga' })).toBeInTheDocument();
    expect(enMain().getByText('Casa habitación')).toBeInTheDocument();
    expect(enMain().getByText('Calle Santa Rosa 116')).toBeInTheDocument();
    expect(enMain().getByText('Código catastral 20010400001234')).toBeInTheDocument();
    expect(enMain().getByText('100.00 % de titularidad')).toBeInTheDocument();
    expect(enMain().getByText('El portal todavía no publica sus vehículos: aquí solo están los predios.')).toBeInTheDocument();
    // El artboard pinta en cada unidad «Autovalúo 2026» con su importe; el contrato no trae ninguno,
    // y la seccion lo dice en su entrada en vez de rellenarlo. Ni el rotulo ni la cifra se dibujan.
    const seccion = enMain().getByRole('heading', { level: 2, name: 'De dónde sale lo que paga' }).closest('section');
    expect(seccion).not.toBeNull();
    expect(within(seccion as HTMLElement).queryByText(/Autovalúo 2026|Base imponible/)).toBeNull();
    expect((seccion as HTMLElement).textContent).not.toMatch(/S\/\s?[\d,]+\.\d{2}/);
  });
});

describe('REVISION — el pago simulado no se cuenta como pago', () => {
  /** Del paso 2 al comprobante, simulando el pago, y de ahi a «Mis pagos». */
  async function trasSimularElPago(): Promise<void> {
    identidad.fijarToken(tokenDeMentira());
    montarElPortal({ hash: '#/deudas', fuente: crearFuenteDeLaPlataforma(clienteCon(CON_DEUDA_Y_PREDIO)) });
    await enMain().findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' });
    fireEvent.click(enMain().getByRole('button', { name: 'Pagar todo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    fireEvent.click(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    window.location.hash = '#/historial';
    await enMain().findByRole('heading', { level: 1, name: 'Mis pagos' });
  }

  it('la banda dice que fue simulado, y no que se registro ni que se envio nada', async () => {
    await trasSimularElPago();

    expect(enMain().getByText('Pago simulado de S/ 1,842.60 en esta visita')).toBeInTheDocument();
    expect(
      enMain().getByText('No se cobró nada, no se envió ningún comprobante y su deuda sigue pendiente.'),
    ).toBeInTheDocument();
    const dicho = principal().textContent ?? '';
    expect(dicho).not.toMatch(/Pago de S\/ [\d,.]+ registrado hoy/);
    expect(dicho).not.toMatch(/Operación .* comprobante .*, enviado a /);
  });

  it('y la deuda SIGUE pendiente, y no entra en «Pagos realizados»', async () => {
    await trasSimularElPago();

    // Lo que queda pendiente: el mismo concepto, con el mismo importe. Si el pago simulado lo
    // hubiera descontado, la pantalla estaria diciendo con la lista lo que el aviso niega con palabras.
    expect(enMain().getByText('Impuesto predial 2024')).toBeInTheDocument();
    expect(enMain().queryByText('Sin deuda pendiente')).toBeNull();
    expect(principal().querySelector('[data-total-pendiente]')?.textContent).toBe('S/ 1,842.60');
    // Y la tabla de pagos hechos no trae ninguna fila: ahi no se pago nada.
    expect(principal().querySelectorAll('[data-reciente]')).toHaveLength(0);
    expect(principal().querySelectorAll('tbody tr')).toHaveLength(0);
  });
});
