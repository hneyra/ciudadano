import type { Cliente } from '@kamayuk/api';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identidad } from '../../api/identidad.ts';
import type { ObligacionDelContrato, SituacionDelContrato } from '../../datos/contrato.ts';
import { LLAVES } from '../../datos/fuente.ts';
import { crearFuenteDeLaPlataforma } from '../../datos/fuenteDeLaPlataforma.ts';
import { limpiarElPortal, montarElPortal, plazosDelPortal } from '../../pruebas/portal.tsx';

/**
 * **Una sola verdad para lo que manda el servidor** (issue 50).
 *
 * Hasta el issue 50 la situacion vivia DOS veces: en la cache de React Query y, copiada por un
 * `useEffect` de `LaConsulta` (la accion `situacionLeida`), en el reductor del recorrido. Estas
 * pruebas miden los tres defectos que esa copia daba, con el portal ENTERO montado sobre la fuente de
 * la plataforma y un cliente falso: la peticion no sale, pero pasa por la ruta y el adaptador de
 * verdad.
 *
 *   1. un instante con la pantalla en un estado que no es ni «consultando» ni la respuesta (antes del
 *      #49, ese instante decia «No le queda nada por pagar» delante de una deuda de verdad);
 *   2. una consulta repetida que vuelve a marcarlo todo, o que con un error borra la lista a mitad de
 *      la eleccion;
 *   3. el foco de la pestana, que con los valores por omision de `QueryClient` vuelve a pedirla.
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

const principal = () => screen.getByRole('main');
const enMain = () => within(principal());

const EL_DIA = '2026-09-16';
const importe = (valor: string) => ({ importe: valor, actualizadoA: EL_DIA });

/** Un impuesto predial de un ejercicio: se llama «Impuesto predial <ejercicio>» en la pantalla. */
function predial(ejercicio: number, insoluto: string): ObligacionDelContrato {
  return {
    tributo: 'PREDIAL',
    ejercicio,
    predioId: null,
    vehiculoId: null,
    insoluto: importe(insoluto),
    reajuste: importe('0.00'),
    interes: importe('0.00'),
    gasto: importe('0.00'),
    total: importe(insoluto),
  };
}

/** Una respuesta con deuda de Catacaos, con las obligaciones que se le den. */
function conDeuda(...obligaciones: readonly ObligacionDelContrato[]): SituacionDelContrato {
  return {
    tipoDocumento: 'DNI',
    numeroDocumento: '03593174',
    aLaFecha: EL_DIA,
    municipalidadesRecorridas: 1,
    totalConsolidado: importe('9999.99'),
    notaDelTotal: null,
    sinRegistros: false,
    municipalidades: [
      {
        ubigeo: '200104',
        nombre: 'Municipalidad Distrital de Catacaos',
        codigoContribuyente: '00000025673',
        nombreContribuyente: 'Suc. Rufina Medina Medina',
        activo: true,
        resumenDeSaldos: {
          insoluto: importe('9999.99'),
          reajuste: importe('0.00'),
          interes: importe('0.00'),
          gasto: importe('0.00'),
          total: importe('9999.99'),
          estadoDeLaConsulta: 'obligaciones con saldo al 16/09/2026',
        },
        obligaciones,
        predios: [],
      },
    ],
  };
}

/**
 * Un cliente que contesta, en orden, lo que se le da: una respuesta del contrato, o un `Error` que
 * rechaza. La ultima se repite. Cuenta las veces que se le pidio la situacion.
 */
function clienteQueContesta(...contestas: readonly (SituacionDelContrato | Error)[]) {
  let veces = 0;
  const cliente = {
    solicitar: vi.fn(() => {
      const esta = contestas[Math.min(veces, contestas.length - 1)];
      veces += 1;
      return esta instanceof Error ? Promise.reject(esta) : Promise.resolve(esta);
    }),
    solicitarRespuesta: vi.fn(),
    descargar: vi.fn(),
    subir: vi.fn(),
  } as unknown as Cliente;
  return { cliente, veces: () => veces };
}

function montarEnElPaso2(cliente: Cliente) {
  identidad.fijarToken(tokenDeMentira());
  return montarElPortal({ hash: '#/deudas', fuente: crearFuenteDeLaPlataforma(cliente) });
}

const LA_LISTA = 'Lo que debe, por concepto';

/** Cada casilla de concepto, por su nombre, con si esta marcada. */
function lasMarcas(): Record<string, boolean> {
  return Object.fromEntries(
    enMain()
      .getAllByRole('checkbox')
      .map((casilla) => [casilla.getAttribute('aria-label') ?? '', casilla.getAttribute('aria-checked') === 'true']),
  );
}

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

