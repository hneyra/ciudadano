import {
  CONTORNO_DE_FOCO_EN_LA_BARRA,
  DisparadorDelMenu,
  Icono,
  ListaDelMenu,
  Menu,
  OpcionDelMenu,
  avisar,
  cn,
} from '@kamayuk/ui';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import escudo from '../../diseno/escudo-catacaos.png';
import { USUARIO } from '../datos/demostracion.ts';
import { useRecorrido } from '../recorrido/ProveedorDelRecorrido.tsx';
import { inicio } from '../recorrido/recorrido.ts';

/**
 * **La barra del portal**: la marca y la sesion (`diseno/Ciudadano.dc.html`, lineas 59-101 y 1046-1061).
 *
 * <h2>Lo que se toma de `@kamayuk/ui`</h2>
 *
 * · El **menu** de la sesion es `Menu` (Radix `DropdownMenu`): trae el `aria-expanded` del
 *   disparador, el foco dentro de la lista, `Escape` y el cierre al pulsar fuera, que en el artboard
 *   son un velo fijo (linea 56) y un `menuSesion` en el estado. «Cerrar sesión» es su opcion
 *   `peligrosa`, que la pinta en `--mal-tinta` (el `ROJO_FG` de la linea 1059).
 * · El chevron es `Icono`. El icono de «Iniciar sesión» no esta en `ICONOS`, y se dibuja aqui con los
 *   trazos de la linea 72.
 * · El **contorno de foco** es `CONTORNO_DE_FOCO_EN_LA_BARRA` y no el `--azul` del resto de la
 *   pagina: esta barra ES `--azul`, y un contorno azul sobre ella no se ve. La libreria ya mide ese
 *   caso (`shadcn/foco.ts`).
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · Los tres velos blancos son los tokens `--barra-control`, `--barra-realce` y `--barra-hover`, mas
 *   tenues que los del artboard por contraste (fila «velo…» de
 *   `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`). El filo izquierdo del disparador,
 *   blanco al 25 % en el artboard, es `--barra-realce`, como en la barra de `@kamayuk/shell`.
 * · El filo de «Iniciar sesión», blanco al 40 % en el artboard, no es token: es `--sobre-barra` con
 *   la opacidad de Tailwind, que no escribe ningun color.
 * · Los grises de la cabecera del menu (`#777`) son `--tinta-3`, el azul de enlace de las opciones
 *   (`AZUL_TXT`) es `--azul` y su hover (`#F6F9FC`) es `--sup`: ninguno de los tres tiene token propio.
 * · El nombre y el documento del disparador, ocultos a ≤ 880 px en el artboard, pasan a `sr-only`:
 *   la vista es la misma y el boton no se queda con «MC» por todo nombre accesible.
 * · **«Iniciar sesión» NO desaparece a ≤ 880 px** (nota del revisor del issue 11). El artboard lo
 *   oculta entero (`data-sm-hide`), y entonces en un celular no hay forma de entrar a la cuenta salvo
 *   en mitad de un pago. Se queda **solo con su icono**: el texto pasa a `sr-only` —el boton se sigue
 *   llamando «Iniciar sesión»— y el boton mide 44×44 px, el area tactil minima (WCAG 2.5.5). Lo mide
 *   `Barra.test.tsx` y, en Chromium a 400 px, `e2e/recorrido-con-sesion.spec.ts`.
 *
 * <h2>«Mis predios y vehículos»</h2>
 *
 * Lleva al mismo `#/historial` que «Mis pagos», como el artboard (lineas 1052-1053), pero pidiendo al
 * historial que deje el foco en «De dónde sale lo que paga» (`verPrediosYVehiculos`, issue 10).
 *
 * El pedido sale **cuando el menu ya se cerro** (`onCloseAutoFocus`), y no al elegir la opcion. Mientras
 * esta abierto, el menu de Radix atrapa el foco: medido estando ya en el historial, el titulo enfocado
 * al elegir lo perdia y el foco acababa en `body`. Y al cerrarse, Radix devuelve el foco a su disparador;
 * esa vez no se le deja, o se lo quitaria a la seccion.
 *
 * `max-[881px]` y no `max-[880px]`: Tailwind v4 lo emite como `width < 881px`, que es el
 * `max-width: 880px` del artboard.
 */
/**
 * «Iniciar sesión» a ≤ 880 px: sin relleno, 44×44 px y el icono en el centro. El texto va aparte, en
 * `sr-only` a esa anchura. Exportado para que `Barra.test.tsx` lo compare con lo que el boton lleva.
 */
export const ICONO_SOLO_EN_EL_CELULAR =
  'max-[881px]:my-[6px] max-[881px]:size-[44px] max-[881px]:justify-center max-[881px]:gap-0 max-[881px]:px-0';

