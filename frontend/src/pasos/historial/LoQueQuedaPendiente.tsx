import { Boton, avisar, cn } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import { useLaSituacion } from '../../datos/fuente.ts';
import { Reintentar } from '../../piezas/Reintentar.tsx';
import { botonConContorno } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { CabeceraDeLoPendiente, FilasPendientes, PieParaPagar, Seccion } from './piezas.tsx';
import { loPendiente, loQueDiceLaConsulta } from './vista.ts';

/**
 * **«Lo que queda pendiente»**, en los dos modos (artboard, lineas 613-640 y 1349-1371). Lo que dice
 * cada uno lo prepara `vista.ts` (`loPendiente`, `loQueDiceLaConsulta`); las piezas son las mismas.
 */

/** La deuda viva del recorrido, o la constancia si no queda nada. */
export function LoQueQuedaPendiente() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const lo = loPendiente(estado, t);

  return (
    <Seccion
      className="mb-[18px]"
      cabecera={(idDelTitulo) => <CabeceraDeLoPendiente idDelTitulo={idDelTitulo} cifra={lo.cifra} />}
    >
      <FilasPendientes filas={lo.filas} />
      {lo.hay ? (
        <PieParaPagar />
      ) : (
        <div className="flex flex-wrap items-center gap-3 bg-ok-fondo/40 px-5 py-4">
          <p className="m-0 min-w-[180px] flex-1 text-[13.5px] text-pretty text-ok-tinta">
            {t('No le queda nada pendiente. Puede pedir su constancia de no adeudo, que acredita que está al día.')}
          </p>
          <Boton
            type="button"
            onClick={() => avisar(t('Se emitiría su constancia de no adeudo al día de hoy.'))}
            className={cn(botonConContorno({ tono: 'ok' }), 'min-h-[46px] px-[22px] py-0 text-[15.5px]')}
          >
            {t('Pedir mi constancia')}
          </Boton>
        </div>
      )}
    </Seccion>
  );
}

/**
 * **Con la deuda que se consulta: lo que dijo la CONSULTA, y nada que no dijera** (issue 49).
 *
 * Hasta el issue 49 esta seccion leia la deuda viva del recorrido, que con plataforma solo existia
 * despues de pasar por el paso 2 (alli la copiaba `situacionLeida`). Entrando directo a `#/historial`
 * la lista estaba vacia y la pantalla decia **«Sin deuda pendiente»**, **«Al día»** y ofrecia la
 * constancia de no adeudo a una persona que debia S/ 1,842.60 (medido: la sonda del issue). Y lo
 * mismo con «no se pudo consultar», que es la respuesta medida contra la plataforma local: un cero de consuelo.
 *
 * Desde el issue 50 esa copia no existe —el recorrido lee la misma cache—, pero la seccion sigue
 * preguntando a la consulta y no a la deuda viva: es la que distingue «no contesto» de «sin deuda».
 */
export function LoQueQuedaPendienteDeLaConsulta() {
  const { t } = useTranslation();
  const consulta = useLaSituacion();
  const lo = loQueDiceLaConsulta({ pidiendo: consulta.isPending, situacion: consulta.data }, t);

  return (
    <Seccion
      ocupada={consulta.isPending}
      className="mb-[18px]"
      cabecera={(idDelTitulo) => <CabeceraDeLoPendiente idDelTitulo={idDelTitulo} cifra={lo.cifra} />}
    >
      {lo.filas.length > 0 ? <FilasPendientes filas={lo.filas} /> : null}
      {lo.dicho === null ? null : (
        <p className="m-0 border-b border-linea-2 px-5 py-[13px] text-[14.5px] text-pretty">{lo.dicho}</p>
      )}
      {lo.filas.length > 0 ? <PieParaPagar /> : null}
      {lo.reintentar ? (
        <div className="bg-sup px-5 py-4">
          <Reintentar alReintentar={() => void consulta.refetch()} />
        </div>
      ) : null}
    </Seccion>
  );
}
