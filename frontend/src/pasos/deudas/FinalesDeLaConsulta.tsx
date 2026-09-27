import { Boton, avisar } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import { peldanoDelPortal } from '../../api/escalera.ts';
import { entrar } from '../../arranque.ts';
import type { SituacionDelServidor } from '../../datos/tipos.ts';
import { Reintentar } from '../../piezas/Reintentar.tsx';
import { Bloque, Parrafo } from './piezas.tsx';

/**
 * **Los finales de la consulta que no son una lista** (issues 27 y 28): mientras viaja, el peldano
 * de la escalera, «no se pudo consultar», «sin registros» y «sin deuda». Lo que hay cuando hay deuda
 * esta en `LaConsulta.tsx`; por que se dibuja cada uno asi, en su cabecera.
 *
 * Los cinco van a `mb-[18px]` de lo que venga debajo; `Pidiendo` no lleva filo, porque todavia no
 * dice nada.
 */

const MARGEN = 'mb-[18px]';

/**
 * Mientras la consulta viaja. Sin cifras y sin esqueleto de cifras: no hay ninguna todavia.
 *
 * **Se anuncia** (issue 62): es un `status`, region viva cortes, y lo que dice se lee sin mover el
 * foco. Hasta el issue 62 era una `section aria-busy` que nadie anunciaba. Y ya **sin `aria-busy`**:
 * con `aria-busy="true"` una tecnologia de apoyo puede retener lo que cambia dentro hasta que pase a
 * `false` (ARIA 1.2), y esta seccion no pasa a `false`, desaparece. Quien espera a que la pantalla
 * termine (`quieta`, en `src/afirmaciones.plataforma.test.tsx`) mira ademas que ya no se diga esto.
 */
export function Pidiendo() {
  const { t } = useTranslation();
  return (
    <section role="status" className="mb-[18px] border border-linea bg-superficie px-[22px] py-5">
      <h1 className="m-0 text-[18px] font-bold">{t('Consultando su deuda…')}</h1>
      <Parrafo>{t('Estamos preguntando a las municipalidades. Tarda unos segundos.')}</Parrafo>
    </section>
  );
}

/**
 * La consulta no llego a contestar: el peldano de la escalera, con las palabras del portal.
 *
 * `entrar()` se llama y no se espera a que vuelva: cuando todo va bien, el navegador se va de esta
 * pagina. La promesa solo trae algo cuando **no se pudo ni llegar al emisor**, y eso se avisa en vez
 * de dejar el boton pulsado sin que ocurra nada visible.
 */
export function NoSePudoPreguntar({
  fallo,
  alReintentar,
}: {
  readonly fallo: unknown;
  readonly alReintentar: () => void;
}) {
  const { t } = useTranslation();
  const peldano = peldanoDelPortal(fallo, t);

  return (
    <Bloque titulo={peldano.titulo} tono={peldano.esAveria ? 'mal' : 'atencion'} className={MARGEN}>
      <Parrafo>{peldano.detalle}</Parrafo>
      <Parrafo>{peldano.remedio}</Parrafo>
      {peldano.pideIdentidad ? (
        <Boton
          type="button"
          variante="primario"
          className="mt-[14px] min-h-[44px] px-5 py-0 text-[14.5px]"
          onClick={() => {
            void entrar().then((falla) => {
              if (falla !== null) {
                avisar(t('No pudimos llevarle al acceso: {{motivo}}.', { motivo: falla.motivo }));
              }
            });
          }}
        >
          {t('Entrar')}
        </Boton>
      ) : (
        <Reintentar alReintentar={alReintentar} className="mt-[14px]" />
      )}
    </Bloque>
  );
}

/**
 * La rama medida: el servidor contesto 200, pero falto alguna municipalidad y **no hay total**.
 *
 * La nota va **tal cual y sin traducir**: la redacta el servidor, que es el unico que sabe cual
 * municipalidad no se pudo leer. Pasarla por `t()` la buscaria en un inventario donde no esta y
 * dejaria en pantalla la frase igual, pero por accidente.
 */
export function NoSePudoConsultar({
  situacion,
  alReintentar,
}: {
  readonly situacion: SituacionDelServidor;
  readonly alReintentar: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Bloque titulo={t('No pudimos consultar toda su deuda')} tono="atencion" className={MARGEN}>
      {situacion.notaDelTotal === null ? null : <Parrafo>{situacion.notaDelTotal}</Parrafo>}
      <Parrafo>
        {t(
          'Por eso no le mostramos ningún total: una cifra a la que le falta una municipalidad se lee como si fuera toda su deuda, y no lo es.',
        )}
      </Parrafo>
      <Parrafo>
        {t(
          'Vuelva a intentarlo en unos minutos. Si sigue igual, acérquese con su documento a la ventanilla de la municipalidad.',
        )}
      </Parrafo>
      <Reintentar alReintentar={alReintentar} className="mt-[14px]" />
    </Bloque>
  );
}

/** La persona no figura en ninguna municipalidad del sistema. */
export function SinRegistros({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();

  return (
    <Bloque titulo={t('No encontramos deuda a su nombre')} className={MARGEN}>
      <Parrafo>
        {t('Con {{tipoDeDocumento}} {{numeroDeDocumento}} no figura ninguna deuda en las municipalidades del sistema.', {
          tipoDeDocumento: situacion.tipoDeDocumento,
          numeroDeDocumento: situacion.numeroDeDocumento,
        })}
      </Parrafo>
      <Parrafo>
        {t(
          'Si cree que es un error, acérquese con su documento a la ventanilla de la municipalidad: allí lo revisan en el momento.',
        )}
      </Parrafo>
    </Bloque>
  );
}

/**
 * Se leyo todo y no hay nada pendiente.
 *
 * **Sin «Pagó» y sin constancia** (issue 49). El texto del artboard —«Pagó todos sus conceptos
 * pendientes. Puede pedir su constancia de no adeudo…»— alli es verdad porque se acaba de pagar en la
 * demostracion. Aqui el servidor solo dice que no hay saldo: nadie sabe si se pago, si se prescribio o
 * si nunca hubo deuda, y el portal no emite ninguna constancia. Se dice lo que el servidor dijo.
 */
export function SinDeudaDelServidor() {
  const { t } = useTranslation();

  return (
    <Bloque titulo={t('No le queda nada por pagar')} tono="ok" className={MARGEN}>
      <Parrafo className="text-ok-tinta">
        {t('Según la consulta de hoy, no tiene deuda pendiente en las municipalidades del sistema.')}
      </Parrafo>
    </Bloque>
  );
}
