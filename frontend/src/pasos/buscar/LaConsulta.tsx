import { Boton, Importe, avisar, cn } from '@kamayuk/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { peldanoDelPortal } from '../../api/escalera.ts';
import { entrar } from '../../arranque.ts';
import { useLaSituacion } from '../../datos/fuente.ts';
import type { SituacionDelServidor } from '../../datos/tipos.ts';

/**
 * **Los estados de la consulta, dibujados** (issue 27).
 *
 * Con plataforma, la deuda no esta en memoria: se pide. Y pedir tiene cuatro finales que el
 * ciudadano puede encontrarse, mas el rato en que todavia no hay ninguno. Esta pieza los dibuja los
 * cinco, y **no dibuja ni una cifra que no venga del servidor**.
 *
 * <h2>Por que vive en el PASO 1, encima del formulario, y no dentro del paso 2</h2>
 *
 * Porque con plataforma la consulta **no espera a que nadie busque**: no hay parametro que escribir,
 * el sujeto sale del token, y se pide en cuanto la pagina abre. El primer paso es donde eso se ve.
 *
 * Y porque el issue 27 dice explicitamente que **el recorrido de pasos no cambia** —lo cambia el
 * 28—. Sustituyendo el paso 2 se llevaria por delante la lista de conceptos, el marcado y el pago de
 * la demostracion, que es por donde pasan el arnes y buena parte de las pruebas. Aqui se anade, no
 * se quita: debajo sigue estando la busqueda de siempre. Cuando el 28 convierta este paso en
 * «Entrar», esta pieza ya esta donde tiene que estar.
 *
 * Por eso su titulo es un `h2` y no un `h1`: el `h1` de la pagina es el del paso.
 *
 * <h2>La regla que gobierna las cinco ramas: ningun cero de consuelo</h2>
 *
 * Cuando una consulta no se pudo completar, lo que NO se puede hacer es ensenar un total. Un total
 * al que le falta una municipalidad es un importe **plausible y equivocado**, y quien lo lea se ira
 * a la ventanilla creyendo que debe eso. Por eso en `no-se-pudo-consultar` se ensena la **nota del
 * servidor tal cual** —que es quien sabe cual falto— y ni un numero; y por eso `sin-registros` no
 * se dibuja como «S/ 0.00» sino como lo que es: no encontramos nada a su nombre.
 *
 * <h2>Los textos del fallo salen de la escalera, y son los del CIUDADANO</h2>
 *
 * `peldanoDelPortal` (issue 25) clasifica el fallo con la libreria y pone las palabras de este
 * portal: nada de «avise a soporte» ni de «pida el permiso a quien administre los perfiles», que
 * son gente que quien entra a pagar su predial no tiene. El boton de entrar sale **solo** cuando la
 * libreria dice que este peldano pide identidad (el 401): con un 403 `SIN_DOCUMENTO`, volver a la
 * puerta trae el mismo token y el mismo 403.
 *
 * <h2>Lo que esta pieza NO hace, y es del issue 28</h2>
 *
 * Dibujar la deuda. Con `con-deuda` se ensena lo que el servidor suma —su total, con su fecha— y se
 * dice que el detalle por concepto todavia no se pinta: el recorrido con plataforma, el desglose y
 * el pago son de la entrega siguiente. Lo que aqui NO pasa, y es el punto, es que se dibujen los
 * conceptos de la demostracion al lado de un total de verdad.
 */

