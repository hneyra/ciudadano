import { formatearFecha, formatearImporte } from '@kamayuk/formato';
import {
  Boton,
  Insignia,
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaNota,
  TablaRotulo,
  avisar,
  cn,
} from '@kamayuk/ui';
import { type ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cifraSinSimbolo, totalDe } from '../../datos/cuentas.ts';
import { useHistorial, useLaSituacion, useUnidades } from '../../datos/fuente.ts';
import type { PredioDelPortal, Unidad } from '../../datos/tipos.ts';
import { AvisoConFilo } from '../../piezas/AvisoConFilo.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { type PagoSellado, aCobrar, cuentaPendiente, pendientes } from '../../recorrido/recorrido.ts';
import { rotuloDelMedio } from '../pagar/textosDeLosMedios.ts';

/**
 * **Mis pagos**, con sesion (`diseno/Ciudadano.dc.html`: plantilla 567-671, datos 887-917, logica
 * 1327-1376).
 *
 * Lo que la persona pago, lo que le queda y de donde sale lo que paga. Sin franja de pasos: aqui no hay
 * nada que avanzar (lo decide `Marco`).
 *
 * <h2>De donde sale cada cosa</h2>
 *
 * · **El pago reciente** —la banda y la primera fila de la tabla— sale SOLO de `estado.ultimo`, el pago
 *   sellado, y solo si `recienPagado`: sus conceptos (`pago.conceptos`), su importe, su medio y los
 *   numeros del comprobante. Como en el comprobante, nada de `marcadas` ni de la seleccion.
 * · **Los pagos anteriores y las unidades** se leen de la fuente del portal (`useHistorial`,
 *   `useUnidades`), como los leeria un portal con backend: mientras llegan, su seccion queda
 *   `aria-busy`; si fallan, lo dice un aviso.
 * · **Lo pendiente** es la deuda viva (`pendientes`), y su total, `cuentaPendiente`.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * El total pendiente es `cuentaPendiente(estado).total` (de `cuentaDe`) y el de cada concepto `totalDe`,
 * los dos de `src/datos/cuentas.ts`; la columna «Importe S/» es `cifraSinSimbolo`. Lo mide
 * `Historial.cuentas.test.tsx` sustituyendo las cuentas por otras.
 *
 * <h2>Las piezas, y lo que se les ajusta</h2>
 *
 * · **`Tabla`** y compania para «Pagos realizados», con el `min-width: 760px` del artboard: se desplaza
 *   dentro de su marco, no la pagina. Los rotulos, la cabecera del producto (como en los pasos 2 y 5).
 *   La nota del pie es `TablaNota` con la letra y el relleno del artboard.
 * · **`Insignia`** tal cual para la situacion de cada concepto pendiente, y «Al día» sin deuda.
 * · **`Boton`** para todas las acciones, con las medidas del artboard encima.
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · El titulo de la banda del pago reciente es un `h2` y la banda una region con su nombre; en el
 *   artboard, un `span`. Lo que queda pendiente es una lista (`ul`), y los datos de cada unidad tambien.
 * · El boton «Comprobante» de cada fila se llama «Comprobante <numero>»: seis botones con el mismo
 *   nombre no se distinguen con un lector de pantalla. El nombre empieza por lo que se ve.
 * · «Mis predios y vehículos» lleva a este mismo `#/historial`, y ademas deja el foco en «De dónde sale
 *   lo que paga» y lo trae a la vista (`enfocarUnidades`, del reductor). En el artboard, las dos opciones
 *   abren el historial igual.
 * · Los colores que no son token, con su porque, en `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 */

/** Las celdas de la tabla de pagos: `TD` y `TDN` del artboard (lineas 722-723), 18 px de lado y 14 px de letra. */
const CELDA = 'px-[18px] text-[14px]';

/**
 * Una seccion blanca con filo (lineas 583, 613 y 643), con el nombre de su titulo. La cabecera la
 * dibuja quien la usa, con el `id` que tiene que llevar el `h2`: las tres son distintas.
 */
function Seccion({
  cabecera,
  children,
  ocupada = false,
  className,
}: {
  readonly cabecera: (idDelTitulo: string) => ReactNode;
  readonly children: ReactNode;
  /** Mientras la fuente no contesta: `aria-busy`. */
  readonly ocupada?: boolean;
  readonly className?: string;
}) {
  const idDelTitulo = useId();
  return (
    <section
      aria-labelledby={idDelTitulo}
      aria-busy={ocupada || undefined}
      className={cn('border border-linea bg-superficie', className)}
    >
      {cabecera(idDelTitulo)}
      {children}
    </section>
  );
}

