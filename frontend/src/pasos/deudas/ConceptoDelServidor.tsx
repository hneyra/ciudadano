import { useTranslation } from 'react-i18next';

import { totalDe } from '../../datos/cuentas.ts';
import { fechaDelImporte } from '../../datos/deLaSituacion.ts';
import type { DeudaDelServidor, SituacionDelServidor } from '../../datos/tipos.ts';
import { Cifra } from '../../piezas/Cifra.tsx';
import { FilaDeConcepto } from './piezas.tsx';
import { componentesDelSaldo } from './vista.ts';

/**
 * **La deuda del servidor, tal como la cuenta el servidor** (issues 27 y 28): el total que el sumo y
 * cada concepto, sin nada que el contrato no traiga. Por que, en la cabecera de `LaConsulta.tsx`.
 */

/** El total que sumo el SERVIDOR, con su fecha, y la frase que cada municipalidad redacto. */
export function LoQueSumoElServidor({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();
  const total = situacion.totalConsolidado;

  return (
    <div className="border border-t-0 border-linea bg-superficie px-5 py-[18px]">
      <h2 className="m-0 text-[12.5px] tracking-[0.09em] text-tinta-3 uppercase">{t('Lo que suma el portal')}</h2>
      {total === null ? null : (
        <p className="mt-[6px] mb-0 text-[27px] [&_span]:font-bold [&_span]:text-azul">
          <Cifra valor={total.importe} aLaFecha={total.actualizadoA} conSuFecha />
        </p>
      )}
      {/*
        La frase de cada municipalidad la redacta el SERVIDOR —«1 obligacion con saldo al …»— y va
        tal cual, sin traducir y sin recomponer: dos interfaces que la compusieran acabarian
        escribiendo dos frases distintas de la misma persona el mismo dia, y una olvidaria la fecha.
      */}
      <ul className="mt-[10px] mb-0 list-none p-0">
        {situacion.municipalidades.map((municipalidad) => (
          <li key={municipalidad.ubigeo} className="mt-[6px] text-[14.5px] leading-[1.6] text-pretty">
            <span className="font-bold">{municipalidad.nombre}</span>
            {` · ${municipalidad.saldos.estadoDeLaConsulta}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El hueco del desglose: lo que el contrato no trae, dicho y no rellenado. */
function SinDesglose() {
  const { t } = useTranslation();
  return (
    <div className="border-t border-linea-2 bg-sup px-5 pt-[14px] pb-4">
      <p className="m-0 max-w-[72ch] text-[14px] leading-[1.6] text-pretty text-tinta-2">
        {t('El portal no publica el desglose de este concepto.')}
      </p>
      <p className="mt-[7px] mb-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-pretty text-tinta-3">
        {t(
          'El servidor da el saldo del tributo entero: cuántas cuotas son, cuándo vence cada una y qué servicios componen el arbitrio no viajan en la respuesta. En la ventanilla de la municipalidad se lo detallan.',
        )}
      </p>
    </div>
  );
}

/**
 * Un concepto del servidor: se marca, se abre y no se le inventa nada. Donde el artboard pone la
 * insignia de estado y la linea del vencimiento no va nada: el contrato no trae ninguna de las dos, y
 * no se deducen.
 */
export function ConceptoDelServidor({ deuda }: { readonly deuda: DeudaDelServidor }) {
  const { t } = useTranslation();

  return (
    <FilaDeConcepto
      id={deuda.id}
      concepto={deuda.concepto}
      // `unidad` es mixto: o el predio de verdad —dato, y `t()` lo devuelve tal cual— o una de las
      // tres frases que redacta el adaptador, que SI son texto del portal (`clavesDeLaUnidad`).
      linea={t(deuda.unidad)}
      cifra={
        <Cifra
          valor={totalDe(deuda)}
          aLaFecha={fechaDelImporte(deuda, 'insoluto')}
          conSuFecha
          peso="negrita"
          className="block text-[19px]"
        />
      }
    >
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(178px,1fr))] border-t border-linea-2 bg-sup p-0 max-[521px]:grid-cols-2">
        {componentesDelSaldo(deuda, t).map((componente) => (
          <li key={componente.rotulo} className="-mt-px -ml-px border-t border-l border-linea-2 px-[18px] py-[13px]">
            <p className="m-0 text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{componente.rotulo}</p>
            <Cifra
              valor={componente.valor}
              aLaFecha={componente.fecha}
              conSuFecha
              className="mt-[5px] block text-[16px]"
            />
          </li>
        ))}
      </ul>
      <SinDesglose />
    </FilaDeConcepto>
  );
}
