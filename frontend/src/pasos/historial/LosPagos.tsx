import {
  Boton,
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
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { useHistorial } from '../../datos/fuente.ts';
import { useModo } from '../../modo/useModo.ts';
import { AvisoConFilo } from '../../piezas/AvisoConFilo.tsx';
import { bandaConFilo, botonConContorno } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import type { PagoSellado } from '../../recorrido/recorrido.ts';
import { Seccion } from './piezas.tsx';
import { filasDePagos, pagoReciente } from './vista.ts';

/**
 * **Los pagos**: el de esta visita, en su banda, y la tabla de los realizados. Lo que dicen lo
 * prepara `vista.ts` (`pagoReciente`, `filasDePagos`).
 *
 * · **`Tabla`** y compania para «Pagos realizados», con el `min-width: 760px` del artboard: se
 *   desplaza dentro de su marco, no la pagina. Los rotulos, la cabecera del producto (como en los
 *   pasos 2 y 5). La nota del pie es `TablaNota` con la letra y el relleno del artboard.
 * · El boton «Comprobante» de cada fila se llama «Comprobante <numero>»: seis botones con el mismo
 *   nombre no se distinguen con un lector de pantalla. El nombre empieza por lo que se ve.
 */

/** Las celdas de la tabla de pagos: `TD` y `TDN` del artboard (lineas 722-723), 18 px de lado y 14 px de letra. */
const CELDA = 'px-[18px] text-[14px]';

/**
 * El pago de esta visita, arriba y en verde (lineas 573-581 y 1330-1335). El titulo es un `h2` y la
 * banda una region con su nombre; en el artboard, un `span`. **Con el pago simulado** se dice lo que
 * es —una simulacion— y se quita el verde, que es el color de un pago hecho.
 */
export function PagoReciente({ pago }: { readonly pago: PagoSellado }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelTitulo = useId();
  const dicho = pagoReciente(estado, pago, t);
  const { simulado } = dicho;

  return (
    <section
      aria-labelledby={idDelTitulo}
      className={cn(
        bandaConFilo({ tono: simulado ? 'neutro' : 'ok' }),
        'mb-[18px] flex flex-wrap items-center gap-[14px] px-[18px] py-4',
      )}
    >
      <span className="min-w-[200px] flex-1">
        <h2 id={idDelTitulo} className={cn('m-0 text-[15px] font-bold', simulado ? null : 'text-ok-tinta')}>
          {dicho.titulo}
        </h2>
        <span className={cn('mt-[3px] block text-[13.5px] text-pretty', simulado ? 'text-tinta-3' : 'text-ok-tinta')}>
          {dicho.detalle}
        </span>
      </span>
      <Boton
        type="button"
        onClick={() => despachar({ tipo: 'verElComprobante' })}
        className={cn(
          'min-h-[40px] flex-[0_0_auto] px-4 py-0 text-[14px] font-bold',
          simulado ? null : botonConContorno({ tono: 'ok' }),
        )}
      >
        {dicho.boton}
      </Boton>
    </section>
  );
}

/** «Pagos realizados»: el reciente, si lo hay, y los del historial (lineas 583-611 y 1337-1348). */
export function PagosRealizados() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const historial = useHistorial();
  const { publicaLosPagos } = useModo().contenido;
  const filas = filasDePagos(estado, historial.data, t);

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
        Sin pagos publicados el fallo NO es una averia: el backend no publica pagos del ciudadano —lo
        unico que ofrece para este portal es `GET /portal/situacion`— y decir «vuelva a intentarlo»
        mandaria a insistir contra algo que no existe (issue 28).
      */}
      {historial.isError ? (
        publicaLosPagos ? (
          <AvisoConFilo tono="mal" role="alert" className="m-5 px-4 py-3">
            {t('No pudimos traer sus pagos. Vuelva a intentarlo en unos minutos.')}
          </AvisoConFilo>
        ) : (
          <AvisoConFilo tono="atencion" className="m-5 px-4 py-3">
            {t(
              'El portal todavía no publica su historial de pagos: por ahora solo sabe lo que debe hoy. Los pagos anteriores están en la ventanilla de la municipalidad, con su comprobante.',
            )}
          </AvisoConFilo>
        )
      ) : null}
      {/* El marco desplaza la tabla por debajo de 760 px (issue 62). Con plataforma no hay pagos, y sin un
          boton dentro el teclado no llegaba a desplazarlo (axe, `scrollable-region-focusable`): entra en
          el tabulador como region con nombre, distinto del de la seccion. */}
      <Tabla
        className="min-w-[760px]"
        marco={{ tabIndex: 0, role: 'region', 'aria-label': t('Tabla de los pagos realizados') }}
      >
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
