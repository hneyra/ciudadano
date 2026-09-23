import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { USUARIO } from '../../datos/demostracion.ts';
import i18n, { IDIOMA_MARCADO } from '../../i18n/i18n.ts';
import { limpiarElPortal, marcado, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';
import type { EstadoDelRecorrido } from '../../recorrido/recorrido.ts';

/**
 * **Paso 3 · Mis datos**: a donde se envia el comprobante, con un correo o entrando con la cuenta.
 *
 * Se monta el portal entero en `#/identificar` y se mira el hash de verdad. Cada tarjeta es una
 * region con el nombre de su titulo, y todo se busca dentro de la suya: las dos tienen un campo, un
 * boton y un error.
 */

afterEach(async () => {
  vi.restoreAllMocks();
  await limpiarElPortal();
});

/** Se busco la deuda y se llego a «Mis datos» con los cuatro conceptos marcados. */
const CON_BUSQUEDA: Partial<EstadoDelRecorrido> = { paso: 'identificar', numero: '00000025673' };

const TITULO = '¿A dónde le enviamos el comprobante?';
const PARRAFO = (importe: string) =>
  `Va a pagar ${importe}. Necesitamos un correo para enviarle el comprobante. Si tiene cuenta, entre y le guardamos el pago en su historial.`;
const SIN_SELECCION = 'Todavía no ha elegido qué pagar. Si tiene cuenta, entre para ver sus pagos y sus comprobantes.';
const CORREO_TEXTO =
  'Lo más rápido. No hace falta crear una cuenta; el comprobante le llega al correo y lo podrá descargar al terminar.';
const CUENTA_TEXTO = 'Guarda este pago y todos los anteriores en un historial, con sus comprobantes siempre a mano.';
const AVISARME = 'Avisarme por correo cuando venza mi próxima cuota';
const CORREO_VACIO = 'Escriba un correo para poder enviarle el comprobante.';
const CORREO_INCOMPLETO = 'Ese correo no parece completo. Revíselo: le enviaremos el comprobante ahí.';
const CUENTA_VACIA = 'Escriba su documento y su clave para entrar.';
const BIENVENIDA = 'Bienvenida. Este pago quedará en su historial.';
const BIENVENIDA_SIN_PAGO = 'Bienvenida. Aquí están sus pagos.';
const OLVIDE_AVISO = 'Abriría la recuperación de su clave.';
const CREAR_AVISO = 'Abriría el registro de una cuenta nueva.';

const principal = () => screen.getByRole('main');
const tarjeta = (nombre: string) => within(within(principal()).getByRole('region', { name: nombre }));
const correo = (t = (s: string) => s) => tarjeta(t('Solo con mi correo'));
const cuenta = (t = (s: string) => s) => tarjeta(t('Con mi cuenta'));
const barra = () => within(screen.getByRole('banner'));

/**
 * Escribe en un campo, reemplazando lo que hubiera. Con `fireEvent`, como `Buscar.test.tsx`: lo que se
 * mide es lo que el `onChange` hace, no la pulsacion tecla a tecla.
 */
function escribir(campo: HTMLElement, texto: string): void {
  fireEvent.change(campo, { target: { value: texto } });
}

/** La validacion de `react-hook-form` es asincrona: se la deja terminar antes de mirar. */
async function queTermineLaValidacion(): Promise<void> {
  await act(async () => {
    await new Promise((listo) => setTimeout(listo, 20));
  });
}

// Monta el portal entero: sus plazos, y la medida que los justifica, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('lo que va a pagar', () => {
  it('con los 4 marcados, el parrafo dice el importe con amnistia: S/ 3,149.92', () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });

    expect(within(principal()).getByRole('heading', { level: 1, name: TITULO })).toBeInTheDocument();
    expect(within(principal()).getByText(PARRAFO('S/ 3,149.92'))).toBeInTheDocument();
    expect(within(principal()).queryByText(SIN_SELECCION)).toBeNull();
  });

  it('y sigue a la seleccion actual: solo el predial 2026 es S/ 293.72; con el vehicular, S/ 1,003.72', async () => {
    const primero = montarElPortal({ hash: '#/identificar', estado: { ...CON_BUSQUEDA, marcadas: { pred26: true } } });
    expect(within(principal()).getByText(PARRAFO('S/ 293.72'))).toBeInTheDocument();
    primero.unmount();
    await limpiarElPortal();

    // 293.72 + 614.00 + 96.00: el interes del vehicular no se cobra.
    montarElPortal({ hash: '#/identificar', estado: { ...CON_BUSQUEDA, marcadas: { pred26: true, veh24: true } } });
    expect(within(principal()).getByText(PARRAFO('S/ 1,003.72'))).toBeInTheDocument();
  });

  it('lo ya pagado no cuenta aunque siga marcado', () => {
    // 293.72 + 1842.60 + 12.00 + 614.00 + 96.00 = 2858.32 sin el arbitrio, que ya se pago.
    montarElPortal({ hash: '#/identificar', estado: { ...CON_BUSQUEDA, pagadas: { arb26: true } } });
    expect(within(principal()).getByText(PARRAFO('S/ 2,858.32'))).toBeInTheDocument();
  });

  it('sin busqueda, o con la seleccion viva vacia, no dice «Va a pagar»: invita a entrar para ver sus pagos', async () => {
    const sinBuscar = montarElPortal({ hash: '#/identificar', estado: { paso: 'identificar' } });
    expect(within(principal()).queryByText(/Va a pagar/)).toBeNull();
    expect(within(principal()).getByText(SIN_SELECCION)).toBeInTheDocument();
    sinBuscar.unmount();
    await limpiarElPortal();

    montarElPortal({ hash: '#/identificar', estado: { ...CON_BUSQUEDA, marcadas: {} } });
    expect(within(principal()).queryByText(/Va a pagar/)).toBeNull();
    expect(within(principal()).getByText(SIN_SELECCION)).toBeInTheDocument();
  });
});

