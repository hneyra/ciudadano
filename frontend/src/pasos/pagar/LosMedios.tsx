import { cn } from '@kamayuk/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { MedioDePago } from '../../datos/tipos.ts';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { laDemostracion } from '../../recorrido/recorrido.ts';
import { PanelDelMedio } from './PanelDelMedio.tsx';
import { medioDe } from './textosDeLosMedios.ts';

/**
 * **El paso 4 del artboard: los cuatro medios y el panel del elegido** (lineas 356-445).
 *
 * **El selector de medio** no tiene pieza en `@kamayuk/ui`: son `<button aria-pressed>` con `cn` y
 * tokens. Su nombre accesible es el rotulo, y la nota lo describe (`aria-describedby`). El medio
 * activo tiene papel `--azul-suave`, como pide el issue 8, y no el `#F0F6FB` del artboard (que es
 * `--info-fondo`, el papel de los avisos informativos). A ≤ 520 px, en una columna: `max-[521px]`,
 * por lo mismo que el resumen.
 */

/** El icono de un medio: sus trazos, en una caja de 30 px (artboard, lineas 367-373 y 1210). */
function IconoDelMedio({ trazos, activo }: { readonly trazos: readonly string[]; readonly activo: boolean }) {
  return (
    <span
      className={cn(
        'grid size-[30px] flex-[0_0_auto] place-items-center rounded-sm',
        activo ? 'bg-azul text-sobre-azul' : 'bg-fondo text-tinta-3',
      )}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {trazos.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

/** Un boton del selector (lineas 365-377 y 1204-1214). */
function BotonDeMedio({ medio }: { readonly medio: MedioDePago }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const id = useId();
  const activo = estado.medio === medio.id;

  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-labelledby={`${id}-rotulo`}
      aria-describedby={`${id}-nota`}
      onClick={() => despachar({ tipo: 'elegirMedio', medio: medio.id })}
      className={cn(
        'block min-h-[88px] w-full cursor-pointer rounded-sm text-left',
        activo ? 'border-2 border-azul bg-azul-suave px-[14px] py-[13px]' : 'border border-linea bg-superficie px-[15px] py-[14px]',
      )}
    >
      <span className="flex items-center gap-[10px]">
        <IconoDelMedio trazos={medio.icono} activo={activo} />
        <span id={`${id}-rotulo`} className="min-w-0 flex-1 text-left text-[15px] font-bold">
          {t(medio.rotulo)}
        </span>
      </span>
      <span id={`${id}-nota`} className="mt-[7px] block text-left text-[13px] leading-[1.5] text-pretty text-tinta-3">
        {t(medio.nota)}
      </span>
    </button>
  );
}

export function LosMedios() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  // Los cuatro del artboard, que llegan con la demostracion (issue 58): con plataforma no se ofrece
  // ninguno, y el numero para yapear o los codigos de pago no pueden viajar en ese paquete.
  const { medios } = laDemostracion(estado);
  const medio = medioDe(medios, estado.medio);

  return (
    <>
      <h1 className="m-0 mb-[6px] text-[24px] font-bold text-pretty text-azul">{t('¿Cómo quiere pagar?')}</h1>
      <p className="mt-0 mb-[18px] max-w-[62ch] text-[15.5px] leading-[1.6] text-pretty text-tinta-2">
        {t(
          'Elija un medio de pago. Con tarjeta, Yape o pagalo.pe el pago se aplica al instante; con código de banco se aplica al día siguiente hábil.',
        )}
      </p>

      <div
        data-medios=""
        className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-3 max-[521px]:grid-cols-[minmax(0,1fr)]"
      >
        {medios.map((m) => (
          <BotonDeMedio key={m.id} medio={m} />
        ))}
      </div>

      <PanelDelMedio medio={medio} />
    </>
  );
}
