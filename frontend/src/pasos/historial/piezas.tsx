import { Boton, Insignia, cn } from '@kamayuk/ui';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import type { FilaPendienteDicha } from './vista.ts';

/**
 * **Lo que las secciones de «Mis pagos» comparten** (issue 60): el marco de cada seccion, la cabecera
 * y las filas de lo pendiente, el pie que ofrece pagarlo y el dato de una unidad. Hasta el issue 60,
 * «Lo que queda pendiente» se escribia dos veces —con la deuda del recorrido y con la de la consulta—
 * con la misma cabecera, las mismas filas y el mismo pie copiados.
 */

/**
 * Una seccion blanca con filo (lineas 583, 613 y 643), con el nombre de su titulo. La cabecera la
 * dibuja quien la usa, con el `id` que tiene que llevar el `h2`: las tres son distintas.
 */
export function Seccion({
  cabecera,
  children,
  ocupada = false,
  className,
}: {
  readonly cabecera: (idDelTitulo: string) => ReactNode;
  readonly children: ReactNode;
  /** Mientras la fuente no contesta: `aria-busy`. */
  readonly ocupada?: boolean;
  readonly className?: string;
}) {
  const idDelTitulo = useId();
  return (
    <section
      aria-labelledby={idDelTitulo}
      aria-busy={ocupada || undefined}
      className={cn('border border-linea bg-superficie', className)}
    >
      {cabecera(idDelTitulo)}
      {children}
    </section>
  );
}

/** La cabecera de «Lo que queda pendiente»: el titulo y, a la derecha, el total o lo que lo sustituye. */
export function CabeceraDeLoPendiente({ idDelTitulo, cifra }: { readonly idDelTitulo: string; readonly cifra: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-linea-2 px-5 py-[14px]">
      <h2 id={idDelTitulo} className="m-0 min-w-[180px] flex-1 text-[17px] font-bold">
        {t('Lo que queda pendiente')}
      </h2>
      <span data-total-pendiente="" className="text-[15px] font-bold text-mal-tinta tabular-nums">
        {cifra}
      </span>
    </div>
  );
}

/** Las filas de lo pendiente (lineas 619-627). */
export function FilasPendientes({ filas }: { readonly filas: readonly FilaPendienteDicha[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {filas.map((fila) => (
        <li key={fila.id} className="flex flex-wrap items-center gap-[14px] border-b border-linea-2 px-5 py-[13px]">
          <span className="min-w-[180px] flex-1">
            <span className="block text-[15px] font-bold text-pretty">{fila.concepto}</span>
            <span className="mt-[2px] block text-[13.5px] text-tinta-3">{fila.vence}</span>
          </span>
          {fila.insignia === null ? null : <Insignia tono={fila.insignia.tono}>{fila.insignia.texto}</Insignia>}
          <span className="flex-[0_0_auto] text-[16px] font-bold tabular-nums">{fila.monto}</span>
        </li>
      ))}
    </ul>
  );
}

/** El pie de lo pendiente cuando queda algo: ir a elegirlo (lineas 630-634). */
export function PieParaPagar() {
  const { t } = useTranslation();
  const { despachar } = useRecorrido();
  return (
    <div className="flex flex-wrap items-center gap-3 bg-sup px-5 py-4">
      <p className="m-0 min-w-[180px] flex-1 text-[13.5px] text-pretty text-tinta-3">
        {t('Puede pagar todo o elegir solo algunos conceptos.')}
      </p>
      <Boton
        type="button"
        variante="primario"
        onClick={() => despachar({ tipo: 'pagarLoPendiente' })}
        className="min-h-[46px] px-6 py-0 text-[15.5px]"
      >
        {t('Pagar lo pendiente')}
      </Boton>
    </div>
  );
}

/** Un dato de una unidad, en su etiqueta (lineas 659-663): el papel informativo con filo `--azul-suave`. */
export function Dato({ children }: { readonly children: ReactNode }) {
  return (
    <li className="rounded-sm border border-azul-suave bg-info-fondo px-[9px] py-1 text-[12.5px] text-tinta-2">
      {children}
    </li>
  );
}

/** Lo que se explica al pie de una seccion, sobre `--sup`. */
export function NotaAlPie({ children }: { readonly children: ReactNode }) {
  return <p className="m-0 bg-sup px-5 py-[13px] text-[13.5px] leading-[1.55] text-pretty text-tinta-3">{children}</p>;
}
