import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { FuenteDelPortal } from '../datos/fuente.ts';
import es from './locales/es.json' with { type: 'json' };

/**
 * **El castellano es la clave**, como en `rentas/frontend/src/i18n/i18n.ts` (rentas#103).
 *
 * <h2>La decision</h2>
 *
 * El artboard `diseno/Ciudadano.dc.html` es la fuente de verdad de los textos, y sus textos en
 * castellano son **definitivos**. Con claves opacas —`'cabecera.titulo'`— una guarda que compare
 * contra el artboard compararia claves contra castellano, y sus rojos dirian «cabecera.titulo» en
 * vez de «Pago de tributos en línea». Asi que la clave **es** el castellano:
 * `t('Pago de tributos en línea')`, y **un segundo idioma es un JSON** que mapea castellano →
 * destino.
 *
 * <h2>El coste conocido de esta forma, y quien lo cubre</h2>
 *
 * Cambiar el castellano **pierde su traduccion**, porque la clave cambia. Eso lo cubre
 * `i18next-cli status`, que corre dentro de `yarn verificar`, y
 * `verificaciones/el-locale-esta-completo.test.ts`, que exige que el locale traiga cada clave con
 * su propio texto como valor.
 *
 * <h2>El locale viene en DOS partes, y la segunda solo viaja con la demostracion (issue 58)</h2>
 *
 * `es.json` es lo que el portal dice, y viaja siempre. `es.demostracion.json` es lo que dicen los
 * DATOS de la demostracion —los medios de pago, los pagos anteriores, las unidades con sus direcciones
 * y sus fichas catastrales—, que las pantallas pasan por `t()` con una variable. Hasta el issue 58
 * iban juntos, y con ellos las direcciones del artboard viajaban en el paquete de produccion aunque
 * ninguna pantalla las dijera. Ahora la segunda parte la importa solo la fuente de demostracion
 * (`LaDemostracion.textos`) y la suma al idioma `sumarLosTextosDeLaFuente`, al montar.
 *
 * <h2>Los dos idiomas que hay, y el segundo no es un idioma</h2>
 *
 * · **`es`** — el de verdad.
 * · **`marcado`** — no es un idioma: es el arnes de las pruebas de cobertura. Envuelve TODO lo que
 *   traduce entre `⟦` y `⟧`, de modo que lo que llegue al DOM sin marcar es texto que se escapo de
 *   `t()`. Lo usa hoy `src/aplicacion.test.tsx`.
 *
 * <h2>Por que el marcado es un POST-PROCESADOR y no un «no encontre la clave»</h2>
 *
 * En `rentas` la primera version lo hacia con `parseMissingKeyHandler`, y funciono **hasta que el
 * locale se lleno**: con las entradas puestas, i18next las encuentra por el idioma de reserva y ese
 * gancho **no se llama nunca**. La guarda paso de verde a rojo diciendo que todo se escapaba, cuando
 * lo que se habia roto era el arnes. Un post-procesador corre **sobre lo que ya se tradujo**, venga
 * de donde venga: mide que texto paso por `t()`, que es lo que se quiere medir.
 */

/** Lo que envuelve el idioma de marcado. No son caracteres que ninguna pantalla use. */
export const ABRE = '⟦';
export const CIERRA = '⟧';

export const IDIOMA_POR_OMISION = 'es';

/** El idioma que marca todo, para que una prueba pueda ver lo que NO paso por `t()`. */
export const IDIOMA_MARCADO = 'marcado';

/**
 * Envuelve lo traducido cuando el idioma es el de marcado. En cualquier otro, no toca nada.
 *
 * `postProcess` se declara en la configuracion y no en cada llamada: si hubiera que acordarse de
 * pedirlo en cada `t()`, la cadena que alguien olvidara seria justo la que la prueba no veria.
 */
const marcador = {
  type: 'postProcessor' as const,
  name: 'marcar',
  process: (valor: string) =>
    i18next.language === IDIOMA_MARCADO ? `${ABRE}${valor}${CIERRA}` : valor,
};

await i18next
  .use(initReactI18next)
  .use(marcador)
  .init({
    lng: IDIOMA_POR_OMISION,
    fallbackLng: IDIOMA_POR_OMISION,
    // Sin espacios de nombre ni separadores: la clave es una frase en castellano y lleva puntos,
    // dos puntos y comas dentro. Con los separadores puestos se partiria y no se encontraria.
    keySeparator: false,
    nsSeparator: false,
    resources: { es: { translation: es } },
    interpolation: { escapeValue: false },
    postProcess: ['marcar'],
  });


/**
 * **Suma al idioma lo que dicen los datos de la fuente**, si los trae (issue 58): con la de
 * demostracion, `es.demostracion.json`; con la de la plataforma, nada.
 *
 * Se llama una vez, al montar —`montaje.tsx`, y en las pruebas `montarElPortal`—, con la fuente que
 * ya eligio `laFuente()`. Mientras el unico idioma sea el castellano, cada entrada dice lo mismo que
 * su clave y la pantalla se veria igual sin esto; lo que esto garantiza es que un segundo idioma, que
 * traeria su propio `…demostracion.json`, se aplique tambien a los datos. Sin la llamada, el locale de
 * la demostracion seria un archivo que nadie lee.
 */
export function sumarLosTextosDeLaFuente(fuente: FuenteDelPortal): void {
  if (fuente.demostracion === null) return;
  i18next.addResourceBundle(IDIOMA_POR_OMISION, 'translation', fuente.demostracion.textos, true, false);
}

export default i18next;