describe('solo con mi correo', () => {
  it('vacio, `maria@correo` y `@correo.com` dan los mensajes exactos; escribir los borra; `maria@correo.com` va a `#/pagar`', async () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });
    const campo = correo().getByRole('textbox', { name: 'Correo electrónico' });
    const continuar = correo().getByRole('button', { name: 'Continuar al pago' });

    expect(correo().queryByRole('alert')).toBeNull();
    fireEvent.click(continuar);
    const vacio = await correo().findByRole('alert');
    expect(vacio.textContent).toBe(CORREO_VACIO);
    // El campo con error se pinta `mal` (lo dibuja `CONTROL` con `aria-invalid`) y apunta al mensaje.
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAttribute('aria-describedby', vacio.id);
    expect(campo.className).toContain('aria-invalid:bg-mal-campo');
    expect(campo.className).toContain('aria-invalid:border-mal-borde');
    expect(window.location.hash).toBe('#/identificar');

    for (const incompleto of ['maria@correo', '@correo.com']) {
      escribir(campo, incompleto);
      await queTermineLaValidacion();
      // Escribir borra el error, como el `onCorreo` del artboard (linea 1180).
      expect(correo().queryByRole('alert'), `tras escribir «${incompleto}»`).toBeNull();
      expect(campo).not.toHaveAttribute('aria-invalid');

      fireEvent.click(continuar);
      await queTermineLaValidacion();
      expect(window.location.hash, `«${incompleto}» no deberia pasar`).toBe('#/identificar');
      expect(correo().getByRole('alert').textContent, incompleto).toBe(CORREO_INCOMPLETO);
      expect(campo).toHaveAttribute('aria-invalid', 'true');
    }

    escribir(campo, 'maria@correo.com');
    fireEvent.click(continuar);
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
  });

  it('solo espacios cuenta como vacio', async () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });

    escribir(correo().getByRole('textbox', { name: 'Correo electrónico' }), '   ');
    fireEvent.click(correo().getByRole('button', { name: 'Continuar al pago' }));

    expect((await correo().findByRole('alert')).textContent).toBe(CORREO_VACIO);
  });

  it('la casilla de aviso empieza marcada, se desmarca, y lo elegido se recuerda al volver', async () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });
    const casilla = () => correo().getByRole('checkbox', { name: AVISARME });

    expect(casilla()).toBeChecked();
    fireEvent.click(casilla());
    expect(casilla()).not.toBeChecked();
    // El rotulo tambien la alterna: en el artboard, la etiqueta envuelve casilla y texto (linea 328).
    fireEvent.click(correo().getByText(AVISARME));
    expect(casilla()).toBeChecked();
    fireEvent.click(correo().getByText(AVISARME));
    expect(casilla()).not.toBeChecked();

    escribir(correo().getByRole('textbox', { name: 'Correo electrónico' }), 'maria@correo.com');
    fireEvent.click(correo().getByRole('button', { name: 'Continuar al pago' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));

    // Volver a «Mis datos» por la franja: el correo y la casilla son los que se dieron.
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Mis datos' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    expect(correo().getByRole('textbox', { name: 'Correo electrónico' })).toHaveValue('maria@correo.com');
    expect(casilla()).not.toBeChecked();
  });
});

