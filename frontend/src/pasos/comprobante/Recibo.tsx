import { Tabla, TablaCabecera, TablaCelda, TablaCuerpo, TablaFila, TablaRotulo, cn } from '@kamayuk/ui';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import escudo from '../../../diseno/escudo-catacaos.png';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import type { PagoSellado } from '../../recorrido/recorrido.ts';
import { elRecibo } from './vista.ts';

/**
 * **El recibo: lo unico que se imprime** (artboard, lineas 491-534 y 1287-1322). Lo que dice lo
 * prepara `elRecibo` (`vista.ts`), solo con el pago sellado.
 *
 * · **`Tabla`** y compania para los conceptos, con el `min-width: 660px` del artboard (sin minimo a
 *   ≤ 700 px) y sus rellenos de 18/14/12 px. Los rotulos, la cabecera del producto (como en el paso 2).
 *   El pie no es pieza de la libreria: es un `<tfoot>` con un `th scope="row"` que ocupa las tres
 *   primeras columnas, donde el artboard pinta tres celdas y dos vacias.
 * · **El escudo** es el mismo recurso que la barra (`diseno/escudo-catacaos.png`).
 * · «Constancia de pago» es el `h2` que da nombre a la region del recibo, y la meta una lista de
 *   definiciones (`dl`), no seis `div`: en el artboard, `span` y `div`.
 */

/**
 * A ≤ 700 px la tabla pierde su minimo y parte; a ≤ 520 px, menos relleno (29-44). Los rotulos van por
 * aqui; las celdas, por `CELDA_DEL_RECIBO`, que ademas bajan a 13 px como en el artboard. Los rotulos
 * no: `TablaRotulo` ya pinta 11.5 px, y subirlos a 13 px en versalitas espaciadas los hacia el ancho
 * minimo de cada columna: a 400 px la tabla media 384 px en un marco de 362 (medido). Con 11.5 px mide
 * 371, lo que piden «municipales», «habitación» y «1,854.60»; el artboard, 366. Lo que sobra se desplaza
 * dentro del marco de `Tabla`, no la pagina.
 */
const ROTULO_DEL_RECIBO = 'px-[18px] max-[701px]:px-[14px] max-[701px]:whitespace-normal max-[521px]:px-3';
const CELDA_DEL_RECIBO = `${ROTULO_DEL_RECIBO} max-[521px]:text-[13px]`;

/** Una celda de la meta (lineas 497-502 y 1291-1300): el filo fino de `CELDA`, rotulo y valor. */
function Meta({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div className="-mt-px -ml-px border-t border-l border-linea-2 bg-superficie px-6 py-[14px]">
      <dt className="m-0 text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{rotulo}</dt>
      <dd className="mx-0 mt-[5px] mb-0 text-[14.5px] font-bold text-pretty wrap-anywhere">{children}</dd>
    </div>
  );
}

export function Recibo({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const idDelTitulo = useId();
  const recibo = elRecibo(estado, pago, t);

  const columnas = [
    { rotulo: t('Concepto'), cifra: false },
    { rotulo: t('Unidad'), cifra: false },
    { rotulo: t('Cuotas'), cifra: false },
    { rotulo: t('Importe S/'), cifra: true },
  ];

  return (
    <section aria-labelledby={idDelTitulo} data-recibo="1" className="border border-linea bg-superficie shadow-sombra-1">
      <div className="flex flex-wrap items-start gap-4 border-b-2 border-azul px-6 pt-[22px] pb-[18px]">
        <img src={escudo} alt="" width={38} height={46} className="block h-[46px] w-auto flex-[0_0_auto]" />
        <span className="min-w-[180px] flex-1">
          <span className="block text-[16px] font-bold">{t('Municipalidad Distrital de Catacaos')}</span>
          <span className="mt-[2px] block text-[13px] text-tinta-3">{t('Gerencia de Administración Tributaria')}</span>
        </span>
        <div className="min-w-[140px] flex-[1_0_auto] text-right">
          <h2 id={idDelTitulo} className="m-0 text-[13px] font-normal text-tinta-3">
            {recibo.titulo}
          </h2>
          {recibo.numero === null ? null : (
            <span className="mt-[2px] block text-[17px] font-bold text-azul tabular-nums">{recibo.numero}</span>
          )}
        </div>
      </div>

      <dl
        data-meta="1"
        className="m-0 grid grid-cols-[repeat(auto-fit,minmax(206px,1fr))] overflow-hidden bg-superficie max-[701px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[521px]:grid-cols-[minmax(0,1fr)]"
      >
        {recibo.meta.map((linea) => (
          <Meta key={linea.rotulo} rotulo={linea.rotulo}>
            {linea.valor}
          </Meta>
        ))}
      </dl>

      <Tabla className="min-w-[660px] max-[701px]:min-w-0">
        <TablaCabecera>
          <tr>
            {columnas.map((columna) => (
              <TablaRotulo key={columna.rotulo} cifra={columna.cifra} className={ROTULO_DEL_RECIBO}>
                {columna.rotulo}
              </TablaRotulo>
            ))}
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {recibo.filas.map((fila) => (
            <TablaFila key={fila.id}>
              <TablaCelda identifica className={cn('font-bold', CELDA_DEL_RECIBO)}>
                {fila.concepto}
              </TablaCelda>
              <TablaCelda className={CELDA_DEL_RECIBO}>{fila.unidad}</TablaCelda>
              <TablaCelda className={CELDA_DEL_RECIBO}>{fila.cuotas}</TablaCelda>
              <TablaCelda cifra className={CELDA_DEL_RECIBO}>
                {fila.importe}
              </TablaCelda>
            </TablaFila>
          ))}
        </TablaCuerpo>
        <tfoot>
          {recibo.condonado === null ? null : (
            <tr className="text-[14px] text-ok-tinta">
              <th scope="row" colSpan={3} className={cn('border-t border-linea-2 py-[10px] text-left font-normal', CELDA_DEL_RECIBO)}>
                {recibo.condonado.rotulo}
              </th>
              <td className={cn('border-t border-linea-2 py-[10px] text-right tabular-nums', CELDA_DEL_RECIBO)}>
                {recibo.condonado.valor}
              </td>
            </tr>
          )}
          <tr className="bg-sup text-[14.5px] font-bold text-tinta">
            <th scope="row" colSpan={3} className={cn('border-t-2 border-linea py-3 text-left', CELDA_DEL_RECIBO)}>
              {recibo.total.rotulo}
            </th>
            <td className={cn('border-t-2 border-linea py-3 text-right tabular-nums', CELDA_DEL_RECIBO)}>
              {recibo.total.valor}
            </td>
          </tr>
        </tfoot>
      </Tabla>

      <div className="border-t border-linea-2 px-6 pt-[18px] pb-[22px]">
        <p className="m-0 max-w-[80ch] text-[13.5px] leading-[1.65] text-pretty text-tinta-3">{recibo.nota}</p>
      </div>
    </section>
  );
}
