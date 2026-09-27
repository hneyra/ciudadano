import type { Fecha } from '@kamayuk/formato';
import { Boton, Casilla, CuerpoDelPlegable, Plegable, avisar, cn } from '@kamayuk/ui';
import { Collapsible } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Cifra } from '../../piezas/Cifra.tsx';
import { bandaConFilo, botonApagado } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { estaMarcada } from '../../recorrido/recorrido.ts';
import { type QuienEsDicho, estaTodoMarcado, laBarraDePago } from './vista.ts';

/**
 * **Lo que el paso 2 dibuja igual en los dos modos** (issue 60).
 *
 * Hasta el issue 60, `Deudas.tsx` (la demostracion) y `LaConsulta.tsx` (la plataforma) repetian 106
 * lineas de codigo literales: quien es, la cabecera de la lista, la fila de un concepto, la barra de
 * pago y el bloque de «No le queda nada por pagar». Y ya habian empezado a divergir: la barra
 * preguntaba por la amnistia de dos formas distintas. Aqui estan una vez; lo que cada modo pone
 * dentro —el desglose del artboard o el hueco del servidor, una cifra con su fecha o sin ella— se lo
 * pasa quien las usa.
 *
 * <h2>Las piezas de `@kamayuk/ui`, y lo que se les ajusta</h2>
 *
 * · **`Casilla`** para marcar. Trae la marca dentro de una caja con filo, que es la de la rejilla de
 *   V8; el artboard dibuja la marca suelta, de 20 px, en una etiqueta de 44 px de alto. La caja se
 *   deja sin filo, sin relleno y sin papel apuntando a su `data-slot="casilla-caja"`, que es para lo que
 *   la libreria pone el `data-slot` («que una pantalla pueda apuntar a la pieza sin depender de una
 *   clase», `shadcn/boton.tsx`).
 * · **`Plegable` y `CuerpoDelPlegable`** para «Ver el detalle» (issue 60): el `aria-expanded`, el
 *   `aria-controls` y el cuerpo que solo se monta abierto son los suyos, y no una copia a mano. Quien
 *   esta abierto lo sigue decidiendo el reductor (`abierta`, uno a la vez), asi que el plegable va
 *   controlado. El disparador NO es `DisparadorDelPlegable`: ese es la fila del arbol del armazon
 *   (ancho completo, papel al pasar); el del artboard es un enlace subrayado dentro de la cifra. Asi
 *   que se usa el `Trigger` de Radix —el mismo que hay debajo de `DisparadorDelPlegable`— sobre el
 *   `Boton` fantasma de siempre.
 * · **`Boton`** para todas las acciones, con las medidas del artboard encima.
 */

/** Quien es, para que no pague la deuda de otro (artboard, lineas 186-193). La accion, si la hay, al lado. */
export function QuienEs({ quien, children }: { readonly quien: QuienEsDicho; readonly children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-4 border border-linea bg-superficie px-5 py-4">
      <span className="min-w-[200px] flex-1">
        <span className="block text-[12.5px] text-tinta-3">{t('Contribuyente')}</span>
        <span className="mt-[2px] block text-[17px] font-bold text-pretty">{quien.nombre}</span>
        <span className="mt-[2px] block text-[13.5px] text-tinta-3">{quien.linea}</span>
      </span>
      {children}
    </div>
  );
}

/** La lista de conceptos, con su titulo y «Marcar todo» (lineas 220-226). */
export function ListaDeConceptos({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();

  return (
    <section className="mb-[18px] border border-t-0 border-linea bg-superficie">
      <div className="flex flex-wrap items-center gap-3 border-b border-linea-2 px-5 py-[14px]">
        <h1 className="m-0 min-w-[180px] flex-1 text-[17px] font-bold">{t('Lo que debe, por concepto')}</h1>
        <Boton
          type="button"
          onClick={() => despachar({ tipo: 'marcarTodo' })}
          className="min-h-[38px] flex-[0_0_auto] px-[14px] py-0 text-[13.5px]"
        >
          {estaTodoMarcado(estado) ? t('Quitar todo') : t('Marcar todo')}
        </Boton>
      </div>
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  );
}

/**
 * **Un concepto de la lista** (lineas 228-281): se marca, se abre y dice lo que cuesta.
 *
 * Lo que cada modo sabe de el va dentro: la linea de debajo del nombre (`linea`), lo que el artboard
 * pone bajo ella —insignia y vencimiento, que el servidor no trae— (`debajo`), la cifra de la derecha
 * (`cifra`) y lo que se ve al abrirlo (`children`).
 */
export function FilaDeConcepto({
  id,
  concepto,
  linea,
  debajo,
  cifra,
  cuerpo,
  children,
}: {
  readonly id: string;
  readonly concepto: string;
  readonly linea: string;
  readonly debajo?: ReactNode;
  readonly cifra: ReactNode;
  /** Las clases del cuerpo que se abre. */
  readonly cuerpo?: string;
  readonly children: ReactNode;
}) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const marcada = estaMarcada(estado, id);
  const abierta = estado.abierta === id;

  return (
    <Plegable asChild open={abierta} onOpenChange={() => despachar({ tipo: 'abrirDetalle', id })}>
      <li
        data-marcada={marcada ? 'true' : 'false'}
        className={cn(
          'border-b border-l-4 border-b-linea-2',
          marcada ? 'border-l-azul bg-sup' : 'border-l-transparent bg-superficie',
        )}
      >
        <div className="flex flex-wrap items-start gap-[14px] px-5 py-[15px]">
          <span className="flex min-h-[44px] flex-[0_0_auto] items-center [&_[data-slot=casilla-caja]]:border-0 [&_[data-slot=casilla-caja]]:bg-transparent [&_[data-slot=casilla-caja]]:p-0">
            <Casilla
              checked={marcada}
              onCheckedChange={() => despachar({ tipo: 'alternar', id })}
              aria-label={t('Pagar {{concepto}}', { concepto })}
              className="size-5 cursor-pointer"
            />
          </span>
          <span className="min-w-0 flex-[1_1_260px]">
            <span className="block text-[16px] font-bold text-pretty">{concepto}</span>
            <span className="mt-[3px] block text-[13.5px] text-pretty text-tinta-3">{linea}</span>
            {debajo}
          </span>
          <span className="min-w-[132px] flex-[0_0_auto] text-right">
            {cifra}
            <Collapsible.Trigger asChild>
              <Boton
                type="button"
                variante="fantasma"
                className="mt-[7px] min-h-[34px] p-0 text-[13.5px] underline hover:bg-transparent"
              >
                {abierta ? t('Ocultar el detalle') : t('Ver el detalle')}
              </Boton>
            </Collapsible.Trigger>
          </span>
        </div>
        <CuerpoDelPlegable className={cuerpo}>{children}</CuerpoDelPlegable>
      </li>
    </Plegable>
  );
}

