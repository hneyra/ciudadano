import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DEUDAS } from '../../datos/demostracion.ts';
import { LA_DEMOSTRACION } from '../../datos/fuenteDeDemostracion.ts';
import { limpiarElPortal, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';
import { type PagoSimulado, datosDeLaDemostracion } from '../../recorrido/recorrido.ts';

/**
 * **El aviso de pago simulado y la banda del comprobante preguntan LO MISMO** (issue 59, revision del
 * PR #69).
 *
 * Hasta el issue 59 la banda se elegia por el dato —`sello === null ? <BandaSimulada/> : <BandaDeExito/>`—
 * y el aviso por el modo —`estado.conPlataforma ? <AvisoDePagoSimulado/> : null`—. Mientras los dos
 * coincidieran no se notaba; en demostracion con un pago sin sello, el comprobante decia «Así se
 * vería su comprobante» y **no** decia que el pago era una demostracion: un recibo a medias.
 *
 * Ahora las dos cuelgan de una sola pregunta, `esSimulado(pago)`, y el reductor sella un pago simulado
 * o uno registrado segun la politica del modo. Aqui se escribe a mano el estado que ninguna accion deja
 * —un pago simulado en el portal de demostracion— para medir que el aviso y la banda van juntos.
 */

const EL_AVISO = 'El pago en línea todavía no está disponible: esta pantalla es una demostración.';

/** Un pago simulado del predial 2026, sin medio, sin destino y sin numeros. */
const SIMULADO: PagoSimulado = {
  conceptos: DEUDAS.filter((deuda) => deuda.id === 'pred26'),
  contribuyente: datosDeLaDemostracion(LA_DEMOSTRACION).contribuyente,
  insoluto: '293.72',
  reajuste: '0.00',
  interes: '0.00',
  gastos: '0.00',
  total: '293.72',
  conAmnistia: '293.72',
  comprobante: null,
};

const principal = () => screen.getByRole('main');

afterEach(limpiarElPortal);

// Monta el portal entero: sus plazos, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('un pago simulado, en el modo que sea, lleva el aviso Y la banda simulada', () => {
  it('en demostracion: «Así se vería su comprobante» con el aviso arriba, y nada de «Su pago se registró»', async () => {
    montarElPortal({
      hash: '#/comprobante',
      estado: { paso: 'comprobante', numero: '03593174', recienPagado: true, ultimo: SIMULADO },
    });

    const main = within(principal());
    await main.findByRole('heading', { level: 1, name: 'Así se vería su comprobante' });
    expect(main.getByText(EL_AVISO)).toBeInTheDocument();
    expect(main.queryByRole('heading', { level: 1, name: 'Su pago se registró' })).toBeNull();
    // Y el recibo tampoco dice nada que un pago simulado no tiene.
    expect(main.queryByText('Número de operación')).toBeNull();
    expect(main.queryByText('Enviado a')).toBeNull();
    expect(main.queryByRole('button', { name: 'Descargar comprobante' })).toBeNull();
  });
});