/**
 * El pago de esta visita, arriba y en verde (lineas 573-581 y 1330-1335).
 *
 * **Con plataforma no se dice que se pago** (issue 28, revision): no hubo cobro, no hay operacion
 * que numerar y no se envio nada. Se dice lo que es —una simulacion— y se quita el verde, que es el
 * color de un pago hecho.
 */
function PagoReciente({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelTitulo = useId();
  const simulado = estado.conPlataforma;

  return (
    <section
      aria-labelledby={idDelTitulo}
      className={cn(
        'mb-[18px] flex flex-wrap items-center gap-[14px] border border-l-[5px] px-[18px] py-4',
        simulado ? 'border-linea border-l-azul bg-superficie' : 'border-ok-tinta/25 border-l-ok-tinta bg-ok-fondo',
      )}
    >
      <span className="min-w-[200px] flex-1">
        <h2 id={idDelTitulo} className={cn('m-0 text-[15px] font-bold', simulado ? null : 'text-ok-tinta')}>
          {simulado
            ? t('Pago simulado de {{importe}} en esta visita', { importe: formatearImporte(aCobrar(estado, pago)) })
            : t('Pago de {{importe}} registrado hoy', { importe: formatearImporte(aCobrar(estado, pago)) })}
        </h2>
        <span
          className={cn('mt-[3px] block text-[13.5px] text-pretty', simulado ? 'text-tinta-3' : 'text-ok-tinta')}
        >
          {simulado
            ? t('No se cobró nada, no se envió ningún comprobante y su deuda sigue pendiente.')
            : t('Operación {{operacion}} · {{medio}} · comprobante {{numero}}, enviado a {{destino}}', {
                operacion: pago.comprobante.operacion,
                medio: t(rotuloDelMedio(pago.medio)),
                numero: pago.comprobante.numero,
                destino: pago.destino ?? t('su correo'),
              })}
        </span>
      </span>
      <Boton
        type="button"
        onClick={() => despachar({ tipo: 'irA', paso: 'comprobante' })}
        className={cn(
          'min-h-[40px] flex-[0_0_auto] px-4 py-0 text-[14px] font-bold',
          simulado ? null : 'border-ok-tinta text-ok-tinta hover:border-ok-tinta hover:bg-ok-fondo',
        )}
      >
        {simulado ? t('Ver cómo se vería') : t('Ver el comprobante')}
      </Boton>
    </section>
  );
}

/** Una fila de la tabla de pagos, ya dicha: fecha, concepto, medio, comprobante e importe. */
interface FilaDePago {
  readonly fecha: string;
  readonly concepto: string;
  readonly medio: string;
  readonly comprobante: string;
  readonly importe: string;
  readonly reciente: boolean;
}

/** «Pagos realizados»: el reciente, si lo hay, y los del historial (lineas 583-611 y 1337-1348). */
function PagosRealizados() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const historial = useHistorial();
  // Con plataforma el pago simulado NO entra en «Pagos realizados»: esa tabla es la lista de lo que
  // se pago, y ahi no se pago nada (issue 28, revision). Lo de esta visita lo dice la banda de
  // arriba, que ademas dice que es simulado.
  const pago = estado.recienPagado && !estado.conPlataforma ? estado.ultimo : null;

  const filas: FilaDePago[] = [
    ...(pago === null
      ? []
      : [
          {
            fecha: formatearFecha(pago.comprobante.fecha),
            concepto: pago.conceptos.map((deuda) => deuda.concepto).join(' · '),
            medio: t(rotuloDelMedio(pago.medio)),
            comprobante: pago.comprobante.numero,
            importe: cifraSinSimbolo(aCobrar(estado, pago)),
            reciente: true,
          },
        ]),
    ...(historial.data ?? []).map((anterior) => ({
      fecha: formatearFecha(anterior.fecha),
      concepto: t(anterior.concepto),
      medio: t(anterior.medio),
      comprobante: anterior.comprobante,
      importe: cifraSinSimbolo(anterior.importe),
      reciente: false,
    })),
  ];

  const columnas = [
    { rotulo: t('Fecha'), cifra: false },
    { rotulo: t('Concepto'), cifra: false },
    { rotulo: t('Medio'), cifra: false },
    { rotulo: t('Comprobante'), cifra: false },
    { rotulo: t('Importe S/'), cifra: true },
  ];

  return (
    <Seccion
      ocupada={historial.isPending}
      className="mb-[18px]"
      cabecera={(idDelTitulo) => (
        <div className="px-5 py-[14px]">
          {/* Sin filo inferior: el de arriba de la tabla (`Tabla`, `--linea-2`) es el `#EEE` de la linea 585. */}
          <h2 id={idDelTitulo} className="m-0 text-[17px] font-bold">
            {t('Pagos realizados')}
          </h2>
        </div>
      )}
    >
      {/*
        Con plataforma el fallo NO es una averia: el backend no publica pagos del ciudadano —lo unico
        que ofrece para este portal es `GET /portal/situacion`— y decir «vuelva a intentarlo» mandaria
        a insistir contra algo que no existe (issue 28).
      */}
      {historial.isError ? (
        estado.conPlataforma ? (
          <AvisoConFilo tono="atencion" className="m-5 px-4 py-3">
            {t(
              'El portal todavía no publica su historial de pagos: por ahora solo sabe lo que debe hoy. Los pagos anteriores están en la ventanilla de la municipalidad, con su comprobante.',
            )}
          </AvisoConFilo>
        ) : (
          <AvisoConFilo tono="mal" role="alert" className="m-5 px-4 py-3">
            {t('No pudimos traer sus pagos. Vuelva a intentarlo en unos minutos.')}
          </AvisoConFilo>
        )
      ) : null}
      <Tabla className="min-w-[760px]">
        <TablaCabecera>
          <tr>
            {columnas.map((columna) => (
              <TablaRotulo key={columna.rotulo} cifra={columna.cifra} className="px-[18px]">
                {columna.rotulo}
              </TablaRotulo>
            ))}
            {/* La columna de la accion no tiene rotulo, como en el artboard (linea 1338). */}
            <TablaRotulo className="px-[18px]" />
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {filas.map((fila) => (
            <TablaFila
              key={fila.comprobante}
              data-reciente={fila.reciente ? 'true' : undefined}
              className={fila.reciente ? 'bg-ok-fondo/40' : undefined}
            >
              <TablaCelda className={cn(CELDA, 'whitespace-nowrap')}>{fila.fecha}</TablaCelda>
              <TablaCelda className={CELDA}>{fila.concepto}</TablaCelda>
              <TablaCelda className={CELDA}>{fila.medio}</TablaCelda>
              <TablaCelda className={CELDA}>{fila.comprobante}</TablaCelda>
              <TablaCelda cifra className={CELDA}>
                {fila.importe}
              </TablaCelda>
              <TablaCelda className="px-[18px] py-[9px] text-right">
                <Boton
                  type="button"
                  aria-label={t('Comprobante {{numero}}', { numero: fila.comprobante })}
                  onClick={() => avisar(t('Se descargaría el comprobante {{numero}}.', { numero: fila.comprobante }))}
                  className="min-h-[36px] px-[13px] py-0 text-[13px]"
                >
                  {t('Comprobante')}
                </Boton>
              </TablaCelda>
            </TablaFila>
          ))}
        </TablaCuerpo>
      </Tabla>
      <TablaNota className="border-t border-linea-2 px-5 py-3 text-[13.5px] leading-[1.55]">
        {t(
          'Un pago aplicado ya descontó la cuota. Si pagó y la deuda sigue apareciendo, traiga el comprobante: se resuelve el mismo día.',
        )}
      </TablaNota>
    </Seccion>
  );
}

