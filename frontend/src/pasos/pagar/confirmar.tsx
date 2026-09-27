import { Boton, avisar, cn } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import { botonApagado } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { alConfirmar } from './vista.ts';

/**
 * **Confirmar, que es lo unico que los dos paneles comparten**: el del artboard y el que se dibuja con
 * plataforma, donde no hay medio que elegir. Que se avisa y si se sella lo decide `alConfirmar`
 * (`vista.ts`); aqui se despacha y se avisa.
 */
export function useConfirmarElPago(): { readonly nada: boolean; readonly confirmar: () => void } {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const { nada, aviso } = alConfirmar(estado, t);

  return {
    nada,
    confirmar: () => {
      if (!nada) despachar({ tipo: 'confirmarPago' });
      avisar(aviso);
    },
  };
}

/**
 * El boton verde de confirmar, con las medidas y el color del artboard: `--ok-tinta` de fondo y
 * `--sobre-azul` de texto (5.45:1 en claro y 12.12:1 en oscuro; calculados en
 * `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`). Sin nada que pagar, apagado
 * (`botonApagado`) y sin oscurecerse al pasar.
 */
export function BotonDeConfirmar({
  rotulo,
  nada,
  alConfirmar: confirmar,
}: {
  readonly rotulo: string;
  readonly nada: boolean;
  readonly alConfirmar: () => void;
}) {
  return (
    <Boton
      type="button"
      variante="primario"
      aria-disabled={nada}
      onClick={confirmar}
      className={cn(
        // El verde del artboard es `--ok-tinta`; su hover (`#326032`) no es token: se oscurece el mismo.
        'min-h-[48px] px-7 py-0 text-[16px] bg-ok-tinta hover:bg-ok-tinta hover:brightness-90',
        // `Boton` no parte el texto (`whitespace-nowrap`), y «Simular el pago: no se cobra nada» mide
        // 356 px: a 320 se salia de la pagina (issue 62). Parte solo cuando no cabe.
        'max-w-full whitespace-normal',
        botonApagado({ apagado: nada }),
        nada && 'hover:brightness-100',
      )}
    >
      {rotulo}
    </Boton>
  );
}
