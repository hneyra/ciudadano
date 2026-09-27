import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { COMPROBANTE, CONTRIBUYENTE, MEDIOS, USUARIO } from './datos/demostracion.ts';
import type { FuenteDelPortal } from './datos/fuente.ts';
import { LA_DEMOSTRACION, fuenteDeDemostracion } from './datos/fuenteDeDemostracion.ts';
import type { LaDemostracion } from './datos/tipos.ts';
import { limpiarElPortal, montarElPortal, plazosDelPortal, remendarJsdomParaElMenu } from './pruebas/portal.tsx';

/**
 * **Todo lo que es dato de una persona llega por la fuente** (issue 58).
 *
 * Hasta el issue 58 la barra, el paso 2, «Pagar», el comprobante y el reductor importaban los datos de
 * `demostracion.ts`, y «Buscar mi deuda» y «Mis datos» escribian el codigo y el DNI del contribuyente
 * como ejemplo: con eso, los datos del artboard viajaban en el paquete de produccion aunque la fuente de
 * demostracion se quedara fuera. Que ya no viajan lo mide el arnes sobre lo construido
 * (`e2e/la-demostracion-no-viaja-al-bundle.spec.ts`); esto mide la otra mitad, la que se ve: **que cada
 * pantalla dice lo que le da la fuente, y no lo que tenga a mano**.
 *
 * Por eso se monta con OTRA demostracion —otra persona, otros documentos, otro sello, otro numero para
 * yapear— y se exige que salga la otra y que no quede ni rastro de la del artboard. Una pantalla que
 * siguiera importando `demostracion.ts` diria aqui el nombre de la persona equivocada.
 */

beforeAll(remendarJsdomParaElMenu);
afterEach(limpiarElPortal);
plazosDelPortal();

const OTRA: LaDemostracion = {
  ...LA_DEMOSTRACION,
  contribuyente: { ...CONTRIBUYENTE, nombre: 'Otra Contribuyente', codigo: '99999999901', numeroDeDocumento: '11112222' },
  usuario: {
    ...USUARIO,
    iniciales: 'OU',
    nombre: 'Otra Usuaria',
    numeroDeDocumento: '33334444',
    codigo: '99999999901',
    correo: 'otra@example.com',
  },
  comprobante: { ...COMPROBANTE, numero: '0009-0000001', operacion: '11 2222 3333 4444' },
  medios: MEDIOS.map((medio) => (medio.id === 'yape' ? { ...medio, codigo: '900 111 222' } : medio)),
  ejemplos: {
    busqueda: { 'Código de contribuyente': '99999999901', DNI: '11112222', RUC: '20999999991' },
    cuenta: '11112222',
  },
};

const OTRA_FUENTE: FuenteDelPortal = { ...fuenteDeDemostracion, demostracion: OTRA };

/** Lo que del artboard NO puede aparecer con otra demostracion: ninguna pantalla lo tiene a mano. */
const DEL_ARTBOARD = [
  CONTRIBUYENTE.nombre,
  CONTRIBUYENTE.codigo,
  CONTRIBUYENTE.numeroDeDocumento,
  USUARIO.nombre,
  USUARIO.numeroDeDocumento,
  USUARIO.correo,
  COMPROBANTE.numero,
  COMPROBANTE.operacion,
  '969 032 194',
];

/** El texto de la pagina y los `placeholder`, que es donde estaban los ejemplos. */
function loQueSeVe(): string {
  const ejemplos = [...document.querySelectorAll('[placeholder]')].map((campo) => campo.getAttribute('placeholder'));
  return `${document.body.textContent ?? ''} ${ejemplos.join(' ')}`;
}

function nadaDelArtboard(): void {
  const visto = loQueSeVe();
  expect(DEL_ARTBOARD.filter((dato) => visto.includes(dato)), 'la pantalla dice un dato del artboard').toEqual([]);
}

const enMain = () => within(screen.getByRole('main'));

describe('con otra demostracion, cada pantalla dice la otra', () => {
  it('«Buscar mi deuda»: el ejemplo del campo es el de la fuente', () => {
    montarElPortal({ hash: '#/buscar', fuente: OTRA_FUENTE });

    expect(enMain().getByPlaceholderText('99999999901')).toBeInTheDocument();
    nadaDelArtboard();
  });

  it('elegir que pago: el contribuyente, sus documentos y la deuda son los de la fuente', () => {
    montarElPortal({ hash: '#/deudas', estado: { paso: 'deudas', numero: '99999999901' }, fuente: OTRA_FUENTE });

    expect(enMain().getByText('Otra Contribuyente')).toBeInTheDocument();
    expect(enMain().getByText(/^Código 99999999901 · DNI 11112222 · /)).toBeInTheDocument();
    nadaDelArtboard();
  });

  it('«Mis datos»: el ejemplo del documento es el de la fuente', () => {
    montarElPortal({ hash: '#/identificar', estado: { paso: 'identificar', numero: '99999999901' }, fuente: OTRA_FUENTE });

    expect(enMain().getByPlaceholderText('11112222')).toBeInTheDocument();
    nadaDelArtboard();
  });

  it('la barra: quien entro es la usuaria de la fuente', () => {
    montarElPortal({ hash: '#/pagar', estado: { paso: 'pagar', autenticado: true }, fuente: OTRA_FUENTE });

    const barra = within(screen.getByRole('banner'));
    expect(barra.getByRole('button', { name: /Otra Usuaria/ })).toHaveTextContent('OUOtra UsuariaDNI 33334444');
    nadaDelArtboard();
  });

  it('pagar y el comprobante: los medios y el sello son los de la fuente, y el recibo va a su nombre', async () => {
    montarElPortal({
      hash: '#/pagar',
      estado: { paso: 'pagar', numero: '99999999901', correo: 'quien@example.com' },
      fuente: OTRA_FUENTE,
    });

    fireEvent.click(enMain().getByRole('radio', { name: 'Yape o Plin' }));
    expect(enMain().getByText('900 111 222')).toBeInTheDocument();
    nadaDelArtboard();

    fireEvent.click(enMain().getByRole('button', { name: 'Ya yapeé' }));
    await waitFor(() => expect(window.location.hash).toBe('#/comprobante'));

    const recibo = within(await enMain().findByRole('region', { name: 'Constancia de pago' }));
    expect(recibo.getByText('0009-0000001')).toBeInTheDocument();
    expect(recibo.getByText('11 2222 3333 4444')).toBeInTheDocument();
    expect(recibo.getByText('Otra Contribuyente')).toBeInTheDocument();
    nadaDelArtboard();
  });
});
