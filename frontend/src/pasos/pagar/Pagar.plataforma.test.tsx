import type { Cliente } from '@kamayuk/api';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identidad } from '../../api/identidad.ts';
import type { SituacionDelContrato } from '../../datos/contrato.ts';
import { CONTRIBUYENTE, USUARIO } from '../../datos/demostracion.ts';
import { crearFuenteDeLaPlataforma } from '../../datos/fuenteDeLaPlataforma.ts';
import i18n, { IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal } from '../../pruebas/portal.tsx';

/**
 * **AC4 — pagar y el comprobante con plataforma quedan simulados, y se dice** (issue 28).
 *
 * El portal ya lee la deuda de verdad, pero **no hay endpoint de cobro**: la decision D-14 sigue
 * abierta. Las dos pantallas se recorren enteras y no envian nada a ningun sitio, asi que las dos
 * llevan un aviso permanente y el boton de confirmar lo repite.
 *
 * El recorrido se hace ENTERO desde el paso 2, con la deuda del servidor: es la unica forma de medir
 * que lo que se sella es lo que el servidor dijo y no lo del artboard.
 */

const EL_AVISO = 'El pago en línea todavía no está disponible: esta pantalla es una demostración.';

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

/** Una municipalidad con una obligacion: la rama «con deuda» del contrato. */
const CON_DEUDA: SituacionDelContrato = {
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
        insoluto: { importe: '1500.00', actualizadoA: '2026-09-16' },
        reajuste: { importe: '42.60', actualizadoA: '2026-09-16' },
        interes: { importe: '200.00', actualizadoA: '2026-09-16' },
        gasto: { importe: '100.00', actualizadoA: '2026-09-16' },
        total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        estadoDeLaConsulta: '1 obligacion con saldo al 16/09/2026',
      },
      obligaciones: [
        {
          tributo: 'PREDIAL',
          ejercicio: 2024,
          predioId: null,
          vehiculoId: null,
          insoluto: { importe: '1500.00', actualizadoA: '2026-09-16' },
          reajuste: { importe: '42.60', actualizadoA: '2026-09-16' },
          interes: { importe: '200.00', actualizadoA: '2026-09-16' },
          gasto: { importe: '100.00', actualizadoA: '2026-09-16' },
          total: { importe: '1842.60', actualizadoA: '2026-09-16' },
        },
      ],
      predios: [],
    },
  ],
};

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());

/** Un cliente que contesta la situacion de arriba. */
function clienteCon(respuesta: SituacionDelContrato): Cliente {
  return {
    solicitar: vi.fn(() => Promise.resolve(respuesta)),
    solicitarRespuesta: vi.fn(),
    descargar: vi.fn(),
    subir: vi.fn(),
  } as unknown as Cliente;
}

/** Monta el portal con plataforma y sesion en el paso 2, con la deuda del servidor ya leida. */
async function enElPaso2(): Promise<void> {
  identidad.fijarToken(tokenDeMentira());
  montarElPortal({ hash: '#/deudas', fuente: crearFuenteDeLaPlataforma(clienteCon(CON_DEUDA)) });
  await enMain().findByRole('heading', { level: 1, name: /Lo que debe, por concepto|⟦Lo que debe/ });
}

/** Del paso 2 al 4, pulsando lo que pulsaria una persona. */
async function hastaPagar(): Promise<void> {
  await enElPaso2();
  // El rotulo pasa por `t()`, y en el idioma de marcado sale envuelto: se busca por las dos formas.
  fireEvent.click(enMain().getByRole('button', { name: /^(⟦)?Pagar todo(⟧)?$/ }));
  await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
}

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

