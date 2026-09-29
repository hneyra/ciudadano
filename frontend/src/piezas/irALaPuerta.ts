import { avisar } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import { entrar } from '../arranque.ts';

/**
 * **Ir al formulario del sistema de identidad, y decirlo si no se llega** (issues 27, 28 y 67).
 *
 * Lo usan los tres botones que mandan a la puerta: «Iniciar sesión» de la barra, «Entrar con mi
 * cuenta» del paso 1 y «Entrar» del peldano que pide identidad. Hasta el issue 67 cada uno escribia
 * las mismas tres lineas, y las tres metian el `motivo` de la libreria en el aviso.
 *
 * `entrar()` se llama y no se espera: cuando todo va bien el navegador se va de esta pagina, y la
 * promesa solo trae algo cuando **no se pudo ni llegar al emisor**. Eso se avisa, porque si no el
 * boton se pulsa y no ocurre nada visible. Lo que se avisa es una clave del portal
 * (`TEXTOS_DEL_EMISOR`), y se traduce aqui.
 */
export function useIrALaPuerta(): () => void {
  const { t } = useTranslation();

  return () => {
    void entrar().then((aviso) => {
      if (aviso !== null) avisar(t(aviso.clave, aviso.valores));
    });
  };
}