plazosDelPortal();

describe('AC1 — mientras no hay respuesta, «consultando»; y ningun final antes de tenerla', () => {
  it('con deuda, «No le queda nada por pagar» no aparece NUNCA, ni hay un instante sin nada entre la espera y la lista', async () => {
    const { cliente } = clienteQueContesta(conDeuda(predial(2024, '1500.00'), predial(2025, '300.00')));

    // Cada vez que el DOM cambia se anota lo que dice `main`. El `MutationObserver` corre como
    // microtarea tras cada commit de React, asi que ve los estados intermedios que un `waitFor` —que
    // sondea cada 50 ms— se salta.
    const vistos: string[] = [];
    const sonda = new MutationObserver(() => {
      const main = document.querySelector('main');
      if (main === null) return;
      const titulo = main.querySelector('h1')?.textContent ?? '(sin titulo)';
      const casillas = main.querySelectorAll('[role="checkbox"]').length;
      const falsa = (main.textContent ?? '').includes('No le queda nada por pagar');
      vistos.push(`${titulo} · ${String(casillas)} casillas${falsa ? ' · «No le queda nada por pagar»' : ''}`);
    });
    sonda.observe(document.body, { childList: true, subtree: true, characterData: true });

    montarEnElPaso2(cliente);
    await enMain().findByRole('heading', { level: 1, name: LA_LISTA });
    await act(async () => {
      await new Promise((listo) => setTimeout(listo, 50));
    });
    sonda.disconnect();

    expect(vistos.filter((visto) => visto.includes('No le queda nada por pagar'))).toEqual([]);
    // Desde que se dice «Consultando su deuda…», solo hay dos cosas que puede decir `main`: eso, o la
    // lista con sus dos conceptos. Nada en medio.
    const desde = vistos.findIndex((visto) => visto.startsWith('Consultando su deuda…'));
    expect(desde, `Nunca se dijo «Consultando su deuda…»: ${JSON.stringify(vistos)}`).toBeGreaterThanOrEqual(0);
    const distintos = [...new Set(vistos.slice(desde))];
    expect(distintos).toEqual(['Consultando su deuda… · 0 casillas', `${LA_LISTA} · 2 casillas`]);
  });
});

describe('AC2 — una consulta repetida no vuelve a marcarlo todo', () => {
  it('una segunda respuesta IGUAL no cambia lo marcado', async () => {
    const igual = conDeuda(predial(2024, '1500.00'), predial(2025, '300.00'));
    // Otro objeto con el mismo contenido: la cache de consultas lo reconoce y lo deja como estaba.
    const { cliente, veces } = clienteQueContesta(igual, structuredClone(igual));
    const { consultas } = montarEnElPaso2(cliente);
    await enMain().findByRole('heading', { level: 1, name: LA_LISTA });

    fireEvent.click(enMain().getByRole('checkbox', { name: 'Pagar Impuesto predial 2024' }));
    expect(lasMarcas()).toEqual({ 'Pagar Impuesto predial 2024': false, 'Pagar Impuesto predial 2025': true });

    await act(() => consultas.refetchQueries({ queryKey: LLAVES.situacion }));
    expect(veces()).toBe(2);
    expect(lasMarcas()).toEqual({ 'Pagar Impuesto predial 2024': false, 'Pagar Impuesto predial 2025': true });
  });

  it('una DISTINTA lo reconcilia: lo que sigue existiendo conserva su marca, lo nuevo llega marcado y lo que desaparecio se va', async () => {
    const { cliente } = clienteQueContesta(
      conDeuda(predial(2024, '1500.00'), predial(2025, '300.00'), predial(2026, '80.00')),
      // 2025 ya no esta (se pago en la ventanilla); 2026 cambio de importe; 2023 aparece.
      conDeuda(predial(2023, '40.00'), predial(2024, '1500.00'), predial(2026, '95.00')),
    );
    const { consultas } = montarEnElPaso2(cliente);
    await enMain().findByRole('heading', { level: 1, name: LA_LISTA });

    fireEvent.click(enMain().getByRole('checkbox', { name: 'Pagar Impuesto predial 2024' }));
    fireEvent.click(enMain().getByRole('checkbox', { name: 'Pagar Impuesto predial 2025' }));

    await act(() => consultas.refetchQueries({ queryKey: LLAVES.situacion }));
    await waitFor(() => expect(enMain().queryByRole('checkbox', { name: 'Pagar Impuesto predial 2025' })).toBeNull());
    expect(lasMarcas()).toEqual({
      'Pagar Impuesto predial 2023': true,
      'Pagar Impuesto predial 2024': false,
      'Pagar Impuesto predial 2026': true,
    });
    // Y la barra cuenta lo que se ve, no lo que habia: dos de tres.
    expect(enMain().getByText('Va a pagar 2 conceptos de 3')).toBeInTheDocument();
  });
});

