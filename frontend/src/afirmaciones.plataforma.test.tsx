import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Cliente } from '@kamayuk/api';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { identidad } from './api/identidad.ts';
import type { SituacionDelContrato } from './datos/contrato.ts';
import { crearFuenteDeLaPlataforma } from './datos/fuenteDeLaPlataforma.ts';
import { FRASES_QUE_AFIRMAN, laDice, nombreDe } from './pruebas/frasesQueAfirman.ts';
import { limpiarElPortal, montarElPortal, plazosDelPortal, remendarJsdomParaElMenu } from './pruebas/portal.tsx';

/**
 * **La guarda POR MODO: con plataforma, ninguna pantalla alcanzable afirma un hecho que no ocurrio**
 * (issue 49).
 *
 * Hasta el issue 49 la regla se vigilaba pantalla por pantalla —`Pagar.plataforma.test.tsx` miraba el
 * `main` de los pasos 4 y 5— y por eso se escaparon frases en las pantallas que nadie recorria con
 * plataforma: el «Sin deuda pendiente» y el «Al día» de «Mis pagos» con una deuda de S/ 1,842.60
 * delante (medido: la sonda del issue), la amnistia de la barra de pago, la frase del pie.
 *
 * Esta guarda no pregunta pantalla por pantalla. Con plataforma, **en cada final de la consulta**
 * —con deuda, sin deuda, «no se pudo consultar», sin registros, y la consulta que ni contesta—
 * recorre **cada paso alcanzable** como lo recorreria una persona, y en cada uno lee el texto de
 * **todo el documento**: la barra, la franja, el pie y los avisos incluidos. Ninguna de las frases de
 * `src/pruebas/frasesQueAfirman.ts` puede estar.
 *
 * Los pasos, en cada final:
 *
 *   · `#/entrar`, sin sesion (la portada);
 *   · `#/historial` **directo**, con sesion, que es el caso medido del issue: sin pasar por el paso 2;
 *     y alli, «Cambiar mi clave» del menu, cuyo aviso es un `toast` fuera de `main`;
 *   · `#/deudas`, con sesion;
 *   · y con deuda, ademas: «Pagar todo» → `#/pagar`, «Simular el pago» → `#/comprobante`, y de ahi
 *     otra vez a «Mis pagos».
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** La respuesta REAL de la plataforma local: «no se pudo consultar». Ver `diseno/medidas/README.md`. */
const MEDIDA = JSON.parse(
  readFileSync(join(AQUI, '../diseno/medidas/situacion-2026-09-16.json'), 'utf8'),
) as SituacionDelContrato;

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

/** Una respuesta del contrato, con lo que cada final cambie. */
function respuesta(cambios: Partial<SituacionDelContrato>): SituacionDelContrato {
  return {
    tipoDocumento: 'DNI',
    numeroDocumento: '03593174',
    aLaFecha: '2026-09-16',
    municipalidadesRecorridas: 1,
    totalConsolidado: { importe: '0.00', actualizadoA: '2026-09-16' },
    notaDelTotal: null,
    sinRegistros: false,
    municipalidades: [],
    ...cambios,
  };
}

/**
 * Con deuda, y **con interes**: sin interes, una amnistia aplicada no moveria ninguna cifra y la
 * guarda no veria la diferencia entre cobrar el total y cobrar «con amnistia».
 */
const CON_DEUDA = respuesta({
  totalConsolidado: { importe: '1842.60', actualizadoA: '2026-09-16' },
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
          predioId: 41,
          vehiculoId: null,
          insoluto: { importe: '1500.00', actualizadoA: '2026-09-16' },
          reajuste: { importe: '42.60', actualizadoA: '2026-09-16' },
          interes: { importe: '200.00', actualizadoA: '2026-09-16' },
          gasto: { importe: '100.00', actualizadoA: '2026-09-16' },
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
});

interface Final {
  readonly nombre: string;
  readonly contesta: () => Promise<unknown>;
  readonly conDeuda: boolean;
}

const FINALES: readonly Final[] = [
  { nombre: 'con deuda', contesta: () => Promise.resolve(CON_DEUDA), conDeuda: true },
  { nombre: 'sin deuda', contesta: () => Promise.resolve(respuesta({})), conDeuda: false },
  { nombre: '«no se pudo consultar» (la respuesta medida)', contesta: () => Promise.resolve(MEDIDA), conDeuda: false },
  { nombre: 'sin registros', contesta: () => Promise.resolve(respuesta({ sinRegistros: true })), conDeuda: false },
  { nombre: 'la consulta no contesta', contesta: () => Promise.reject(new Error('sin servicio')), conDeuda: false },
];

