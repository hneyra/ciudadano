import { Boton, avisar, cn } from '@kamayuk/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { bandaConFilo, botonConContorno } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { type PagoSellado, esSimulado, vivas } from '../../recorrido/recorrido.ts';

/**
 * **Lo que se hace con el comprobante, y lo que no se imprime**: las acciones y la invitacion a crear
 * una cuenta. Las dos llevan `data-noprint`.
 *
 * **`Boton`** para las acciones: «Descargar comprobante» y «Ver mis pagos» primarios —el `ACERO` de
 * la linea 1285 es `--azul`, fila `ACERO` de la tabla de la paleta—, el resto secundarios. A ≤ 700 px
 * van en columna y a lo ancho: `max-[701px]:`, que Tailwind v4 emite como `width < 701px`, el
 * `max-width: 700px` del artboard.
 */

/** Las medidas de un boton de las acciones (lineas 537-543 y 1287-1288). */
const BOTON_DE_ACCION = 'min-h-[46px] py-0 text-[15.5px] max-[701px]:w-full';

/** Descargar, imprimir y seguir; no se imprime (lineas 536-544 y 1281-1289). */
export function Acciones({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();

  return (
    <div
      data-acciones="1"
      data-noprint="1"
      className="mt-[18px] flex flex-wrap items-center gap-[11px] max-[701px]:flex-col max-[701px]:items-stretch"
    >
      {/*
        Un pago simulado no tiene comprobante que descargar: no se emitio ninguno, y el numero del
        artboard es utileria. «Imprimir» si se queda, y el aviso de pago simulado NO lleva
        `data-noprint`: lo que salga en el papel lleva escrito que es una demostracion.
      */}
      {esSimulado(pago) ? null : (
        <Boton
          type="button"
          variante="primario"
          onClick={() => avisar(t('Se descargaría el comprobante {{numero}} en PDF.', { numero: pago.comprobante.numero }))}
          className={cn(BOTON_DE_ACCION, 'px-6')}
        >
          {t('Descargar comprobante')}
        </Boton>
      )}
      <Boton type="button" onClick={() => window.print()} className={cn(BOTON_DE_ACCION, 'px-[22px]')}>
        {t('Imprimir')}
      </Boton>
      <span aria-hidden="true" className="min-w-2 flex-1 max-[701px]:hidden" />
      {estado.autenticado ? (
        <>
          <Boton
            type="button"
            variante="primario"
            onClick={() => despachar({ tipo: 'verMisPagos' })}
            className={cn(BOTON_DE_ACCION, 'px-[22px]')}
          >
            {t('Ver mis pagos')}
          </Boton>
          {vivas(estado).length > 0 ? (
            <Boton
              type="button"
              onClick={() => despachar({ tipo: 'pagarLoPendiente' })}
              className={cn(BOTON_DE_ACCION, 'px-[22px]')}
            >
              {t('Pagar otra deuda')}
            </Boton>
          ) : null}
        </>
      ) : (
        <Boton
          type="button"
          onClick={() => despachar({ tipo: 'consultarOtra' })}
          className={cn(BOTON_DE_ACCION, 'px-[22px]')}
        >
          {t('Consultar otra deuda')}
        </Boton>
      )}
    </div>
  );
}

/**
 * Sin sesion: guardar el pago en una cuenta; no se imprime (lineas 546-552). El correo es el destino
 * del pago registrado; uno simulado no se envio a ningun sitio, y se dice «su correo».
 */
export function Invitacion({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const { despachar } = useRecorrido();
  const idDelTitulo = useId();

  return (
    <section
      aria-labelledby={idDelTitulo}
      data-noprint="1"
      className={cn(bandaConFilo({ tono: 'info', filo: 'fino' }), 'mt-[18px] px-[18px] py-4')}
    >
      <h2 id={idDelTitulo} className="m-0 text-[15px] font-bold">
        {t('Guarde este pago en una cuenta')}
      </h2>
      <p className="mt-[6px] mb-3 max-w-[70ch] text-[14px] leading-[1.6] text-pretty text-tinta-2">
        {t(
          'Si crea una cuenta con {{correo}}, este comprobante y los anteriores quedan guardados: no tendrá que volver a buscarlos.',
          { correo: (esSimulado(pago) ? null : pago.destino) ?? t('su correo') },
        )}
      </p>
      <Boton
        type="button"
        onClick={() => despachar({ tipo: 'identificarse' })}
        className={cn(botonConContorno({ tono: 'azul' }), 'min-h-[42px] px-[18px] py-0 text-[14.5px]')}
      >
        {t('Crear mi cuenta')}
      </Boton>
    </section>
  );
}