describe('AC2 — y el comprobante no cuelga de la lista', () => {
  it('otra respuesta despues de simular el pago no le quita filas al recibo, ni le cambia el nombre', async () => {
    const { cliente } = clienteQueContesta(
      conDeuda(predial(2024, '1500.00'), predial(2025, '300.00')),
      // Despues, 2025 ya no esta y la municipalidad cambio el nombre del padron.
      {
        ...conDeuda(predial(2024, '1500.00')),
        municipalidades: conDeuda(predial(2024, '1500.00')).municipalidades.map((municipalidad) => ({
          ...municipalidad,
          nombreContribuyente: 'Otro nombre',
        })),
      },
    );
    const { consultas } = montarEnElPaso2(cliente);
    await enMain().findByRole('heading', { level: 1, name: LA_LISTA });
    fireEvent.click(enMain().getByRole('button', { name: 'Pagar todo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    fireEvent.click(enMain().getByRole('button', { name: 'Simular el pago: no se cobra nada' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    expect(enMain().getByText('Impuesto predial 2025')).toBeInTheDocument();

    // Aqui el paso 2 ya no esta montado, y el unico que sigue la llave es el recorrido, que no pide
    // (`useLaSituacionSinPedir`): `refetchQueries` se salta las consultas apagadas. Se pide a mano.
    await act(async () => {
      await consultas.getQueryCache().find({ queryKey: LLAVES.situacion })?.fetch();
    });
    expect(consultas.getQueryData<{ deudas: unknown[] }>(LLAVES.situacion)?.deudas).toHaveLength(1);

    // El recibo dice lo que se sello, no lo que hoy dice el servidor.
    expect(enMain().getByText('Impuesto predial 2024')).toBeInTheDocument();
    expect(enMain().getByText('Impuesto predial 2025')).toBeInTheDocument();
    expect(enMain().getByText('Suc. Rufina Medina Medina')).toBeInTheDocument();
    expect(enMain().queryByText('Otro nombre')).toBeNull();
  });
});

describe('AC3 — un error en una consulta repetida no borra lo que ya se ve', () => {
  it('la lista y lo marcado siguen a la vista', async () => {
    const { cliente, veces } = clienteQueContesta(
      conDeuda(predial(2024, '1500.00'), predial(2025, '300.00')),
      new Error('la segunda consulta no llego'),
    );
    const { consultas } = montarEnElPaso2(cliente);
    await enMain().findByRole('heading', { level: 1, name: LA_LISTA });
    fireEvent.click(enMain().getByRole('checkbox', { name: 'Pagar Impuesto predial 2025' }));

    await act(() => consultas.refetchQueries({ queryKey: LLAVES.situacion }));
    expect(veces()).toBe(2);
    await waitFor(() => expect(consultas.getQueryState(LLAVES.situacion)?.status).toBe('error'));

    expect(enMain().getByRole('heading', { level: 1, name: LA_LISTA })).toBeInTheDocument();
    expect(lasMarcas()).toEqual({ 'Pagar Impuesto predial 2024': true, 'Pagar Impuesto predial 2025': false });
  });
});

describe('AC4 — recuperar el foco no vuelve a pedir la situacion', () => {
  it('ni al volver a la pestana, ni al volver a montar el paso 2', async () => {
    const { cliente, veces } = clienteQueContesta(conDeuda(predial(2024, '1500.00')));
    montarEnElPaso2(cliente);
    await enMain().findByRole('heading', { level: 1, name: LA_LISTA });
    expect(veces()).toBe(1);

    // Lo que hace el navegador al volver a la pestana: `focusManager` de React Query escucha este
    // evento en `window`.
    await act(async () => {
      window.dispatchEvent(new Event('visibilitychange'));
      await new Promise((listo) => setTimeout(listo, 50));
    });
    expect(veces()).toBe(1);

    // «Pagar todo» y «Cambiar lo que voy a pagar»: el paso 2 se desmonta y se vuelve a montar.
    fireEvent.click(enMain().getByRole('button', { name: 'Pagar todo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    fireEvent.click(enMain().getByRole('button', { name: /Cambiar lo que voy a pagar/ }));
    await enMain().findByRole('heading', { level: 1, name: LA_LISTA });
    await act(async () => {
      await new Promise((listo) => setTimeout(listo, 50));
    });
    expect(veces()).toBe(1);
  });
});
