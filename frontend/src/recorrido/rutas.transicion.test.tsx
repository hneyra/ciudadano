import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { type ReactNode, use } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { limpiarElPortal, montarElPortal, moverElNavegador, plazosDelPortal } from '../pruebas/portal.tsx';

/**
 * **Atras mientras el enrutador todavia no ha dibujado la ruta a la que acaba de ir** (issue 74).
 * Determinista: la ruta nueva se deja A MEDIO DIBUJAR a proposito, y no por la carga.
 *
 * Medido en Chromium contra el paquete (CPU x6, `Emulation.setCPUThrottlingRate`): «Continuar al pago»
 * lleva el recorrido a «Pagar», el gancho empuja `#/pagar`, y el enrutador avisa a React DENTRO de una
 * transicion. Si Atras llega antes de que esa transicion se dibuje, React la sustituye por la del
 * `popstate`, que vuelve a `/identificar`: la MISMA ruta que el ultimo dibujo. Para el efecto de
 * `useLaUrlYElPaso` no cambio nada —ni el paso ni `pathname`—, asi que no corria: la URL y la pantalla
 * en «Mis datos» y la franja en «Pagar», 14 s despues y para siempre (hasta el issue 74).
 *
 * Aqui la transicion se detiene con la pantalla de «Pagar» suspendida en una `puerta` que no se abre:
 * el `Suspense` de `PantallaDelPaso` ya estaba a la vista, y en una transicion React sigue ensenando lo
 * de antes en vez del hueco. (Es la misma detencion que daria, sin carga ninguna, el trozo de «Pagar»
 * sin llegar todavia por la red; eso no se midio en el navegador.)
 */

const trampa = vi.hoisted(() => ({ puerta: null as Promise<void> | null, abrir: () => {} }));

vi.mock('../pasos/pantallas.tsx', async (importarElOriginal) => {
  const original = await importarElOriginal<typeof import('../pasos/pantallas.tsx')>();
  const Pagar = await original.PANTALLAS.pagar.precargar();
  function PagarTrasLaPuerta(): ReactNode {
    if (trampa.puerta !== null) use(trampa.puerta);
    return <Pagar />;
  }
  return {
    ...original,
    PANTALLAS: { ...original.PANTALLAS, pagar: { ...original.PANTALLAS.pagar, Pantalla: PagarTrasLaPuerta } },
  };
});

afterEach(async () => {
  trampa.abrir();
  trampa.puerta = null;
  await limpiarElPortal();
});

plazosDelPortal();

describe('atras antes de que el enrutador dibuje la ruta nueva', () => {
  it('el recorrido sigue a la URL aunque la ruta dibujada sea la misma de antes', async () => {
    montarElPortal({ hash: '#/identificar', estado: { paso: 'identificar', numero: '00000025673' } });
    const franja = () => within(screen.getByRole('navigation'));
    trampa.puerta = new Promise((abrir) => {
      trampa.abrir = abrir;
    });

    const correo = within(within(screen.getByRole('main')).getByRole('region', { name: 'Solo con mi correo' }));
    fireEvent.change(correo.getByRole('textbox', { name: 'Correo electrónico' }), { target: { value: 'maria@example.com' } });
    fireEvent.click(correo.getByRole('button', { name: 'Continuar al pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    await waitFor(() => expect(franja().getByRole('button', { name: 'Pagar' })).toHaveAttribute('aria-current', 'step'));
    // La transicion del enrutador sigue detenida: la pantalla es todavia la de «Mis datos».
    expect(screen.getByRole('heading', { level: 1, name: '¿A dónde le enviamos el comprobante?' })).toBeInTheDocument();

    // Atras: el navegador vuelve a `#/identificar`, y se espera a su `popstate` dentro de `act`.
    await moverElNavegador(() => window.history.back());

    expect(window.location.hash).toBe('#/identificar');
    // Hasta el issue 74: «Expected the element to have attribute: aria-current="step" Received: null».
    expect(franja().getByRole('button', { name: 'Mis datos' })).toHaveAttribute('aria-current', 'step');
  });
});
