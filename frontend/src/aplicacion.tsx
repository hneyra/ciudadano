import { ProveedorDeTema, type ConfiguracionDeTema } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import escudo from '../diseno/escudo-catacaos.png';

/**
 * **El tema de este portal** (issue 2): dos decisiones, y ningun color.
 *
 * · `identidadPorOmision: 'clasico'`: la paleta del artboard —azul `#0D5FA8`, Arial, filos grises,
 *   las insignias de siempre— vive en `@kamayuk/ui` como identidad `clasico` (`kamayuk-lib`#56). El
 *   portal la ELIGE; no la escribe. Que siga siendo la del artboard lo mide
 *   `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`, y que aqui no se escriba ningun
 *   color, `verificaciones/sin-colores-propios.test.ts`.
 * · `prefijoDeClaves: 'kamayuk.ciudadano'`: el mismo motivo que en `rentas` (rentas#111). Las
 *   interfaces del producto pueden servirse del mismo origen y compartir el almacenamiento del
 *   navegador; sin prefijo propio, elegir un tema en otra se lo cambiaria a esta.
 *
 * **El modo no se declara**, como en `rentas`: ausente es «el del equipo», y el oscuro sale derivado
 * por la libreria. Un oscuro a medida esta fuera del alcance del issue.
 */
const TEMA: ConfiguracionDeTema = {
  identidadPorOmision: 'clasico',
  prefijoDeClaves: 'kamayuk.ciudadano',
};

/**
 * **El marcador del andamiaje, ya con el tema**: la pagina que `yarn dev` sirve mientras no hay
 * pantallas.
 *
 * Es la barra del artboard (`diseno/Ciudadano.dc.html`, lineas 61-68) reducida a lo que se puede
 * comparar a ojo con la cabecera de verdad: el escudo, el titulo en blanco sobre `bg-azul` y la
 * entidad —la prop `entidad`, linea 692— en `text-sobre-barra-2`, que es el `#CFE3F4` del artboard,
 * con las medidas de sus estilos en linea, sobre el lienzo `bg-fondo`. Los botones de sesion son de
 * la pantalla que los usa.
 *
 * Los dos textos pasan por `t()` —lo demuestra `aplicacion.test.tsx` con el idioma `marcado`— para
 * que la primera pantalla de verdad no herede una cadena escrita a pelo.
 *
 * **El proveedor envuelve TODO**, y es lo primero que se monta: lo que se dibuje sin el se dibuja con
 * la paleta de `institucional`, que es la del `:root`.
 */
export function Aplicacion() {
  const { t } = useTranslation();
  return (
    <ProveedorDeTema configuracion={TEMA}>
      <div className="flex min-h-screen flex-col bg-fondo">
        <header className="bg-azul text-sobre-azul">
          <div className="flex items-center gap-[12px] px-[18px] py-[10px]">
            <img src={escudo} alt="" width={30} height={36} className="block h-[36px] w-auto" />
            <div className="min-w-0 leading-[1.2]">
              <h1 className="m-0 text-[17px] font-bold">{t('Pago de tributos en línea')}</h1>
              <p className="m-0 text-[11.5px] text-sobre-barra-2">{t('Municipalidad Distrital de Catacaos')}</p>
            </div>
          </div>
        </header>
      </div>
    </ProveedorDeTema>
  );
}
