import { type Fecha, type Importe as ImporteDecimal, formatearFecha, formatearImporte } from '@kamayuk/formato';
import { Boton, Casilla, Importe, avisar, cn } from '@kamayuk/ui';
import { type ReactNode, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { peldanoDelPortal } from '../../api/escalera.ts';
import { entrar } from '../../arranque.ts';
import { totalDe } from '../../datos/cuentas.ts';
import { fechaDelImporte, quienDebeDe } from '../../datos/deLaSituacion.ts';
import { useLaSituacion } from '../../datos/fuente.ts';
import type { DeudaDelServidor, SituacionDelServidor } from '../../datos/tipos.ts';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { cuenta, destinoAlPagar, seleccion, vivasDelServidor } from '../../recorrido/recorrido.ts';

/**
 * **La deuda que cuenta el servidor, con sus cinco finales** (issues 27 y 28).
 *
 * Con plataforma, la deuda no esta en memoria: se pide. Y pedir tiene cuatro finales que el
 * ciudadano puede encontrarse, mas el rato en que todavia no hay ninguno. Esta pieza los dibuja los
 * cinco, y **no dibuja ni una cifra que no venga del servidor**.
 *
 * <h2>Donde vive, y por que aqui</h2>
 *
 * En el **paso 2**, «Elegir qué pago», que es el sitio que el issue 28 le da: con plataforma el paso
 * 1 es «Entrar» —el sujeto de la consulta sale del token— y esta pantalla es a donde se llega con la
 * sesion abierta. En el issue 27 vivia encima del paso 1 a proposito y con fecha de caducidad
 * escrita: entonces el recorrido de pasos no se podia tocar.
 *
 * `Deudas.tsx` elige entre esta pieza y la del artboard mirando la fuente, no el entorno. **En
 * demostracion no se monta**: no hay peticion, y el paso 2 es el de siempre.
 *
 * <h2>La regla que gobierna las cinco ramas: ningun cero de consuelo</h2>
 *
 * Cuando una consulta no se pudo completar, lo que NO se puede hacer es ensenar un total. Un total
 * al que le falta una municipalidad es un importe **plausible y equivocado**, y quien lo lea se ira
 * a la ventanilla creyendo que debe eso. Por eso en `no-se-pudo-consultar` se ensena la **nota del
 * servidor tal cual** —que es quien sabe cual falto—, ni un numero, y un boton para reintentar; y
 * por eso `sin-registros` no se dibuja como «S/ 0.00» sino como lo que es: no encontramos nada a su
 * nombre.
 *
 * <h2>Y la que gobierna la lista: lo que el contrato no da, no se dibuja</h2>
 *
 * `GET /portal/situacion` no trae cuotas, ni fecha de vencimiento, ni estado por concepto, ni el
 * desglose de los servicios del arbitrio (`src/datos/deLaSituacion.ts`, decision 4). Asi que aqui
 * **no hay insignia de estado, no hay linea de vencimiento y no hay tabla de detalle**: el desglose
 * dice que el portal no lo publica. Una insignia «Por vencer» deducida del interes seria un dato
 * inventado que el ciudadano leeria como oficial.
 *
 * Cada importe lleva **su** fecha (`fechaDelImporte`), y no una fecha de corte comun: el contrato
 * permite que difieran y aplanarlas seria decidir por el servidor.
 *
 * <h2>Los textos del fallo salen de la escalera, y son los del CIUDADANO</h2>
 *
 * `peldanoDelPortal` (issue 25) clasifica el fallo con la libreria y pone las palabras de este
 * portal: nada de «avise a soporte» ni de «pida el permiso a quien administre los perfiles», que
 * son gente que quien entra a pagar su predial no tiene. El boton de entrar sale **solo** cuando la
 * libreria dice que este peldano pide identidad (el 401): con un 403 `SIN_DOCUMENTO`, volver a la
 * puerta trae el mismo token y el mismo 403 — ahi lo que se ofrece es reintentar.
 */

/** El marco comun de los estados sin deuda: un bloque con su titulo y lo que haga falta debajo. */
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
      <h1 className="m-0 text-[18px] font-bold">{titulo}</h1>
      {children}
    </section>
  );
}

/** Un parrafo del cuerpo de un bloque, con la medida del artboard para el texto corrido. */
function Parrafo({ children }: { readonly children: ReactNode }) {
  return <p className="mt-[7px] mb-0 max-w-[66ch] text-[14.5px] leading-[1.6] text-pretty">{children}</p>;
}

