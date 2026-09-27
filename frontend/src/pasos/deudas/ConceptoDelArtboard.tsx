import {
  Insignia,
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaRotulo,
  cn,
} from '@kamayuk/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { tonoDe, totalDe } from '../../datos/cuentas.ts';
import type { Deuda, TablaDeDetalle, TonoDeInsignia } from '../../datos/tipos.ts';
import { Cifra } from '../../piezas/Cifra.tsx';
import { FilaDeConcepto } from './piezas.tsx';
import { notaDelRecargo } from './vista.ts';

/**
 * **Un concepto del artboard** (lineas 228-281): con sus cuotas, su insignia de estado, su
 * vencimiento, su recargo y su desglose. Solo en demostracion; con plataforma el servidor no trae
 * nada de eso (`ConceptoDelServidor.tsx`).
 *
 * · **`Insignia`** tal cual: su letra (11.5 px) y su radio (pildora) son la decision del producto; el
 *   artboard escribe 12.5 px y 3 px (`INS`, linea 730). Los colores son los mismos cuatro pares.
 * · **`Tabla`** y compania tal cual, con el filo y el papel del contenedor del artboard (linea 254) y
 *   su ancho minimo. Los rotulos salen en versalitas de 11.5 px sobre `--sup`, que es la cabecera del
 *   producto, y no los 12.5 px sobre `#F2F2F2` de `TH` (linea 721).
 */

/** El color de la linea del vencimiento, por el tono del estado (artboard, linea 1140). */
const TINTA_DEL_VENCIMIENTO: Readonly<Record<TonoDeInsignia, string>> = {
  mal: 'text-mal-tinta',
  atencion: 'text-atencion-tinta',
  ok: 'text-tinta-3',
  info: 'text-tinta-3',
};

/** El desglose de un concepto: su tabla y su nota (lineas 251-279). */
function Detalle({ detalle }: { readonly detalle: TablaDeDetalle }) {
  const { titulo, anchoMinimo, columnas, filas, columnaDeInsignia, nota } = detalle;
  const idDelTitulo = useId();

  return (
    <>
      <p
        id={idDelTitulo}
        className="mt-[14px] mb-[10px] text-[13px] font-bold tracking-[0.07em] text-tinta-3 uppercase"
      >
        {titulo}
      </p>
      <Tabla
        aria-labelledby={idDelTitulo}
        style={{ minWidth: anchoMinimo }}
        marco={{ className: 'border border-linea bg-superficie' }}
      >
        <TablaCabecera>
          <tr>
            {columnas.map((columna) => (
              <TablaRotulo key={columna.rotulo} cifra={columna.cifra}>
                {columna.rotulo}
              </TablaRotulo>
            ))}
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {filas.map((fila) => (
            <TablaFila key={fila.join('|')}>
              {fila.map((celda, j) => (
                <TablaCelda
                  // Las celdas de una fila no tienen otra identidad que su columna.
                  key={columnas[j]?.rotulo ?? j}
                  cifra={columnas[j]?.cifra === true}
                  identifica={j === 0}
                >
                  {j === columnaDeInsignia ? <Insignia tono={tonoDe(celda)}>{celda}</Insignia> : celda}
                </TablaCelda>
              ))}
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>
      <p className="mt-[11px] mb-0 text-[13.5px] leading-[1.55] text-pretty text-tinta-3">{nota}</p>
    </>
  );
}

export function ConceptoDelArtboard({ deuda }: { readonly deuda: Deuda }) {
  const { t } = useTranslation();
  const recargo = notaDelRecargo(deuda, t);

  return (
    <FilaDeConcepto
      id={deuda.id}
      concepto={deuda.concepto}
      linea={`${deuda.unidad} · ${deuda.cuotas}`}
      debajo={
        <span className="mt-[7px] flex flex-wrap items-center gap-[10px]">
          <Insignia tono={deuda.tono}>{deuda.estado}</Insignia>
          <span className={cn('text-[13.5px]', TINTA_DEL_VENCIMIENTO[deuda.tono])}>{deuda.vence}</span>
        </span>
      }
      cifra={
        <>
          <Cifra valor={totalDe(deuda)} peso="negrita" className="block text-[19px]" />
          {recargo === null ? null : <span className="mt-[3px] block text-[12.5px] text-mal-tinta">{recargo}</span>}
        </>
      }
      cuerpo="border-t border-linea-2 bg-sup px-5 pt-1 pb-4"
    >
      <Detalle detalle={deuda.detalle} />
    </FilaDeConcepto>
  );
}