/** Una fila de lo pendiente (lineas 619-627). */
function FilaPendiente({
  concepto,
  vence,
  insignia,
  monto,
}: {
  readonly concepto: string;
  /** Lo que se dice bajo el concepto. Con plataforma no hay vencimiento: va la unidad. */
  readonly vence: string;
  /** La situacion del concepto, o `null` cuando nadie la sabe (issue 26). */
  readonly insignia: ReactNode;
  readonly monto: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-[14px] border-b border-linea-2 px-5 py-[13px]">
      <span className="min-w-[180px] flex-1">
        <span className="block text-[15px] font-bold text-pretty">{concepto}</span>
        <span className="mt-[2px] block text-[13.5px] text-tinta-3">{vence}</span>
      </span>
      {insignia}
      <span className="flex-[0_0_auto] text-[16px] font-bold tabular-nums">{monto}</span>
    </li>
  );
}

/** «Lo que queda pendiente»: la deuda viva, o la constancia si no queda nada (lineas 613-640 y 1349-1371). */
function LoQueQuedaPendiente() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const lista = pendientes(estado);
  const { total } = cuentaPendiente(estado);
  const hay = lista.length > 0;

  return (
    <Seccion
      className="mb-[18px]"
      cabecera={(idDelTitulo) => (
        <div className="flex flex-wrap items-center gap-3 border-b border-linea-2 px-5 py-[14px]">
          <h2 id={idDelTitulo} className="m-0 min-w-[180px] flex-1 text-[17px] font-bold">
            {t('Lo que queda pendiente')}
          </h2>
          <span data-total-pendiente="" className="text-[15px] font-bold text-mal-tinta tabular-nums">
            {hay ? formatearImporte(total) : t('Sin deuda pendiente')}
          </span>
        </div>
      )}
    >
      <ul className="m-0 list-none p-0">
        {hay ? (
          lista.map((deuda) => (
            <FilaPendiente
              key={deuda.id}
              concepto={deuda.concepto}
              // Con plataforma el contrato no trae vencimiento ni estado (issue 26), y no se deducen:
              // en su sitio va la unidad, que si viene, y la insignia no se dibuja.
              vence={deuda.vence ?? t(deuda.unidad)}
              insignia={
                deuda.estado === null || deuda.tono === null ? null : (
                  <Insignia tono={deuda.tono}>{deuda.estado}</Insignia>
                )
              }
              monto={formatearImporte(totalDe(deuda))}
            />
          ))
        ) : (
          <FilaPendiente
            concepto={t('No le queda nada pendiente')}
            vence={t('Puede pedir su constancia de no adeudo')}
            insignia={<Insignia tono="ok">{t('Al día')}</Insignia>}
            monto={formatearImporte(total)}
          />
        )}
      </ul>
      {hay ? (
        <div className="flex flex-wrap items-center gap-3 bg-sup px-5 py-4">
          <p className="m-0 min-w-[180px] flex-1 text-[13.5px] text-pretty text-tinta-3">
            {t('Puede pagar todo o elegir solo algunos conceptos.')}
          </p>
          <Boton
            type="button"
            variante="primario"
            onClick={() => despachar({ tipo: 'irA', paso: 'deudas' })}
            className="min-h-[46px] px-6 py-0 text-[15.5px]"
          >
            {t('Pagar lo pendiente')}
          </Boton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 bg-ok-fondo/40 px-5 py-4">
          <p className="m-0 min-w-[180px] flex-1 text-[13.5px] text-pretty text-ok-tinta">
            {t('No le queda nada pendiente. Puede pedir su constancia de no adeudo, que acredita que está al día.')}
          </p>
          <Boton
            type="button"
            onClick={() => avisar(t('Se emitiría su constancia de no adeudo al día de hoy.'))}
            className="min-h-[46px] border-ok-tinta px-[22px] py-0 text-[15.5px] font-bold text-ok-tinta hover:border-ok-tinta hover:bg-ok-fondo"
          >
            {t('Pedir mi constancia')}
          </Boton>
        </div>
      )}
    </Seccion>
  );
}