/** El boton que vuelve a pedir la consulta. `useLaSituacion` no reintenta solo, y aqui manda quien lee. */
function Reintentar({ alReintentar }: { readonly alReintentar: () => void }) {
  const { t } = useTranslation();
  return (
    <Boton type="button" onClick={alReintentar} className="mt-[14px] min-h-[44px] px-5 py-0 text-[14.5px]">
      {t('Reintentar la consulta')}
    </Boton>
  );
}

/** Mientras la consulta viaja. Sin cifras y sin esqueleto de cifras: no hay ninguna todavia. */
function Pidiendo() {
  const { t } = useTranslation();
  return (
    <section aria-busy="true" className="mb-[18px] border border-linea bg-superficie px-[22px] py-5">
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
function NoSePudoPreguntar({
  fallo,
  alReintentar,
}: {
  readonly fallo: unknown;
  readonly alReintentar: () => void;
}) {
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
      ) : (
        <Reintentar alReintentar={alReintentar} />
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
function NoSePudoConsultar({
  situacion,
  alReintentar,
}: {
  readonly situacion: SituacionDelServidor;
  readonly alReintentar: () => void;
}) {
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
      <Reintentar alReintentar={alReintentar} />
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
      <h1 className="m-0 text-[18px] font-bold text-ok-tinta">{t('No le queda nada por pagar')}</h1>
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
 * Un importe del servidor **con la fecha a la que el servidor lo calculo**, visible.
 *
 * Sin `fechaImplicita`, a diferencia de la demostracion: alli una sola banda dice «al 13 de setiembre
 * de 2026» y vale para las cuarenta cifras, porque `FECHA_DE_CORTE` es una. Aqui cada componente del
 * saldo trae la suya y el contrato permite que difieran.
 *
 * El rotulo se escribe con `t()` y no se deja el de la libreria: `TEXTOS_DE_LA_UI.aLaFecha` dice «al
 * …» en castellano sin pasar por el inventario de este portal, y es texto que se lee.
 */
function ImporteDelServidor({
  valor,
  fecha,
  className,
}: {
  readonly valor: ImporteDecimal;
  readonly fecha: Fecha;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className={className}>
      <Importe
        valor={valor}
        fechaCalculo={fecha}
        rotuloDeLaFecha={() => t('al {{fecha}}', { fecha: formatearFecha(fecha) })}
      />
    </span>
  );
}

/** Quien es, segun el servidor: lo poco que el contrato deja decir, y ni una linea mas. */
function QuienEsDelServidor({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();
  const quien = quienDebeDe(situacion);

  return (
    <div className="flex flex-wrap items-center gap-4 border border-linea bg-superficie px-5 py-4">
      <span className="min-w-[200px] flex-1">
        <span className="block text-[12.5px] text-tinta-3">{t('Contribuyente')}</span>
        <span className="mt-[2px] block text-[17px] font-bold text-pretty">{quien.nombre}</span>
        <span className="mt-[2px] block text-[13.5px] text-tinta-3">
          {quien.codigo === null
            ? quien.documento
            : t('Código {{codigo}} · {{documento}}', { codigo: quien.codigo, documento: quien.documento })}
        </span>
      </span>
    </div>
  );
}

/** El total que sumo el SERVIDOR, con su fecha, y la frase que cada municipalidad redacto. */
function LoQueSumoElServidor({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();
  const total = situacion.totalConsolidado;

  return (
    <div className="border border-t-0 border-linea bg-superficie px-5 py-[18px]">
      <h2 className="m-0 text-[12.5px] tracking-[0.09em] text-tinta-3 uppercase">
        {t('Lo que suma el portal')}
      </h2>
      {total === null ? null : (
        <p className="mt-[6px] mb-0 text-[27px] [&_span]:font-bold [&_span]:text-azul">
          <ImporteDelServidor valor={total.importe} fecha={total.actualizadoA} />
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
    </div>
  );
}

/** El hueco del desglose: lo que el contrato no trae, dicho y no rellenado. */
function SinDesglose({ id }: { readonly id: string }) {
  const { t } = useTranslation();
  return (
    <div id={id} className="border-t border-linea-2 bg-sup px-5 pt-[14px] pb-4">
      <p className="m-0 max-w-[72ch] text-[14px] leading-[1.6] text-pretty text-tinta-2">
        {t('El portal no publica el desglose de este concepto.')}
      </p>
      <p className="mt-[7px] mb-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-pretty text-tinta-3">
        {t(
          'El servidor da el saldo del tributo entero: cuántas cuotas son, cuándo vence cada una y qué servicios componen el arbitrio no viajan en la respuesta. En la ventanilla de la municipalidad se lo detallan.',
        )}
      </p>
    </div>
  );
}

/** Un concepto del servidor: se marca, se abre y no se le inventa nada. */
function ConceptoDelServidor({ deuda }: { readonly deuda: DeudaDelServidor }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelDetalle = useId();
  const marcada = estado.marcadas[deuda.id] === true;
  const abierta = estado.abierta === deuda.id;

  const componentes: readonly { readonly rotulo: string; readonly valor: ImporteDecimal; readonly campo: keyof DeudaDelServidor['actualizadoA'] }[] = [
    { rotulo: t('Impuesto y arbitrios'), valor: deuda.insoluto, campo: 'insoluto' },
    { rotulo: t('Reajuste'), valor: deuda.reajuste, campo: 'reajuste' },
    { rotulo: t('Interés moratorio'), valor: deuda.interes, campo: 'interes' },
    { rotulo: t('Gastos y costas'), valor: deuda.gastos, campo: 'gastos' },
  ];

  return (
    <li
      data-marcada={marcada ? 'true' : 'false'}
      className={cn(
        'border-b border-l-4 border-b-linea-2',
        marcada ? 'border-l-azul bg-sup' : 'border-l-transparent bg-superficie',
      )}
    >
      <div className="flex flex-wrap items-start gap-[14px] px-5 py-[15px]">
        <span className="flex min-h-[44px] flex-[0_0_auto] items-center [&_[data-slot=casilla-caja]]:border-0 [&_[data-slot=casilla-caja]]:bg-transparent [&_[data-slot=casilla-caja]]:p-0">
          <Casilla
            checked={marcada}
            onCheckedChange={() => despachar({ tipo: 'alternar', id: deuda.id })}
            aria-label={t('Pagar {{concepto}}', { concepto: deuda.concepto })}
            className="size-5 cursor-pointer"
          />
        </span>
        <span className="min-w-0 flex-[1_1_260px]">
          <span className="block text-[16px] font-bold text-pretty">{deuda.concepto}</span>
          {/*
            `unidad` es mixto: o el predio de verdad —dato, y `t()` lo devuelve tal cual— o una de las
            tres frases que redacta el adaptador, que SI son texto del portal (`clavesDeLaUnidad`).
          */}
          <span className="mt-[3px] block text-[13.5px] text-pretty text-tinta-3">{t(deuda.unidad)}</span>
          {/*
            Aqui va, en el artboard, la insignia de estado y la linea del vencimiento. El contrato no
            trae ninguna de las dos y no se deducen: ver la cabecera de este archivo.
          */}
        </span>
        <span className="min-w-[132px] flex-[0_0_auto] text-right">
          <ImporteDelServidor
            valor={totalDe(deuda)}
            fecha={fechaDelImporte(deuda, 'insoluto')}
            className="block text-[19px] [&_span]:font-bold"
          />
          <Boton
            type="button"
            variante="fantasma"
            aria-expanded={abierta}
            aria-controls={abierta ? idDelDetalle : undefined}
            onClick={() => despachar({ tipo: 'abrirDetalle', id: deuda.id })}
            className="mt-[7px] min-h-[34px] p-0 text-[13.5px] underline hover:bg-transparent"
          >
            {abierta ? t('Ocultar el detalle') : t('Ver el detalle')}
          </Boton>
        </span>
      </div>
      {abierta ? (
        <>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(178px,1fr))] border-t border-linea-2 bg-sup p-0 max-[521px]:grid-cols-2">
            {componentes.map((componente) => (
              <li key={componente.rotulo} className="-mt-px -ml-px border-t border-l border-linea-2 px-[18px] py-[13px]">
                <p className="m-0 text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{componente.rotulo}</p>
                <ImporteDelServidor
                  valor={componente.valor}
                  fecha={fechaDelImporte(deuda, componente.campo)}
                  className="mt-[5px] block text-[16px]"
                />
              </li>
            ))}
          </ul>
          <SinDesglose id={idDelDetalle} />
        </>
      ) : null}
    </li>
  );
}

/**
 * La barra de pago: lo elegido y el boton (artboard, lineas 284-299), sobre la deuda del servidor.
 *
 * `aLaFecha` es la fecha de corte del recorrido entero, la que el servidor puso en la respuesta, y
 * va **implicita**: esta suma junta importes de varios conceptos, cada uno con la suya, y ensenar
 * una de ellas como si fuera la del total seria decir algo que nadie dijo. Cada cifra del servidor
 * sale con su fecha arriba, en su concepto.
 */
function BarraDePagoDelServidor({ aLaFecha }: { readonly aLaFecha: Fecha }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const viva = vivasDelServidor(estado).length;
  const marcadas = seleccion(estado).length;
  const lo = cuenta(estado);
  const vacio = marcadas === 0;
  const todo = marcadas === viva;

  let detalle: string;
  if (vacio) detalle = t('No ha marcado ningún concepto');
  else if (todo) detalle = t('Va a pagar los {{count}} conceptos', { count: viva });
  else detalle = t('Va a pagar {{count}} concepto de {{total}}', { count: marcadas, total: viva });

  const pagar = () => {
    if (vacio) {
      avisar(t('Marque al menos un concepto para poder pagar.'));
      return;
    }
    despachar({ tipo: 'irA', paso: destinoAlPagar(estado) });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-[18px] border border-t-[3px] border-linea border-t-azul bg-superficie px-5 py-[18px]">
        <span className="min-w-[200px] flex-1">
          <span className="block text-[13.5px] text-tinta-3">{detalle}</span>
          <span className="mt-[3px] block text-[27px] [&_span]:font-bold [&_span]:text-azul">
            <Importe valor={lo.total} fechaCalculo={aLaFecha} fechaImplicita />
          </span>
          <span className="mt-[3px] block text-[13.5px] text-ok-tinta">
            {t('Con la amnistía paga {{conAmnistia}}: se descuentan {{interes}} de interés', {
              conAmnistia: formatearImporte(lo.conAmnistia),
              interes: formatearImporte(lo.interes),
            })}
          </span>
        </span>
        <Boton
          type="button"
          variante="primario"
          aria-disabled={vacio}
          onClick={pagar}
          className={cn(
            'min-h-[52px] flex-[0_0_auto] px-8 py-0 text-[17px]',
            vacio && 'bg-linea text-tinta-2 hover:bg-linea',
          )}
        >
          {todo ? t('Pagar todo') : t('Pagar lo marcado')}
        </Boton>
      </div>
      {vacio ? (
        <p className="mt-3 mb-0 text-[14px] text-pretty text-tinta-3">
          {t('Marque al menos un concepto para continuar. Puede pagar todo de una vez o solo lo que le venza primero.')}
        </p>
      ) : null}
    </>
  );
}

/** Hay deuda, y es la del servidor: quien es, lo que el sumo, los conceptos y el pago. */
function ConDeuda({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const viva = vivasDelServidor(estado);
  const todo = seleccion(estado).length === viva.length;

  // Los conceptos del servidor pasan a ser los del recorrido. Es idempotente con la MISMA lista —la
  // que guarda la cache de consultas—, asi que volver a este paso no vuelve a marcarlo todo.
  useEffect(() => {
    despachar({ tipo: 'situacionLeida', deudas: situacion.deudas, contribuyente: quienDebeDe(situacion) });
  }, [situacion, despachar]);

  if (viva.length === 0) return <SinDeudaDelServidor />;

  return (
    <div>
      <QuienEsDelServidor situacion={situacion} />
      <LoQueSumoElServidor situacion={situacion} />

      <section className="mb-[18px] border border-t-0 border-linea bg-superficie">
        <div className="flex flex-wrap items-center gap-3 border-b border-linea-2 px-5 py-[14px]">
          <h1 className="m-0 min-w-[180px] flex-1 text-[17px] font-bold">{t('Lo que debe, por concepto')}</h1>
          <Boton
            type="button"
            onClick={() => despachar({ tipo: 'marcarTodo' })}
            className="min-h-[38px] flex-[0_0_auto] px-[14px] py-0 text-[13.5px]"
          >
            {todo ? t('Quitar todo') : t('Marcar todo')}
          </Boton>
        </div>
        <ul className="m-0 list-none p-0">
          {viva.map((deuda) => (
            <ConceptoDelServidor key={deuda.id} deuda={deuda} />
          ))}
        </ul>
      </section>

      <BarraDePagoDelServidor aLaFecha={situacion.aLaFecha} />
    </div>
  );
}

/**
 * **La consulta al portal, con sus cinco finales.**
 *
 * `useLaSituacion` no reintenta (`retry: false`, en `src/datos/fuente.ts`): un 401 reintentado tres
 * veces son tres 401, y el remedio es entrar, no insistir. Quien decide volver a preguntar es la
 * persona, con «Reintentar la consulta», que es un `refetch` y no un reintento automatico.
 */
export function LaConsulta() {
  const consulta = useLaSituacion();
  const alReintentar = () => void consulta.refetch();

  if (consulta.isPending) return <Pidiendo />;
  if (consulta.isError) return <NoSePudoPreguntar fallo={consulta.error} alReintentar={alReintentar} />;

  const situacion = consulta.data;
  switch (situacion.estado) {
    case 'no-se-pudo-consultar':
      return <NoSePudoConsultar situacion={situacion} alReintentar={alReintentar} />;
    case 'sin-registros':
      return <SinRegistros situacion={situacion} />;
    case 'sin-deuda':
      return <SinDeudaDelServidor />;
    case 'con-deuda':
      return <ConDeuda situacion={situacion} />;
  }
}
