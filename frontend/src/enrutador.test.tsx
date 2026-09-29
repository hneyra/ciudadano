import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { limpiarElPortal, montarElPortal, moverElNavegador, plazosDelPortal } from './pruebas/portal.tsx';

/**
 * **Las rutas hash obedecen al recorrido**: lo que no es alcanzable redirige, con `replace`, al
 * ultimo paso que si lo es.
 *
 * Se entra por el hash como entraria el navegador —`montarElPortal` pone la URL antes de crear el
 * enrutador— y se mira `window.location.hash`, que es lo que ve quien comparte el enlace.
 */

afterEach(limpiarElPortal);

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('entrar por hash', () => {
  it('`#/pagar` sin haber buscado redirige a `#/buscar`', async () => {
    montarElPortal({ hash: '#/pagar' });

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(screen.getByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '¿Cómo quiere pagar?' })).toBeNull();
  });

  it('`#/historial` sin sesion redirige a `#/buscar`', async () => {
    montarElPortal({ hash: '#/historial' });

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(screen.queryByRole('heading', { name: 'Mis pagos' })).toBeNull();
  });

  it('y la redireccion REEMPLAZA: el hash no alcanzable no queda en el historial del navegador', async () => {
    window.history.replaceState(null, '', '/#/buscar');
    const antes = window.history.length;

    montarElPortal({ hash: '#/comprobante' });

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(window.history.length).toBe(antes);
  });

  it('la raiz y lo que no es una ruta llevan al paso en que se esta', async () => {
    montarElPortal({ hash: '#/', estado: { paso: 'deudas' } });
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    await limpiarElPortal();

    montarElPortal({ hash: '#/no-existe' });
    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
  });

  it('un paso anterior alcanzable se abre, y el recorrido lo sigue', async () => {
    montarElPortal({ hash: '#/deudas', estado: { paso: 'pagar' } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Lo que debe, por concepto' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/deudas');
    const franja = screen.getByRole('navigation');
    await waitFor(() =>
      expect(within(franja).getByRole('button', { name: 'Elegir qué pago' })).toHaveAttribute('aria-current', 'step'),
    );
  });

  /**
   * **La pantalla en blanco** (issue 61). El recorrido en el comprobante SIN pago sellado: el paso es
   * el de la URL, asi que hasta el issue 61 nadie redirigia —el efecto de la ruta solo actuaba cuando
   * cambiaba la URL, y `pasoAlcanzable` daba el comprobante por alcanzable por su posicion—, y
   * `Comprobante` sin sello no dibuja nada: `main` vacio. Con las acciones del reductor no se llega aqui
   * (solo `confirmarPago` pasa al comprobante, y siempre sella); es el estado que lo reproduce.
   */
  it('un paso que no es alcanzable aunque sea el del recorrido redirige, y no deja la pantalla en blanco', async () => {
    montarElPortal({ hash: '#/comprobante', estado: { paso: 'comprobante' } });

    await waitFor(() => expect(window.location.hash).toBe('#/buscar'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Consulte y pague sus tributos' })).toBeInTheDocument();
  });

  it('con sesion, el historial se abre y la franja no esta', async () => {
    montarElPortal({ hash: '#/historial', estado: { paso: 'buscar', autenticado: true } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis pagos' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/historial');
    await waitFor(() => expect(screen.queryByRole('navigation')).toBeNull());
  });
});

describe('atras y adelante del navegador', () => {
  /**
   * **Cambio del issue 61.** Hasta entonces este caso decia lo contrario: que adelante no llevaba al
   * que dejo de ser alcanzable. Era el defecto: lo alcanzable se media por la posicion ACTUAL, asi que
   * volver atras a `#/buscar` dejaba `#/identificar` fuera, el enrutador lo reemplazaba y el boton
   * Adelante del navegador quedaba muerto. «Mis datos» se abrio con «Iniciar sesión»: es un paso
   * alcanzado, y adelante vuelve a el. Lo que NO se da por hecho es lo que nadie hizo (la franja).
   */
  it('atras vuelve a un paso ya hecho, y adelante vuelve al que se alcanzo', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    const franja = screen.getByRole('navigation');
    expect(within(franja).getByRole('button', { name: 'Mis datos' })).toHaveAttribute('aria-current', 'step');

    // Atras: `#/buscar` es el primero, se abre y el recorrido lo sigue.
    await moverElNavegador(() => window.history.back());
    expect(window.location.hash).toBe('#/buscar');
    expect(within(franja).getByRole('button', { name: 'Buscar mi deuda' })).toHaveAttribute('aria-current', 'step');

    // Adelante: `#/identificar` se alcanzo, y se vuelve a el.
    await moverElNavegador(() => window.history.forward());
    expect(window.location.hash).toBe('#/identificar');
    expect(within(franja).getByRole('button', { name: 'Mis datos' })).toHaveAttribute('aria-current', 'step');
  });

  /**
   * **La URL es la del navegador, no la del ultimo dibujo** (issue 61, medido en `yarn verificar` con
   * la maquina cargada). El enrutador escribe la historia en el acto pero avisa a React dentro de una
   * transicion; un clic que llega en medio se dibuja con la ruta VIEJA. Aqui se provoca a proposito:
   * se da el correo, se espera a que el navegador este en `#/pagar` SIN dejar que React dibuje la
   * transicion, y se pulsa «Mis datos» en la franja. Con el efecto leyendo la ruta del dibujo, veia
   * `/identificar`, no navegaba, y la transicion atrasada devolvia el recorrido a pagar.
   */
  it('un clic que llega antes de que el enrutador dibuje su navegacion no se pierde', async () => {
    montarElPortal({ hash: '#/identificar', estado: { paso: 'identificar', numero: '00000025673' } });
    const correo = within(within(screen.getByRole('main')).getByRole('region', { name: 'Solo con mi correo' }));
    fireEvent.change(correo.getByRole('textbox', { name: 'Correo electrónico' }), { target: { value: 'maria@example.com' } });

    fireEvent.click(correo.getByRole('button', { name: 'Continuar al pago' }));
    // Se mira el navegador a cada vuelta —casi siempre microtareas; una tarea cada diez, que es lo que
    // tarda el envio del formulario— y se pulsa EN CUANTO la historia dice `#/pagar`, antes de que
    // React dibuje la transicion del enrutador. Sin la ruta del navegador en el efecto, rojo 3 de 3.
    for (let i = 0; i < 200 && window.location.hash !== '#/pagar'; i++) {
      await (i % 10 === 9 ? new Promise((r) => setTimeout(r, 0)) : Promise.resolve());
    }
    expect(window.location.hash).toBe('#/pagar');
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Mis datos' }));
    // Y ahora si, que llegue todo lo atrasado: la transicion del enrutador y lo que el efecto haga con
    // ella. Es trabajo de React, y `act` lo vacia al salir; hasta la revision del PR #76 aqui se
    // esperaban ademas 50 ms, que sobraban: sin ellos, 3 de 3 en verde, y con el efecto leyendo la ruta
    // del dibujo, 3 de 3 en rojo («expected '#/pagar' to be '#/identificar'»).
    await act(async () => {});

    expect(window.location.hash).toBe('#/identificar');
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: 'Mis datos' })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('recorrido hasta pagar, atras y adelante pasan por cada paso alcanzado, y el recorrido los sigue', async () => {
    montarElPortal({ hash: '#/buscar' });
    const principal = () => screen.getByRole('main');
    const franja = () => screen.getByRole('navigation');
    const actual = () =>
      within(franja())
        .getAllByRole('button')
        .find((b) => b.getAttribute('aria-current') === 'step')
        ?.getAttribute('aria-label');

    fireEvent.change(within(principal()).getByRole('textbox', { name: 'Código de contribuyente' }), {
      target: { value: '00000025673' },
    });
    fireEvent.click(within(principal()).getByRole('button', { name: 'Buscar mi deuda' }));
    await waitFor(() => expect(window.location.hash).toBe('#/deudas'));
    fireEvent.click(await within(principal()).findByRole('button', { name: 'Pagar todo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    const correo = within(await within(principal()).findByRole('region', { name: 'Solo con mi correo' }));
    fireEvent.change(correo.getByRole('textbox', { name: 'Correo electrónico' }), { target: { value: 'maria@example.com' } });
    fireEvent.click(correo.getByRole('button', { name: 'Continuar al pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));

    // Atras y adelante no escriben en el historial (issue 74): ni una entrada nueva ni una reemplazada.
    // Un `replaceState` sobre la misma URL no se ve en la barra, pero cambia la entrada —su estado, la
    // llave del enrutador— y es trabajo que nadie pidio.
    const empujar = vi.spyOn(window.history, 'pushState');
    const reemplazar = vi.spyOn(window.history, 'replaceState');
    const vistos: string[] = [];
    let escrito: string[];
    try {
      for (const mover of ['back', 'back', 'back', 'forward', 'forward', 'forward'] as const) {
        await moverElNavegador(() => window.history[mover]());
        vistos.push(`${window.location.hash} ${String(actual())}`);
      }
      escrito = [...empujar.mock.calls, ...reemplazar.mock.calls].map(([, , url]) => String(url));
    } finally {
      empujar.mockRestore();
      reemplazar.mockRestore();
    }
    expect(escrito).toEqual([]);
    expect(vistos).toEqual([
      '#/identificar Mis datos',
      '#/deudas Elegir qué pago',
      '#/buscar Buscar mi deuda',
      '#/deudas Elegir qué pago',
      '#/identificar Mis datos',
      '#/pagar Pagar',
    ]);
  });
});