/**
 * **«Lo que queda pendiente» con plataforma: lo que dijo la CONSULTA, y nada que no dijera** (issue 49).
 *
 * Hasta el issue 49 esta seccion leia la deuda viva del recorrido, que con plataforma solo existia
 * despues de pasar por el paso 2 (alli la copiaba `situacionLeida`). Entrando directo a `#/historial`
 * la lista estaba vacia y la pantalla decia **«Sin deuda pendiente»**, **«Al día»** y ofrecia la
 * constancia de no adeudo a una persona que debia S/ 1,842.60 (medido: la sonda del issue). Y lo
 * mismo con «no se pudo consultar», que es la respuesta real de hoy: un cero de consuelo.
 *
 * Aqui se pregunta a la consulta, y cada final dice lo suyo:
 *
 *   · **con deuda**: los conceptos del servidor y el total que sumo el servidor, tal cual;
 *   · **no se pudo consultar**, o la consulta **no contesto**: que no se pudo, sin cifra, y reintentar;
 *   · **sin registros**: que no figura nada a su nombre;
 *   · **sin deuda**: que no tiene deuda pendiente, que es lo que el servidor dijo. Sin «Al día» ni
 *     constancia: el portal no emite ninguna.
 *
 * Desde el issue 50 esa copia ya no existe —el recorrido lee la misma cache—, pero la seccion sigue
 * preguntando a la consulta y no a la deuda viva: es la que distingue «no contesto» de «sin deuda».
 */