function fuenteQue(contesta: () => Promise<unknown>) {
  const cliente = {
    solicitar: vi.fn(() => contesta()),
    solicitarRespuesta: vi.fn(),
    descargar: vi.fn(),
    subir: vi.fn(),
  } as unknown as Cliente;
  return crearFuenteDeLaPlataforma(cliente);
}

const principal = () => screen.getByRole('main');

/** La pantalla ya no espera nada: ninguna seccion `aria-busy` (la consulta y los pagos contestaron). */
async function quieta(): Promise<void> {
  await waitFor(() => expect(principal().querySelector('[aria-busy="true"]')).toBeNull());
}

/** Lo que dice TODO el documento: marco, franja, pie y avisos incluidos. */
const todoElDocumento = () => document.body.textContent ?? '';

/**
 * Recorre los pasos alcanzables en un final y devuelve lo leido en cada uno, con su nombre.
 *
 * Cada montaje empieza de cero (cliente de consultas nuevo): es lo que hace una persona que entra
 * directamente a una direccion, que es justo el caso que se escapaba.
 */
async function recorrer(final: Final): Promise<ReadonlyMap<string, string>> {
  const leido = new Map<string, string>();

  // La portada, sin sesion.
  montarElPortal({ hash: '#/entrar', fuente: fuenteQue(final.contesta) });
  await screen.findByRole('heading', { level: 1, name: 'Entre con su cuenta del portal' });
  leido.set('#/entrar', todoElDocumento());
  await limpiarElPortal();

  // «Mis pagos» DIRECTO, con sesion: el caso medido del issue.
  identidad.fijarToken(tokenDeMentira());
  montarElPortal({ hash: '#/historial', fuente: fuenteQue(final.contesta) });
  await screen.findByRole('heading', { level: 1, name: 'Mis pagos' });
  await quieta();
  leido.set('#/historial directo', todoElDocumento());

  // «Cambiar mi clave»: su aviso es un `toast`, fuera de `main`.
  const disparador = within(screen.getByRole('banner')).getByRole('button', { expanded: false, name: /Rufina/ });
  act(() => disparador.focus());
  fireEvent.keyDown(disparador, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cambiar mi clave' }));
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  // El aviso llega un turno despues de cerrarse el menu.
  await act(async () => {
    await new Promise((resuelve) => setTimeout(resuelve, 50));
  });
  leido.set('«Cambiar mi clave»', todoElDocumento());
  await limpiarElPortal();

  // El paso 2.
  identidad.fijarToken(tokenDeMentira());
  montarElPortal({ hash: '#/deudas', fuente: fuenteQue(final.contesta) });
  await quieta();
  await screen.findByRole('heading', { level: 1 });
  leido.set('#/deudas', todoElDocumento());

  if (final.conDeuda) {
    fireEvent.click(within(principal()).getByRole('button', { name: 'Pagar todo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/pagar'));
    leido.set('#/pagar', todoElDocumento());

    fireEvent.click(within(principal()).getByRole('button', { name: 'Simular el pago: no se cobra nada' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));
    leido.set('#/comprobante', todoElDocumento());

    window.location.hash = '#/historial';
    await screen.findByRole('heading', { level: 1, name: 'Mis pagos' });
    await quieta();
    leido.set('#/historial tras simular', todoElDocumento());
  }
  await limpiarElPortal();
  return leido;
}

beforeAll(remendarJsdomParaElMenu);

afterEach(async () => {
  identidad.fijarToken(null);
  vi.restoreAllMocks();
  await limpiarElPortal();
});

// Monta el portal entero varias veces por caso: sus plazos, en `src/pruebas/portal.tsx`.
plazosDelPortal();

describe('con plataforma, ninguna frase de la lista llega al documento', () => {
  it.each(FINALES)('$nombre: en ningun paso alcanzable', async (final) => {
    const leido = await recorrer(final);

    const dichas = [...leido].flatMap(([paso, texto]) =>
      FRASES_QUE_AFIRMAN.filter((frase) => laDice(texto, frase)).map((frase) => `  ${paso}: ${nombreDe(frase)}`),
    );

    expect(
      dichas,
      `Con plataforma y la consulta «${final.nombre}», el portal le afirma a una persona hechos que ` +
        `no ocurrieron:\n${dichas.join('\n')}\n\n` +
        '  Ver `src/pruebas/frasesQueAfirman.ts`: con plataforma se dice lo que de verdad se sabe.',
    ).toEqual([]);
    // Y la guarda recorrio lo que dice que recorre: sin esto, un paso que no se dibujara pasaria en
    // verde sin haber leido nada.
    expect([...leido.keys()]).toEqual(
      final.conDeuda
        ? ['#/entrar', '#/historial directo', '«Cambiar mi clave»', '#/deudas', '#/pagar', '#/comprobante', '#/historial tras simular']
        : ['#/entrar', '#/historial directo', '«Cambiar mi clave»', '#/deudas'],
    );
  });
});