/**
 * **La barra de pago**: lo elegido y el boton, siempre a la vista (lineas 284-299), en los dos modos.
 *
 * `aLaFecha` es la fecha de corte del recorrido: la del artboard en demostracion, la que el servidor
 * puso en la respuesta con plataforma. Va **implicita**: esta suma junta importes de varios
 * conceptos, cada uno con la suya, y ensenar una de ellas como si fuera la del total seria decir algo
 * que nadie dijo.
 *
 * El boton sin nada marcado se pinta apagado (`botonApagado`) y sigue siendo pulsable: avisa. La
 * ayuda «Marque al menos un concepto…» (linea 298) sale solo si queda deuda: sin deuda viva no se
 * dibuja la barra.
 */
export function BarraDePago({ aLaFecha }: { readonly aLaFecha?: Fecha }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const barra = laBarraDePago(estado, t);

  const pagar = () => {
    if (barra.vacio) {
      avisar(t('Marque al menos un concepto para poder pagar.'));
      return;
    }
    // A donde lleva —«Mis datos» o pagar— lo decide el reductor (issue 61).
    despachar({ tipo: 'confirmarEleccion' });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-[18px] border border-t-[3px] border-linea border-t-azul bg-superficie px-5 py-[18px]">
        <span className="min-w-[200px] flex-1">
          <span className="block text-[13.5px] text-tinta-3">{barra.detalle}</span>
          <Cifra
            valor={barra.total}
            aLaFecha={aLaFecha}
            peso="negrita"
            className="mt-[3px] block text-[27px] [&_span]:text-azul"
          />
          {barra.amnistia === null ? null : (
            <span className="mt-[3px] block text-[13.5px] text-ok-tinta">{barra.amnistia}</span>
          )}
        </span>
        <Boton
          type="button"
          variante="primario"
          aria-disabled={barra.vacio}
          onClick={pagar}
          className={cn('min-h-[52px] flex-[0_0_auto] px-8 py-0 text-[17px]', botonApagado({ apagado: barra.vacio }))}
        >
          {barra.rotulo}
        </Boton>
      </div>
      {barra.vacio ? (
        <p className="mt-3 mb-0 text-[14px] text-pretty text-tinta-3">
          {t('Marque al menos un concepto para continuar. Puede pagar todo de una vez o solo lo que le venza primero.')}
        </p>
      ) : null}
    </>
  );
}

/**
 * Un bloque con su titulo: los finales de la consulta y «No le queda nada por pagar». La banda con
 * filo de su tono (`bandaConFilo`); el margen, quien lo usa.
 */
export function Bloque({
  titulo,
  tono = 'neutro',
  className,
  children,
}: {
  readonly titulo: string;
  readonly tono?: 'neutro' | 'ok' | 'mal' | 'atencion';
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={cn(bandaConFilo({ tono }), 'px-[22px] py-5', className)}>
      <h1 className={cn('m-0 text-[18px] font-bold', tono === 'ok' && 'text-ok-tinta')}>{titulo}</h1>
      {children}
    </section>
  );
}

/** Un parrafo del cuerpo de un bloque, con la medida del artboard para el texto corrido. */
export function Parrafo({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return (
    <p className={cn('mt-[7px] mb-0 max-w-[66ch] text-[14.5px] leading-[1.6] text-pretty', className)}>{children}</p>
  );
}