function LoQueQuedaPendienteConPlataforma() {
  const { t } = useTranslation();
  const { despachar } = useRecorrido();
  const consulta = useLaSituacion();
  const situacion = consulta.data;
  const alReintentar = () => void consulta.refetch();

  let cifra: string;
  let dicho: string | null = null;
  let reintentar = false;
  if (consulta.isPending) {
    cifra = t('Consultando…');
  } else if (situacion === undefined) {
    cifra = t('Sin total');
    dicho = t('No pudimos consultar su deuda. Vuelva a intentarlo en unos minutos.');
    reintentar = true;
  } else if (situacion.estado === 'con-deuda') {
    cifra = situacion.totalConsolidado === null ? '' : formatearImporte(situacion.totalConsolidado.importe);
  } else if (situacion.estado === 'no-se-pudo-consultar') {
    cifra = t('Sin total');
    dicho = t('No pudimos consultar toda su deuda, así que no le mostramos ningún total.');
    reintentar = true;
  } else if (situacion.estado === 'sin-registros') {
    cifra = t('Sin registros');
    dicho = t('No encontramos deuda a su nombre en las municipalidades del sistema.');
  } else {
    cifra = t('Nada pendiente');
    dicho = t('Según la consulta de hoy, no tiene deuda pendiente en las municipalidades del sistema.');
  }
  const deudas = situacion?.estado === 'con-deuda' ? situacion.deudas : [];

  return (
    <Seccion
      ocupada={consulta.isPending}
      className="mb-[18px]"
      cabecera={(idDelTitulo) => (
        <div className="flex flex-wrap items-center gap-3 border-b border-linea-2 px-5 py-[14px]">
          <h2 id={idDelTitulo} className="m-0 min-w-[180px] flex-1 text-[17px] font-bold">
            {t('Lo que queda pendiente')}
          </h2>
          <span data-total-pendiente="" className="text-[15px] font-bold text-mal-tinta tabular-nums">
            {cifra}
          </span>
        </div>
      )}
    >
      {deudas.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {deudas.map((deuda) => (
            <FilaPendiente
              key={deuda.id}
              concepto={deuda.concepto}
              // El contrato no trae vencimiento ni estado (issue 26): va la unidad, y sin insignia.
              vence={t(deuda.unidad)}
              insignia={null}
              monto={formatearImporte(totalDe(deuda))}
            />
          ))}
        </ul>
      ) : null}
      {dicho === null ? null : (
        <p className="m-0 border-b border-linea-2 px-5 py-[13px] text-[14.5px] text-pretty">{dicho}</p>
      )}
      {deudas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 bg-sup px-5 py-4">
          <p className="m-0 min-w-[180px] flex-1 text-[13.5px] text-pretty text-tinta-3">
            {t('Puede pagar todo o elegir solo algunos conceptos.')}
          </p>
          <Boton
            type="button"
            variante="primario"
            onClick={() => despachar({ tipo: 'irA', paso: 'deudas' })}
            className="min-h-[46px] px-6 py-0 text-[15.5px]"
          >
            {t('Pagar lo pendiente')}
          </Boton>
        </div>
      ) : null}
      {reintentar ? (
        <div className="bg-sup px-5 py-4">
          <Boton type="button" onClick={alReintentar} className="min-h-[44px] px-5 py-0 text-[14.5px]">
            {t('Reintentar la consulta')}
          </Boton>
        </div>
      ) : null}
    </Seccion>
  );
}