describe('con mi cuenta', () => {
  it('sin clave, o sin documento, muestra el error exacto y no entra', async () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });
    const documento = cuenta().getByRole('textbox', { name: 'Documento de identidad' });
    const clave = cuenta().getByLabelText('Clave');
    const entrar = cuenta().getByRole('button', { name: 'Entrar y pagar' });

    escribir(documento, '03593174');
    fireEvent.click(entrar);
    const error = await cuenta().findByRole('alert');
    expect(error.textContent).toBe(CUENTA_VACIA);
    expect(clave).toHaveAttribute('aria-invalid', 'true');
    expect(clave).toHaveAttribute('aria-describedby', error.id);
    expect(documento).not.toHaveAttribute('aria-invalid');

    // Escribir en cualquiera de los dos lo borra (artboard, lineas 1193-1194).
    escribir(clave, 'x');
    await queTermineLaValidacion();
    expect(cuenta().queryByRole('alert')).toBeNull();

    // Solo espacios en el documento cuenta como vacio, como el `trim()` del artboard.
    escribir(documento, '   ');
    fireEvent.click(entrar);
    await queTermineLaValidacion();
    expect(window.location.hash, 'un documento en blanco no deberia entrar').toBe('#/identificar');
    expect(cuenta().getByRole('alert').textContent).toBe(CUENTA_VACIA);
    expect(documento).toHaveAttribute('aria-invalid', 'true');

    expect(barra().queryByRole('button', { name: /María E\. Castillo/ })).toBeNull();
    // Y el error de una tarjeta no sale en la otra.
    expect(correo().queryByRole('alert')).toBeNull();
  });

  it('con documento y clave entra: la barra muestra a «María E. Castillo», va a `#/pagar` y avisa', async () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });

    escribir(cuenta().getByRole('textbox', { name: 'Documento de identidad' }), '03593174');
    escribir(cuenta().getByLabelText('Clave'), 'secreta');
    fireEvent.click(cuenta().getByRole('button', { name: 'Entrar y pagar' }));

    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    expect(barra().getByRole('button', { name: new RegExp(USUARIO.nombre.replace('.', '\\.')) })).toBeInTheDocument();
    expect(barra().queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();
    expect(await screen.findByText(BIENVENIDA)).toBeInTheDocument();
  });

  it('entrar sin haber buscado lleva a `#/historial`, no a «Pagar», con el aviso de bienvenida (nota del revisor)', async () => {
    montarElPortal({ hash: '#/buscar' });

    fireEvent.click(barra().getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.hash).toBe('#/identificar'));
    expect(within(principal()).queryByText(/Va a pagar/)).toBeNull();

    escribir(cuenta().getByRole('textbox', { name: 'Documento de identidad' }), '03593174');
    escribir(cuenta().getByLabelText('Clave'), 'secreta');
    fireEvent.click(cuenta().getByRole('button', { name: 'Entrar y pagar' }));

    await waitFor(() => expect(window.location.hash).toBe('#/historial'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis pagos' })).toBeInTheDocument();
    expect(barra().getByRole('button', { name: /María E\. Castillo/ })).toBeInTheDocument();
    expect(await screen.findByText(BIENVENIDA_SIN_PAGO)).toBeInTheDocument();
    expect(screen.queryByText(BIENVENIDA)).toBeNull();
  });

  it('la clave no llega al almacenamiento del navegador', async () => {
    const guardado = vi.spyOn(Storage.prototype, 'setItem');
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });

    escribir(cuenta().getByRole('textbox', { name: 'Documento de identidad' }), '03593174');
    const clave = cuenta().getByLabelText('Clave');
    expect(clave).toHaveAttribute('type', 'password');
    escribir(clave, 'clave-que-no-se-guarda');
    fireEvent.click(cuenta().getByRole('button', { name: 'Entrar y pagar' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));

    const escrito = guardado.mock.calls.flat().join('\n');
    expect(escrito).not.toContain('clave-que-no-se-guarda');
    for (const almacen of [window.localStorage, window.sessionStorage]) {
      const todo = Object.keys(almacen).map((k) => `${k}=${almacen.getItem(k) ?? ''}`);
      expect(todo.join('\n')).not.toContain('clave-que-no-se-guarda');
    }
  });

  it('«Olvidé mi clave» y «Crear una cuenta» son botones que avisan, no enlaces a `#`', async () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });

    expect(within(principal()).queryAllByRole('link')).toEqual([]);
    fireEvent.click(cuenta().getByRole('button', { name: 'Olvidé mi clave' }));
    expect(await screen.findByText(OLVIDE_AVISO)).toBeInTheDocument();
    fireEvent.click(cuenta().getByRole('button', { name: 'Crear una cuenta' }));
    expect(await screen.findByText(CREAR_AVISO)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/identificar');
  });
});

