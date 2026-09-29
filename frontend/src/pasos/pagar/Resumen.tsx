import { Boton, cn } from '@kamayuk/ui';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Cifra } from '../../piezas/Cifra.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { elResumen } from './vista.ts';

/**
 * **«Lo que va a pagar»**, pegado arriba; a ≤ 820 px, encima de los medios y sin pegar (artboard,
 * lineas 449-473). Lo que dice lo prepara `elResumen` (`vista.ts`); aqui se coloca.
 *
 * El corte es `max-[821px]:` y no `max-[820px]:`: Tailwind v4 emite `max-[820px]` como `width <
 * 820px`, y a 820 px justos el resumen seguia a la derecha. Lo destapo el arnes (issue 11).
 */

/**
 * Una fila de los totales del resumen (lineas 463-468 y 1242-1251). El color es del importe, no del
 * rotulo: el artboard solo pinta `t.color` en la cifra.
 */
function Total({
  rotulo,
  children,
  className,
  tintaDeLaCifra,
}: {
  readonly rotulo: string;
  readonly children: ReactNode;
  readonly className: string;
  readonly tintaDeLaCifra?: string;
}) {
  return (
    <div className={cn('flex items-baseline gap-3 px-[18px]', className)}>
      <dt className="min-w-0 flex-1">{rotulo}</dt>
      <dd className={cn('m-0 flex-[0_0_auto] tabular-nums', tintaDeLaCifra)}>{children}</dd>
    </div>
  );
}

export function Resumen() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelTitulo = useId();
  const resumen = elResumen(estado, t);

  return (
    <section
      aria-labelledby={idDelTitulo}
      data-resumen=""
      className="sticky top-[14px] border border-linea bg-superficie max-[821px]:static max-[821px]:-order-1"
    >
      <div className="border-b border-linea-2 bg-sup px-[18px] py-[14px]">
        <h2 id={idDelTitulo} className="m-0 text-[15.5px] font-bold">
          {t('Lo que va a pagar')}
        </h2>
      </div>

      {resumen.conceptos.length === 0 ? (
        <p className="m-0 px-[18px] py-[14px] text-[14px] text-pretty text-tinta-2">{t('No hay nada que pagar.')}</p>
      ) : (
        <>
          <ul className="m-0 list-none p-0">
            {resumen.conceptos.map((deuda) => (
              <li key={deuda.id} className="flex items-baseline gap-3 border-b border-linea-2 px-[18px] py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-pretty">{deuda.concepto}</span>
                  {deuda.cuotas === null ? null : (
                    <span className="mt-[2px] block text-[12.5px] text-tinta-3">{deuda.cuotas}</span>
                  )}
                </span>
                <Cifra valor={deuda.total} peso="normal" className="flex-[0_0_auto] text-[14px]" />
              </li>
            ))}
          </ul>
          <dl className="m-0 text-[14px]">
            {resumen.filas.map((fila, i) => (
              <Total
                key={fila.rotulo}
                rotulo={fila.rotulo}
                className={i === 0 ? 'py-[9px]' : 'border-t border-linea-2 py-[9px]'}
                tintaDeLaCifra={fila.condonado ? 'text-ok-tinta' : undefined}
              >
                {fila.condonado ? '− ' : null}
                <Cifra valor={fila.valor} peso="normal" className={fila.condonado ? '[&_span]:text-ok-tinta' : undefined} />
              </Total>
            ))}
            <Total
              rotulo={t('Total a pagar')}
              className="border-t-2 border-linea bg-sup py-[14px] text-[19px] font-bold"
              tintaDeLaCifra="text-azul"
            >
              <Cifra valor={resumen.total} peso="negrita" className="[&_span]:text-azul" />
            </Total>
          </dl>
        </>
      )}

      <div className="border-t border-linea-2 px-[18px] py-[13px]">
        <p className="m-0 text-[12.5px] leading-[1.55] text-pretty text-tinta-3">{resumen.aviso}</p>
        <Boton
          type="button"
          variante="fantasma"
          onClick={() => despachar({ tipo: 'volverAElegir' })}
          // 44 px de alto (issue 62): el artboard no le fija medida (linea 471) y con la del texto media 20.
          className="mt-[10px] min-h-[44px] p-0 text-[13.5px] underline hover:bg-transparent print:hidden"
        >
          {resumen.volver}
        </Boton>
      </div>
    </section>
  );
}