/** Un predio o vehiculo, con los datos sobre los que se calcula su tributo (lineas 649-666). */
function UnaUnidad({ unidad }: { readonly unidad: Unidad }) {
  const { t } = useTranslation();
  return (
    <li className="border-b border-linea-2 px-5 py-[15px]">
      <div className="flex flex-wrap items-start gap-[14px]">
        <span className="min-w-[200px] flex-1">
          <span className="block text-[15.5px] font-bold text-pretty">{t(unidad.titulo)}</span>
          <span className="mt-[3px] block text-[13.5px] text-pretty text-tinta-3">{t(unidad.detalle)}</span>
        </span>
        <span className="flex-[0_0_auto] text-right">
          <span className="block text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{t(unidad.baseEtiqueta)}</span>
          <span className="mt-[2px] block text-[16px] font-bold tabular-nums">{formatearImporte(unidad.base)}</span>
        </span>
      </div>
      <ul className="m-0 mt-[11px] flex list-none flex-wrap gap-[9px] p-0">
        {unidad.datos.map((dato) => (
          <li
            key={dato}
            className="rounded-sm border border-azul-suave bg-info-fondo px-[9px] py-1 text-[12.5px] text-tinta-2"
          >
            {t(dato)}
          </li>
        ))}
      </ul>
      <p className="mt-[11px] mb-0 text-[13px] text-pretty text-tinta-3">{t(unidad.origen)}</p>
    </li>
  );
}

/**
 * Un predio **del servidor**: lo que el contrato publica de el, y nada mas (issue 28).
 *
 * El contrato trae tipo, direccion, codigo catastral y porcentaje de titularidad; **no trae el
 * autovaluo, ni los metros de frontis, ni el arancel de la calle**, que es lo que el artboard pinta
 * como «Autovalúo 2026 · S/ 38,420.50». Asi que aqui no hay cifra: dibujar un importe donde el
 * servidor no dio ninguno es exactamente lo que este portal no hace.
 *
 * Y **no hay vehiculos**: el contrato no publica la lista. Lo dice la nota de la seccion, en vez de
 * dejar pensar que no tiene ninguno.
 */
function UnPredioDelServidor({ predio, municipalidad }: { readonly predio: PredioDelPortal; readonly municipalidad: string }) {
  const { t } = useTranslation();
  return (
    <li className="border-b border-linea-2 px-5 py-[15px]">
      <div className="flex flex-wrap items-start gap-[14px]">
        <span className="min-w-[200px] flex-1">
          <span className="block text-[15.5px] font-bold text-pretty">{predio.tipo}</span>
          <span className="mt-[3px] block text-[13.5px] text-pretty text-tinta-3">{predio.direccion}</span>
        </span>
      </div>
      <ul className="m-0 mt-[11px] flex list-none flex-wrap gap-[9px] p-0">
        <li className="rounded-sm border border-azul-suave bg-info-fondo px-[9px] py-1 text-[12.5px] text-tinta-2">
          {t('Código catastral {{codigo}}', { codigo: predio.codigoCatastral })}
        </li>
        <li className="rounded-sm border border-azul-suave bg-info-fondo px-[9px] py-1 text-[12.5px] text-tinta-2">
          {t('{{porcentaje}} % de titularidad', { porcentaje: predio.porcentajeDeTitularidad })}
        </li>
      </ul>
      <p className="mt-[11px] mb-0 text-[13px] text-pretty text-tinta-3">{municipalidad}</p>
    </li>
  );
}

/** «De dónde sale lo que paga» con plataforma: los predios que devolvio la consulta. */
function DeDondeSaleConPlataforma() {
  const { t } = useTranslation();
  const consulta = useLaSituacion();
  const predios = (consulta.data?.municipalidades ?? []).flatMap((municipalidad) =>
    municipalidad.predios.map((predio) => ({ predio, municipalidad: municipalidad.nombre })),
  );

  return (
    <Seccion
      ocupada={consulta.isPending}
      cabecera={(idDelTitulo) => (
        <div className="border-b border-linea-2 px-5 py-[14px]">
          <h2 id={idDelTitulo} className="m-0 scroll-mt-4 text-[17px] font-bold">
            {t('De dónde sale lo que paga')}
          </h2>
          <p className="mt-[5px] mb-0 max-w-[72ch] text-[14px] leading-[1.55] text-pretty text-tinta-3">
            {t(
              'Los predios que el portal publica a su nombre. El autovalúo, los metros de frontis y la tabla que se le aplica no viajan en la respuesta: se los detallan en la ventanilla.',
            )}
          </p>
        </div>
      )}
    >
      <ul className="m-0 list-none p-0">
        {predios.map(({ predio, municipalidad }) => (
          <UnPredioDelServidor key={predio.codigoCatastral} predio={predio} municipalidad={municipalidad} />
        ))}
      </ul>
      <p className="m-0 bg-sup px-5 py-[13px] text-[13.5px] leading-[1.55] text-pretty text-tinta-3">
        {t('El portal todavía no publica sus vehículos: aquí solo están los predios.')}
      </p>
    </Seccion>
  );
}

