import { compararImportes, formatearImporte, type Importe as ImporteDecimal } from '@kamayuk/formato';
import {
  Boton,
  Casilla,
  Importe,
  Insignia,
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaRotulo,
  avisar,
  cn,
} from '@kamayuk/ui';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { recargoDe, tonoDe, totalDe } from '../../datos/cuentas.ts';
import { CONTRIBUYENTE, FECHA_DE_CORTE } from '../../datos/demostracion.ts';
import { hayPlataforma, useLaFuente } from '../../datos/fuente.ts';
import type { Deuda, TonoDeInsignia } from '../../datos/tipos.ts';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { cuenta, destinoAlPagar, inicio, resumen, seleccion, vivasDelArtboard } from '../../recorrido/recorrido.ts';
import { fechaEnPalabras } from './fechaEnPalabras.ts';
import { LaConsulta } from './LaConsulta.tsx';

/**
 * **Paso 2 · Elegir qué pago** (`diseno/Ciudadano.dc.html`: plantilla 182-309, logica 1102-1176).
 *
 * Lo primero que se ve es el total, porque es lo que se viene a saber; cada concepto se abre para ver
 * de donde sale la cifra.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * El total, lo que queda con la amnistia, las cuatro cifras y la nota salen de `resumen` (la deuda
 * viva); lo marcado, de `cuenta` y `seleccion`; el total y el recargo de cada concepto, de `totalDe` y
 * `recargoDe`. Todo eso esta en `src/datos/cuentas.ts` y `src/recorrido/recorrido.ts`. Aqui solo se
 * PREGUNTA si un importe es mayor que cero (`compararImportes`, de `@kamayuk/formato`) para decidir si
 * se dice «incluye … de recargo» o el ahorro. Que la pantalla pinta lo que las cuentas dicen, y no lo
 * que ella sumaria, lo demuestra `Deudas.cuentas.test.tsx` sustituyendo las cuentas por otras.
 *
 * <h2>Las piezas de `@kamayuk/ui`, y lo que se les ajusta</h2>
 *
 * · **`Importe`** en cada cifra, con `fechaCalculo={FECHA_DE_CORTE}` y `fechaImplicita`: la fecha ya la
 *   dice la banda. Pinta su numero en `--tinta` y seminegrita, y no admite `className`; donde el
 *   artboard lo quiere blanco, verde, azul o en negrita, se le cambia desde fuera con un selector de
 *   descendiente sobre tokens (`[&_span]:text-sobre-azul`), sin tocar la pieza.
 * · **`Casilla`** para marcar. Trae la marca dentro de una caja con filo, que es la de la rejilla de
 *   V8; el artboard dibuja la marca suelta, de 20 px, en una etiqueta de 44 px de alto. La caja se
 *   deja sin filo, sin relleno y sin papel apuntando a su `data-slot="casilla-caja"`, que es para lo que
 *   la libreria pone el `data-slot` («que una pantalla pueda apuntar a la pieza sin depender de una
 *   clase», `shadcn/boton.tsx`).
 * · **`Insignia`** tal cual: su letra (11.5 px) y su radio (pildora) son la decision del producto; el
 *   artboard escribe 12.5 px y 3 px (`INS`, linea 730). Los colores son los mismos cuatro pares.
 * · **`Tabla`** y compania tal cual, con el filo y el papel del contenedor del artboard (linea 254) y
 *   su ancho minimo. Los rotulos salen en versalitas de 11.5 px sobre `--sup`, que es la cabecera del
 *   producto, y no los 12.5 px sobre `#F2F2F2` de `TH` (linea 721).
 * · **`Boton`** para todas las acciones, con las medidas del artboard encima.
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · **«Lo que debe, por concepto» es el `h1`**; en el artboard, un `h2`. Es el titulo del paso (el
 *   marcador del issue 4 ya lo usaba) y la pagina no tiene otro: sin el, el paso no tendria encabezado
 *   principal por el que llegar.
 * · **El boton de pagar sin nada marcado** se pinta con `--linea` y `--tinta-2`, no blanco sobre
 *   `#BBB` (1.92:1): sigue siendo pulsable —avisa—, y lo que dice se tiene que leer.
 * · **La ayuda «Marque al menos un concepto…» (linea 298) solo sale si queda deuda.** En el artboard
 *   cuelga de `seleccion.vacio`, que tambien es cierto sin deuda viva, y saldria encima de «No le queda
 *   nada por pagar» pidiendo marcar lo que ya no existe.
 * · **«Va a pagar los N conceptos» con un solo concepto vivo** dice «Va a pagar 1 concepto» (forma
 *   `_one`), y no «los 1 conceptos».
 * · Los colores que no son token, con su porque, en `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 *
 * <h2>De donde sale el contribuyente</h2>
 *
 * De `CONTRIBUYENTE` de `src/datos/demostracion.ts`, como la deuda sale de `DEUDAS` en el reductor:
 * el recorrido trabaja sobre los datos de la demostracion y la busqueda no guarda otra situacion.
 */

