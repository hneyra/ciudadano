import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { AvisoDePagoSimulado } from '../../piezas/AvisoDePagoSimulado.tsx';
import { BotonDeConfirmar, useConfirmarElPago } from './confirmar.tsx';

/**
 * **Paso 3 con plataforma: no hay medio de pago que ofrecer** (issue 28, revision).
 *
 * <h2>Por que el selector de los cuatro medios NO se dibuja</h2>
 *
 * Porque los cuatro medios del artboard no son cuatro rotulos: son **datos accionables**. El de Yape
 * publica un numero de telefono —«Número para yapear 969 032 194, a nombre de la Municipalidad
 * Distrital de Catacaos»— y el del banco, un codigo de pago «válido por 72 horas». En el portal de
 * demostracion eso es utileria de una ficcion que la pagina entera declara. En un portal construido
 * para una municipalidad, con la deuda de verdad delante y el total de verdad al lado, es una
 * instruccion: alguien puede yapear S/ 3,785.20 a ese numero. No existe ese cobro, y ese numero no
 * es de nadie que vaya a devolverlo.
 *
 * Lo mismo con las promesas de cada panel —«el comprobante se emite de inmediato», «el pago aparece
 * en un minuto», «se aplica al día siguiente hábil»—: son hechos futuros que el portal no puede
 * cumplir porque no hay nada detras (D-14 abierta).
 *
 * Asi que con plataforma el paso 3 dice **lo que es**: aqui no se puede pagar, esto es lo
 * que se deberia, y se paga en ventanilla. El boton de confirmar se queda para poder recorrer el
 * paso —y dice en su propio texto que lo que hace es simular—, porque el issue pide que el recorrido
 * se pueda recorrer entero.
 */
export function PagarSinMedios() {
  const { t } = useTranslation();
  const idDelTitulo = useId();
  const { nada, confirmar } = useConfirmarElPago();

  return (
    <>
      {/* No lleva `data-noprint`: si alguien imprime esta pagina, el aviso tiene que ir en el papel. */}
      <AvisoDePagoSimulado />
      <h1 className="m-0 mb-[6px] text-[24px] font-bold text-pretty text-azul">
        {t('Todavía no se puede pagar en línea')}
      </h1>
      <p className="mt-0 mb-[18px] max-w-[62ch] text-[15.5px] leading-[1.6] text-pretty text-tinta-2">
        {t(
          'El portal ya sabe lo que debe, pero el cobro todavía no está conectado: no hay ningún medio de pago que ofrecerle. Para pagar, acérquese con su documento a la ventanilla de la municipalidad.',
        )}
      </p>

      <section aria-labelledby={idDelTitulo} className="border border-linea bg-superficie">
        <div className="border-b border-linea-2 px-5 py-[14px]">
          <h2 id={idDelTitulo} className="m-0 text-[17px] font-bold">
            {t('Puede seguir el recorrido, sin pagar')}
          </h2>
          <p className="mt-[5px] mb-0 max-w-[66ch] text-[14px] leading-[1.55] text-pretty text-tinta-3">
            {t(
              'El botón de abajo no cobra: solo enseña cómo se vería su comprobante. Su deuda queda exactamente donde está.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-linea-2 bg-sup px-5 py-4">
          <p className="m-0 min-w-[180px] flex-1 text-[13.5px] leading-[1.55] text-pretty text-tinta-3">
            {t('No se le pide ningún dato de pago, porque no hay ningún pago que hacer.')}
          </p>
          <BotonDeConfirmar rotulo={t('Simular el pago: no se cobra nada')} nada={nada} alConfirmar={confirmar} />
        </div>
      </section>
    </>
  );
}