describe('lo que la pantalla dice y mide', () => {
  it('los textos del artboard, los placeholders y las medidas de los controles', () => {
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });

    expect(correo().getByRole('heading', { level: 2, name: 'Solo con mi correo' })).toBeInTheDocument();
    expect(correo().getByText(CORREO_TEXTO)).toBeInTheDocument();
    expect(cuenta().getByRole('heading', { level: 2, name: 'Con mi cuenta' })).toBeInTheDocument();
    expect(cuenta().getByText(CUENTA_TEXTO)).toBeInTheDocument();

    const campoCorreo = correo().getByRole('textbox', { name: 'Correo electrónico' });
    const documento = cuenta().getByRole('textbox', { name: 'Documento de identidad' });
    const clave = cuenta().getByLabelText('Clave');
    expect(campoCorreo).toHaveAttribute('placeholder', 'nombre@correo.com');
    expect(documento).toHaveAttribute('placeholder', '03593174');

    // jsdom no maqueta: se comprueba la clase aqui y la medida en el navegador (capturas del PR).
    for (const control of [campoCorreo, documento, clave]) {
      expect(control.className.split(/\s+/)).toContain('min-h-[44px]');
    }
    for (const boton of [
      correo().getByRole('button', { name: 'Continuar al pago' }),
      cuenta().getByRole('button', { name: 'Entrar y pagar' }),
    ]) {
      expect(boton.className.split(/\s+/)).toEqual(expect.arrayContaining(['w-full', 'min-h-[48px]']));
    }
    expect(correo().getByRole('button', { name: 'Continuar al pago' })).toHaveAttribute('data-slot', 'boton');

    const rejilla = within(principal()).getByRole('region', { name: 'Solo con mi correo' }).parentElement;
    expect(rejilla?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-[repeat(auto-fit,minmax(316px,1fr))]', 'gap-[18px]']),
    );
  });

  it('y todo pasa por `t()`: con el idioma marcado sale envuelto', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/identificar', estado: CON_BUSQUEDA });
    const main = within(principal());

    expect(main.getByRole('heading', { level: 1, name: marcado(TITULO) })).toBeInTheDocument();
    expect(main.getByText(marcado(PARRAFO('S/ 3,149.92')))).toBeInTheDocument();
    expect(correo(marcado).getByText(marcado(CORREO_TEXTO))).toBeInTheDocument();
    expect(cuenta(marcado).getByText(marcado(CUENTA_TEXTO))).toBeInTheDocument();
    const campo = correo(marcado).getByRole('textbox', { name: marcado('Correo electrónico') });
    expect(campo).toHaveAttribute('placeholder', marcado('nombre@correo.com'));
    // El documento de ejemplo es dato —el mismo numero en todo idioma—, como en «Buscar mi deuda».
    const documento = cuenta(marcado).getByRole('textbox', { name: marcado('Documento de identidad') });
    expect(documento).toHaveAttribute('placeholder', '03593174');
    expect(correo(marcado).getByRole('checkbox', { name: marcado(AVISARME) })).toBeChecked();
    expect(cuenta(marcado).getByLabelText(marcado('Clave'))).toBeInTheDocument();

    // Los tres errores.
    fireEvent.click(correo(marcado).getByRole('button', { name: marcado('Continuar al pago') }));
    expect((await correo(marcado).findByRole('alert')).textContent).toBe(marcado(CORREO_VACIO));
    escribir(campo, 'maria@correo');
    fireEvent.click(correo(marcado).getByRole('button', { name: marcado('Continuar al pago') }));
    await waitFor(() => expect(correo(marcado).getByRole('alert').textContent).toBe(marcado(CORREO_INCOMPLETO)));
    const entrar = cuenta(marcado).getByRole('button', { name: marcado('Entrar y pagar') });
    fireEvent.click(entrar);
    expect((await cuenta(marcado).findByRole('alert')).textContent).toBe(marcado(CUENTA_VACIA));

    // Los avisos de la demostracion.
    fireEvent.click(cuenta(marcado).getByRole('button', { name: marcado('Olvidé mi clave') }));
    expect(await screen.findByText(marcado(OLVIDE_AVISO))).toBeInTheDocument();
    fireEvent.click(cuenta(marcado).getByRole('button', { name: marcado('Crear una cuenta') }));
    expect(await screen.findByText(marcado(CREAR_AVISO))).toBeInTheDocument();

    // Y la bienvenida.
    escribir(documento, '03593174');
    escribir(cuenta(marcado).getByLabelText(marcado('Clave')), 'secreta');
    fireEvent.click(entrar);
    expect(await screen.findByText(marcado(BIENVENIDA))).toBeInTheDocument();
  });

  it('sin seleccion, el parrafo y la bienvenida al historial tambien pasan por `t()`', async () => {
    await i18n.changeLanguage(IDIOMA_MARCADO);
    montarElPortal({ hash: '#/identificar', estado: { paso: 'identificar' } });

    expect(within(principal()).getByText(marcado(SIN_SELECCION))).toBeInTheDocument();
    escribir(cuenta(marcado).getByRole('textbox', { name: marcado('Documento de identidad') }), '03593174');
    escribir(cuenta(marcado).getByLabelText(marcado('Clave')), 'secreta');
    fireEvent.click(cuenta(marcado).getByRole('button', { name: marcado('Entrar y pagar') }));
    expect(await screen.findByText(marcado(BIENVENIDA_SIN_PAGO))).toBeInTheDocument();
  });
});