/** El marco comun de los cinco estados: un bloque con su titulo y lo que haga falta debajo. */
function Bloque({
  titulo,
  tono = 'neutro',
  children,
}: {
  readonly titulo: string;
  readonly tono?: 'neutro' | 'mal' | 'atencion';
  readonly children: ReactNode;
}) {
  const filo = {
    neutro: 'border-linea border-l-azul',
    mal: 'border-mal-borde/40 border-l-mal-tinta bg-mal-fondo',
    atencion: 'border-atencion-tinta/25 border-l-atencion-tinta bg-atencion-fondo',
  }[tono];

  return (
    <section className={cn('mb-[18px] border border-l-[5px] bg-superficie px-[22px] py-5', filo)}>
      <h2 className="m-0 text-[18px] font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

/** Un parrafo del cuerpo de un bloque, con la medida del artboard para el texto corrido. */
function Parrafo({ children }: { readonly children: ReactNode }) {
  return <p className="mt-[7px] mb-0 max-w-[66ch] text-[14.5px] leading-[1.6] text-pretty">{children}</p>;
}

/** Mientras la consulta viaja. Sin cifras y sin esqueleto de cifras: no hay ninguna todavia. */
function Pidiendo() {
  const { t } = useTranslation();
  return (
    <section aria-busy="true" className="mb-[18px] border border-linea bg-superficie px-[22px] py-5">
      <h2 className="m-0 text-[18px] font-bold">{t('Consultando su deuda…')}</h2>
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
function NoSePudoPreguntar({ fallo }: { readonly fallo: unknown }) {
  const { t } = useTranslation();
  const peldano = peldanoDelPortal(fallo, t);

  return (
    <Bloque titulo={peldano.titulo} tono={peldano.esAveria ? 'mal' : 'atencion'}>
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
      ) : null}
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
function NoSePudoConsultar({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();

  return (
    <Bloque titulo={t('No pudimos consultar toda su deuda')} tono="atencion">
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
    </Bloque>
  );
}

/** La persona no figura en ninguna municipalidad del sistema. */
function SinRegistros({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();

  return (
    <Bloque titulo={t('No encontramos deuda a su nombre')}>
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
 * La constancia se ofrece igual que en la demostracion (`SinDeuda`, en `Deudas.tsx`), y el aviso
 * dice lo mismo: es una demostracion, aqui no se emite nada.
 */
function SinDeudaDelServidor() {
  const { t } = useTranslation();

  return (
    <section className="mb-[18px] border border-l-[5px] border-ok-tinta/25 border-l-ok-tinta bg-ok-fondo px-[22px] py-5">
      <h2 className="m-0 text-[18px] font-bold text-ok-tinta">{t('No le queda nada por pagar')}</h2>
      <p className="mt-[7px] mb-[14px] max-w-[66ch] text-[14.5px] leading-[1.6] text-pretty text-ok-tinta">
        {t('Pagó todos sus conceptos pendientes. Puede pedir su constancia de no adeudo, que acredita que está al día.')}
      </p>
      <Boton
        type="button"
        onClick={() => avisar(t('Se emitiría su constancia de no adeudo al día de hoy.'))}
        className="min-h-[44px] border-ok-tinta px-5 py-0 text-[14.5px] font-bold text-ok-tinta hover:border-ok-tinta hover:bg-ok-fondo"
      >
        {t('Pedir mi constancia de no adeudo')}
      </Boton>
    </section>
  );
}

/**
 * Hay deuda, y es del servidor.
 *
 * Se ensena **su** total, con **su** fecha, y nada mas: el detalle por concepto, el marcado y el
 * pago con plataforma son del issue 28. Ensenar aqui la lista de la demostracion al lado de un total
 * de verdad seria lo unico peor que no ensenar nada.
 */
function ConDeuda({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();
  const total = situacion.totalConsolidado;

  return (
    <Bloque titulo={t('Lo que encontramos a su nombre')}>
      {total === null ? null : (
        <p className="mt-[10px] mb-0 text-[27px] [&_span]:font-bold [&_span]:text-azul">
          <Importe valor={total.importe} fechaCalculo={total.actualizadoA} />
        </p>
      )}
      {/*
        La frase de cada municipalidad la redacta el SERVIDOR —«1 obligacion con saldo al …»— y va
        tal cual, sin traducir y sin recomponer: dos interfaces que la compusieran acabarian
        escribiendo dos frases distintas de la misma persona el mismo dia, y una olvidaria la fecha.
      */}
      <ul className="mt-[10px] mb-0 list-none p-0">
        {situacion.municipalidades.map((municipalidad) => (
          <li key={municipalidad.ubigeo} className="mt-[6px] text-[14.5px] leading-[1.6] text-pretty">
            <span className="font-bold">{municipalidad.nombre}</span>
            {` · ${municipalidad.saldos.estadoDeLaConsulta}`}
          </li>
        ))}
      </ul>
      <Parrafo>
        {t(
          'Todavía no puede pagar aquí lo que el portal consulta: por ahora, acérquese con su documento a la ventanilla de la municipalidad.',
        )}
      </Parrafo>
    </Bloque>
  );
}

/**
 * **La consulta al portal, con sus cinco finales.**
 *
 * `useLaSituacion` no reintenta (`retry: false`, en `src/datos/fuente.ts`): un 401 reintentado tres
 * veces son tres 401, y el remedio es entrar, no insistir. Por eso la peticion sale **una sola vez**
 * por montaje, que es lo que mide `Deudas.plataforma.test.tsx` contra un cliente falso.
 */
export function LaConsulta() {
  const consulta = useLaSituacion();

  if (consulta.isPending) return <Pidiendo />;
  if (consulta.isError) return <NoSePudoPreguntar fallo={consulta.error} />;

  const situacion = consulta.data;
  switch (situacion.estado) {
    case 'no-se-pudo-consultar':
      return <NoSePudoConsultar situacion={situacion} />;
    case 'sin-registros':
      return <SinRegistros situacion={situacion} />;
    case 'sin-deuda':
      return <SinDeudaDelServidor />;
    case 'con-deuda':
      return <ConDeuda situacion={situacion} />;
  }
}