describe('AC4 — el paso 4, «Pagar»', () => {
  it('lleva el aviso de pago simulado, y el boton de confirmar lo repite', async () => {
    await hastaPagar();

    expect(enMain().getByText(EL_AVISO)).toBeInTheDocument();
    expect(enMain().getByText(/no se cobra nada y su deuda no cambia/)).toBeInTheDocument();
    // El boton de confirmar, que es lo ultimo que se lee antes de pulsar.
    expect(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' })).toBeInTheDocument();
    // Y el texto del medio, que promete un cobro, ya no esta.
    expect(enMain().queryByRole('button', { name: 'Pagar ahora' })).toBeNull();
  });

  it('el resumen cobra lo del SERVIDOR, y no dibuja cuotas que el contrato no trae', async () => {
    await hastaPagar();

    const resumen = principal().querySelector('[data-resumen]');
    expect(resumen).not.toBeNull();
    expect(within(resumen as HTMLElement).getByText('Impuesto predial 2024')).toBeInTheDocument();
    // 1500 + 42.60 + 100 = 1642.60: todo menos el interes, que la amnistia condona.
    expect(within(resumen as HTMLElement).getByText('S/ 1,642.60')).toBeInTheDocument();
    // Nada del artboard: ni sus conceptos ni sus cuotas.
    expect(principal().textContent).not.toMatch(/Cuota \d de \d/);
    expect(enMain().queryByText('Impuesto predial 2026')).toBeNull();
  });

  it('en demostracion el paso 4 NO cambia: ni aviso, ni boton renombrado', async () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', numero: '03593174' } });

    await enMain().findByRole('heading', { level: 1, name: '¿Cómo quiere pagar?' });
    expect(enMain().queryByText(EL_AVISO)).toBeNull();
    expect(enMain().getByRole('button', { name: 'Pagar ahora' })).toBeInTheDocument();
  });
});

describe('AC4 — el paso 5, «Comprobante»', () => {
  it('lleva el mismo aviso, y el recibo es el de la deuda del servidor', async () => {
    await hastaPagar();

    fireEvent.click(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));

    expect(enMain().getByText(EL_AVISO)).toBeInTheDocument();
    // El recibo dice lo que el servidor dijo: su concepto, su contribuyente y su codigo de padron.
    expect(enMain().getByText('Impuesto predial 2024')).toBeInTheDocument();
    expect(enMain().getByText('Rufina Medina Medina')).toBeInTheDocument();
    expect(enMain().getByText('00000025673')).toBeInTheDocument();
    // Y NUNCA la persona del artboard, que es otra.
    expect(enMain().queryByText(CONTRIBUYENTE.nombre)).toBeNull();
    expect(principal().textContent).not.toContain(USUARIO.correo);
  });

  it('en demostracion el paso 5 NO cambia: sin aviso, y con el contribuyente del artboard', async () => {
    montarElPortal({
      hash: '#/comprobante',
      estado: {
        paso: 'comprobante',
        numero: '03593174',
        pagadas: { pred26: true },
        recienPagado: true,
        ultimo: {
          ids: ['pred26'],
          insoluto: '293.72',
          reajuste: '0.00',
          interes: '0.00',
          gastos: '0.00',
          total: '293.72',
          conAmnistia: '293.72',
          medio: 'tarjeta',
          destino: 'maria@correo.com',
          comprobante: { numero: '0003-0041418', operacion: '882134', fecha: '2026-09-13', hora: '14:22' },
        },
      },
    });

    await enMain().findByRole('heading', { level: 1, name: 'Su pago se registró' });
    expect(enMain().queryByText(EL_AVISO)).toBeNull();
    expect(enMain().getByText(CONTRIBUYENTE.nombre)).toBeInTheDocument();
    expect(enMain().getByText(CONTRIBUYENTE.codigo)).toBeInTheDocument();
  });
});

describe('el aviso pasa por `t()`', () => {
  it('sale envuelto en el idioma marcado, en los dos pasos', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    await hastaPagar();

    expect(enMain().getByText(marcado(EL_AVISO))).toBeInTheDocument();

    fireEvent.click(enMain().getByRole('button', { name: marcado('Simular el pago: no se cobra nada') }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    expect(enMain().getByText(marcado(EL_AVISO))).toBeInTheDocument();
  });
});
