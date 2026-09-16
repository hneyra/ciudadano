import { avisar, cn } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import { useRecorrido } from '../recorrido/ProveedorDelRecorrido.tsx';
import { type PasoNumerado, indiceDelPaso, pasoAlcanzable, pasosNumerados } from '../recorrido/recorrido.ts';

/**
 * **La franja de pasos** (`diseno/Ciudadano.dc.html`, lineas 103-116, 1018-1022 y 1064-1078).
 *
 * El ciudadano ve siempre en que punto esta y cuanto le falta; los pasos ya hechos se pueden volver
 * a abrir, y uno futuro no: avisa «Complete primero los pasos anteriores.». Quien decide que se
 * puede abrir es `pasoAlcanzable`, no esta pieza. En el historial no se dibuja (lo decide `Marco`).
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · **Los futuros no son `#AAA` ni su numero `#999` sobre `#EEE`.** Dan 2.32:1 sobre blanco y
 *   2.46:1, lejos del 4.5:1 de WCAG 1.4.3, y un paso futuro se lee (y se pulsa). `#999` es ademas `--tinta-4`, que la
 *   libreria declara «no es color de texto». Etiqueta y numero van en `--tinta-3`, la tinta mas tenue
 *   que se lee; el numero, sobre `--linea-2` (el `#EEE`). Lo dice la tabla de
 *   `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 * · **La etiqueta, oculta a ≤ 880 px como en el artboard, sigue siendo el nombre accesible**: va
 *   tambien en el `aria-label` del boton, que si no a esa anchura se llamaria «1».
 *
 * <h2>La franja se renumera con el recorrido (issue 28)</h2>
 *
 * Los pasos salen de `pasosNumerados(estado)`: cinco en demostracion y **cuatro con plataforma**
 * —«Entrar · Elegir qué pago · Pagar · Comprobante»—. Los numeros son la posicion en esa lista, asi
 * que «Pagar» es el 4 en un recorrido y el 3 en el otro sin que aqui se escriba ningun numero.
 *
 * Y hay un paso HECHO que no se puede volver a abrir, que en demostracion no existia: «Entrar», una
 * vez se entro. Por eso el aviso se elige: el de siempre habla de completar los pasos anteriores, y
 * ahi no falta ninguno.
 */
export function FranjaDePasos() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const actual = indiceDelPaso(estado, estado.paso);

  const etiquetas: Readonly<Record<PasoNumerado, string>> = {
    entrar: t('Entrar'),
    buscar: t('Buscar mi deuda'),
    deudas: t('Elegir qué pago'),
    identificar: t('Mis datos'),
    pagar: t('Pagar'),
    comprobante: t('Comprobante'),
  };

  return (
    <nav data-noprint="1" className="border-b border-linea bg-superficie">
      <div className="mx-auto flex max-w-[1020px] flex-wrap items-stretch px-[18px]">
        {pasosNumerados(estado).map((paso, i) => {
          const esActual = i === actual;
          const hecho = i < actual;
          const alcanzable = pasoAlcanzable(estado, paso);
          return (
            <button
              key={paso}
              type="button"
              aria-current={esActual ? 'step' : undefined}
              aria-label={etiquetas[paso]}
              onClick={() => {
                if (alcanzable) despachar({ tipo: 'irA', paso });
                else if (hecho) avisar(t('Ese paso ya está hecho y no hace falta repetirlo.'));
                else avisar(t('Complete primero los pasos anteriores.'));
              }}
              className={cn(
                'flex min-h-[48px] items-center gap-[9px] border-0 border-b-[3px] bg-transparent px-[15px] text-[14px]',
                esActual ? 'border-azul font-bold text-tinta' : 'border-transparent font-normal',
                !esActual && (hecho ? 'text-tinta-2' : 'text-tinta-3'),
                alcanzable ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-[12.5px] font-bold',
                  esActual ? 'bg-azul text-sobre-azul' : hecho ? 'bg-ok-fondo text-ok-tinta' : 'bg-linea-2 text-tinta-3',
                )}
              >
                {i + 1}
              </span>
              <span className="whitespace-nowrap max-[881px]:hidden">{etiquetas[paso]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
