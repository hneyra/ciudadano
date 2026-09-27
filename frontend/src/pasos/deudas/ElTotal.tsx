import { useTranslation } from 'react-i18next';

import { Cifra } from '../../piezas/Cifra.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { elTotal } from './vista.ts';

/**
 * **El total, arriba** (artboard, lineas 197-208), **y las cuatro cifras que lo componen** (210-218).
 * Solo en demostracion: con plataforma el total es el que sumo el servidor (`LoQueSumoElServidor`).
 *
 * Lo primero que se ve es el total, porque es lo que se viene a saber. Las cifras salen de `resumen`
 * (la deuda viva), por `elTotal` de `vista.ts`; aqui no se suma nada. `Importe` pinta su numero en
 * `--tinta`; donde el artboard lo quiere blanco o verde se le cambia desde fuera con un selector de
 * descendiente sobre tokens (`[&_span]:text-sobre-azul`), sin tocar la pieza.
 *
 * A ≤ 520 px, las cuatro de dos en dos (linea 41): `max-[521px]`, porque Tailwind v4 emite
 * `max-[520px]` como `width < 520px`.
 */
export function ElTotal() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const total = elTotal(estado, t);

  return (
    <>
      <div
        data-banda-del-total=""
        className="flex flex-wrap items-end gap-[26px] bg-azul px-5 py-[22px] text-sobre-azul"
      >
        <span className="min-w-[200px] flex-1">
          <span className="block text-[12.5px] tracking-[0.09em] text-sobre-barra-2 uppercase">{total.alDia}</span>
          <Cifra
            valor={total.total}
            peso="negrita"
            className="mt-[5px] block text-[34px] leading-[1.1] tracking-[-0.02em] [&_span]:text-sobre-azul"
          />
          <span className="mt-[6px] block text-[13.5px] text-pretty text-sobre-barra-2">{total.vencidas}</span>
        </span>
        <span className="flex-[0_0_auto]">
          <span className="block text-[12.5px] tracking-[0.09em] text-sobre-barra-2 uppercase">
            {t('Con la amnistía')}
          </span>
          <Cifra valor={total.conAmnistia} peso="negrita" className="mt-1 block text-[24px] [&_span]:text-sobre-azul" />
          <span className="mt-[3px] block text-[12.5px] text-sobre-barra-2">{total.descuento}</span>
        </span>
      </div>

      <ul
        data-cifras=""
        className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(162px,1fr))] overflow-hidden border border-t-0 border-linea bg-superficie p-0 max-[521px]:grid-cols-2"
      >
        {total.cuatro.map(({ rotulo, valor, nota }) => (
          <li
            key={rotulo}
            className="-mt-px -ml-px border-t border-l border-linea-2 bg-superficie px-[18px] py-[15px]"
          >
            <p className="m-0 text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{rotulo}</p>
            <div className="mt-[6px] text-[20px]">
              {'importe' in valor ? (
                <Cifra
                  valor={valor.importe}
                  peso="negrita"
                  className={valor.verde ? 'block [&_span]:text-ok-tinta' : 'block'}
                />
              ) : (
                <span className="block font-bold text-tinta tabular-nums">{valor.cuantos}</span>
              )}
            </div>
            <p className="mt-1 mb-0 text-[12.5px] text-pretty text-tinta-3">{nota}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
