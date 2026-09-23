import { Boton, avisar } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import { entrar } from '../../arranque.ts';
import { AvisoDeAmnistia, QuePuedeHacerAqui } from '../../piezas/PortadaDelPortal.tsx';

/**
 * **Paso 1 · Entrar**, el primer paso del recorrido CON plataforma (issue 28).
 *
 * <h2>Por que este paso existe, y por que sustituye a «Buscar mi deuda»</h2>
 *
 * El artboard empieza por buscar por documento, y **el backend ya no ofrece eso**: el ADR-0020
 * retiro `GET /portal/deuda?doc=` —cualquiera podia preguntar por el documento de cualquiera, que es
 * una enumeracion de contribuyentes— y lo reemplazo por `GET /portal/situacion` **sin parametros**,
 * donde el sujeto sale del token. Sin parametro que escribir no hay formulario que ensenar: lo
 * primero que hace falta es saber quien pregunta, y eso es entrar.
 *
 * En demostracion esta pantalla **no existe**: alli `buscar` sigue siendo el paso 1 y el recorrido es
 * el del artboard, sin tocar.
 *
 * <h2>Lo que se dice de la cuenta que no se tiene, y por que se dice asi</h2>
 *
 * El realm `kamayuk-ciudadano` tiene **el registro cerrado a proposito**: una cuenta del portal dice
 * que quien entra es el titular de un documento, y eso no se puede acreditar desde una pantalla. La
 * pantalla no ofrece «Crear una cuenta» ni manda a ningun formulario — dice donde se hace, que es la
 * ventanilla, y por que. Prometer aqui un registro que el emisor rechaza seria mandar a la gente a
 * un callejon.
 *
 * <h2>Lo que conserva del paso 1 del artboard</h2>
 *
 * «Qué puede hacer aquí» y el aviso de la amnistia, los dos de `src/piezas/PortadaDelPortal.tsx`:
 * son lo que el portal cuenta de si mismo, y no dependen de por donde se entre.
 *
 * <h2>El boton</h2>
 *
 * `entrar()` se llama y no se espera a que vuelva: cuando todo va bien, el navegador se va de esta
 * pagina. La promesa solo trae algo cuando **no se pudo ni llegar al emisor**, y eso se avisa en vez
 * de dejar el boton pulsado sin que ocurra nada visible. Es el mismo trato que en la barra
 * (`src/marco/Barra.tsx`) y en el peldano de la consulta (`src/pasos/deudas/LaConsulta.tsx`).
 */
export function Entrar() {
  const { t } = useTranslation();

  const alEntrar = () => {
    void entrar().then((falla) => {
      if (falla !== null) avisar(t('No pudimos llevarle al acceso: {{motivo}}.', { motivo: falla.motivo }));
    });
  };

  return (
    <div>
      <div className="border border-linea bg-superficie shadow-sombra-1">
        <div className="px-[26px] pt-[26px] pb-[22px]">
          <h1 className="m-0 text-[27px] font-bold tracking-[-0.01em] text-pretty text-azul">
            {t('Entre con su cuenta del portal')}
          </h1>
          <p className="mt-[11px] mb-0 max-w-[64ch] text-[16px] leading-[1.6] text-pretty text-tinta-2">
            {t(
              'Su deuda está a nombre de su documento, así que lo primero es saber quién pregunta. Al entrar verá lo que debe en todas las municipalidades del sistema.',
            )}
          </p>

          <Boton
            type="button"
            variante="primario"
            onClick={alEntrar}
            className="mt-5 min-h-[48px] px-[30px] py-0 text-[16px]"
          >
            {t('Entrar con mi cuenta')}
          </Boton>

          <p className="mt-4 mb-0 max-w-[66ch] text-[14px] text-pretty text-tinta-3">
            {t(
              'Si todavía no tiene cuenta, se la abren en la ventanilla de la municipalidad con su documento: aquí no se puede crear. Es a propósito, porque nadie puede acreditar desde una pantalla que usted es usted.',
            )}
          </p>
        </div>

        <QuePuedeHacerAqui />
      </div>

      <AvisoDeAmnistia />
    </div>
  );
}
