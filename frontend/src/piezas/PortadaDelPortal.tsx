import { Icono } from '@kamayuk/ui';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { ORDENANZA } from '../datos/demostracion.ts';
import { TRAZOS_DEL_ARTBOARD, type TrazoDelArtboard } from '../pasos/buscar/trazos.ts';
import { useRecorrido } from '../recorrido/ProveedorDelRecorrido.tsx';
import { AvisoConFilo } from './AvisoConFilo.tsx';

/**
 * **Lo que dice la portada del portal, diga lo que diga el primer paso** (issue 28).
 *
 * Son las dos piezas del paso 1 que **no** dependen de como se llegue a la deuda: «Qué puede hacer
 * aquí» (artboard, lineas 154-178) y el aviso de la amnistia (lineas 168-178 del bloque de abajo).
 * Estaban dentro de `src/pasos/buscar/Buscar.tsx`, que con plataforma ya no se dibuja: el primer
 * paso es «Entrar». El issue pide que esa pantalla las CONSERVE, asi que viven aqui y las dos
 * pantallas las usan.
 *
 * Copiarlas en la pantalla nueva habria sido mas corto y habria dejado dos textos del artboard que
 * el dia que uno se retoque dejan de decir lo mismo en las dos puertas de entrada del portal.
 *
 * <h2>Con plataforma, lo que el portal sabe hacer DE VERDAD (issue 49)</h2>
 *
 * Las cuatro capacidades del artboard prometen lo que con plataforma no hay: pagar en linea con
 * tarjeta o Yape, descargar comprobantes, el vencimiento de cada cuota, el autovaluo y los metros de
 * frontis. Y el aviso de la amnistia anuncia un descuento que el contrato no trae. Con plataforma se
 * dice lo que si hace, y la amnistia sale solo si la fuente la aporta (`estado.amnistia`).
 */

/** Lo que el portal sabe hacer, con su trazo: `lupa` es de la libreria, los demas del artboard. */
interface Capacidad {
  readonly titulo: string;
  readonly detalle: string;
  readonly icono: 'lupa' | TrazoDelArtboard;
}

function IconoDeCapacidad({ icono }: { readonly icono: Capacidad['icono'] }): ReactNode {
  if (icono === 'lupa') return <Icono nombre="lupa" tamano={15} grosor={1.9} />;
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS_DEL_ARTBOARD[icono].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * «Qué puede hacer aquí»: las cuatro capacidades del portal, al pie de la tarjeta del paso 1.
 *
 * **Es un `h2` y una lista**; en el artboard, un `p` y cuatro `div`. Se ve igual y se recorre por
 * encabezados.
 */
export function QuePuedeHacerAqui() {
  const { t } = useTranslation();
  const idDeCapacidades = useId();

  const { estado } = useRecorrido();

  const capacidades: readonly Capacidad[] = estado.conPlataforma
    ? [
        {
          titulo: t('Ver lo que debe'),
          detalle: t('Lo que debe en cada municipalidad del sistema, por tributo y año, con la fecha de cada importe.'),
          icono: 'lupa',
        },
        {
          titulo: t('Ver sus predios'),
          detalle: t('Los predios que figuran a su nombre, con su código catastral.'),
          icono: 'detalle',
        },
        {
          titulo: t('Pagar en la ventanilla'),
          detalle: t('El pago en línea todavía no está disponible: se paga con su documento en la municipalidad.'),
          icono: 'pagar',
        },
      ]
    : [
        {
          titulo: t('Ver lo que debe'),
          detalle: t('Su impuesto predial, arbitrios y vehicular, con el vencimiento de cada cuota.'),
          icono: 'lupa',
        },
        {
          titulo: t('Pagar en línea'),
          detalle: t('Con tarjeta, Yape, pagalo.pe o un código para el banco.'),
          icono: 'pagar',
        },
        {
          titulo: t('Descargar comprobantes'),
          detalle: t('El del pago que acaba de hacer y los de años anteriores.'),
          icono: 'recibo',
        },
        {
          titulo: t('Saber de dónde sale'),
          detalle: t('El autovalúo de su predio, los metros de frontis y la tabla que se le aplica.'),
          icono: 'detalle',
        },
      ];

  return (
    <section aria-labelledby={idDeCapacidades} className="border-t border-linea-2 bg-sup px-[26px] pt-[18px] pb-5">
      <h2 id={idDeCapacidades} className="m-0 mb-3 text-[13px] font-bold tracking-[0.08em] text-tinta-3 uppercase">
        {t('Qué puede hacer aquí')}
      </h2>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(232px,1fr))] gap-0 p-0">
        {capacidades.map((capacidad) => (
          <li key={capacidad.icono} className="mr-[18px] border-t border-linea pt-[14px] pr-[18px] pb-4">
            <span className="mb-[6px] flex items-center gap-[9px]">
              <span className="grid size-7 flex-[0_0_auto] place-items-center rounded-sm bg-azul-suave text-azul">
                <IconoDeCapacidad icono={capacidad.icono} />
              </span>
              <span className="text-[14.5px] font-bold">{capacidad.titulo}</span>
            </span>
            <span className="block text-[13.5px] leading-[1.55] text-pretty text-tinta-3">{capacidad.detalle}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** El aviso de la amnistia, debajo de la tarjeta del paso 1. */
export function AvisoDeAmnistia() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  // Solo si la fuente aporta una amnistia: con plataforma el contrato no trae ninguna (issue 49).
  if (!estado.amnistia) return null;

  return (
    <AvisoConFilo tono="atencion" className="mt-[18px] px-[18px] py-[15px] leading-[1.6]">
      <strong>{t('Amnistía vigente hasta el 31 de diciembre.')}</strong>{' '}
      {t(
        'La {{ordenanza}} condona el 100 % del interés moratorio. Al pagar ahora, el descuento se aplica solo: no hay que solicitarlo.',
        { ordenanza: ORDENANZA },
      )}
    </AvisoConFilo>
  );
}