/** «De dónde sale lo que paga»: las unidades del contribuyente (lineas 642-669 y 1372-1375). */
function DeDondeSale({ enfocar, alEnfocar }: { readonly enfocar: boolean; readonly alEnfocar: () => void }) {
  const { t } = useTranslation();
  const unidades = useUnidades();
  const historial = useHistorial();
  const titulo = useRef<HTMLHeadingElement>(null);

  // «Mis predios y vehículos»: foco y vista en esta seccion, UNA vez, y cuando lo de arriba ya llego
  // (con la tabla de pagos aun vacia, la seccion estaria mas arriba de donde se va a quedar).
  const listo = !unidades.isPending && !historial.isPending;
  useEffect(() => {
    if (!enfocar || !listo || titulo.current === null) return;
    titulo.current.focus({ preventScroll: true });
    titulo.current.scrollIntoView({ block: 'start' });
    alEnfocar();
  }, [enfocar, listo, alEnfocar]);

  return (
    <Seccion
      ocupada={unidades.isPending}
      cabecera={(idDelTitulo) => (
        <div className="border-b border-linea-2 px-5 py-[14px]">
          <h2
            id={idDelTitulo}
            ref={titulo}
            tabIndex={-1}
            className="m-0 scroll-mt-4 text-[17px] font-bold focus:outline-none"
          >
            {t('De dónde sale lo que paga')}
          </h2>
          <p className="mt-[5px] mb-0 max-w-[72ch] text-[14px] leading-[1.55] text-pretty text-tinta-3">
            {t(
              'Sus predios y vehículos, con los datos sobre los que se calcula cada tributo. Si algo no coincide con la realidad, puede pedir que se rectifique.',
            )}
          </p>
        </div>
      )}
    >
      {unidades.isError ? (
        <AvisoConFilo tono="mal" role="alert" className="m-5 px-4 py-3">
          {t('No pudimos traer sus predios y vehículos. Vuelva a intentarlo en unos minutos.')}
        </AvisoConFilo>
      ) : null}
      <ul className="m-0 list-none p-0">
        {(unidades.data ?? []).map((unidad) => (
          <UnaUnidad key={unidad.titulo} unidad={unidad} />
        ))}
      </ul>
      <p className="m-0 bg-sup px-5 py-[13px] text-[13.5px] leading-[1.55] text-pretty text-tinta-3">
        {t(
          'El autovalúo lo determina Catastro con el arancel de su calle y los valores unitarios del año; la deuda y las cuotas las lleva Rentas; los pagos se registran en Caja.',
        )}
      </p>
    </Seccion>
  );
}

export function Historial() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const pago = estado.recienPagado ? estado.ultimo : null;
  // Estable entre dibujos: si cambiara, el efecto de `DeDondeSale` volveria a correr sin motivo.
  const alEnfocar = useCallback(() => despachar({ tipo: 'unidadesEnfocadas' }), [despachar]);

  return (
    <div>
      <h1 className="mt-0 mb-[6px] text-[24px] font-bold text-azul">{t('Mis pagos')}</h1>
      <p className="mt-0 mb-[18px] max-w-[68ch] text-[15.5px] leading-[1.6] text-pretty text-tinta-2">
        {/*
          Con plataforma no hay «todos sus pagos» ni comprobantes: el backend no publica ninguno
          (issue 49). Se dice lo que la pantalla ensena de verdad.
        */}
        {estado.conPlataforma
          ? t('Lo que le queda pendiente, según la consulta de hoy, y los predios a su nombre. El portal todavía no publica sus pagos.')
          : t('Todos sus pagos, con sus comprobantes. Abajo está lo que le queda pendiente.')}
      </p>

      {pago === null ? null : <PagoReciente pago={pago} />}
      <PagosRealizados />
      {estado.conPlataforma ? <LoQueQuedaPendienteConPlataforma /> : <LoQueQuedaPendiente />}
      {/*
        Con plataforma las unidades salen de la CONSULTA y no de `useUnidades`, que el backend no
        publica. El foco de «Mis predios y vehículos» es del recorrido de la demostracion: con
        plataforma el menu lleva a esta misma pantalla y la seccion es la de abajo del todo.
      */}
      {estado.conPlataforma ? (
        <DeDondeSaleConPlataforma />
      ) : (
        <DeDondeSale enfocar={estado.enfocarUnidades} alEnfocar={alEnfocar} />
      )}
    </div>
  );
}