export function Barra() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  // Se lee cuando el menu ya se cerro: un `ref`, y no el estado de un dibujo que ya no es el ultimo.
  const elFocoVaALasUnidades = useRef(false);

  return (
    <header data-noprint="1" className="relative z-[79] flex flex-wrap items-stretch bg-azul text-sobre-azul">
      <button
        type="button"
        onClick={() => despachar({ tipo: 'irA', paso: inicio(estado) })}
        className={cn(
          'flex min-w-0 flex-auto cursor-pointer items-center gap-3 border-0 bg-transparent px-[18px] py-[10px] text-left text-sobre-azul',
          CONTORNO_DE_FOCO_EN_LA_BARRA,
        )}
      >
        <img src={escudo} alt="" width={30} height={36} className="block h-[36px] w-auto shrink-0" />
        <span className="min-w-0 leading-[1.2]">
          <span className="block truncate text-[17px] font-bold">{t('Pago de tributos en línea')}</span>
          <span className="block truncate text-[11.5px] text-sobre-barra-2">
            {t('Municipalidad Distrital de Catacaos')}
          </span>
        </span>
      </button>

      {estado.autenticado ? (
        <Menu>
          <DisparadorDelMenu
            className={cn(
              'flex shrink-0 cursor-pointer items-center gap-[10px] border-0 border-l border-barra-realce bg-transparent px-4 py-2 text-sobre-azul',
              'hover:bg-barra-hover data-[state=open]:bg-barra-hover',
              CONTORNO_DE_FOCO_EN_LA_BARRA,
            )}
          >
            <span
              aria-hidden="true"
              className="grid size-[30px] shrink-0 place-items-center rounded-full bg-barra-realce text-[12px] font-bold"
            >
              {USUARIO.iniciales}
            </span>
            <span className="text-left leading-[1.2] max-[881px]:sr-only">
              <span className="block whitespace-nowrap text-[13.5px] font-bold">{USUARIO.nombre}</span>
              <span className="block whitespace-nowrap text-[11.5px] text-sobre-barra-2">
                {`${USUARIO.tipoDeDocumento} ${USUARIO.numeroDeDocumento}`}
              </span>
            </span>
            <Icono nombre="chevronAbajo" tamano={12} grosor={2.6} />
          </DisparadorDelMenu>
          <ListaDelMenu
            className="w-[min(270px,calc(100vw-24px))]"
            onCloseAutoFocus={(evento) => {
              if (!elFocoVaALasUnidades.current) return;
              elFocoVaALasUnidades.current = false;
              evento.preventDefault();
              despachar({ tipo: 'verPrediosYVehiculos' });
            }}
          >
            <div className="border-b border-linea-2 px-4 py-3 text-left">
              <p className="m-0 text-[14px] font-bold text-tinta">{USUARIO.nombre}</p>
              <p className="mt-[3px] mb-0 text-[12.5px] text-tinta-3">
                {t('Contribuyente {{codigo}}', { codigo: USUARIO.codigo })}
              </p>
              <p className="mt-[2px] mb-0 text-[12.5px] text-tinta-3">{USUARIO.correo}</p>
            </div>
            <OpcionDelMenu className="px-4 py-3 text-[14.5px]" onSelect={() => despachar({ tipo: 'irA', paso: 'historial' })}>
              {t('Mis pagos')}
            </OpcionDelMenu>
            <OpcionDelMenu
              className="px-4 py-3 text-[14.5px]"
              onSelect={() => {
                elFocoVaALasUnidades.current = true;
                despachar({ tipo: 'irA', paso: 'historial' });
              }}
            >
              {t('Mis predios y vehículos')}
            </OpcionDelMenu>
            <OpcionDelMenu className="px-4 py-3 text-[14.5px]" onSelect={() => avisar(t('Abriría el cambio de clave.'))}>
              {t('Cambiar mi clave')}
            </OpcionDelMenu>
            <OpcionDelMenu
              peligrosa
              className="px-4 py-3 text-[14.5px]"
              onSelect={() => {
                despachar({ tipo: 'cerrarSesion' });
                avisar(t('Sesión cerrada.'));
              }}
            >
              {t('Cerrar sesión')}
            </OpcionDelMenu>
          </ListaDelMenu>
        </Menu>
      ) : (
        <button
          type="button"
          onClick={() => despachar({ tipo: 'irA', paso: 'identificar' })}
          className={cn(
            'my-[10px] mr-[18px] flex cursor-pointer items-center gap-[9px] rounded-sm border border-sobre-barra/40 bg-barra-control px-[18px] text-[14px] text-sobre-azul',
            'hover:bg-barra-hover',
            // A ≤ 880 px, solo el icono en un cuadro de 44 px, centrado en la barra de 56.
            ICONO_SOLO_EN_EL_CELULAR,
            CONTORNO_DE_FOCO_EN_LA_BARRA,
          )}
        >
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
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M15 4.5h4.5v15H15" />
          </svg>
          <span className="max-[881px]:sr-only">{t('Iniciar sesión')}</span>
        </button>
      )}
    </header>
  );
}
