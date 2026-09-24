import { ProveedorDeTema, type ConfiguracionDeTema } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';

import type { FalloDelSilencio } from './api/silencio.ts';
import { preguntaFallida, vueltaFallida, type VueltaFallida } from './arranque.ts';
import type { Enrutador } from './enrutador.tsx';
import { ProveedorDelRecorrido } from './recorrido/ProveedorDelRecorrido.tsx';
import type { DecisionesDelRecorrido } from './recorrido/recorrido.ts';

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
 * **La puerta no contesto** (issue 13), portada de `rentas/frontend/src/aplicacion.tsx`.
 *
 * Se dibuja **solo** cuando el portal volvio del emisor de identidad y el canje no se pudo hacer:
 * un `?error=` del propio emisor, un `state` que no cuadra, un codigo que el emisor rechaza. En
 * cualquier otro arranque —o sea, en todos los de hoy— esta pantalla no existe y el portal abre en
 * su primer paso, como siempre.
 *
 * Y hace falta porque el fallo, sin ella, **no se ve**: la libreria limpia la URL siempre —un
 * codigo usado no vale dos veces, y dejarlo en la barra hace que recargar de un error que no tiene
 * nada que ver con lo que paso—, asi que lo unico que quedaria seria la pantalla de siempre, como
 * si nadie hubiera intentado entrar.
 *
 * Los dos datos del emisor —`motivo` y `detalle`— van tal cual, que es lo que hace falta para
 * arreglarlo: sin ellos el aviso diria «algo fallo» y habria que mirar la consola del navegador de
 * quien lo sufrio.
 */
function LaPuertaNoContesto({ falla }: { readonly falla: VueltaFallida }) {
  const { t } = useTranslation();

  return (
    <AvisoDeLaSesion>
      {t('Volvimos del sistema de identidad sin poder entrar: {{motivo}}. {{detalle}}', {
        motivo: falla.motivo,
        detalle: falla.detalle,
      })}
    </AvisoDeLaSesion>
  );
}

/**
 * **La pregunta silenciosa no salio** (issue 35, revision del PR #45): la variante del aviso de
 * arriba para cuando nadie fue a ningun sitio.
 *
 * Quien recarga no ha ido al emisor ni ha vuelto de el: el portal le pregunto por detras, desde un
 * marco oculto, y ese marco a veces ni vuelve (el tope). «Volvimos del sistema de identidad…» seria
 * afirmarle algo que no ocurrio, que es lo que el repositorio no hace en ninguna pantalla. Esta
 * frase dice lo que si paso. El motivo y el detalle son claves del portal (`TEXTOS_DEL_SILENCIO`),
 * y se traducen aqui con sus huecos.
 */
function LaPreguntaNoSalio({ falla }: { readonly falla: FalloDelSilencio }) {
  const { t } = useTranslation();

  return (
    <AvisoDeLaSesion>
      {t('Al abrir la página quisimos comprobar si ya había entrado, y no se pudo: {{motivo}}. {{detalle}}', {
        motivo: t(falla.motivo.clave, falla.motivo.valores),
        detalle: t(falla.detalle.clave, falla.detalle.valores),
      })}
    </AvisoDeLaSesion>
  );
}

/** Lo comun a los dos avisos: el titulo, la frase que cambia, y que hacer. */
function AvisoDeLaSesion({ children }: { readonly children: string }) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-screen place-items-center bg-fondo p-[30px]">
      <div className="max-w-[64ch] border border-mal-borde bg-mal-fondo p-[20px] text-[14px] leading-[1.6]">
        <p className="m-0 font-bold text-mal-tinta">{t('No se pudo abrir su sesión')}</p>
        <p className="mt-[10px] mb-0 text-tinta-2">{children}</p>
        <p className="mt-[10px] mb-0 text-tinta-2 text-pretty">
          {t(
            'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * **La espera mientras se le pregunta al emisor si ya se habia entrado** (issue 35).
 *
 * La dibuja `main.tsx` cuando el canje silencioso tarda mas que `UMBRAL_DE_ESPERA`
 * (`src/arranque.ts`): el issue pide que, mientras tanto, el portal diga que esta consultando, y no
 * que se quede en blanco ni que salte a la puerta. Cuando la pregunta termina, el portal se monta
 * encima, en la misma raiz.
 *
 * Con el tema, por lo mismo que la puerta caida: la primera pantalla que alguien ve no puede tener
 * la paleta de otro programa. Y con el aspecto de «Consultando su deuda…» (`LaConsulta.tsx`), que es
 * el «consultando» que el portal ya tiene.
 */
export function ComprobandoLaSesion() {
  const { t } = useTranslation();

  return (
    <ProveedorDeTema configuracion={TEMA}>
      <div className="grid min-h-screen place-items-center bg-fondo p-[30px]">
        <p
          role="status"
          aria-busy="true"
          className="m-0 border border-linea bg-superficie px-[22px] py-5 text-[18px] font-bold"
        >
          {t('Comprobando su sesión…')}
        </p>
      </div>
    </ProveedorDeTema>
  );
}

/**
 * **El portal**: el tema, el estado del recorrido y el enrutador, en ese orden.
 *
 * · **El proveedor del tema envuelve TODO**, y es lo primero que se monta: lo que se dibuje sin el
 *   se dibuja con la paleta de `institucional`, que es la del `:root`.
 * · **El recorrido va por encima del enrutador** (issue 4): cambiar de ruta no lo desmonta, asi que
 *   ir de `#/pagar` a `#/deudas` y volver no pierde lo marcado ni lo pagado.
 * · **El enrutador llega hecho**, como el cliente de consultas: se crea una vez fuera del render
 *   (`main.tsx`), y cada prueba crea el suyo (`crearEnrutador`, en `src/enrutador.tsx`).
 *
 * La barra, la franja y el pie son `src/marco/`; cada paso, su pantalla en `src/pasos/`.
 * `inicial` es para las pruebas: empezar con sesion o en un paso dado sin recorrerlo entero.
 *
 * **El proveedor del tema envuelve TODO, incluida la pantalla de la puerta caida** (issue 13, de
 * rentas#111). Podria envolver solo el recorrido y seria mas corto. Seria tambien un fallo
 * visible: quien eligio oscuro y se encuentra con que no pudo entrar leeria ese aviso —el unico
 * momento en que el portal de verdad no esta— con la paleta de otro. La pantalla que explica una
 * averia es exactamente la que no debe parecer de otro programa.
 */
export interface AplicacionProps {
  readonly enrutador: Enrutador;
  readonly inicial?: DecisionesDelRecorrido;
}

export function Aplicacion({ enrutador, inicial }: AplicacionProps) {
  // Se lee aqui y no en `main.tsx` porque el montaje no lleva argumentos a proposito: ver
  // `src/arranque.ts`. Al llegar aqui la pasada de arranque ya termino, asi que el valor esta fijo.
  const falla = vueltaFallida();
  const pregunta = preguntaFallida();

  return (
    <ProveedorDeTema configuracion={TEMA}>
      {falla !== null ? (
        <LaPuertaNoContesto falla={falla} />
      ) : pregunta !== null ? (
        <LaPreguntaNoSalio falla={pregunta} />
      ) : (
        <ProveedorDelRecorrido inicial={inicial}>
          <RouterProvider router={enrutador} />
        </ProveedorDelRecorrido>
      )}
    </ProveedorDeTema>
  );
}