/** El color de la linea del vencimiento, por el tono del estado (artboard, linea 1140). */
const TINTA_DEL_VENCIMIENTO: Readonly<Record<TonoDeInsignia, string>> = {
  mal: 'text-mal-tinta',
  atencion: 'text-atencion-tinta',
  ok: 'text-tinta-3',
  info: 'text-tinta-3',
};

const CERO: ImporteDecimal = '0.00';
const hay = (importe: ImporteDecimal): boolean => compararImportes(importe, CERO) > 0;

/** `Importe`, sin su fecha (la dice la banda) y con la letra que el artboard pide en ese sitio. */
function Cifra({ valor, className }: { readonly valor: ImporteDecimal; readonly className?: string }) {
  return (
    <span className={cn('block [&_span]:font-bold', className)}>
      <Importe valor={valor} fechaCalculo={FECHA_DE_CORTE} fechaImplicita />
    </span>
  );
}

/** Quien es, para que no pague la deuda de otro (lineas 186-193). */
function QuienEs() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const { nombre, codigo, tipoDeDocumento, numeroDeDocumento, predios, vehiculos } = CONTRIBUYENTE;

  return (
    <div className="flex flex-wrap items-center gap-4 border border-linea bg-superficie px-5 py-4">
      <span className="min-w-[200px] flex-1">
        <span className="block text-[12.5px] text-tinta-3">{t('Contribuyente')}</span>
        <span className="mt-[2px] block text-[17px] font-bold text-pretty">{nombre}</span>
        <span className="mt-[2px] block text-[13.5px] text-tinta-3">
          {t('Código {{codigo}} · {{tipoDeDocumento}} {{numeroDeDocumento}} · {{predios}} y {{vehiculos}}', {
            codigo,
            tipoDeDocumento,
            numeroDeDocumento,
            predios: t('{{count}} predio', { count: predios }),
            vehiculos: t('{{count}} vehículo', { count: vehiculos }),
          })}
        </span>
      </span>
      <Boton
        type="button"
        className="min-h-[40px] flex-[0_0_auto] px-4 py-0 text-[14px]"
        onClick={() => despachar({ tipo: 'irA', paso: inicio(estado) })}
      >
        {t('No soy yo')}
      </Boton>
    </div>
  );
}

/**
 * El total, arriba (lineas 197-208), y las cuatro cifras que lo componen (210-218). A ≤ 520 px, de dos en
 * dos (linea 41): `max-[521px]`, porque Tailwind v4 emite `max-[520px]` como `width < 520px`.
 */
