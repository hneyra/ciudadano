import { Icono, cn } from '@kamayuk/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { bandaConFilo } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import type { PagoRegistrado, PagoSimulado } from '../../recorrido/recorrido.ts';
import { laBanda } from './vista.ts';

/**
 * **Las dos bandas de arriba del comprobante**: la verde de exito de un pago registrado, y la de un
 * pago simulado. Lo que dicen lo prepara `laBanda` (`vista.ts`); «Su pago se registró» es el `h1` (el
 * marcador del issue 4 ya lo usaba), en el artboard un `span`.
 */

/**
 * **Con el pago simulado, la banda no dice que se pago** (issue 28, revision).
 *
 * La del artboard afirma tres hechos —«Pagó …», «Le enviamos el comprobante a …», «La deuda pagada
 * ya se descontó de su cuenta»— y con un pago simulado **no ocurrio ninguno**: no hubo cobro, no se
 * envio nada y la deuda esta donde estaba (el reductor no la da por pagada). Un aviso al lado no
 * arregla una afirmacion falsa en el cuerpo: quien la lee se va creyendo que pago.
 *
 * Asi que se dice en condicional y se niegan los tres, uno por uno. Y no va en verde de exito: no
 * hay ningun exito que celebrar.
 */
export function BandaSimulada({ pago }: { readonly pago: PagoSimulado }) {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const idDelTitulo = useId();

  return (
    <section aria-labelledby={idDelTitulo} className={cn(bandaConFilo({ tono: 'neutro' }), 'mb-[18px] px-[22px] py-5')}>
      <h1 id={idDelTitulo} className="m-0 text-[21px] font-bold text-pretty">
        {t('Así se vería su comprobante')}
      </h1>
      <p className="mt-[6px] mb-0 max-w-[70ch] text-[15px] leading-[1.6] text-pretty text-tinta-2">
        {laBanda(estado, pago, t)}
      </p>
    </section>
  );
}

/**
 * La banda verde de exito, que no se imprime (lineas 480-488 y 1276-1278). Solo con un pago
 * registrado, que es el unico que dice con que se pago (issue 58). El visto es el `Icono` de
 * `@kamayuk/ui` (issue 60): el mismo trazo que el artboard, que antes se copiaba aqui a mano.
 */
export function BandaDeExito({ pago }: { readonly pago: PagoRegistrado }) {
  const { t } = useTranslation();
  const { estado } = useRecorrido();

  return (
    <div
      data-noprint="1"
      className={cn(bandaConFilo({ tono: 'ok' }), 'mb-[18px] flex items-start gap-[15px] px-[22px] py-5')}
    >
      <span
        aria-hidden="true"
        className="grid size-[38px] flex-[0_0_auto] place-items-center rounded-full bg-ok-tinta text-sobre-azul"
      >
        <Icono nombre="visto" tamano={21} grosor={2.8} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-[21px] font-bold text-pretty text-ok-tinta">{t('Su pago se registró')}</h1>
        <p className="mt-[6px] mb-0 text-[15px] leading-[1.6] text-pretty text-ok-tinta">{laBanda(estado, pago, t)}</p>
      </div>
    </div>
  );
}
