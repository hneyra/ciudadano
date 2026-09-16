import { formatearFecha, formatearImporte } from '@kamayuk/formato';
import {
  Boton,
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

import escudo from '../../../diseno/escudo-catacaos.png';
import { cifraSinSimbolo, conAmnistiaDe } from '../../datos/cuentas.ts';
import { CONTRIBUYENTE, ORDENANZA } from '../../datos/demostracion.ts';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { type PagoSellado, conceptosDelPago, vivas } from '../../recorrido/recorrido.ts';
import { rotuloDelMedio } from '../pagar/textosDeLosMedios.ts';

/**
 * **Paso 5 · Comprobante** (`diseno/Ciudadano.dc.html`: plantilla 477-565, `@media` 29-44, `print`
 * 45-49, logica 1273-1326).
 *
 * La constancia de pago: lo que la persona conserva y presenta si la deuda volviera a aparecer. Por
 * eso **se imprime sola**: todo lo que no es el recibo lleva `data-noprint` —la banda de exito, las
 * acciones y la invitacion, aqui; la barra, la franja, el pie y los avisos, en `src/marco/`— y la
 * regla `@media print` de `src/estilos.css` lo oculta. Que la regla este y que en la pantalla no
 * quede nada fuera del recibo sin marcar lo miden `verificaciones/lo-no-imprimible-no-se-imprime.test.ts`
 * y `Comprobante.test.tsx`.
 *
 * <h2>El recibo se dibuja SOLO con el pago sellado</h2>
 *
 * Todo sale de `estado.ultimo`, que `confirmarPago` sello: los conceptos (`conceptosDelPago`), los
 * importes, el medio, el destino y los numeros del comprobante. Nada de `marcadas`, `seleccion` ni
 * `cuenta`: volver a elegir qué pago y regresar aqui ensena el mismo recibo. Lo unico que se lee del
 * estado vivo es lo que el artboard tambien lee vivo (1283-1286): si hay sesion —que acciones se
 * ofrecen— y si queda deuda viva —«Pagar otra deuda»—.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * El importe de cada fila es `conAmnistiaDe` (insoluto + gastos) y la cifra sin «S/ » es
 * `cifraSinSimbolo`, las dos de `src/datos/cuentas.ts`; el condonado y el total, los del sello.
 *
 * <h2>Las piezas, y lo que se les ajusta</h2>
 *
 * · **`Tabla`** y compania para los conceptos, con el `min-width: 660px` del artboard (sin minimo a
 *   ≤ 700 px) y sus rellenos de 18/14/12 px. Los rotulos, la cabecera del producto (como en el paso 2).
 *   El pie no es pieza de la libreria: es un `<tfoot>` con un `th scope="row"` que ocupa las tres
 *   primeras columnas, donde el artboard pinta tres celdas y dos vacias.
 * · **`Boton`** para las acciones: «Descargar comprobante» y «Ver mis pagos» primarios —el `ACERO` de
 *   la linea 1285 es `--azul`, fila `ACERO` de la tabla de la paleta—, el resto secundarios.
 * · **El escudo** es el mismo recurso que la barra (`diseno/escudo-catacaos.png`).
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · «Su pago se registró» es el `h1` (el marcador del issue 4 ya lo usaba) y «Constancia de pago» el
 *   `h2` que da nombre a la region del recibo: en el artboard, dos `span`.
 * · La meta es una lista de definiciones (`dl`), no seis `div`.
 * · Los `@media` de 700 y 520 px son variantes `max-[701px]:` y `max-[521px]:`: Tailwind v4 las
 *   emite como `width < 701px`, que es el `max-width: 700px` del artboard (como `Barra.tsx`).
 * · Los colores que no son token, con su porque, en `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 */

/**
 * A ≤ 700 px la tabla pierde su minimo y parte; a ≤ 520 px, menos relleno (29-44). Los rotulos van por
 * aqui; las celdas, por `CELDA_DEL_RECIBO`, que ademas bajan a 13 px como en el artboard. Los rotulos
 * no: `TablaRotulo` ya pinta 11.5 px, y subirlos a 13 px en versalitas espaciadas los hacia el ancho
 * minimo de cada columna: a 400 px la tabla media 384 px en un marco de 362 (medido). Con 11.5 px mide
 * 371, lo que piden «municipales», «habitación» y «1,854.60»; el artboard, 366. Lo que sobra se desplaza
 * dentro del marco de `Tabla`, no la pagina.
 */
const ROTULO_DEL_RECIBO = 'px-[18px] max-[701px]:px-[14px] max-[701px]:whitespace-normal max-[521px]:px-3';
const CELDA_DEL_RECIBO = `${ROTULO_DEL_RECIBO} max-[521px]:text-[13px]`;

/** Una celda de la meta (lineas 497-502 y 1291-1300): el filo fino de `CELDA`, rotulo y valor. */
function Meta({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div className="-mt-px -ml-px border-t border-l border-linea-2 bg-superficie px-6 py-[14px]">
      <dt className="m-0 text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{rotulo}</dt>
      <dd className="mx-0 mt-[5px] mb-0 text-[14.5px] font-bold text-pretty wrap-anywhere">{children}</dd>
    </div>
  );
}

/** El rotulo con que se dice el medio del sello, traducido (los textos de `MEDIOS` son del locale). */
function useRotuloDelMedio(pago: PagoSellado): string {
  const { t } = useTranslation();
  return t(rotuloDelMedio(pago.medio));
}

/** La banda verde de exito, que no se imprime (lineas 480-489 y 1276-1279). */
function BandaDeExito({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const medio = useRotuloDelMedio(pago);

  return (
    <div
      data-noprint="1"
      className="mb-[18px] flex items-start gap-[15px] border border-l-[5px] border-ok-tinta/25 border-l-ok-tinta bg-ok-fondo px-[22px] py-5"
    >
      <span
        aria-hidden="true"
        className="grid size-[38px] flex-[0_0_auto] place-items-center rounded-full bg-ok-tinta text-sobre-azul"
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-[21px] font-bold text-pretty text-ok-tinta">{t('Su pago se registró')}</h1>
        <p className="mt-[6px] mb-0 text-[15px] leading-[1.6] text-pretty text-ok-tinta">
          {t(
            'Pagó {{importe}} con {{medio}}. Le enviamos el comprobante a {{destino}}, y puede descargarlo aquí mismo. La deuda pagada ya se descontó de su cuenta.',
            {
              importe: formatearImporte(pago.conAmnistia),
              // «con tarjeta»: el artboard lo pone en minusculas (linea 1279).
              medio: medio.toLowerCase(),
              destino: pago.destino ?? t('su correo'),
            },
          )}
        </p>
      </div>
    </div>
  );
}

/** El recibo: lo unico que se imprime (lineas 491-534 y 1287-1322). */
function Recibo({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const idDelTitulo = useId();
  const medio = useRotuloDelMedio(pago);
  const { comprobante } = pago;

  const columnas = [
    { rotulo: t('Concepto'), cifra: false },
    { rotulo: t('Unidad'), cifra: false },
    { rotulo: t('Cuotas'), cifra: false },
    { rotulo: t('Importe S/'), cifra: true },
  ];

  return (
    <section
      aria-labelledby={idDelTitulo}
      data-recibo="1"
      className="border border-linea bg-superficie shadow-sombra-1"
    >
      <div className="flex flex-wrap items-start gap-4 border-b-2 border-azul px-6 pt-[22px] pb-[18px]">
        <img src={escudo} alt="" width={38} height={46} className="block h-[46px] w-auto flex-[0_0_auto]" />
        <span className="min-w-[180px] flex-1">
          <span className="block text-[16px] font-bold">{t('Municipalidad Distrital de Catacaos')}</span>
          <span className="mt-[2px] block text-[13px] text-tinta-3">{t('Gerencia de Administración Tributaria')}</span>
        </span>
        <div className="min-w-[140px] flex-[1_0_auto] text-right">
          <h2 id={idDelTitulo} className="m-0 text-[13px] font-normal text-tinta-3">
            {t('Constancia de pago')}
          </h2>
          <span className="mt-[2px] block text-[17px] font-bold text-azul tabular-nums">{comprobante.numero}</span>
        </div>
      </div>

      <dl
        data-meta="1"
        className="m-0 grid grid-cols-[repeat(auto-fit,minmax(206px,1fr))] overflow-hidden bg-superficie max-[701px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[521px]:grid-cols-[minmax(0,1fr)]"
      >
        <Meta rotulo={t('Número de operación')}>{comprobante.operacion}</Meta>
        <Meta rotulo={t('Fecha y hora')}>{`${formatearFecha(comprobante.fecha)} · ${comprobante.hora}`}</Meta>
        <Meta rotulo={t('Medio de pago')}>{medio}</Meta>
        <Meta rotulo={t('Contribuyente')}>{CONTRIBUYENTE.nombre}</Meta>
        <Meta rotulo={t('Código')}>{CONTRIBUYENTE.codigo}</Meta>
        <Meta rotulo={t('Enviado a')}>{pago.destino ?? t('su correo')}</Meta>
      </dl>

      <Tabla className="min-w-[660px] max-[701px]:min-w-0">
        <TablaCabecera>
          <tr>
            {columnas.map((columna) => (
              <TablaRotulo key={columna.rotulo} cifra={columna.cifra} className={ROTULO_DEL_RECIBO}>
                {columna.rotulo}
              </TablaRotulo>
            ))}
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {conceptosDelPago(pago).map((deuda) => (
            <TablaFila key={deuda.id}>
              <TablaCelda identifica className={cn('font-bold', CELDA_DEL_RECIBO)}>
                {deuda.concepto}
              </TablaCelda>
              <TablaCelda className={CELDA_DEL_RECIBO}>{deuda.unidad}</TablaCelda>
              <TablaCelda className={CELDA_DEL_RECIBO}>{deuda.cuotas}</TablaCelda>
              <TablaCelda cifra className={CELDA_DEL_RECIBO}>
                {cifraSinSimbolo(conAmnistiaDe(deuda))}
              </TablaCelda>
            </TablaFila>
          ))}
        </TablaCuerpo>
        <tfoot>
          <tr className="text-[14px] text-ok-tinta">
            <th scope="row" colSpan={3} className={cn('border-t border-linea-2 py-[10px] text-left font-normal', CELDA_DEL_RECIBO)}>
              {t('Interés condonado por la {{ordenanza}}', { ordenanza: ORDENANZA })}
            </th>
            <td className={cn('border-t border-linea-2 py-[10px] text-right tabular-nums', CELDA_DEL_RECIBO)}>
              {`− ${cifraSinSimbolo(pago.interes)}`}
            </td>
          </tr>
          <tr className="bg-sup text-[14.5px] font-bold text-tinta">
            <th scope="row" colSpan={3} className={cn('border-t-2 border-linea py-3 text-left', CELDA_DEL_RECIBO)}>
              {t('Total pagado')}
            </th>
            <td className={cn('border-t-2 border-linea py-3 text-right tabular-nums', CELDA_DEL_RECIBO)}>
              {cifraSinSimbolo(pago.conAmnistia)}
            </td>
          </tr>
        </tfoot>
      </Tabla>

      <div className="border-t border-linea-2 px-6 pt-[18px] pb-[22px]">
        <p className="m-0 max-w-[80ch] text-[13.5px] leading-[1.65] text-pretty text-tinta-3">
          {t(
            'Esta constancia acredita el pago de los conceptos detallados. Consérvela: es lo que hay que presentar si la deuda volviera a aparecer. El pago con tarjeta, Yape o pagalo.pe se aplica de inmediato; el pago con código de banco, al día siguiente hábil.',
          )}
        </p>
      </div>
    </section>
  );
}

/** Las medidas de un boton de las acciones (lineas 537-543 y 1287-1288). */
const BOTON_DE_ACCION = 'min-h-[46px] py-0 text-[15.5px] max-[701px]:w-full';

/** Descargar, imprimir y seguir; no se imprime (lineas 536-544 y 1281-1289). */
function Acciones({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();

  return (
    <div
      data-acciones="1"
      data-noprint="1"
      className="mt-[18px] flex flex-wrap items-center gap-[11px] max-[701px]:flex-col max-[701px]:items-stretch"
    >
      <Boton
        type="button"
        variante="primario"
        onClick={() => avisar(t('Se descargaría el comprobante {{numero}} en PDF.', { numero: pago.comprobante.numero }))}
        className={cn(BOTON_DE_ACCION, 'px-6')}
      >
        {t('Descargar comprobante')}
      </Boton>
      <Boton type="button" onClick={() => window.print()} className={cn(BOTON_DE_ACCION, 'px-[22px]')}>
        {t('Imprimir')}
      </Boton>
      <span aria-hidden="true" className="min-w-2 flex-1 max-[701px]:hidden" />
      {estado.autenticado ? (
        <>
          <Boton
            type="button"
            variante="primario"
            onClick={() => despachar({ tipo: 'irA', paso: 'historial' })}
            className={cn(BOTON_DE_ACCION, 'px-[22px]')}
          >
            {t('Ver mis pagos')}
          </Boton>
          {vivas(estado).length > 0 ? (
            <Boton
              type="button"
              onClick={() => despachar({ tipo: 'irA', paso: 'deudas' })}
              className={cn(BOTON_DE_ACCION, 'px-[22px]')}
            >
              {t('Pagar otra deuda')}
            </Boton>
          ) : null}
        </>
      ) : (
        <Boton
          type="button"
          onClick={() => despachar({ tipo: 'consultarOtra' })}
          className={cn(BOTON_DE_ACCION, 'px-[22px]')}
        >
          {t('Consultar otra deuda')}
        </Boton>
      )}
    </div>
  );
}

/** Sin sesion: guardar el pago en una cuenta; no se imprime (lineas 546-552). */
function Invitacion({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const { despachar } = useRecorrido();
  const idDelTitulo = useId();

  return (
    <section
      aria-labelledby={idDelTitulo}
      data-noprint="1"
      className="mt-[18px] border border-l-4 border-azul/25 border-l-azul bg-info-fondo px-[18px] py-4"
    >
      <h2 id={idDelTitulo} className="m-0 text-[15px] font-bold">
        {t('Guarde este pago en una cuenta')}
      </h2>
      <p className="mt-[6px] mb-3 max-w-[70ch] text-[14px] leading-[1.6] text-pretty text-tinta-2">
        {t(
          'Si crea una cuenta con {{correo}}, este comprobante y los anteriores quedan guardados: no tendrá que volver a buscarlos.',
          { correo: pago.destino ?? t('su correo') },
        )}
      </p>
      <Boton
        type="button"
        onClick={() => despachar({ tipo: 'irA', paso: 'identificar' })}
        className="min-h-[42px] border-azul px-[18px] py-0 text-[14.5px] font-bold text-azul hover:border-azul hover:bg-azul-suave"
      >
        {t('Crear mi cuenta')}
      </Boton>
    </section>
  );
}

export function Comprobante() {
  const { estado } = useRecorrido();
  const pago = estado.ultimo;
  // Sin sello no se llega aqui por ninguna accion (`confirmarPago` es quien pasa al comprobante); solo
  // un estado inicial escrito a mano. No hay recibo que dibujar con otra cosa que el sello.
  if (pago === null) return null;

  return (
    <div>
      <BandaDeExito pago={pago} />
      <Recibo pago={pago} />
      <Acciones pago={pago} />
      {estado.autenticado ? null : <Invitacion pago={pago} />}
    </div>
  );
}