function ElTotal() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const cifras = resumen(estado);

  const cuatro: readonly { readonly rotulo: string; readonly valor: ReactNode; readonly nota: string }[] = [
    {
      rotulo: t('Impuesto y arbitrios'),
      valor: <Cifra valor={cifras.insoluto} />,
      nota: t('Lo que no se condona'),
    },
    {
      rotulo: t('Interés moratorio'),
      valor: <Cifra valor={cifras.interes} className="[&_span]:text-ok-tinta" />,
      nota: t('La amnistía lo condona entero'),
    },
    {
      rotulo: t('Gastos y costas'),
      valor: <Cifra valor={cifras.gastos} />,
      nota: t('Emisión y cobranza coactiva'),
    },
    {
      rotulo: t('Conceptos'),
      valor: <span className="block font-bold text-tinta tabular-nums">{cifras.conceptos}</span>,
      nota: t('Predial, arbitrios y vehicular'),
    },
  ];

  return (
    <>
      <div
        data-banda-del-total=""
        className="flex flex-wrap items-end gap-[26px] bg-azul px-5 py-[22px] text-sobre-azul"
      >
        <span className="min-w-[200px] flex-1">
          <span className="block text-[12.5px] tracking-[0.09em] text-sobre-barra-2 uppercase">
            {t('Deuda total al {{fecha}}', { fecha: fechaEnPalabras(FECHA_DE_CORTE) })}
          </span>
          <Cifra
            valor={cifras.total}
            className="mt-[5px] text-[34px] leading-[1.1] tracking-[-0.02em] [&_span]:text-sobre-azul"
          />
          <span className="mt-[6px] block text-[13.5px] text-pretty text-sobre-barra-2">
            {t('{{count}} de {{conceptos}} conceptos están vencidos. El interés corre cada día que pasa.', {
              count: cifras.vencidas,
              conceptos: cifras.conceptos,
            })}
          </span>
        </span>
        <span className="flex-[0_0_auto]">
          <span className="block text-[12.5px] tracking-[0.09em] text-sobre-barra-2 uppercase">
            {t('Con la amnistía')}
          </span>
          <Cifra valor={cifras.conAmnistia} className="mt-1 text-[24px] [&_span]:text-sobre-azul" />
          <span className="mt-[3px] block text-[12.5px] text-sobre-barra-2">
            {t('se descuenta {{importe}} de interés', { importe: formatearImporte(cifras.interes) })}
          </span>
        </span>
      </div>

      <ul
        data-cifras=""
        className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(162px,1fr))] overflow-hidden border border-t-0 border-linea bg-superficie p-0 max-[521px]:grid-cols-2"
      >
        {cuatro.map(({ rotulo, valor, nota }) => (
          <li
            key={rotulo}
            className="-mt-px -ml-px border-t border-l border-linea-2 bg-superficie px-[18px] py-[15px]"
          >
            <p className="m-0 text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{rotulo}</p>
            <div className="mt-[6px] text-[20px]">{valor}</div>
            <p className="mt-1 mb-0 text-[12.5px] text-pretty text-tinta-3">{nota}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** El desglose de un concepto: su tabla y su nota (lineas 251-279). */
function Detalle({ deuda, id }: { readonly deuda: Deuda; readonly id: string }) {
  const { titulo, anchoMinimo, columnas, filas, columnaDeInsignia, nota } = deuda.detalle;
  const idDelTitulo = `${id}-titulo`;

  return (
    <div id={id} className="border-t border-linea-2 bg-sup px-5 pt-1 pb-4">
      <p
        id={idDelTitulo}
        className="mt-[14px] mb-[10px] text-[13px] font-bold tracking-[0.07em] text-tinta-3 uppercase"
      >
        {titulo}
      </p>
      <Tabla
        aria-labelledby={idDelTitulo}
        style={{ minWidth: anchoMinimo }}
        marco={{ className: 'border border-linea bg-superficie' }}
      >
        <TablaCabecera>
          <tr>
            {columnas.map((columna) => (
              <TablaRotulo key={columna.rotulo} cifra={columna.cifra}>
                {columna.rotulo}
              </TablaRotulo>
            ))}
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {filas.map((fila) => (
            <TablaFila key={fila.join('|')}>
              {fila.map((celda, j) => (
                <TablaCelda
                  // Las celdas de una fila no tienen otra identidad que su columna.
                  key={columnas[j]?.rotulo ?? j}
                  cifra={columnas[j]?.cifra === true}
                  identifica={j === 0}
                >
                  {j === columnaDeInsignia ? <Insignia tono={tonoDe(celda)}>{celda}</Insignia> : celda}
                </TablaCelda>
              ))}
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>
      <p className="mt-[11px] mb-0 text-[13.5px] leading-[1.55] text-pretty text-tinta-3">{nota}</p>
    </div>
  );
}

/** Un concepto de la lista (lineas 228-281). */
function Concepto({ deuda }: { readonly deuda: Deuda }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelDetalle = useId();
  const marcada = estado.marcadas[deuda.id] === true;
  const abierta = estado.abierta === deuda.id;
  const recargo = recargoDe(deuda);

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
          <span className="mt-[3px] block text-[13.5px] text-pretty text-tinta-3">
            {`${deuda.unidad} · ${deuda.cuotas}`}
          </span>
          <span className="mt-[7px] flex flex-wrap items-center gap-[10px]">
            <Insignia tono={deuda.tono}>{deuda.estado}</Insignia>
            <span className={cn('text-[13.5px]', TINTA_DEL_VENCIMIENTO[deuda.tono])}>{deuda.vence}</span>
          </span>
        </span>
        <span className="min-w-[132px] flex-[0_0_auto] text-right">
          <Cifra valor={totalDe(deuda)} className="text-[19px]" />
          {hay(recargo) ? (
            <span className="mt-[3px] block text-[12.5px] text-mal-tinta">
              {t('incluye {{importe}} de recargo', { importe: formatearImporte(recargo) })}
            </span>
          ) : null}
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
      {abierta ? <Detalle deuda={deuda} id={idDelDetalle} /> : null}
    </li>
  );
}

/** La barra de pago: lo elegido y el boton, siempre a la vista (lineas 284-299). */
function BarraDePago() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const viva = vivasDelArtboard(estado).length;
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
          <Cifra valor={lo.total} className="mt-[3px] text-[27px] [&_span]:text-azul" />
          {hay(lo.interes) ? (
            <span className="mt-[3px] block text-[13.5px] text-ok-tinta">
              {t('Con la amnistía paga {{conAmnistia}}: se descuentan {{interes}} de interés', {
                conAmnistia: formatearImporte(lo.conAmnistia),
                interes: formatearImporte(lo.interes),
              })}
            </span>
          ) : null}
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

/** Sin deuda viva no hay lista que pintar: queda la constancia (lineas 301-307). */
function SinDeuda() {
  const { t } = useTranslation();
  return (
    <div className="mt-[18px] border border-l-[5px] border-ok-tinta/25 border-l-ok-tinta bg-ok-fondo px-[22px] py-5">
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
    </div>
  );
}

/** El paso 2 del artboard: la lista de la demostracion, con su desglose y su insignia por concepto. */
function DeudasDeLaDemostracion() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const viva = vivasDelArtboard(estado);
  const todo = seleccion(estado).length === viva.length;

  return (
    <div>
      <QuienEs />

      {viva.length === 0 ? (
        <SinDeuda />
      ) : (
        <>
          <ElTotal />

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
                <Concepto key={deuda.id} deuda={deuda} />
              ))}
            </ul>
          </section>

          <BarraDePago />
        </>
      )}
    </div>
  );
}

/**
 * **Paso 2, en los dos modos** (issue 28).
 *
 * `hayPlataforma` mira la fuente inyectada y no `import.meta.env`: la pregunta que la pantalla hace
 * es «¿hay a quien consultar?», la contesta el dato, y asi los dos modos se prueban inyectando una
 * fuente en vez de trucando el entorno.
 *
 * Y son **dos pantallas enteras**, no una con condiciones dentro. Lo que el artboard dibuja —cuotas,
 * vencimiento, insignia de estado y desglose de servicios— el servidor no lo trae, y una pantalla
 * sola acabaria con un `?? null` en cada linea: el sitio exacto donde un dia aparece un valor por
 * omision que se lee como un dato. Separadas, la de demostracion es la de siempre —byte a byte— y la
 * de plataforma solo puede dibujar lo que le dieron.
 */
export function Deudas() {
  return hayPlataforma(useLaFuente()) ? <LaConsulta /> : <DeudasDeLaDemostracion />;
}
